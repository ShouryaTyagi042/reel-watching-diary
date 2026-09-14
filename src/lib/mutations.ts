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
import { resolveVenue, recentreVenue, pruneEmptyVenues, createNamedVenue } from "./venues";
import { slugify } from "./import-format";
import { and, ne } from "drizzle-orm";

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

  // The served copy is re-encoded without metadata. Hiding coordinates from the
  // page is not enough on its own: the GPS is inside the file, and anyone who
  // opens the image gets it. The original keeps its EXIF, untouched, in your
  // assets folder.
  const webName = await publishStripped(abs, `${movie.id.slice(0, 8)}-${shotId.slice(0, 6)}`);

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

/**
 * Copy an image into /public with its metadata removed.
 *
 * sharp drops EXIF unless told to keep it, so a plain re-encode is the whole
 * job. Falls back to a straight copy if the image cannot be decoded, and says
 * so, rather than losing the photo over a metadata concern.
 */
async function publishStripped(source: string, baseName: string): Promise<string> {
  const dir = path.join(PUBLIC_DIR, "shots");
  fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(source).toLowerCase();
  const dest = path.join(dir, `${baseName}${ext === ".png" ? ".png" : ".jpg"}`);

  try {
    const sharp = (await import("sharp")).default;
    // rotate() bakes the orientation in before the EXIF that described it goes.
    const pipeline = sharp(source).rotate();
    if (ext === ".png") await pipeline.png().toFile(dest);
    else await pipeline.jpeg({ quality: 86 }).toFile(dest);
    return path.basename(dest);
  } catch (e) {
    console.warn(`Could not re-encode ${path.basename(source)}, copying as-is:`, e);
    return copyAsset(source, dir, baseName);
  }
}

/* ------------------------------------------------------------ visit venue */

/**
 * Say which cinema an entry was watched at.
 *
 * Three shapes: point the visit at a cinema already on record, name a new one,
 * or detach it. Detaching leaves the visit in place with an unknown venue,
 * which is the honest state rather than deleting the fact that you went out.
 *
 * Only meaningful for an entry marked as watched in a cinema. Rather than
 * refuse, this marks it as one: asking for the cinema is a clear statement that
 * you were in one.
 */
export function setVisitVenue(
  movieSlug: string,
  choice: { venueId?: string | null; name?: string },
) {
  const movie = db.select().from(s.movies).where(eq(s.movies.slug, movieSlug)).get();
  if (!movie) throw new ValidationError("No entry with that address.");

  let venueId: string | null = null;
  let created = false;
  let label = "";

  // A name of nothing but spaces is a mistake, not a request to detach. Detaching
  // is `venueId: null`, which is explicit.
  if (choice.name !== undefined && !choice.name.trim()) {
    throw new ValidationError("A cinema needs a name.");
  }

  if (choice.name?.trim()) {
    if (choice.name.trim().length > 120) {
      throw new ValidationError("That name is too long (120 characters max).");
    }
    const venue = createNamedVenue(db, choice.name);
    venueId = venue.id;
    created = venue.created;
    label = venue.name ?? venue.label;
  } else if (choice.venueId) {
    const venue = db.select().from(s.venues).where(eq(s.venues.id, choice.venueId)).get();
    if (!venue) throw new ValidationError("No cinema with that id.");
    venueId = venue.id;
    label = venue.name ?? venue.label;
  }

  if (!movie.watchedInTheatre && venueId) {
    db.update(s.movies).set({ watchedInTheatre: true }).where(eq(s.movies.id, movie.id)).run();
  }

  const visitId = crypto.createHash("sha1").update(`visit:${movie.id}`).digest("hex").slice(0, 32);
  const existing = db.select().from(s.cinemaVisits).where(eq(s.cinemaVisits.movieId, movie.id)).get();

  if (existing) {
    db.update(s.cinemaVisits).set({ venueId }).where(eq(s.cinemaVisits.movieId, movie.id)).run();
  } else if (venueId || movie.watchedInTheatre) {
    db.insert(s.cinemaVisits).values({
      id: visitId,
      movieId: movie.id,
      venueId,
      visitedAt: movie.createdTime,
      visitedAtSource: "manual-entry",
    }).onConflictDoNothing().run();
  }

  // A cinema nothing points at any more is not a cinema.
  const pruned = pruneEmptyVenues(db);

  return { venueId, created, label: label || null, prunedEmptyVenues: pruned };
}

/* ----------------------------------------------------------- rename venue */

/**
 * Name a cinema.
 *
 * Lives here rather than in the route handler so that every write in the app
 * goes through one module. A route reaching into the database directly is a
 * route that can be forgotten when a rule changes, and this one was exactly
 * that for a while.
 */
/**
 * A slug that is free, or the same one this venue already holds.
 *
 * Two cinemas can genuinely share a name across cities, and the slug is the URL,
 * so a collision has to resolve rather than throw.
 */
function uniqueVenueSlug(base: string, selfId: string): string {
  const root = base || "cinema";
  for (let n = 0; ; n++) {
    const slug = n === 0 ? root : `${root}-${n + 1}`;
    const taken = db
      .select({ id: s.venues.id })
      .from(s.venues)
      .where(and(eq(s.venues.slug, slug), ne(s.venues.id, selfId)))
      .get();
    if (!taken) return slug;
  }
}

export function renameVenue(id: string, rawName: string | null) {
  const venue = db.select().from(s.venues).where(eq(s.venues.id, id)).get();
  if (!venue) throw new ValidationError("No cinema with that id.");

  const name = rawName === null ? null : rawName.trim().slice(0, 120) || null;

  // Naming a cinema has to rewrite its label and slug too. Both were derived
  // from GPS when the venue was created from a photo, so leaving them alone
  // publishes the position in the label and in the URL, whatever the page
  // chooses to render.
  const patch: { name: string | null; label?: string; slug?: string } = { name };
  if (name) {
    patch.label = name;
    patch.slug = uniqueVenueSlug(slugify(name), id);
  }

  db.update(s.venues).set(patch).where(eq(s.venues.id, id)).run();
  return { id, name, slug: patch.slug ?? venue.slug };
}
