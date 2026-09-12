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
import { slugify } from "./notion";

/** Any drizzle handle over the diary schema, from the app or from a script. */
export type DiaryDb = BetterSQLite3Database<typeof import("@/db/schema")>;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/* ------------------------------------------------------------------ shared */

/** Ids for app-created rows are prefixed so they can never look like a Notion page id. */
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

/** Render a 0–5 number in the same star notation the Notion tracker uses. */
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
    notionPath: null,
    origin: "app",
  }).run();

  for (const g of dedupe(input.genres)) {
    db.insert(s.movieGenres).values({ movieId: id, genreId: ensureGenre(db, g) }).onConflictDoNothing().run();
  }
  dedupe(input.cast).forEach((name, i) => {
    db.insert(s.movieActors).values({ movieId: id, actorId: ensureActor(db, name), position: i })
      .onConflictDoNothing().run();
  });
  for (const d of dedupe(input.directors)) {
    db.insert(s.movieDirectors).values({ movieId: id, directorId: ensureDirector(db, d) })
      .onConflictDoNothing().run();
  }

  // A cinema outing with no geotagged photo behaves exactly like one imported
  // from Notion: counted as a visit, venue left unknown rather than guessed.
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

