import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Production builds write somewhere else entirely, so running `npm run build`
  // while `npm run dev` is up cannot pull .next out from under the dev server.
  // That failure looks like "__webpack_modules__[moduleId] is not a function"
  // in the browser and is thoroughly confusing when it happens.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // There is an unrelated package-lock.json in the user's home directory, which
  // makes Next infer ~ as the workspace root and trace far more of the disk than
  // it should. Pin the root to this app.
  outputFileTracingRoot: path.join(import.meta.dirname, "."),
  serverExternalPackages: ["better-sqlite3"],
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
