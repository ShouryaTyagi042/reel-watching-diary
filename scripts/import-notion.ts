/**
 * Notion → SQLite import pipeline.
 *
 * Reads the export at `../d` and the curated assets at `../src`, parses each
 * Notion property according to its actual type, matches posters by content hash,
 * derives cinema venues from photo GPS, and upserts everything into SQLite.
 *
 * The run is idempotent: every row is keyed by its Notion page id, writes are
 * upserts, and join tables are rebuilt per record. Re-running produces the same
 * database. The one thing the importer never overwrites is a venue `name` the
 * user has set in the app — the export has no cinema names to overwrite it with.
 *
 * Usage:  npm run import  [-- --export <dir>] [--assets <dir>] [--json]
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import exifr from "exifr";
import { openDb } from "../src/db/connect";
import * as s from "../src/db/schema";
import {
  csvToObjects, parseRelation, parseFileList, parseRating, parseCheckbox,
  parseNotionDate, pageIdFromPath, slugify, safeDecode,
} from "../src/lib/notion";
import {
  indexImageDir, md5File, copyAsset, slugMatchScore, isImage, matchPersonPhoto,
  type PosterMatchKind,
} from "../src/lib/assets";
import { clusterByProximity, formatCoords, type GeoPoint } from "../src/lib/geo";

/* ------------------------------------------------------------------ config */
const argv = process.argv.slice(2);
const argOf = (flag: string, fallback: string) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const JSON_OUT = argv.includes("--json");

const ROOT = process.cwd();
const EXPORT_DIR = path.resolve(ROOT, argOf("--export", "../d"));
const ASSETS_DIR = path.resolve(ROOT, argOf("--assets", "../src"));
const DIARY_DIR = path.join(EXPORT_DIR, "Movies and TV Shows Diary");
const DB_DIR = path.join(DIARY_DIR, "Databases");
const MOVIE_PAGES_DIR = path.join(DB_DIR, "Movies and TV Shows");
const THUMBS_DIR = path.join(ASSETS_DIR, "Movies Thumbnails");
const ACTORS_DIR = path.join(ASSETS_DIR, "Actors ");
const DIRECTORS_DIR = path.join(ASSETS_DIR, "Directors");
const PUB = path.join(ROOT, "public");

/* ------------------------------------------------------------------ report */
type Severity = "error" | "warning" | "info";
interface Issue { severity: Severity; kind: string; subject: string | null; detail: string }

const issues: Issue[] = [];
const report = (severity: Severity, kind: string, subject: string | null, detail: string) =>
  issues.push({ severity, kind, subject, detail });

const stats = {
  moviesInExport: 0, moviesInserted: 0, moviesUpdated: 0, moviesSkipped: 0,
  duplicateTitles: 0,
  genresInserted: 0, actorsInserted: 0, directorsInserted: 0,
  quotesInserted: 0, shotsInserted: 0,
  venuesDerived: 0, cinemaVisits: 0, cinemaVisitsWithVenue: 0,
  postersByContentHash: 0, postersFromExport: 0, postersBySlug: 0,
  postersExternalUrlOnly: 0, moviesWithoutPoster: 0,
  thumbnailsUnmatched: 0, actorPhotos: 0, directorPhotos: 0,
  peoplePhotosFuzzy: 0, peoplePhotosUnmatched: 0,
};

/* ------------------------------------------------------------------- utils */
const readFile = (p: string) => fs.readFileSync(p, "utf8");

/** Locate a file in `dir` whose name matches `re` (used for the `*_all.csv` views). */
function findFile(dir: string, re: RegExp): string | null {
  if (!fs.existsSync(dir)) return null;
  const hit = fs.readdirSync(dir).find((f) => re.test(f));
  return hit ? path.join(dir, hit) : null;
}

/**
 * Stable synthetic id for records the export gives no page id for.
 * Derived from the record's natural key so it is identical across runs.
 */
const synthId = (ns: string, key: string) =>
  crypto.createHash("sha1").update(`${ns}:${key}`).digest("hex").slice(0, 32);

/* ------------------------------------------------- 1. read the export files */
console.log(`▸ Reading Notion export from ${EXPORT_DIR}`);
for (const dir of [EXPORT_DIR, DIARY_DIR, DB_DIR]) {
  if (!fs.existsSync(dir)) {
    console.error(`✖ Not found: ${dir}`);
    process.exit(1);
  }
}

const moviesCsvPath = findFile(DB_DIR, /^Movies and TV Shows .*_all\.csv$/);
const genresCsvPath = findFile(DB_DIR, /^Genres .*_all\.csv$/);
const castsCsvPath = findFile(DB_DIR, /^Casts .*_all\.csv$/);
const directorCsvPath = findFile(DB_DIR, /^Director .*_all\.csv$/);
const quotesCsvPath = findFile(DB_DIR, /^Quotes .*_all\.csv$/);

