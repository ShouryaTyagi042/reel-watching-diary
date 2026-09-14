# syntax=docker/dockerfile:1

# The diary is a Node server with a SQLite file next to it, so the image carries
# both. Phase one is read only: no admin credentials are set, so nothing can be
# written and the database in the image is the whole of the site's state.
#
# Updating the diary means building a new image. That is the trade for having no
# volume and no upload path to protect.

# ---------------------------------------------------------------- base ------
# Pinned to a major that matches package.json engines. better-sqlite3 is a
# native module: it is compiled here, for linux, and the binary the host built
# for macOS is deliberately left out by .dockerignore.
FROM node:20-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------ install -------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# -------------------------------------------------------------- build -------
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Fails the build if the diary or its artwork did not make it into the context.
# They are not in git, so this is the only thing standing between a typo in
# .dockerignore and a deployed site with no films in it.
RUN npx tsx scripts/check-shippable.ts

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ------------------------------------------------------------- runtime ------
# No toolchain here. The compiled better-sqlite3 binary comes across inside the
# traced node_modules, built against this same image.
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN useradd --system --create-home --uid 1001 reel

# `npm run build` writes to .next-prod, not .next, so that building never pulls
# the directory out from under a running dev server.
COPY --from=build --chown=reel:reel /app/.next-prod/standalone ./
COPY --from=build --chown=reel:reel /app/.next-prod/static ./.next-prod/static
COPY --from=build --chown=reel:reel /app/public ./public
COPY --from=build --chown=reel:reel /app/data ./data

# SQLite opens the file read-write and puts its -wal and -shm alongside it, so
# the directory has to belong to the user the server runs as even though the
# site never writes anything.
USER reel

EXPOSE 8080
CMD ["node", "server.js"]
