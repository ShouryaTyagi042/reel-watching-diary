# Putting the diary online

Phase one is **read only**. No admin credentials are set on the server, so
nothing can be added or edited there and the database inside the image is the
whole of the site's state. Adding a film means building a new image.

## Why it is shaped this way

The diary and its artwork are not in the repository. `.gitignore` excludes
`data/*.db`, `public/posters`, `public/people` and `public/shots` because the
repository is public, and a film diary with the coordinates of the cinemas you
sat in is not something to publish on GitHub.

That has one consequence worth understanding before choosing a host: **anything
that builds from GitHub deploys an empty site.** Render and Railway, pointed at
the repository, would produce a working application with no films in it. Fly
sends the contents of this directory to the builder, so the diary travels with
it. That is the reason for the choice, not price.

`scripts/check-shippable.ts` runs inside the build and fails if the diary or its
artwork is missing, so an empty deploy cannot happen quietly.

## First deploy

```sh
brew install flyctl          # or: curl -L https://fly.io/install.sh | sh
fly auth signup              # or: fly auth login

fly launch --no-deploy       # keep the existing fly.toml when it asks
fly deploy
```

`fly launch` will want to change `app` in `fly.toml` if the name is taken; that
is the only line worth editing. Do not let it add a volume or a database.

## Afterwards

```sh
fly open          # open the site
fly logs          # follow the server
fly status        # what is running, and where
```

To publish a change, including a new film: make it locally, then `fly deploy`.
The database goes with the image.

## Keeping it read only

Nothing needs to be switched off. The site refuses writes because
`ADMIN_PASSWORD_HASH` and `SESSION_SECRET` are simply not set on the server:
sessions cannot be signed, so no one can hold one, and every mutating route
answers 401. Verified before the first deploy: every page 200, writes 401, login
refused, no coordinates anywhere in the markup.

**Do not set those two secrets on Fly** unless you intend to open editing, which
is phase two and needs a volume first — see the README's note on uploads.

## Checking a build before sending it

```sh
npm run build
npm run start:standalone     # runs the same layout the container runs
```

`npm run start` also works but warns: with `output: "standalone"` the real entry
point is `server.js`, not `next start`, and `start:standalone` assembles the
static files exactly as the Dockerfile does.

## What is not solved yet

Uploads. A poster or photograph added through a deployed site would be written
into `public/`, which Next reads once at startup, so it would 404 until a
restart and disappear on the next deploy — while the database row kept pointing
at it. Phase one avoids this entirely by making the site read only. Phase two
needs the assets on a mounted volume and served through a route handler, and
`sharp` promoted to a real dependency so photographs keep being stripped of
their GPS.