if (!moviesCsvPath) { console.error("✖ Movies CSV not found"); process.exit(1); }

const movieRows = csvToObjects(readFile(moviesCsvPath));
const genreRows = genresCsvPath ? csvToObjects(readFile(genresCsvPath)) : [];
const castRows = castsCsvPath ? csvToObjects(readFile(castsCsvPath)) : [];
const directorRows = directorCsvPath ? csvToObjects(readFile(directorCsvPath)) : [];
const quoteRows = quotesCsvPath ? csvToObjects(readFile(quotesCsvPath)) : [];
stats.moviesInExport = movieRows.length;

/**
 * The CSV carries the property values but not each row's page id. The per-record
 * markdown files carry the id in their filename. Map title → page file so every
 * movie gets its real Notion id (which is what makes re-import idempotent).
 */
const pageByTitle = new Map<string, { id: string; rel: string }>();
if (fs.existsSync(MOVIE_PAGES_DIR)) {
  for (const f of fs.readdirSync(MOVIE_PAGES_DIR)) {
    if (!f.endsWith(".md")) continue;
    const id = pageIdFromPath(f);
    if (!id) continue;
    const title = f.slice(0, f.length - id.length - 4).trim();
    pageByTitle.set(slugify(title), { id, rel: path.join("Movies and TV Shows", f) });
  }
}

/* --------------------------------------------------- 2. index local assets */
const thumbs = indexImageDir(THUMBS_DIR);
const actorPhotos = indexImageDir(ACTORS_DIR);
const directorPhotos = indexImageDir(DIRECTORS_DIR);
const thumbsByMd5 = new Map(thumbs.map((t) => [t.md5, t]));
const usedThumbs = new Set<string>();
console.log(`▸ Indexed ${thumbs.length} thumbnails, ${actorPhotos.length} actor photos, ${directorPhotos.length} director photos`);

/* ------------------------------------------------------ 3. open the database */
const { sqlite, db } = openDb();
const tableCount = sqlite
  .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name='movies'")
  .get() as { n: number };
if (!tableCount.n) {
  console.error("✖ Schema not found. Run `npm run db:migrate` first.");
  process.exit(1);
}

const existingMovieIds = new Set(
  (db.select({ id: s.movies.id }).from(s.movies).all() as { id: string }[]).map((r) => r.id),
);

/* ------------------------------------------------------- 4. lookup tables */
type Lookup = { id: string; name: string; slug: string; photoPath: string | null };

function upsertGenres(): Map<string, string> {
  const bySlug = new Map<string, string>();
  const rows = genreRows.length
    ? genreRows.map((r) => ({
        name: (r["Name"] ?? "").trim(),
        total: r["Total Movies"] ? Number(r["Total Movies"]) : null,
        summary: r["Summary"] || null,
      }))
    : [];
  for (const r of rows) {
    if (!r.name) { report("warning", "malformed-record", null, "Genres row with empty Name skipped"); continue; }
    const slug = slugify(r.name);
    const id = synthId("genre", slug);
    db.insert(s.genres)
      .values({ id, name: r.name, slug, notionTotalMovies: Number.isFinite(r.total!) ? r.total : null, notionSummary: r.summary })
      .onConflictDoUpdate({
        target: s.genres.id,
        set: { name: r.name, notionTotalMovies: Number.isFinite(r.total!) ? r.total : null, notionSummary: r.summary },
      })
      .run();
    bySlug.set(slug, id);
    stats.genresInserted++;
  }
  return bySlug;
}

/** Headshot files that were successfully attached to somebody. */
const usedPeoplePhotos = new Set<string>();

interface ResolvedPhoto { photoPath: string; photoMatch: string; photoSource: string }

/**
 * Match a person to a headshot and copy it into /public.
 * Returns nulls when there is no confident match — a face is never guessed at.
 */
function resolvePhoto(
  name: string,
  slug: string,
  pool: ReturnType<typeof indexImageDir>,
  role: "actor" | "director",
): ResolvedPhoto | { photoPath: null; photoMatch: null; photoSource: null } {
  const hit = matchPersonPhoto(name, pool);
  if (!hit) return { photoPath: null, photoMatch: null, photoSource: null };

  usedPeoplePhotos.add(hit.file.absPath);
  if (hit.kind === "fuzzy") {
    stats.peoplePhotosFuzzy++;
    report("warning", "photo-fuzzy-match", name,
      `Headshot "${hit.file.fileName}" does not match the name exactly; taken as a near-miss filename. Rename the file to "${slug}" to make it exact, or delete it if it is somebody else.`);
  }
  if (role === "actor") stats.actorPhotos++; else stats.directorPhotos++;

  return {
    photoPath: `/people/${copyAsset(hit.file.absPath, path.join(PUB, "people"), `${role}-${slug}`)}`,
    photoMatch: hit.kind,
    photoSource: hit.file.fileName,
  };
}

