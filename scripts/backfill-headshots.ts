/**
 * Find headshots for the cast and directors who have none.
 *
 *   npx tsx scripts/backfill-headshots.ts --dry-run
 *   npx tsx scripts/backfill-headshots.ts
 *   npm run import            # attaches the new files to the records
 *
 * A name alone is not enough to find the right face. "Brian Cox" is an actor,
 * a physicist and a footballer, and Wikipedia answers with a disambiguation
 * page. So each person is looked up through a film they are in: Wikidata is
 * asked for the person credited as cast (P161) or director (P57) of a film with
 * that title, and only then for their portrait (P18). The film is what pins the
 * person down.
 *
 * Only freely licensed Commons files are kept. Anyone who cannot be resolved
 * this way is reported and left without a picture, never given a near miss.
 */
import fs from "node:fs";
import path from "node:path";
import { openDb } from "../src/db/connect";

const UA = "ReelDiary/1.0 (personal film diary, local single-user use)";
const DRY = process.argv.includes("--dry-run");
const ROOT = process.cwd();
const DIRS = {
  actor: path.resolve(ROOT, "../src/Actors "),
  director: path.resolve(ROOT, "../src/Directors"),
} as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, attempt = 1): Promise<Response> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/sparql-results+json, application/json, image/*" } });
  if ((res.status === 429 || res.status >= 500) && attempt <= 5) {
    await sleep(3000 * attempt);
    return get(url, attempt + 1);
  }
  return res;
}

const slug = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

interface Hit { person: string; image: string; film: string; year: string | null }

/**
 * The person credited in `role` on a film titled `title`, and their portrait.
 * Matches the English label or an English alias on both sides, and prefers the
 * film from the diary's release year when titles repeat.
 */
async function resolve(name: string, role: "actor" | "director", title: string, year: number | null): Promise<Hit[]> {
  const prop = role === "actor" ? "wdt:P161" : "wdt:P57";
  const q = `
SELECT DISTINCT ?person ?image ?film (YEAR(MIN(?date)) AS ?year) WHERE {
  VALUES ?name { "${esc(name)}"@en }
  VALUES ?title { "${esc(title)}"@en }
  { ?person rdfs:label ?name } UNION { ?person skos:altLabel ?name }
  { ?film rdfs:label ?title } UNION { ?film skos:altLabel ?title }
  ?film ${prop} ?person .
  ?person wdt:P18 ?image .
  OPTIONAL { ?film wdt:P577 ?date }
} GROUP BY ?person ?image ?film`;
  const res = await get(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
  const j = (await res.json()) as { results: { bindings: Record<string, { value: string }>[] } };
  const hits = j.results.bindings.map((b) => ({
    person: b.person.value.split("/").pop()!,
    image: b.image.value,
    film: b.film.value.split("/").pop()!,
    year: b.year?.value ?? null,
  }));
  if (year === null || hits.length < 2) return hits;
  const sameYear = hits.filter((h) => h.year && Math.abs(Number(h.year) - year) <= 1);
  return sameYear.length ? sameYear : hits;
}

async function licenceOf(file: string): Promise<string> {
  const res = await get(
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata&titles=${encodeURIComponent("File:" + file)}`,
  );
  if (!res.ok) return "unknown";
  const j = (await res.json()) as { query?: { pages?: Record<string, { imageinfo?: { extmetadata?: Record<string, { value?: string }> }[] }> } };
  const p = Object.values(j.query?.pages ?? {})[0];
  return p?.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value?.replace(/<[^>]*>/g, "") ?? "unknown";
}

const EXT: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

async function download(file: string, dir: string, base: string) {
  const res = await get(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=640`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ext = EXT[(res.headers.get("content-type") ?? "").split(";")[0]];
  if (!ext) throw new Error(`unexpected type ${res.headers.get("content-type")}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1500) throw new Error(`suspiciously small (${buf.length}B)`);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${base}${ext}`);
  fs.writeFileSync(dest, buf);
  return { dest, bytes: buf.length };
}

function hasFile(dir: string, name: string): boolean {
  return fs.existsSync(dir) && fs.readdirSync(dir).some((f) => slug(path.basename(f, path.extname(f))) === slug(name));
}

async function run() {
  const { sqlite } = openDb();
  const missing = sqlite.prepare(`
    SELECT 'actor' AS role, a.name, m.title, m.year FROM actors a
      JOIN movie_actors ma ON ma.actor_id = a.id JOIN movies m ON m.id = ma.movie_id
      WHERE a.photo_path IS NULL
    UNION ALL
    SELECT 'director', d.name, m.title, m.year FROM directors d
      JOIN movie_directors md ON md.director_id = d.id JOIN movies m ON m.id = md.movie_id
      WHERE d.photo_path IS NULL
    ORDER BY 1, 2`).all() as { role: "actor" | "director"; name: string; title: string; year: number | null }[];
  sqlite.close();

  // One person may be in several films; any one of them is enough to find them.
  const people = new Map<string, { role: "actor" | "director"; name: string; films: { title: string; year: number | null }[] }>();
  for (const r of missing) {
    const k = `${r.role}:${r.name}`;
    if (!people.has(k)) people.set(k, { role: r.role, name: r.name, films: [] });
    people.get(k)!.films.push({ title: r.title, year: r.year });
  }

  console.log(`\n${people.size} people without a headshot${DRY ? "  (dry run)" : ""}\n`);
  let saved = 0;

  for (const p of people.values()) {
    const label = `${p.name} (${p.role})`.padEnd(34);
    const dir = DIRS[p.role];
    if (hasFile(dir, p.name)) {
      console.log(`  ${label} file already present, run npm run import`);
      continue;
    }
    try {
      let hits: Hit[] = [];
      let via = "";
      for (const f of p.films) {
        hits = await resolve(p.name, p.role, f.title, f.year);
        await sleep(400);
        if (hits.length) { via = f.title; break; }
      }
      const persons = [...new Set(hits.map((h) => h.person))];
      if (!hits.length) {
        console.log(`  ${label} not found as ${p.role} of ${p.films.map((f) => f.title).join(" / ")} on Wikidata, or no portrait`);
        continue;
      }
      if (persons.length > 1) {
        console.log(`  ${label} ambiguous: ${persons.join(", ")}, skipped`);
        continue;
      }
      const file = decodeURIComponent(hits[0].image.split("/").pop()!).replace(/_/g, " ");
      const lic = await licenceOf(file);
      if (/fair use|non-?free|unknown/i.test(lic)) {
        console.log(`  ${label} skipped, licence is ${lic}`);
        continue;
      }
      if (DRY) {
        console.log(`  ${label} would save  ${persons[0]} via ${via}  [${lic}]  ${file}`);
        continue;
      }
      const { dest, bytes } = await download(file, dir, p.name);
      saved++;
      console.log(`  ${label} saved  ${persons[0]} via ${via}  [${lic}, ${(bytes / 1024).toFixed(0)}KB]  ${path.basename(dest)}`);
    } catch (e) {
      console.log(`  ${label} failed: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(600);
  }

  console.log(DRY ? "\nDry run, nothing written.\n" : `\n${saved} saved. Run \`npm run import\` to attach them.\n`);
}

run().catch((e) => { console.error(e); process.exit(1); });
