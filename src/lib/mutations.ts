/**
 * Write layer. Everything that changes the database lives here, so the read
 * layer (`queries.ts`) and the importer stay free of mutation logic.
 *
 * Entries created here are marked `origin: "app"`. The importer treats those as
 * the user's own and never overwrites or removes them — an imported collection
 * remains the source of truth only for the records it actually contains.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import * as s from "@/db/schema";
import {
  createEntry as createEntryIn,
  updateEntry as updateEntryIn,
  ValidationError,
  type NewEntryInput,
  type EntryPatch,
  type EditableField,
} from "./entry";
import { copyAsset } from "./assets";
import crypto from "node:crypto";
import exifr from "exifr";
import {
  THUMBS_DIR, SHOTS_DIR, PUBLIC_DIR, ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, thumbnailBaseName,
} from "./paths";
import { resolveVenue, recentreVenue, pruneEmptyVenues } from "./venues";

export { ValidationError };
export type { NewEntryInput, EntryPatch, EditableField };

/** Create an entry using the app's database handle. */
export function createEntry(input: NewEntryInput) {
  return createEntryIn(db, input);
}

/** Edit an existing entry. Changed fields are marked so imports leave them alone. */
export function updateEntry(slug: string, patch: EntryPatch) {
  return updateEntryIn(db, slug, patch);
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

/* ------------------------------------------------------------ cinema pics */

export interface SavedShot {
  fileName: string;
  path: string;
  capturedAt: string | null;
  lat: number | null;
  lng: number | null;
  camera: string | null;
  venue: { name: string | null; label: string; slug: string; created: boolean; distanceM?: number } | null;
  /** Why no cinema was placed, when none was. */
  venueNote: string | null;
}

/**
 * Attach a photo taken during a screening.
 *
 * The photo's GPS is what places the cinema, so this is the one upload that can
 * change where an entry was watched. A venue is only attached when the entry is
 * actually marked as watched in a cinema: a geotagged photo on an entry that is
 * not is kept with its position recorded, and the reason is reported rather than
 * a visit being invented.
 */
export async function saveShot(movieSlug: string, file: File): Promise<SavedShot> {
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

  const bytes = Buffer.from(await file.arrayBuffer());

  // Read the position and time before the file is renamed, so nothing about the
  // original is needed afterwards.
  let capturedAt: string | null = null;
  let lat: number | null = null;
  let lng: number | null = null;
  let camera: string | null = null;
  try {
    const meta = await exifr.parse(bytes, { gps: true, tiff: true, exif: true });
    const when: Date | undefined = meta?.DateTimeOriginal ?? meta?.CreateDate ?? meta?.ModifyDate;
    if (when instanceof Date && !Number.isNaN(when.getTime())) capturedAt = when.toISOString();
    if (typeof meta?.latitude === "number") lat = meta.latitude;
    if (typeof meta?.longitude === "number") lng = meta.longitude;
    camera = [meta?.Make, meta?.Model].filter(Boolean).join(" ").trim() || null;
  } catch {
    // A photo without readable EXIF is still worth keeping.
  }

  const dir = path.join(SHOTS_DIR, movie.slug);
  fs.mkdirSync(dir, { recursive: true });

  // Named from the capture time where there is one, so the folder sorts by when
  // the photos were taken rather than when they happened to be uploaded.
  const stamp = (capturedAt ?? new Date().toISOString()).replace(/[-:]/g, "").replace(/\..*$/, "");
  let fileName = `${stamp}${ext}`;
  let n = 2;
  while (fs.existsSync(path.join(dir, fileName))) fileName = `${stamp}-${n++}${ext}`;
  const abs = path.join(dir, fileName);
  fs.writeFileSync(abs, bytes);

  const shotId = crypto.createHash("sha1").update(`shot:${movie.id}:${fileName}`).digest("hex").slice(0, 32);
  const position = db.select({ n: sql<number>`count(*)` }).from(s.movieShots)
    .where(eq(s.movieShots.movieId, movie.id)).get()?.n ?? 0;
  const webName = copyAsset(abs, path.join(PUBLIC_DIR, "shots"), `${movie.id.slice(0, 8)}-${shotId.slice(0, 6)}`);

  let venue: SavedShot["venue"] = null;
  let venueNote: string | null = null;
  let venueIdForShot: string | null = null;

  if (lat !== null && lng !== null) {
    if (movie.watchedInTheatre) {
      const r = resolveVenue(db, lat, lng);
      venueIdForShot = r.id;
      venue = { name: r.name, label: r.label, slug: r.slug, created: r.created, distanceM: r.distanceM };

      db.insert(s.cinemaVisits).values({
        id: crypto.createHash("sha1").update(`visit:${movie.id}`).digest("hex").slice(0, 32),
        movieId: movie.id,
        venueId: r.id,
        visitedAt: capturedAt ?? movie.createdTime,
        visitedAtSource: capturedAt ? "photo-exif" : "record-date",
      }).onConflictDoUpdate({
        target: s.cinemaVisits.movieId,
        set: { venueId: r.id, ...(capturedAt ? { visitedAt: capturedAt, visitedAtSource: "photo-exif" } : {}) },
      }).run();
    } else {
      venueNote =
        "This photo has a position, but the entry is not marked as watched in a cinema. " +
        "Tick that and upload again, or edit the entry, to place the cinema.";
    }
  } else {
    venueNote = "This photo carries no GPS, so it cannot help place the cinema.";
  }

  db.insert(s.movieShots).values({
    id: shotId,
    movieId: movie.id,
    path: `/shots/${webName}`,
    sourceName: fileName,
    capturedAt, lat, lng,
    cameraMake: camera, cameraModel: camera,
    venueId: venueIdForShot,
    position,
  }).onConflictDoUpdate({
    target: s.movieShots.id,
    set: { path: `/shots/${webName}`, capturedAt, lat, lng, cameraMake: camera, cameraModel: camera },
  }).run();

  if (venueIdForShot) recentreVenue(db, venueIdForShot);

  return { fileName, path: `/shots/${webName}`, capturedAt, lat, lng, camera, venue, venueNote };
}

/**
 * Remove a photo: its record, both copies of the file, and any cinema it was
 * the only evidence for.
 *
 * Both copies matter. Deleting only the row leaves the image stranded in
 * public/ and in the assets folder, where nothing references it and nothing
 * will ever clean it up.
 */
export function deleteShot(shotId: string) {
  const shot = db.select().from(s.movieShots).where(eq(s.movieShots.id, shotId)).get();
  if (!shot) throw new ValidationError("No photo with that id.");

  const movie = db.select({ slug: s.movies.slug }).from(s.movies)
    .where(eq(s.movies.id, shot.movieId)).get();

  for (const file of [
    path.join(PUBLIC_DIR, shot.path.replace(/^\//, "")),
    movie ? path.join(SHOTS_DIR, movie.slug, shot.sourceName) : null,
  ]) {
    if (file && fs.existsSync(file)) {
      try {
        fs.rmSync(file);
      } catch {
        // A file we cannot remove is not a reason to keep a dead record.
      }
    }
  }

  db.delete(s.movieShots).where(eq(s.movieShots.id, shotId)).run();

  if (shot.venueId) {
    const remaining = db.select({ id: s.movieShots.id }).from(s.movieShots)
      .where(eq(s.movieShots.venueId, shot.venueId)).all();
    if (!remaining.length) {
      db.update(s.cinemaVisits).set({ venueId: null })
        .where(eq(s.cinemaVisits.venueId, shot.venueId)).run();
      pruneEmptyVenues(db);
    } else {
      recentreVenue(db, shot.venueId);
    }
  }
  return { removed: shot.sourceName };
}