function upsertPeople(): { actors: Map<string, string>; directors: Map<string, string> } {
  const actorsBySlug = new Map<string, string>();
  const directorsBySlug = new Map<string, string>();

  for (const r of castRows) {
    const name = (r["Actor"] ?? "").trim();
    if (!name) { report("warning", "malformed-record", null, "Casts row with empty Actor skipped"); continue; }
    const slug = slugify(name);
    const id = synthId("actor", slug);
    const photo = resolvePhoto(name, slug, actorPhotos, "actor");
    db.insert(s.actors).values({ id, name, slug, ...photo })
      .onConflictDoUpdate({ target: s.actors.id, set: { name, ...photo } }).run();
    actorsBySlug.set(slug, id);
    stats.actorsInserted++;
  }

  for (const r of directorRows) {
    const name = (r["Director"] ?? "").trim();
    if (!name) { report("warning", "malformed-record", null, "Director row with empty name skipped"); continue; }
    const slug = slugify(name);
    const id = synthId("director", slug);
    const photo = resolvePhoto(name, slug, directorPhotos, "director");
    db.insert(s.directors).values({ id, name, slug, ...photo })
      .onConflictDoUpdate({ target: s.directors.id, set: { name, ...photo } }).run();
    directorsBySlug.set(slug, id);
    stats.directorsInserted++;
  }

  return { actors: actorsBySlug, directors: directorsBySlug };
}

/** Insert a person discovered only through a movie relation (not in the people CSV). */
function ensureActor(name: string, map: Map<string, string>): string {
  const slug = slugify(name);
  const hit = map.get(slug);
  if (hit) return hit;
  const id = synthId("actor", slug);
  const photo = resolvePhoto(name, slug, actorPhotos, "actor");
  db.insert(s.actors).values({ id, name, slug, ...photo })
    .onConflictDoUpdate({ target: s.actors.id, set: { name, ...photo } }).run();
  map.set(slug, id);
  report("info", "relation-only-record", name, "Actor referenced by a title but absent from the people list — created from the credit.");
  return id;
}

function ensureDirector(name: string, map: Map<string, string>): string {
  const slug = slugify(name);
  const hit = map.get(slug);
  if (hit) return hit;
  const id = synthId("director", slug);
  const photo = resolvePhoto(name, slug, directorPhotos, "director");
  db.insert(s.directors).values({ id, name, slug, ...photo })
    .onConflictDoUpdate({ target: s.directors.id, set: { name, ...photo } }).run();
  map.set(slug, id);
  report("info", "relation-only-record", name, "Director referenced by a title but absent from the people list — created from the credit.");
  return id;
}

function ensureGenre(name: string, map: Map<string, string>): string {
  const slug = slugify(name);
  const hit = map.get(slug);
  if (hit) return hit;
  const id = synthId("genre", slug);
  db.insert(s.genres).values({ id, name, slug })
    .onConflictDoUpdate({ target: s.genres.id, set: { name } }).run();
  map.set(slug, id);
  report("info", "relation-only-record", name, "Genre referenced by a title but absent from the genre list — created from the relation.");
  return id;
}

/* ------------------------------------------------------- 5. poster matching */
interface PosterResult {
  coverRaw: string | null;
  coverKind: "local" | "external" | null;
  posterPath: string | null;
  posterUrl: string | null;
  posterMatch: PosterMatchKind | null;
  posterSource: string | null;
}

