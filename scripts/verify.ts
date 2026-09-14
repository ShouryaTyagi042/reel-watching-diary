/**
 * Check the diary's integrity.
 *
 * The database is the source of truth, so this no longer compares it to an
 * export. It asserts that the database is internally consistent and that every
 * file it points at actually exists.
 *
 * Usage: npm run verify
 */
import fs from "node:fs";
import path from "node:path";
import { openDb } from "../src/db/connect";

const PUB = path.join(process.cwd(), "public");
const { sqlite } = openDb();
const all = <T>(q: string) => sqlite.prepare(q).all() as T[];
const one = <T>(q: string) => sqlite.prepare(q).get() as T;
const count = (q: string) => one<{ n: number }>(`SELECT count(*) n FROM ${q}`).n;

let checks = 0;
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (ok) console.log(`  ok   ${name}`);
  else { failures++; console.log(`  FAIL ${name}${detail ? `  ${detail}` : ""}`); }
}

console.log("\nContents");
const movies = count("movies");
console.log(`     ${movies} entries, ${count("actors")} actors, ${count("directors")} directors,`);
console.log(`     ${count("genres")} genres, ${count("quotes")} lines, ${count("venues")} cinemas,`);
console.log(`     ${count("cinema_visits")} visits, ${count("movie_shots")} photos`);
check("the diary is not empty", movies > 0);

console.log("\nIdentity");
const dupSlugs = all<{ slug: string }>("SELECT slug FROM movies GROUP BY slug HAVING count(*) > 1");
check("every entry has a unique address", dupSlugs.length === 0, dupSlugs.map((d) => d.slug).join(", "));
check("no entry is missing a title", count("movies WHERE title IS NULL OR trim(title) = ''") === 0);
const dupIds = all<{ id: string }>("SELECT id FROM movies GROUP BY id HAVING count(*) > 1");
check("no duplicate record ids", dupIds.length === 0);

console.log("\nRelations");
check("every cast credit points at a real person",
  count("movie_actors WHERE actor_id NOT IN (SELECT id FROM actors)") === 0);
check("every director credit points at a real person",
  count("movie_directors WHERE director_id NOT IN (SELECT id FROM directors)") === 0);
check("every credit points at a real entry",
  count("movie_actors WHERE movie_id NOT IN (SELECT id FROM movies)") === 0 &&
  count("movie_directors WHERE movie_id NOT IN (SELECT id FROM movies)") === 0);
check("every genre tag points at a real genre",
  count("movie_genres WHERE genre_id NOT IN (SELECT id FROM genres)") === 0);
check("no line points at a missing entry",
  count("quotes WHERE movie_id IS NOT NULL AND movie_id NOT IN (SELECT id FROM movies)") === 0);
check("no photo points at a missing entry",
  count("movie_shots WHERE movie_id NOT IN (SELECT id FROM movies)") === 0);

console.log("\nFiles on disk");
const posters = all<{ title: string; poster_path: string }>(
  "SELECT title, poster_path FROM movies WHERE poster_path IS NOT NULL");
const missingPosters = posters.filter((r) => !fs.existsSync(path.join(PUB, r.poster_path)));
check(`${posters.length} artwork files exist`, missingPosters.length === 0,
  missingPosters.map((r) => r.title).join(", "));

const heads = all<{ name: string; photo_path: string }>(
  "SELECT name, photo_path FROM actors WHERE photo_path IS NOT NULL " +
  "UNION ALL SELECT name, photo_path FROM directors WHERE photo_path IS NOT NULL");
const missingHeads = heads.filter((r) => !fs.existsSync(path.join(PUB, r.photo_path)));
check(`${heads.length} headshot files exist`, missingHeads.length === 0,
  missingHeads.map((r) => r.name).join(", "));

const shots = all<{ path: string }>("SELECT path FROM movie_shots");
const missingShots = shots.filter((r) => !fs.existsSync(path.join(PUB, r.path)));
check(`${shots.length} photo files exist`, missingShots.length === 0);

const noArt = all<{ title: string }>(
  "SELECT title FROM movies WHERE poster_path IS NULL AND poster_url IS NULL");
check("every entry has artwork", noArt.length === 0, noArt.map((r) => r.title).join(", "));

console.log("\nCinemas");
check("every visit points at a real entry",
  count("cinema_visits WHERE movie_id NOT IN (SELECT id FROM movies)") === 0);
check("no visit on an entry not marked as watched in a cinema",
  count("cinema_visits v JOIN movies m ON m.id = v.movie_id WHERE m.watched_in_theatre = 0") === 0);
check("every entry marked as a cinema watch has a visit",
  count("movies m WHERE m.watched_in_theatre = 1 AND m.id NOT IN (SELECT movie_id FROM cinema_visits)") === 0);
// Only a cinema derived from a photo must have a position. One added by name
// has none, which is the honest state rather than a fault.
check("every photo-placed cinema has coordinates",
  count("venues WHERE source = 'photo-gps' AND (lat IS NULL OR lng IS NULL)") === 0);
check("every cinema has a name or a position",
  count("venues WHERE (name IS NULL OR trim(name) = '') AND (lat IS NULL OR lng IS NULL)") === 0);
check("no cinema exists without a visit",
  count("venues v WHERE NOT EXISTS (SELECT 1 FROM cinema_visits WHERE venue_id = v.id)") === 0);
const named = all<{ name: string | null; label: string }>("SELECT name, label FROM venues");
console.log(`     ${named.map((v) => v.name ?? `(unnamed) ${v.label}`).join("; ")}`);

console.log("\nValues");
check("no rating sits outside 0 to 5",
  count("movies WHERE rating_value IS NOT NULL AND (rating_value < 0 OR rating_value > 5)") === 0);
check("no rating is stored in half-steps it cannot be",
  count("movies WHERE rating_value IS NOT NULL AND (rating_value * 2) % 1 != 0") === 0);
check("no release year is implausible",
  count("movies WHERE year IS NOT NULL AND (year < 1870 OR year > 2200)") === 0);
check("status is always a known value",
  count("movies WHERE status IS NOT NULL AND status NOT IN ('Watched','Watching','To Watch')") === 0);
check("format is always a known value",
  count("movies WHERE format IS NOT NULL AND format NOT IN ('Movie','TV Show')") === 0);

console.log("\n" + "-".repeat(54));
console.log(`${checks - failures} of ${checks} checks passed`);
sqlite.close();
if (failures) { console.log(`${failures} failed\n`); process.exit(1); }
console.log("The diary is internally consistent.\n");
