/**
 * Creating a diary entry.
 *
 * Deliberately free of any server-only import and parameterised on a database
 * handle, so the same code path serves the app's API route and the command-line
 * importer. One implementation, so the two can never drift.
 */
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as s from "@/db/schema";
import { slugify } from "./import-format";

/** Any drizzle handle over the diary schema, from the app or from a script. */
export type DiaryDb = BetterSQLite3Database<typeof import("@/db/schema")>;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/* ------------------------------------------------------------------ shared */

/** Ids for app-created rows are prefixed so they can never look like a record id. */
const appId = () => `app_${crypto.randomBytes(12).toString("hex")}`;

/** Find a free slug, suffixing only if the natural one is taken. */
function uniqueSlug(db: DiaryDb, base: string): string {
  const root = slugify(base);
  const taken = (slug: string) =>
    !!db.select({ id: s.movies.id }).from(s.movies).where(eq(s.movies.slug, slug)).get();
  if (!taken(root)) return root;
  for (let i = 2; i < 500; i++) {
    const candidate = `${root}-${i}`;
    if (!taken(candidate)) return candidate;
  }
  return `${root}-${crypto.randomBytes(3).toString("hex")}`;
}

const synthId = (ns: string, key: string) =>
  crypto.createHash("sha1").update(`${ns}:${key}`).digest("hex").slice(0, 32);

/** Reuse an existing genre/person row by name, or create one. */
function ensureGenre(db: DiaryDb, name: string): string {
  const slug = slugify(name);
  const existing = db.select({ id: s.genres.id }).from(s.genres).where(eq(s.genres.slug, slug)).get();
  if (existing) return existing.id;
  const id = synthId("genre", slug);
  db.insert(s.genres).values({ id, name: name.trim(), slug }).onConflictDoNothing().run();
  return id;
}

function ensureActor(db: DiaryDb, name: string): string {
  const slug = slugify(name);
  const existing = db.select({ id: s.actors.id }).from(s.actors).where(eq(s.actors.slug, slug)).get();
  if (existing) return existing.id;
  const id = synthId("actor", slug);
  db.insert(s.actors).values({ id, name: name.trim(), slug }).onConflictDoNothing().run();
  return id;
}

function ensureDirector(db: DiaryDb, name: string): string {
  const slug = slugify(name);
  const existing = db.select({ id: s.directors.id }).from(s.directors).where(eq(s.directors.slug, slug)).get();
  if (existing) return existing.id;
  const id = synthId("director", slug);
  db.insert(s.directors).values({ id, name: name.trim(), slug }).onConflictDoNothing().run();
  return id;
}

/* ------------------------------------------------------------ create entry */

export interface NewEntryInput {
  title: string;
  year?: string | number | null;
  format?: string | null;
  status?: string | null;
  /** 0–5 in half steps. Stored both as the number and in the tracker's star notation. */
  rating?: string | number | null;
  seriesName?: string | null;
  watchedInTheatre?: boolean;
  watchedOn?: string | null;
  genres?: string[];
  cast?: string[];
  directors?: string[];
  notes?: string | null;
}

const FORMATS = ["Movie", "TV Show"];
const STATUSES = ["Watched", "Watching", "To Watch"];

/** Render a 0–5 number in the same star notation the diary uses. */
export function toStarString(value: number): string {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return "★".repeat(full) + (half ? "½" : "") + "✰".repeat(5 - full - (half ? 1 : 0));
}

