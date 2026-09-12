/**
 * Write layer. Everything that changes the database lives here, so the read
 * layer (`queries.ts`) and the importer stay free of mutation logic.
 *
 * Entries created here are marked `origin: "app"`. The importer treats those as
 * the user's own and never overwrites or removes them — the Notion export
 * remains the source of truth only for the records it actually contains.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import { createEntry as createEntryIn, ValidationError, type NewEntryInput } from "./entry";
import { copyAsset } from "./assets";
import {
  THUMBS_DIR, PUBLIC_DIR, ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, thumbnailBaseName,
} from "./paths";

export { ValidationError };
export type { NewEntryInput };

/** Create an entry using the app's database handle. */
export function createEntry(input: NewEntryInput) {
  return createEntryIn(db, input);
}

/* --------------------------------------------------------- save thumbnail */

export interface SavedThumbnail {
  fileName: string;
  savedTo: string;
  posterPath: string;
  replaced: boolean;
}

/**
 * Save an uploaded thumbnail into the user's `Movies Thumbnails` folder using
 * the existing snake_case convention, then copy it into /public so the app can
 * render it immediately.
 *
 * Writing to the source folder is deliberate: it means the file is picked up by
 * the next `npm run import` through the normal slug match, exactly as if it had
 * been placed there by hand.
 */
export async function saveThumbnail(movieSlug: string, file: File): Promise<SavedThumbnail> {
  const movie = db.select().from(s.movies).where(eq(s.movies.slug, movieSlug)).get();
  if (!movie) throw new ValidationError("No entry with that address.");

  const ext = ALLOWED_IMAGE_TYPES[file.type];
  if (!ext) {
    throw new ValidationError(
      `That file is a ${file.type || "unknown type"}. Use a JPEG, PNG, WebP, AVIF or GIF.`,
    );
  }
  if (file.size === 0) throw new ValidationError("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ValidationError(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 8 MB.`);
  }

  // The name is derived from the title, never from the uploaded filename, so a
  // crafted name cannot escape the thumbnails folder.
  const base = thumbnailBaseName(movie.title);
  const fileName = `${base}${ext}`;
  const dest = path.join(THUMBS_DIR, fileName);
  if (path.dirname(path.resolve(dest)) !== path.resolve(THUMBS_DIR)) {
    throw new ValidationError("Refusing to write outside the thumbnails folder.");
  }

  fs.mkdirSync(THUMBS_DIR, { recursive: true });

  // Any other extension for the same title would shadow this one on re-import.
  const replaced = fs.existsSync(dest);
  for (const other of Object.values(ALLOWED_IMAGE_TYPES)) {
    const stale = path.join(THUMBS_DIR, `${base}${other}`);
    if (other !== ext && fs.existsSync(stale)) fs.rmSync(stale);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(dest, bytes);

  const publicName = copyAsset(dest, path.join(PUBLIC_DIR, "posters"), movie.slug);
  const posterPath = `/posters/${publicName}`;

  db.update(s.movies).set({
    posterPath,
    posterMatch: "uploaded",
    posterSource: fileName,
    coverKind: movie.coverKind ?? "local",
  }).where(eq(s.movies.id, movie.id)).run();

  return { fileName, savedTo: dest, posterPath, replaced };
}

/** Entries with no artwork — used to prompt for uploads. */
export function countMissingPosters(): number {
  return db
    .select({ n: sql<number>`count(*)` })
    .from(s.movies)
    .where(sql`${s.movies.posterPath} IS NULL AND ${s.movies.posterUrl} IS NULL`)
    .get()?.n ?? 0;
}
