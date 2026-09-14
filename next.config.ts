import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Production builds write somewhere else entirely, so running `npm run build`
  // while `npm run dev` is up cannot pull .next out from under the dev server.
  // That failure looks like "__webpack_modules__[moduleId] is not a function"
  // in the browser and is thoroughly confusing when it happens.
  /*
   * A self-contained server for the container: `.next/standalone` carries its
   * own node_modules, traced down to what the app actually imports, so the
   * image does not ship the whole dependency tree. better-sqlite3's compiled
   * binary is traced along with it.
   */
  output: "standalone",

  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // There is an unrelated package-lock.json in the user's home directory, which
  // makes Next infer ~ as the workspace root and trace far more of the disk than
  // it should. Pin the root to this app.
  outputFileTracingRoot: path.join(import.meta.dirname, "."),

  /*
   * What must never travel with the standalone build.
   *
   * Tracing from the app root sweeps up more than the server needs, and a build
   * here put `.env` — the admin password hash and the session signing secret —
   * inside `.next/standalone`, along with `.git` and 470MB of build caches. The
   * .dockerignore keeps them out of the image too; this is the second lock, for
   * anyone who copies the standalone directory somewhere by hand.
   */
  outputFileTracingExcludes: {
    "*": [
      ".env",
      ".env.*",
      ".git/**",
      ".next/**",
      ".next-prod/cache/**",
      ".agents/**",
      ".claude/**",
      "scripts/**",
      "**/*.tsbuildinfo",
      "**/.DS_Store",
    ],
  },
  serverExternalPackages: ["better-sqlite3"],
  // The dev-only badge defaults to the bottom left, which is now where the
  // phone's navigation bar lives. Move it out of the way.
  devIndicators: { position: "top-left" },

  experimental: {
    // Phosphor ships 3,024 icon modules behind one barrel export, and a bare
    // `import { X } from "@phosphor-icons/react"` drags all of them into the
    // compile. That was most of the 10,696 modules a cold route was building,
    // and most of the 12 seconds it took. This rewrites those imports to the
    // individual icons actually used.
    optimizePackageImports: ["@phosphor-icons/react", "motion"],
  },
  images: {
    // Posters copied out of the Notion export live in /public/posters.
    // Two records only have remote Notion cover URLs (no local asset shipped
    // in the export) — those hosts are allowlisted here.
    remotePatterns: [
      { protocol: "https", hostname: "resizing.flixster.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
};

export default nextConfig;
