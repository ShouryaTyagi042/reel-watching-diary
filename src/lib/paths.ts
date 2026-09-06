import path from "node:path";
import { thumbnailStem } from "./thumbnail-name";

/**
 * Where the user's source assets live.
 *
 * The app reads the Notion export and the curated thumbnails from folders that
 * sit alongside it — the same ones the importer uses. Thumbnails added through
 * the UI are written back into `Movies Thumbnails/` so a later `npm run import`
 * picks them up exactly as if they had always been there.
 *
 * Override with ASSETS_DIR / EXPORT_DIR if your folders live elsewhere.
 */
export const ASSETS_DIR = path.resolve(process.cwd(), process.env.ASSETS_DIR ?? "../src");
export const EXPORT_DIR = path.resolve(process.cwd(), process.env.EXPORT_DIR ?? "../d");
export const THUMBS_DIR = path.join(ASSETS_DIR, "Movies Thumbnails");
export const PUBLIC_DIR = path.join(process.cwd(), "public");


/** Filename stem for a title, e.g. "Mirzapur The Movie" -> "mirzapur_the_movie". */
export const thumbnailBaseName = thumbnailStem;

/** Image types accepted for an uploaded thumbnail. */
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
};

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