function resolvePoster(title: string, slug: string, coverCell: string): PosterResult {
  const raw = coverCell.trim() || null;

  // A remote cover URL: the export shipped no file for this record.
  if (raw && /^https?:\/\//i.test(raw)) {
    // Still try the curated thumbnails by slug, so a local asset wins if one exists.
    const byslug = bestSlugThumb(slug);
    if (byslug) {
      usedThumbs.add(byslug.absPath);
      stats.postersBySlug++;
      return {
        coverRaw: raw, coverKind: "external",
        posterPath: `/posters/${copyAsset(byslug.absPath, path.join(PUB, "posters"), slug)}`,
        posterUrl: raw, posterMatch: "slug", posterSource: byslug.fileName,
      };
    }
    stats.postersExternalUrlOnly++;
    report("warning", "poster-external-only", title,
      `Artwork is a remote URL and no local file matches. Using that URL; nothing was downloaded.`);
    return { coverRaw: raw, coverKind: "external", posterPath: null, posterUrl: raw, posterMatch: null, posterSource: null };
  }

  // A file inside the export.
  if (raw) {
    const rel = safeDecode(raw);
    // Cover paths are written relative to the Databases dir in the CSV.
    const candidates = [
      path.join(DB_DIR, rel),
      path.join(DIARY_DIR, rel),
      path.join(EXPORT_DIR, rel),
      path.join(MOVIE_PAGES_DIR, rel),
    ];
    const abs = candidates.find((c) => fs.existsSync(c));
    if (!abs) {
      report("error", "poster-file-missing", title, `Artwork references "${rel}" but no such file exists.`);
      stats.moviesWithoutPoster++;
      return { coverRaw: raw, coverKind: "local", posterPath: null, posterUrl: null, posterMatch: null, posterSource: null };
    }

    // Prefer the user's curated thumbnail when it is byte-identical.
    const hash = md5File(abs);
    const curated = thumbsByMd5.get(hash);
    if (curated) {
      usedThumbs.add(curated.absPath);
      stats.postersByContentHash++;
      return {
        coverRaw: raw, coverKind: "local",
        posterPath: `/posters/${copyAsset(curated.absPath, path.join(PUB, "posters"), slug)}`,
        posterUrl: null, posterMatch: "content-hash", posterSource: curated.fileName,
      };
    }

    stats.postersFromExport++;
    report("info", "poster-export-only", title,
      `No byte-identical file in src/Movies Thumbnails; used the export's own cover (${path.basename(abs)}).`);
    return {
      coverRaw: raw, coverKind: "local",
      posterPath: `/posters/${copyAsset(abs, path.join(PUB, "posters"), slug)}`,
      posterUrl: null, posterMatch: "export-cover", posterSource: path.basename(abs),
    };
  }

  // No cover at all — last resort, try a confident slug match.
  const byslug = bestSlugThumb(slug);
  if (byslug) {
    usedThumbs.add(byslug.absPath);
    stats.postersBySlug++;
    report("info", "poster-slug-match", title, `No artwork reference on the record; matched "${byslug.fileName}" by filename.`);
    return {
      coverRaw: null, coverKind: null,
      posterPath: `/posters/${copyAsset(byslug.absPath, path.join(PUB, "posters"), slug)}`,
      posterUrl: null, posterMatch: "slug", posterSource: byslug.fileName,
    };
  }

  stats.moviesWithoutPoster++;
  report("warning", "poster-missing", title, "No artwork reference and no confident thumbnail match. Rendered with a placeholder.");
  return { coverRaw: null, coverKind: null, posterPath: null, posterUrl: null, posterMatch: null, posterSource: null };
}

function bestSlugThumb(titleSlug: string) {
  let best: { t: (typeof thumbs)[number]; score: number } | null = null;
  for (const t of thumbs) {
    if (usedThumbs.has(t.absPath)) continue;
    const score = slugMatchScore(titleSlug, t.slug);
    if (score !== null && (!best || score > best.score)) best = { t, score };
  }
  return best?.t ?? null;
}

/* ---------------------------------------------------------- 6. movie shots */
interface ShotRecord {
  movieId: string; movieTitle: string; theatre: boolean;
  absPath: string; sourceName: string; position: number;
  capturedAt: string | null; lat: number | null; lng: number | null;
  cameraMake: string | null; cameraModel: string | null;
}

async function readShot(absPath: string): Promise<Partial<ShotRecord>> {
  try {
    const meta = await exifr.parse(absPath, { gps: true, tiff: true, exif: true });
    if (!meta) return {};
    const d: Date | undefined = meta.DateTimeOriginal ?? meta.CreateDate ?? meta.ModifyDate;
    return {
      capturedAt: d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
      lat: typeof meta.latitude === "number" ? meta.latitude : null,
      lng: typeof meta.longitude === "number" ? meta.longitude : null,
      cameraMake: meta.Make ?? null,
      cameraModel: meta.Model ?? null,
    };
  } catch {
    return {};
  }
}