export function createEntry(db: DiaryDb, input: NewEntryInput) {
  const title = (input.title ?? "").trim();
  if (!title) throw new ValidationError("A title is required.");
  if (title.length > 300) throw new ValidationError("That title is too long (300 characters max).");

  const format = input.format?.trim() || null;
  if (format && !FORMATS.includes(format)) {
    throw new ValidationError(`Format must be one of: ${FORMATS.join(", ")}.`);
  }
  const status = input.status?.trim() || "Watched";
  if (!STATUSES.includes(status)) {
    throw new ValidationError(`Status must be one of: ${STATUSES.join(", ")}.`);
  }

  let year: number | null = null;
  if (input.year !== undefined && input.year !== null && `${input.year}`.trim() !== "") {
    year = Number(input.year);
    if (!Number.isInteger(year) || year < 1870 || year > 2200) {
      throw new ValidationError("Year must be a whole number between 1870 and 2200.");
    }
  }

  let ratingValue: number | null = null;
  let ratingRaw: string | null = null;
  if (input.rating !== undefined && input.rating !== null && `${input.rating}`.trim() !== "") {
    ratingValue = Number(input.rating);
    if (!Number.isFinite(ratingValue) || ratingValue < 0 || ratingValue > 5 || (ratingValue * 2) % 1 !== 0) {
      throw new ValidationError("Rating must be between 0 and 5, in half-star steps.");
    }
    ratingRaw = toStarString(ratingValue);
  }

  let watchedOn: string | null = null;
  if (input.watchedOn?.trim()) {
    const d = new Date(input.watchedOn);
    if (Number.isNaN(d.getTime())) throw new ValidationError("That date could not be read.");
    watchedOn = d.toISOString();
  }

  const id = appId();
  const slug = uniqueSlug(db, title);

  db.insert(s.movies).values({
    id,
    titleRaw: title,
    title,
    slug,
    year,
    format: format ?? "Movie",
    status,
    seriesName: input.seriesName?.trim() || null,
    ratingRaw,
    ratingValue,
    watchedInTheatre: !!input.watchedInTheatre,
    createdTime: watchedOn ?? new Date().toISOString(),
    coverRaw: null,
    coverKind: null,
    posterPath: null,
    posterUrl: null,
    posterMatch: null,
    posterSource: null,
    sourcePath: null,
  }).run();

  for (const g of dedupe(input.genres)) {
    db.insert(s.movieGenres).values({ movieId: id, genreId: ensureGenre(db, g) }).onConflictDoNothing().run();
  }
  dedupeCast(input.cast).forEach((entry, i) => {
    db.insert(s.movieActors)
      .values({ movieId: id, actorId: ensureActor(db, entry.name), position: i, role: entry.role })
      .onConflictDoNothing().run();
  });
  for (const d of dedupe(input.directors)) {
    db.insert(s.movieDirectors).values({ movieId: id, directorId: ensureDirector(db, d) })
      .onConflictDoNothing().run();
  }

  // A cinema outing with no geotagged photo behaves exactly like one imported
  // from the source: counted as a visit, venue left unknown rather than guessed.
  if (input.watchedInTheatre) {
    db.insert(s.cinemaVisits).values({
      id: synthId("visit", id),
      movieId: id,
      venueId: null,
      visitedAt: watchedOn ?? new Date().toISOString(),
      visitedAtSource: "manual-entry",
    }).onConflictDoNothing().run();
  }

  if (input.notes?.trim()) {
    db.insert(s.quotes).values({
      id: synthId("quote", `${id}:${input.notes.trim()}`),
      text: input.notes.trim(),
      saidBy: null,
      favorite: false,
      createdTime: new Date().toISOString(),
      movieId: id,
    }).onConflictDoNothing().run();
  }

  return { id, slug, title };
}

/**
 * A cast entry, optionally carrying the character.
 *
 * Written as "Domhnall Gleeson as Tim Lake", matching how cast lists read
 * everywhere else, so there is nothing new to learn to type one.
 */
export interface CastEntry {
  name: string;
  role: string | null;
}

export function parseCastEntry(raw: string): CastEntry {
  const m = raw.match(/^(.*?)\s+as\s+(.+)$/i);
  if (!m) return { name: raw.trim(), role: null };
  const name = m[1].trim();
  const role = m[2].trim();
  // "as" inside a name is not a credit. Require something on both sides.
  return name && role ? { name, role } : { name: raw.trim(), role: null };
}

