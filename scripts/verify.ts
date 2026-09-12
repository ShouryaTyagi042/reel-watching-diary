/**
 * Post-import verification.
 *
 * Re-reads the Notion export independently of the importer and asserts that the
 * database agrees with it: same record count, same titles, same ratings, same
 * dates, same theatre flags, and posters pointing at files that actually exist.
 *
 * Usage: npm run verify
 */
import fs from "node:fs";
import path from "node:path";
import { openDb } from "../src/db/connect";
import { csvToObjects, parseRating, parseCheckbox, parseNotionDate, parseRelation, slugify } from "../src/lib/notion";

const ROOT = process.cwd();
const EXPORT_DIR = path.resolve(ROOT, process.env.EXPORT_DIR ?? "../d");
const DB_DIR = path.join(EXPORT_DIR, "Movies and TV Shows Diary", "Databases");
const PUB = path.join(ROOT, "public");

let failures = 0;
let checks = 0;

function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (ok) {
    console.log(`  ✔ ${name}`);
  } else {
    failures++;
    console.log(`  ✖ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function findFile(dir: string, re: RegExp) {
  const hit = fs.readdirSync(dir).find((f) => re.test(f));
  if (!hit) throw new Error(`No file matching ${re} in ${dir}`);
  return path.join(dir, hit);
}

const { sqlite } = openDb();

/*
 * Entries added in the app are legitimately absent from the source, so every
 * comparison below is scoped to imported rows. Without this the whole suite
 * fails the moment somebody adds a film by hand.
 */
const IMPORTED = "origin = 'notion'";
const all = <T>(q: string, ...p: unknown[]) => sqlite.prepare(q).all(...(p as [])) as T[];
const one = <T>(q: string, ...p: unknown[]) => sqlite.prepare(q).get(...(p as [])) as T;

const movieRows = csvToObjects(fs.readFileSync(findFile(DB_DIR, /^Movies and TV Shows .*_all\.csv$/), "utf8"));
const quoteRows = csvToObjects(fs.readFileSync(findFile(DB_DIR, /^Quotes .*_all\.csv$/), "utf8"));
const genreRows = csvToObjects(fs.readFileSync(findFile(DB_DIR, /^Genres .*_all\.csv$/), "utf8"));
const castRows = csvToObjects(fs.readFileSync(findFile(DB_DIR, /^Casts .*_all\.csv$/), "utf8"));

console.log("\n── Counts ────────────────────────────────────────────");
const dbMovies = one<{ n: number }>(`SELECT count(*) n FROM movies WHERE ${IMPORTED}`).n;
const appMovies = one<{ n: number }>("SELECT count(*) n FROM movies WHERE origin = 'app'").n;
check(`imported movies: ${dbMovies} = ${movieRows.length} in the export` + (appMovies ? `  (plus ${appMovies} added in the app)` : ""),
  dbMovies === movieRows.length, `database has ${dbMovies}, export has ${movieRows.length}`);
check(`quotes: ${quoteRows.length} imported`, one<{ n: number }>("SELECT count(*) n FROM quotes").n === quoteRows.length);
check(`genres: ${genreRows.length} imported`, one<{ n: number }>("SELECT count(*) n FROM genres").n >= genreRows.length);
check(`actors: ${castRows.length} imported`, one<{ n: number }>("SELECT count(*) n FROM actors").n >= castRows.length);

console.log("\n── Every title present, once ─────────────────────────");
const dbTitles = new Map(all<{ title: string; id: string }>(`SELECT title, id FROM movies WHERE ${IMPORTED}`).map((r) => [r.title, r.id]));
const missing = movieRows.map((r) => r["Title"].trim()).filter((t) => t && !dbTitles.has(t));
check("every export title has a row", missing.length === 0, missing.join(", "));

const dupSlugs = all<{ slug: string; n: number }>("SELECT slug, count(*) n FROM movies GROUP BY slug HAVING n > 1");
check("no duplicate slugs", dupSlugs.length === 0, dupSlugs.map((d) => d.slug).join(", "));

console.log("\n── Field fidelity ────────────────────────────────────");
const fieldErrors: string[] = [];
for (const row of movieRows) {
  const title = row["Title"].trim();
  if (!title) continue;
  const db = one<{
    title_raw: string; year: number | null; format: string | null; status: string | null;
    rating_raw: string | null; rating_value: number | null; created_time: string | null;
    watched_in_theatre: number; series_name: string | null;
  }>("SELECT * FROM movies WHERE title = ?", title);
  if (!db) { fieldErrors.push(`${title}: no row`); continue; }

  const expectYear = row["Year"] ? Number(row["Year"]) : null;
  if (db.year !== expectYear) fieldErrors.push(`${title}: year ${db.year} ≠ ${expectYear}`);
  if ((db.format ?? null) !== (row["Format"]?.trim() || null)) fieldErrors.push(`${title}: format`);
  if ((db.status ?? null) !== (row["Status"]?.trim() || null)) fieldErrors.push(`${title}: status`);
  if ((db.series_name ?? null) !== (row["Series Name"]?.trim() || null)) fieldErrors.push(`${title}: series`);
  if ((db.rating_raw ?? null) !== (row["Rating"]?.trim() || null)) fieldErrors.push(`${title}: rating string`);
  if (db.rating_value !== parseRating(row["Rating"])) fieldErrors.push(`${title}: rating value`);
  if ((db.created_time ?? null) !== parseNotionDate(row["Created time"])) fieldErrors.push(`${title}: created time`);
  if (!!db.watched_in_theatre !== parseCheckbox(row["Theatre"])) fieldErrors.push(`${title}: theatre flag`);
  if (db.title_raw !== row["Title"]) fieldErrors.push(`${title}: raw title not preserved`);
}
check("year, format, status, series, rating, date and theatre flag match the export for all rows",
  fieldErrors.length === 0, fieldErrors.slice(0, 6).join(" | "));

console.log("\n── Relations ─────────────────────────────────────────");
const relErrors: string[] = [];
for (const row of movieRows) {
  const title = row["Title"].trim();
  if (!title) continue;
  const id = dbTitles.get(title);
  if (!id) continue;
  for (const [cell, table, joinTable, col] of [
    ["Genres", "genres", "movie_genres", "genre_id"],
    ["Cast", "actors", "movie_actors", "actor_id"],
    ["Director", "directors", "movie_directors", "director_id"],
  ] as const) {
    const expected = parseRelation(row[cell]).length;
    const actual = one<{ n: number }>(
      `SELECT count(*) n FROM ${joinTable} j JOIN ${table} t ON t.id = j.${col} WHERE j.movie_id = ?`, id,
    ).n;
    if (expected !== actual) relErrors.push(`${title}/${cell}: ${actual} ≠ ${expected}`);
  }
}
check("cast, genre and director link counts match the export", relErrors.length === 0, relErrors.slice(0, 6).join(" | "));

const orphanQuotes = one<{ n: number }>(
  "SELECT count(*) n FROM quotes WHERE movie_id IS NOT NULL AND movie_id NOT IN (SELECT id FROM movies)").n;
check("no quote points at a missing movie", orphanQuotes === 0);

console.log("\n── Posters and shots ─────────────────────────────────");
const posterRows = all<{ title: string; poster_path: string | null; poster_url: string | null }>(
  "SELECT title, poster_path, poster_url FROM movies");  // artwork is checked for every entry
const brokenPosters = posterRows
  .filter((r) => r.poster_path && !fs.existsSync(path.join(PUB, r.poster_path)))
  .map((r) => `${r.title} → ${r.poster_path}`);
check(`${posterRows.filter((r) => r.poster_path).length} poster files exist on disk`,
  brokenPosters.length === 0, brokenPosters.join(", "));

const noArt = posterRows.filter((r) => !r.poster_path && !r.poster_url);
check("every record has a poster or a cover URL", noArt.length === 0,
  noArt.map((r) => r.title).join(", "));

const shotRows = all<{ path: string; source_name: string }>("SELECT path, source_name FROM movie_shots");
const brokenShots = shotRows.filter((r) => !fs.existsSync(path.join(PUB, r.path)));
check(`${shotRows.length} movie-shot files exist on disk`, brokenShots.length === 0,
  brokenShots.map((r) => r.source_name).join(", "));

const expectedShots = movieRows.reduce(
  (n, r) => n + (r["Movie Shots"] ? r["Movie Shots"].split(/,\s+/).filter(Boolean).length : 0), 0);
check(`movie shots: ${shotRows.length} = ${expectedShots} referenced in the export`, shotRows.length === expectedShots);

console.log("\n── People and headshots ──────────────────────────────");
const actorLinks = one<{ n: number }>(`SELECT count(*) n FROM movie_actors ma JOIN movies m ON m.id = ma.movie_id WHERE m.${IMPORTED}`).n;
const expectedActorLinks = movieRows.reduce((n, r) => n + parseRelation(r["Cast"]).length, 0);
check(`cast links: ${actorLinks} = ${expectedActorLinks} in the export`, actorLinks === expectedActorLinks);

const dirLinks = one<{ n: number }>(`SELECT count(*) n FROM movie_directors md JOIN movies m ON m.id = md.movie_id WHERE m.${IMPORTED}`).n;
const expectedDirLinks = movieRows.reduce((n, r) => n + parseRelation(r["Director"]).length, 0);
check(`director links: ${dirLinks} = ${expectedDirLinks} in the export`, dirLinks === expectedDirLinks);

const danglingActors = one<{ n: number }>(
  "SELECT count(*) n FROM movie_actors WHERE actor_id NOT IN (SELECT id FROM actors)").n;
const danglingDirs = one<{ n: number }>(
  "SELECT count(*) n FROM movie_directors WHERE director_id NOT IN (SELECT id FROM directors)").n;
check("no credit points at a missing person", danglingActors === 0 && danglingDirs === 0);

const headshots = all<{ name: string; photo_path: string }>(
  "SELECT name, photo_path FROM actors WHERE photo_path IS NOT NULL " +
  "UNION ALL SELECT name, photo_path FROM directors WHERE photo_path IS NOT NULL");
const brokenHeadshots = headshots.filter((r) => !fs.existsSync(path.join(PUB, r.photo_path)));
check(`${headshots.length} headshot files exist on disk`, brokenHeadshots.length === 0,
  brokenHeadshots.map((r) => r.name).join(", "));

// Every image the user supplied should be either attached to somebody or reported.
const supplied = ["Actors ", "Directors"].flatMap((d) => {
  const dir = path.join(path.resolve(ROOT, "../src"), d);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => !f.startsWith(".")) : [];
});
const attached = new Set(all<{ photo_source: string }>(
  "SELECT photo_source FROM actors WHERE photo_source IS NOT NULL " +
  "UNION ALL SELECT photo_source FROM directors WHERE photo_source IS NOT NULL",
).map((r) => r.photo_source));
const reported = new Set(all<{ subject: string }>(
  "SELECT subject FROM import_issues WHERE kind = 'person-photo-unmatched'").map((r) => r.subject));
const unaccounted = supplied.filter((f) => !attached.has(f) && !reported.has(f));
check(`all ${supplied.length} supplied headshots are either attached or reported`,
  unaccounted.length === 0, unaccounted.join(", "));

console.log("\n── Cinemas ───────────────────────────────────────────");
const theatreCount = movieRows.filter((r) => parseCheckbox(r["Theatre"])).length;
const visits = one<{ n: number }>(
  `SELECT count(*) n FROM cinema_visits v JOIN movies m ON m.id = v.movie_id WHERE m.${IMPORTED}`).n;
check(`cinema visits: ${visits} = ${theatreCount} records with Theatre = Yes`, visits === theatreCount);

const badVisits = one<{ n: number }>(
  "SELECT count(*) n FROM cinema_visits v JOIN movies m ON m.id = v.movie_id WHERE m.watched_in_theatre = 0").n;
check("no cinema visit on a record whose Theatre box is unticked", badVisits === 0);

const missedVisits = one<{ n: number }>(
  "SELECT count(*) n FROM movies m WHERE m.watched_in_theatre = 1 AND m.id NOT IN (SELECT movie_id FROM cinema_visits)").n;
check("every theatre-flagged record has a visit", missedVisits === 0);

const venuesWithoutGps = one<{ n: number }>("SELECT count(*) n FROM venues WHERE lat IS NULL OR lng IS NULL").n;
check("every derived venue has coordinates", venuesWithoutGps === 0);

const orphanVenues = one<{ n: number }>(
  "SELECT count(*) n FROM venues v WHERE NOT EXISTS (SELECT 1 FROM cinema_visits WHERE venue_id = v.id)").n;
check("no venue exists without at least one visit", orphanVenues === 0);

const namedByImport = all<{ label: string; name: string | null }>("SELECT label, name FROM venues");
console.log(`     venues: ${namedByImport.map((v) => `${v.name ?? "(unnamed)"} — ${v.label}`).join("; ")}`);

console.log("\n── Data preservation ─────────────────────────────────");
const nullRaw = one<{ n: number }>("SELECT count(*) n FROM movies WHERE title_raw IS NULL OR title_raw = ''").n;
check("original title strings preserved verbatim", nullRaw === 0);
const lostCover = one<{ n: number }>(
  `SELECT count(*) n FROM movies WHERE cover_raw IS NULL AND ${IMPORTED}`).n;
check("original Cover cell preserved for every imported record that had one",
  lostCover === movieRows.filter((r) => !r["Cover"]?.trim()).length);

console.log("\n──────────────────────────────────────────────────────");
console.log(`${checks - failures}/${checks} checks passed`);
sqlite.close();
if (failures) {
  console.log(`✖ ${failures} check(s) failed\n`);
  process.exit(1);
}
console.log("✔ The database matches the Notion export.\n");
