import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
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