/** Deduplicate cast entries by person, keeping the first role given. */
function dedupeCast(values: string[] | undefined): CastEntry[] {
  const seen = new Set<string>();
  const out: CastEntry[] = [];
  for (const value of values ?? []) {
    const entry = parseCastEntry(value);
    if (!entry.name) continue;
    const key = slugify(entry.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}

function dedupe(values: string[] | undefined): string[] {
  const seen = new Set<string>();
  return (values ?? [])
    .map((v) => v.trim())
    .filter((v) => {
      if (!v) return false;
      const key = slugify(v);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}


/* ------------------------------------------------------------ edit entry -- */

/**
 * Fields an entry exposes for editing. Anything absent from a patch is left
 * alone, so a caller can send one field without disturbing the rest.
 */
export interface EntryPatch {
  title?: string;
  year?: string | number | null;
  format?: string | null;
  status?: string | null;
  rating?: string | number | null;
  seriesName?: string | null;
  watchedInTheatre?: boolean;
  watchedOn?: string | null;
  genres?: string[];
  cast?: string[];
  directors?: string[];
}

/** Every editable field, in the order the form presents them. */
export const EDITABLE_FIELDS = [
  "title", "year", "format", "status", "rating",
  "seriesName", "watchedInTheatre", "watchedOn",
  "genres", "cast", "directors",
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];

/**
 * Apply an edit to an existing entry.
 *
 * The slug is deliberately not recomputed when the title changes. It is the
 * record's address, linked from cinema and people pages, and silently moving it
 * would orphan those links.
 */
export function updateEntry(db: DiaryDb, slug: string, patch: EntryPatch) {
  const movie = db.select().from(s.movies).where(eq(s.movies.slug, slug)).get();
  if (!movie) throw new ValidationError("No entry with that address.");

  const set: Record<string, unknown> = {};
  const changed: string[] = [];

  const note = (field: EditableField, value: unknown, current: unknown) => {
    if (value === current) return false;
    set[field] = value;
    changed.push(field);
    return true;
  };

  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) throw new ValidationError("A title is required.");
    if (title.length > 300) throw new ValidationError("That title is too long (300 characters max).");
    if (title !== movie.title) {
      set.title = title;
      set.titleRaw = title;
      changed.push("title");
    }
  }

  if (patch.year !== undefined) {
    let year: number | null = null;
    if (patch.year !== null && `${patch.year}`.trim() !== "") {
      year = Number(patch.year);
      if (!Number.isInteger(year) || year < 1870 || year > 2200) {
        throw new ValidationError("Year must be a whole number between 1870 and 2200.");
      }
    }
    note("year", year, movie.year);
  }

  if (patch.format !== undefined) {
    const format = patch.format?.trim() || null;
    if (format && !FORMATS.includes(format)) {
      throw new ValidationError(`Format must be one of: ${FORMATS.join(", ")}.`);
    }
    note("format", format, movie.format);
  }

  if (patch.status !== undefined) {
    const status = patch.status?.trim() || null;
    if (status && !STATUSES.includes(status)) {
      throw new ValidationError(`Status must be one of: ${STATUSES.join(", ")}.`);
    }
    note("status", status, movie.status);
  }

  if (patch.rating !== undefined) {
    let value: number | null = null;
    if (patch.rating !== null && `${patch.rating}`.trim() !== "") {
      value = Number(patch.rating);
      if (!Number.isFinite(value) || value < 0 || value > 5 || (value * 2) % 1 !== 0) {
        throw new ValidationError("Rating must be between 0 and 5, in half-star steps.");
      }
    }
    if (value !== movie.ratingValue) {
      set.ratingValue = value;
      set.ratingRaw = value === null ? null : toStarString(value);
      changed.push("rating");
    }
  }

  if (patch.seriesName !== undefined) {
    note("seriesName", patch.seriesName?.trim() || null, movie.seriesName);
  }

  if (patch.watchedOn !== undefined) {
    let iso: string | null = null;
    if (patch.watchedOn?.trim()) {
      const d = new Date(patch.watchedOn);
      if (Number.isNaN(d.getTime())) throw new ValidationError("That date could not be read.");
      iso = d.toISOString();
    }
    if (iso !== movie.createdTime) {
      set.createdTime = iso;
      changed.push("watchedOn");
    }
  }

  /* --- relations are replaced wholesale when supplied --- */
  const relationChanged = (
    field: EditableField,
    values: string[] | undefined,
    current: string[],
    write: (names: string[]) => void,
  ) => {
    if (values === undefined) return;
    const next = dedupe(values);
    const same =
      next.length === current.length &&
      next.every((v, i) => v.trim().toLowerCase() === (current[i] ?? "").trim().toLowerCase());
    if (same) return;
    write(next);
    changed.push(field);
  };

  const currentGenres = db
    .select({ name: s.genres.name })
    .from(s.movieGenres)
    .innerJoin(s.genres, eq(s.genres.id, s.movieGenres.genreId))
    .where(eq(s.movieGenres.movieId, movie.id))
    .all()
    .map((r) => r.name);

  relationChanged("genres", patch.genres, currentGenres, (names) => {
    db.delete(s.movieGenres).where(eq(s.movieGenres.movieId, movie.id)).run();
    for (const n of names) {
      db.insert(s.movieGenres)
        .values({ movieId: movie.id, genreId: ensureGenre(db, n) })
        .onConflictDoNothing().run();
    }
  });

  // Compared as "Name as Role" so a change of character counts as a change.
  const currentCast = db
    .select({ name: s.actors.name, role: s.movieActors.role })
    .from(s.movieActors)
    .innerJoin(s.actors, eq(s.actors.id, s.movieActors.actorId))
    .where(eq(s.movieActors.movieId, movie.id))
    .orderBy(s.movieActors.position)
    .all()
    .map((r) => (r.role ? `${r.name} as ${r.role}` : r.name));

  relationChanged("cast", patch.cast, currentCast, (names) => {
    db.delete(s.movieActors).where(eq(s.movieActors.movieId, movie.id)).run();
    dedupeCast(names).forEach((entry, i) => {
      db.insert(s.movieActors)
        .values({ movieId: movie.id, actorId: ensureActor(db, entry.name), position: i, role: entry.role })
        .onConflictDoNothing().run();
    });
  });

  const currentDirectors = db
    .select({ name: s.directors.name })
    .from(s.movieDirectors)
    .innerJoin(s.directors, eq(s.directors.id, s.movieDirectors.directorId))
    .where(eq(s.movieDirectors.movieId, movie.id))
    .all()
    .map((r) => r.name);

  relationChanged("directors", patch.directors, currentDirectors, (names) => {
    db.delete(s.movieDirectors).where(eq(s.movieDirectors.movieId, movie.id)).run();
    for (const n of names) {
      db.insert(s.movieDirectors)
        .values({ movieId: movie.id, directorId: ensureDirector(db, n) })
        .onConflictDoNothing().run();
    }
  });

  /* --- a cinema visit follows the theatre flag --- */
  if (patch.watchedInTheatre !== undefined && patch.watchedInTheatre !== movie.watchedInTheatre) {
    set.watchedInTheatre = patch.watchedInTheatre;
    changed.push("watchedInTheatre");

    if (patch.watchedInTheatre) {
      db.insert(s.cinemaVisits).values({
        id: synthId("visit", movie.id),
        movieId: movie.id,
        venueId: null,
        visitedAt: (set.createdTime as string | undefined) ?? movie.createdTime,
        visitedAtSource: "manual-entry",
      }).onConflictDoNothing().run();
    } else {
      db.delete(s.cinemaVisits).where(eq(s.cinemaVisits.movieId, movie.id)).run();
    }
  }

  if (changed.length) {
    db.update(s.movies).set(set).where(eq(s.movies.id, movie.id)).run();
  }

  return { slug: movie.slug, changed };
}