/* -------------------------------------------------------------- 7. the run */
async function run() {
  const genreMap = upsertGenres();
  const { actors: actorMap, directors: directorMap } = upsertPeople();

  const seenSlugs = new Map<string, string>();
  const seenIds = new Set<string>();
  const allShots: ShotRecord[] = [];
  /** movieId → title, for records whose Theatre checkbox is Yes. */
  const theatreMovies: { id: string; title: string; createdTime: string | null }[] = [];
  const importedIds = new Set<string>();

  for (const row of movieRows) {
    const titleRaw = row["Title"] ?? "";
    const title = titleRaw.trim();
    if (!title) {
      stats.moviesSkipped++;
      report("error", "malformed-record", null, "Movie row with an empty Title — skipped (nothing to key it on).");
      continue;
    }

    let slug = slugify(title);
    const page = pageByTitle.get(slug) ?? pageByTitle.get(slugify(titleRaw));
    const id = page?.id ?? synthId("movie", slug);
    if (!page) {
      report("warning", "page-file-missing", title,
        "No per-record page file alongside the data; using a synthetic id derived from the title.");
    }

    // Distinct Notion records that collapse to the same slug must stay distinct.
    if (seenIds.has(id)) {
      stats.moviesSkipped++;
      stats.duplicateTitles++;
      report("error", "duplicate-record", title, `A second row resolves to the same record id (${id}) — skipped to avoid overwriting.`);
      continue;
    }
    seenIds.add(id);
    const slugOwner = seenSlugs.get(slug);
    if (slugOwner) {
      stats.duplicateTitles++;
      const unique = `${slug}-${id.slice(0, 6)}`;
      report("warning", "duplicate-title", title,
        `Another record shares the slug "${slug}". Both records were kept; this one is addressed as "${unique}".`);
      slug = unique;
    }
    seenSlugs.set(slug, id);

    // A record arriving from the source that matches an entry already added by
    // hand is almost certainly the same film twice. Both are kept — merging them
    // would risk losing a rating or a date — but the collision is reported.
    const appTwin = db
      .select({ title: s.movies.title, slug: s.movies.slug })
      .from(s.movies)
      .where(and(eq(s.movies.origin, "app"), eq(s.movies.slug, slugify(title))))
      .get();
    if (appTwin && appTwin.slug !== slug) {
      report("warning", "possible-duplicate", title,
        `An entry added in the app ("${appTwin.title}") looks like the same title. Both were kept — delete whichever is redundant.`);
    }

    const year = row["Year"] ? Number(row["Year"]) : null;
    if (row["Year"] && !Number.isFinite(year)) {
      report("warning", "malformed-value", title, `Year "${row["Year"]}" is not a number — stored as NULL.`);
    }
    const ratingRaw = row["Rating"]?.trim() || null;
    const ratingValue = parseRating(ratingRaw);
    if (ratingRaw && ratingValue === null) {
      report("warning", "malformed-value", title, `Rating "${ratingRaw}" could not be parsed to a number — the raw string is preserved.`);
    }
    const createdTime = parseNotionDate(row["Created time"]);
    if (row["Created time"] && !createdTime) {
      report("warning", "malformed-value", title, `Created time "${row["Created time"]}" could not be parsed — stored as NULL.`);
    }
    const theatre = parseCheckbox(row["Theatre"]);
    const poster = resolvePoster(title, slug, row["Cover"] ?? "");

    const values = {
      id, titleRaw, title, slug,
      year: Number.isFinite(year!) ? year : null,
      format: row["Format"]?.trim() || null,
      status: row["Status"]?.trim() || null,
      seriesName: row["Series Name"]?.trim() || null,
      ratingRaw, ratingValue,
      watchedInTheatre: theatre,
      createdTime,
      coverRaw: poster.coverRaw, coverKind: poster.coverKind,
      posterPath: poster.posterPath, posterUrl: poster.posterUrl,
      posterMatch: poster.posterMatch, posterSource: poster.posterSource,
      notionPath: page?.rel ?? null,
    };

    // An entry created in the app is the user's own record, not a projection of
    // the export. Never overwrite one.
    const existing = db
      .select({ origin: s.movies.origin, title: s.movies.title })
      .from(s.movies)
      .where(eq(s.movies.id, id))
      .get();
    if (existing?.origin === "app") {
      stats.moviesSkipped++;
      report("info", "app-record-preserved", title,
        "This entry was created in the app, so the importer left it untouched.");
      continue;
    }

    db.insert(s.movies).values(values)
      .onConflictDoUpdate({ target: s.movies.id, set: { ...values, id: undefined as never } })
      .run();
    if (existingMovieIds.has(id)) stats.moviesUpdated++; else stats.moviesInserted++;
    importedIds.add(id);

    // --- relations: rebuilt from scratch each run so removals propagate ---
    db.delete(s.movieGenres).where(eq(s.movieGenres.movieId, id)).run();
    for (const g of parseRelation(row["Genres"])) {
      db.insert(s.movieGenres).values({ movieId: id, genreId: ensureGenre(g.name, genreMap) })
        .onConflictDoNothing().run();
    }

    db.delete(s.movieActors).where(eq(s.movieActors.movieId, id)).run();
    parseRelation(row["Cast"]).forEach((a, i) => {
      db.insert(s.movieActors).values({ movieId: id, actorId: ensureActor(a.name, actorMap), position: i })
        .onConflictDoUpdate({ target: [s.movieActors.movieId, s.movieActors.actorId], set: { position: i } })
        .run();
    });

    db.delete(s.movieDirectors).where(eq(s.movieDirectors.movieId, id)).run();
    for (const d of parseRelation(row["Director"])) {
      db.insert(s.movieDirectors).values({ movieId: id, directorId: ensureDirector(d.name, directorMap) })
        .onConflictDoNothing().run();
    }

    // --- movie shots ---
    db.delete(s.movieShots).where(eq(s.movieShots.movieId, id)).run();
    parseFileList(row["Movie Shots"]).forEach((rel, i) => {
      const candidates = [
        path.join(DB_DIR, rel), path.join(DIARY_DIR, rel),
        path.join(EXPORT_DIR, rel), path.join(MOVIE_PAGES_DIR, rel),
      ];
      const abs = candidates.find((c) => fs.existsSync(c));
      if (!abs) {
        report("error", "shot-file-missing", title, `A photo references "${rel}" but no such file exists.`);
        return;
      }
      if (!isImage(abs)) {
        report("warning", "shot-not-image", title, `Movie Shots entry "${rel}" is not an image — skipped.`);
        return;
      }
      allShots.push({
        movieId: id, movieTitle: title, theatre,
        absPath: abs, sourceName: path.basename(abs), position: i,
        capturedAt: null, lat: null, lng: null, cameraMake: null, cameraModel: null,
      });
    });

    if (theatre) theatreMovies.push({ id, title, createdTime });
  }

  /* ---- read EXIF for every shot ---- */
  for (const shot of allShots) {
    Object.assign(shot, await readShot(shot.absPath));
  }

  /* ---- derive venues from the GPS of shots taken on theatre visits ---- */
  //
  // Only theatre-flagged records feed venue derivation. A geotagged shot on a
  // record whose Theatre checkbox is No is *not* evidence of a cinema visit —
  // the Notion value is authoritative and is preserved as-is, with the conflict
  // reported rather than resolved.
  const geoShots = allShots.filter(
    (sh): sh is ShotRecord & GeoPoint => sh.theatre && sh.lat !== null && sh.lng !== null,
  );
  for (const sh of allShots) {
    if (!sh.theatre && sh.lat !== null && sh.lng !== null) {
      report("info", "theatre-flag-conflict", sh.movieTitle,
        `Photo "${sh.sourceName}" carries GPS (${formatCoords(sh.lat, sh.lng!)}) but the record is not marked as watched in a cinema. The recorded value was kept; no cinema visit was created.`);
    }
    if (sh.theatre && (sh.lat === null || sh.lng === null)) {
      report("info", "shot-without-gps", sh.movieTitle,
        `Photo "${sh.sourceName}" has no GPS EXIF, so it cannot help identify the cinema.`);
    }
  }

  // Sort first so clustering is deterministic regardless of CSV order.
  const sorted = [...geoShots].sort((a, b) => a.lat - b.lat || a.lng - b.lng);
  const clusters = clusterByProximity(sorted);
  const venueIdByShot = new Map<string, string>();

  for (const c of clusters) {
    const key = `${c.centroid.lat.toFixed(4)},${c.centroid.lng.toFixed(4)}`;
    const id = synthId("venue", key);
    const label = `Cinema at ${formatCoords(c.centroid.lat, c.centroid.lng)}`;
    const slug = `venue-${key.replace(/[.,]/g, "-")}`;

    // Preserve any name the user has given this venue in the app.
    const existing = db.select().from(s.venues).where(eq(s.venues.id, id)).get();
    db.insert(s.venues)
      .values({
        id, name: null, label, slug,
        lat: c.centroid.lat, lng: c.centroid.lng, source: "photo-gps",
        notes: `Derived from ${c.items.length} geotagged photo(s) taken during theatre visits.`,
      })
      .onConflictDoUpdate({
        target: s.venues.id,
        set: {
          label, slug, lat: c.centroid.lat, lng: c.centroid.lng,
          notes: `Derived from ${c.items.length} geotagged photo(s) taken during theatre visits.`,
          ...(existing?.name ? {} : { name: null }),
        },
      })
      .run();
    stats.venuesDerived++;
    for (const item of c.items) venueIdByShot.set(item.absPath, id);
  }

  /* ---- persist shots ---- */
  for (const sh of allShots) {
    const shotId = synthId("shot", `${sh.movieId}:${sh.sourceName}`);
    const webName = copyAsset(sh.absPath, path.join(PUB, "shots"), `${sh.movieId.slice(0, 8)}-${sh.position}`);
    db.insert(s.movieShots).values({
      id: shotId, movieId: sh.movieId, path: `/shots/${webName}`, sourceName: sh.sourceName,
      capturedAt: sh.capturedAt, lat: sh.lat, lng: sh.lng,
      cameraMake: sh.cameraMake, cameraModel: sh.cameraModel,
      venueId: venueIdByShot.get(sh.absPath) ?? null, position: sh.position,
    }).onConflictDoUpdate({
      target: s.movieShots.id,
      set: {
        path: `/shots/${webName}`, capturedAt: sh.capturedAt, lat: sh.lat, lng: sh.lng,
        cameraMake: sh.cameraMake, cameraModel: sh.cameraModel,
        venueId: venueIdByShot.get(sh.absPath) ?? null, position: sh.position,
      },
    }).run();
    stats.shotsInserted++;
  }

  /* ---- one cinema visit per theatre-flagged record ---- */
  // Rebuild only the visits this importer owns. Visits belonging to entries added
  // in the app are the user's own records and must survive a re-import.
  db.delete(s.cinemaVisits)
    .where(sql`${s.cinemaVisits.movieId} IN (SELECT id FROM movies WHERE origin = 'notion')`)
    .run();
  for (const m of theatreMovies) {
    const shots = allShots.filter((sh) => sh.movieId === m.id);
    const dated = shots.filter((sh) => sh.capturedAt).sort((a, b) => a.capturedAt!.localeCompare(b.capturedAt!));
    const withVenue = shots.find((sh) => venueIdByShot.has(sh.absPath));
    const venueId = withVenue ? venueIdByShot.get(withVenue.absPath)! : null;

    db.insert(s.cinemaVisits).values({
      id: synthId("visit", m.id),
      movieId: m.id,
      venueId,
      visitedAt: dated[0]?.capturedAt ?? m.createdTime,
      visitedAtSource: dated[0]?.capturedAt ? "photo-exif" : "notion-created-time",
    }).onConflictDoUpdate({
      target: s.cinemaVisits.movieId,
      set: { venueId, visitedAt: dated[0]?.capturedAt ?? m.createdTime, visitedAtSource: dated[0]?.capturedAt ? "photo-exif" : "notion-created-time" },
    }).run();

    stats.cinemaVisits++;
    if (venueId) stats.cinemaVisitsWithVenue++;
    else report("info", "visit-without-venue", m.title,
      "Watched in a cinema but there is no geotagged photo, so the venue is unknown. Grouped under “Cinema not identified”.");
  }

  /* ---- quotes ---- */
  const movieIdByTitleSlug = new Map(
    (db.select({ id: s.movies.id, title: s.movies.title }).from(s.movies).all() as { id: string; title: string }[])
      .map((r) => [slugify(r.title), r.id]),
  );
  for (const q of quoteRows) {
    const text = (q["Quote"] ?? "").trim();
    if (!text) { report("warning", "malformed-record", null, "Quotes row with empty text skipped"); continue; }
    const refs = parseRelation(q["Movies/TV Show"]);
    let movieId = refs[0]?.id ?? null;
    if (movieId && !importedIds.has(movieId)) movieId = null;
    if (!movieId && refs[0]) movieId = movieIdByTitleSlug.get(slugify(refs[0].name)) ?? null;
    if (!movieId) {
      report("warning", "orphan-quote", text.slice(0, 60),
        `This line does not resolve to any entry${refs[0] ? ` (referenced "${refs[0].name}")` : ""}. Stored without a link.`);
    }
    const id = synthId("quote", text);
    const values = {
      id, text,
      saidBy: (q["Said by"] ?? "").trim() || null,
      favorite: parseCheckbox(q["Favorite"]),
      createdTime: parseNotionDate(q["Created time"]),
      movieId,
    };
    db.insert(s.quotes).values(values)
      .onConflictDoUpdate({ target: s.quotes.id, set: { ...values, id: undefined as never } }).run();
    stats.quotesInserted++;
  }

  /* ---- assets for entries added in the app ----------------------------- */
  //
  // Entries created in the UI are not in the source, so the passes above never
  // see them. Their artwork and their people's headshots still live in the same
  // folders, so resolve them here by the same slug match rather than leaving
  // them reported as orphan files.
  const appMovies = db
    .select({ id: s.movies.id, title: s.movies.title, slug: s.movies.slug, posterPath: s.movies.posterPath })
    .from(s.movies)
    .where(eq(s.movies.origin, "app"))
    .all();

  for (const m of appMovies) {
    if (m.posterPath) continue;
    const hit = thumbs.find((t) => t.slug === m.slug);
    if (!hit) {
      report("warning", "poster-missing", m.title,
        "Added in the app with no artwork in the thumbnails folder. Rendered with a placeholder.");
      stats.moviesWithoutPoster++;
      continue;
    }
    usedThumbs.add(hit.absPath);
    db.update(s.movies).set({
      posterPath: `/posters/${copyAsset(hit.absPath, path.join(PUB, "posters"), m.slug)}`,
      posterMatch: "slug",
      posterSource: hit.fileName,
      coverKind: "local",
    }).where(eq(s.movies.id, m.id)).run();
    stats.postersBySlug++;
  }

  // Likewise for anyone credited only on an app-created entry.
  for (const [table, pool, role] of [
    [s.actors, actorPhotos, "actor"],
    [s.directors, directorPhotos, "director"],
  ] as const) {
    const missing = db
      .select({ id: table.id, name: table.name, slug: table.slug })
      .from(table)
      .where(sql`${table.photoPath} IS NULL`)
      .all();
    for (const person of missing) {
      const photo = resolvePhoto(person.name, person.slug, pool, role);
      if (!photo.photoPath) continue;
      db.update(table).set(photo).where(eq(table.id, person.id)).run();
    }
  }

  /* ---- thumbnails that matched nothing ---- */
  // A thumbnail whose name matches an entry added in the app is accounted for —
  // that entry owns it, the importer simply never saw the record.
  const appSlugs = new Set(
    (db.select({ slug: s.movies.slug }).from(s.movies).where(eq(s.movies.origin, "app")).all() as { slug: string }[])
      .map((r) => r.slug),
  );
  for (const t of thumbs) {
    if (usedThumbs.has(t.absPath) || appSlugs.has(t.slug)) continue;
    stats.thumbnailsUnmatched++;
    report("warning", "thumbnail-unmatched", t.fileName,
      "This thumbnail does not correspond to any entry in the diary. Left unassigned rather than guessed at.");
  }

  /* ---- headshots that matched nobody ---- */
  for (const [pool, dir, role] of [
    [actorPhotos, "src/Actors", "actor"],
    [directorPhotos, "src/Directors", "director"],
  ] as const) {
    for (const p of pool) {
      if (usedPeoplePhotos.has(p.absPath)) continue;
      stats.peoplePhotosUnmatched++;
      report("warning", "person-photo-unmatched", p.fileName,
        `Headshot in ${dir} matches no ${role} in the diary. Left unassigned rather than attached to the wrong person.`);
    }
  }

  /* ---- records removed from the export since the last import ---- */
  for (const id of existingMovieIds) {
    if (importedIds.has(id)) continue;
    const row = db
      .select({ title: s.movies.title, origin: s.movies.origin })
      .from(s.movies)
      .where(eq(s.movies.id, id))
      .get();
    // Entries added in the app are expected to be absent from the source; only
    // previously-imported records going missing is worth reporting.
    if (row?.origin === "app") continue;
    report("info", "stale-record", row?.title ?? id,
      "Present in the database but not in this source. Left in place — the importer never deletes records.");
  }

  /* ---- persist the report ---- */
  db.delete(s.importIssues).run();
  for (const i of issues) {
    db.insert(s.importIssues).values({ severity: i.severity, kind: i.kind, subject: i.subject, detail: i.detail }).run();
  }
  db.delete(s.importRuns).run();
  db.insert(s.importRuns).values({ stats: JSON.stringify(stats) }).run();

  /* ---- console report ---- */
  if (JSON_OUT) {
    console.log(JSON.stringify({ stats, issues }, null, 2));
  } else {
    const line = (k: string, v: unknown) => console.log(`   ${k.padEnd(34)} ${v}`);
    console.log("\n─── Import report ───────────────────────────────────");
    line("Movie records in export", stats.moviesInExport);
    line("Inserted", stats.moviesInserted);
    line("Updated", stats.moviesUpdated);
    line("Skipped", stats.moviesSkipped);
    line("Duplicate title collisions", stats.duplicateTitles);
    console.log("");
    line("Genres", stats.genresInserted);
    line("Actors", `${stats.actorsInserted} (${stats.actorPhotos} with photos)`);
    line("Directors", `${stats.directorsInserted} (${stats.directorPhotos} with photos)`);
    line("Headshots matched by near-miss", stats.peoplePhotosFuzzy);
    line("Headshots matching nobody", stats.peoplePhotosUnmatched);
    line("Quotes", stats.quotesInserted);
    line("Movie shots", stats.shotsInserted);
    console.log("");
    line("Posters matched by content hash", stats.postersByContentHash);
    line("Posters from export cover", stats.postersFromExport);
    line("Posters matched by filename", stats.postersBySlug);
    line("Remote cover URL only", stats.postersExternalUrlOnly);
    line("Movies without any poster", stats.moviesWithoutPoster);
    line("Thumbnails matching no movie", stats.thumbnailsUnmatched);
    console.log("");
    line("Cinema visits (Theatre = Yes)", stats.cinemaVisits);
    line("  …placed at a derived venue", stats.cinemaVisitsWithVenue);
    line("Distinct venues from photo GPS", stats.venuesDerived);
    console.log("");

    const bySeverity = { error: 0, warning: 0, info: 0 } as Record<Severity, number>;
    issues.forEach((i) => bySeverity[i.severity]++);
    console.log(`   Issues: ${bySeverity.error} error, ${bySeverity.warning} warning, ${bySeverity.info} info`);
    for (const i of issues) {
      const tag = i.severity === "error" ? "✖" : i.severity === "warning" ? "!" : "·";
      console.log(`   ${tag} [${i.kind}] ${i.subject ? i.subject + " — " : ""}${i.detail}`);
    }
    console.log("─────────────────────────────────────────────────────\n");
    console.log("✔ Import complete. Full report is also stored in the database (Data Health page).");
  }

  sqlite.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
