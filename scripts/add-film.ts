/**
 * Add a film to the diary by name.
 *
 *   npx tsx scripts/add-film.ts "About Time"
 *
 * Facts come from Wikipedia and Wikidata rather than from anybody's memory:
 * the release year, the director and the billed cast are read from structured
 * Wikidata claims, so the entry is sourced rather than guessed. Artwork and
 * headshots are downloaded only for people and films that do not already have
 * one, and every licence is reported.
 *
 * Nothing subjective is ever invented. Rating, watch date and cinema visit are
 * only set when you pass them explicitly.
 *
 * Options:
 *   --year N            override the release year
 *   --status S          Watched (default) | Watching | To Watch
 *   --rating N          0 to 5 in half steps; omitted means unrated
 *   --watched-on DATE   ISO date the entry is logged under
 *   --cinema            record it as a cinema visit
 *   --cast N            how many cast to take from Wikidata (default 5)
 *   --cast-names "A,B"  use exactly these cast, ignoring Wikidata's order
 *   --genres "A,B"      override the genre mapping
 *   --no-images         skip all downloads
 *   --dry-run           resolve and report, write nothing
 */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { openDb } from "../src/db/connect";
import * as s from "../src/db/schema";
import { createEntry, ValidationError } from "../src/lib/entry";
import { slugify } from "../src/lib/import-format";
import { thumbnailStem } from "../src/lib/thumbnail-name";

const UA = "ReelDiary/1.0 (personal film diary, local single-user use)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ----------------------------------------------------------------- args -- */
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined;
};
const NAME = argv.filter((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1]?.startsWith("--") !== true)[0]
  ?? argv.find((a) => !a.startsWith("--"));

if (!NAME) {
  console.error('Usage: npx tsx scripts/add-film.ts "Film name" [options]');
  process.exit(1);
}

const DRY = flag("dry-run");
const NO_IMAGES = flag("no-images");
const CAST_LIMIT = Number(opt("cast") ?? 5);

const ROOT = process.cwd();
const THUMBS = path.resolve(ROOT, "../src/Movies Thumbnails");
const ACTORS = path.resolve(ROOT, "../src/Actors ");
const DIRECTORS = path.resolve(ROOT, "../src/Directors");

/* ------------------------------------------------------------- http bits -- */
async function get(url: string, attempt = 1): Promise<Response> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if ((res.status === 429 || res.status >= 500) && attempt <= 4) {
    await sleep(2500 * attempt);
    return get(url, attempt + 1);
  }
  return res;
}
async function getJson<T>(url: string): Promise<T | null> {
  const res = await get(url);
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/* ------------------------------------------------------ resolve the film -- */
interface Summary {
  title: string; description?: string; extract?: string; type?: string;
  thumbnail?: { source: string }; originalimage?: { source: string };
  wikibase_item?: string;
}

async function resolveFilm(name: string): Promise<Summary | null> {
  const direct = await getJson<Summary>(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/\s+/g, "_"))}?redirect=true`,
  );
  const isFilm = (x: Summary | null) =>
    !!x && x.type === "standard" && /\bfilm\b/i.test(`${x.description ?? ""} ${x.extract ?? ""}`);
  if (isFilm(direct)) return direct;

  // Fall back to search, which is what disambiguates "About Time" from the phrase.
  const search = await getJson<{ query?: { search?: { title: string }[] } }>(
    "https://en.wikipedia.org/w/api.php?" +
      new URLSearchParams({ action: "query", format: "json", list: "search", srsearch: `${name} film`, srlimit: "5" }),
  );
  for (const hit of search?.query?.search ?? []) {
    await sleep(300);
    const s2 = await getJson<Summary>(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title.replace(/\s+/g, "_"))}?redirect=true`,
    );
    if (isFilm(s2)) return s2;
  }
  return null;
}

/* ----------------------------------------------------- structured claims -- */
type Claims = Record<string, { mainsnak?: { datavalue?: { value: unknown } } }[]>;

async function wikidata(qid: string): Promise<Claims | null> {
  const j = await getJson<{ entities?: Record<string, { claims?: Claims }> }>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${qid}`,
  );
  return j?.entities?.[qid]?.claims ?? null;
}

const idsOf = (claims: Claims | null, prop: string): string[] =>
  (claims?.[prop] ?? [])
    .map((c) => (c.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id)
    .filter((v): v is string => !!v);

/** Resolve Wikidata ids to English labels, batched. */
async function labels(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 40) {
    const j = await getJson<{ entities?: Record<string, { labels?: { en?: { value: string } } }> }>(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=en&ids=${ids.slice(i, i + 40).join("|")}`,
    );
    for (const [id, ent] of Object.entries(j?.entities ?? {})) {
      if (ent.labels?.en?.value) out.set(id, ent.labels.en.value);
    }
    await sleep(400);
  }
  return out;
}

function yearFrom(claims: Claims | null): number | null {
  const years = (claims?.["P577"] ?? [])
    .map((c) => (c.mainsnak?.datavalue?.value as { time?: string } | undefined)?.time)
    .map((t) => (t ? Number(t.slice(1, 5)) : NaN))
    .filter((n) => Number.isFinite(n));
  return years.length ? Math.min(...years) : null;
}

/**
 * Map the film's Wikidata genres onto the vocabulary already in the diary.
 * Never invents a new genre: an unmapped one is reported and dropped, so the
 * list does not sprout a near-duplicate for every entry.
 */
function mapGenres(raw: string[], known: string[]): { used: string[]; dropped: string[] } {
  const KEYS: [RegExp, string][] = [
    [/science fiction|sci-fi/i, "Science Fiction"],
    [/romance|romantic/i, "Romance"],
    [/comedy/i, "Comedy"],
    [/drama/i, "Drama"],
    [/horror/i, "Horror"],
    [/thriller|suspense/i, "Thriller"],
    [/fantasy/i, "Fantasy"],
    [/crime|heist|gangster/i, "Crime"],
    [/action|martial arts/i, "Action"],
    [/anime/i, "Anime"],
    [/musical/i, "Musical"],
    [/animation|animated/i, "Animation"],
    [/documentary/i, "Documentary"],
    [/adventure/i, "Adventure"],
    [/western/i, "Western"],
    [/mystery/i, "Mystery"],
    [/war film|war\b/i, "War"],
    [/biograph|biopic/i, "Biography"],
    [/history|historical/i, "History"],
    [/family/i, "Family"],
  ];
  const used = new Set<string>();
  const dropped: string[] = [];
  for (const g of raw) {
    const hit = KEYS.find(([re]) => re.test(g));
    if (hit && known.some((k) => k.toLowerCase() === hit[1].toLowerCase())) used.add(hit[1]);
    else dropped.push(g);
  }
  return { used: [...used], dropped };
}

/* -------------------------------------------------------------- images --- */
const EXT: Record<string, string> = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
};

async function download(url: string, dir: string, base: string) {
  const res = await get(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = (res.headers.get("content-type") ?? "").split(";")[0];
  const ext = EXT[type];
  if (!ext) throw new Error(`unexpected type ${type}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1500) throw new Error(`suspiciously small (${buf.length}B)`);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${base}${ext}`);
  fs.writeFileSync(dest, buf);
  return { dest, bytes: buf.length, type };
}

function commonsFile(url: string): string {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  const i = parts.indexOf("thumb");
  return decodeURIComponent(i >= 0 ? parts[parts.length - 2] : parts[parts.length - 1]);
}
const sizedCommons = (file: string, w = 640) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${w}`;

async function licenceOf(host: "commons" | "en", file: string): Promise<string> {
  const base = host === "commons" ? "https://commons.wikimedia.org" : "https://en.wikipedia.org";
  const j = await getJson<{ query?: { pages?: Record<string, { imageinfo?: { extmetadata?: Record<string, { value?: string }> }[] }> } }>(
    `${base}/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata&titles=${encodeURIComponent("File:" + file)}`,
  );
  const p = Object.values(j?.query?.pages ?? {})[0];
  return p?.imageinfo?.[0]?.extmetadata?.LicenseShortName?.value?.replace(/<[^>]*>/g, "") ?? "unknown";
}

/** Fetch a person's headshot from Commons, only if they have no file already. */
async function headshotFor(name: string, dir: string): Promise<{ status: string; detail?: string }> {
  const wanted = slugify(name);
  if (fs.existsSync(dir) && fs.readdirSync(dir).some((f) => slugify(path.basename(f, path.extname(f))) === wanted)) {
    return { status: "already had one" };
  }
  const sum = await getJson<Summary>(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/\s+/g, "_"))}?redirect=true`,
  );
  const img = sum?.originalimage?.source ?? sum?.thumbnail?.source;
  const isPerson = /\b(actor|actress|film|director|screenwriter|filmmaker|producer|comedian|writer)\b/i.test(
    `${sum?.description ?? ""} ${sum?.extract ?? ""}`,
  );
  if (!sum || sum.type === "disambiguation" || !img || !isPerson) {
    return { status: "no free image found" };
  }
  const file = commonsFile(img);
  const lic = await licenceOf("commons", file);
  if (/fair use|non-?free/i.test(lic)) return { status: "skipped, not freely licensed", detail: lic };
  const { dest, bytes } = await download(sizedCommons(file), dir, name);
  return { status: "downloaded", detail: `${lic}, ${(bytes / 1024).toFixed(0)}KB, ${path.basename(dest)}` };
}

/* ----------------------------------------------------------------- run --- */
async function run() {
  console.log(`\nResolving "${NAME}"`);
  const film = await resolveFilm(NAME!);
  if (!film) {
    console.error(`\n  Could not find a film called "${NAME}" on Wikipedia. Nothing was written.`);
    process.exit(1);
  }
  console.log(`  ${film.title}  [${film.description ?? "no description"}]`);

  const claims = film.wikibase_item ? await wikidata(film.wikibase_item) : null;
  const year = Number(opt("year")) || yearFrom(claims);
  const directorIds = idsOf(claims, "P57");
  const castIds = idsOf(claims, "P161").slice(0, CAST_LIMIT);
  const genreIds = idsOf(claims, "P136");
  const lookup = await labels([...directorIds, ...castIds, ...genreIds]);

  const directors = directorIds.map((id) => lookup.get(id)).filter((v): v is string => !!v);

  // Wikidata's cast order is not billing order, so a lead can sit below a bit
  // part and fall outside the limit. Report the truncation, and let the caller
  // name the cast outright when they know who matters.
  const castOverride = opt("cast-names")?.split(",").map((x) => x.trim()).filter(Boolean);
  const castAll = idsOf(claims, "P161");
  const cast = castOverride ?? castIds.map((id) => lookup.get(id)).filter((v): v is string => !!v);
  const rawGenres = genreIds.map((id) => lookup.get(id)).filter((v): v is string => !!v);

  const { sqlite, db } = openDb();
  const knownGenres = db.select({ name: s.genres.name }).from(s.genres).all().map((r) => r.name);
  const genreOverride = opt("genres")?.split(",").map((x) => x.trim()).filter(Boolean);
  const { used: genres, dropped } = genreOverride
    ? { used: genreOverride, dropped: [] as string[] }
    : mapGenres(rawGenres, knownGenres);

  console.log(`\n  year      ${year ?? "unknown"}`);
  console.log(`  director  ${directors.join(", ") || "unknown"}`);
  console.log(`  cast      ${cast.join(", ") || "unknown"}`);
  if (!castOverride && castAll.length > cast.length) {
    console.log(`            (${castAll.length} credited on Wikidata; ${castAll.length - cast.length} not taken.`);
    console.log(`             Order there is not billing order, so pass --cast-names to choose.)`);
  }
  console.log(`  genres    ${genres.join(", ") || "none mapped"}${dropped.length ? `   (dropped: ${dropped.join(", ")})` : ""}`);

  const existing = db.select({ title: s.movies.title }).from(s.movies).where(eq(s.movies.slug, slugify(film.title.replace(/\s*\(.*\)$/, "")))).get();
  if (existing) console.log(`\n  note: "${existing.title}" is already in the diary; a second entry would be created.`);

  if (DRY) {
    console.log("\n  Dry run, nothing written.\n");
    sqlite.close();
    return;
  }

  const title = film.title.replace(/\s*\((?:\d{4}\s*)?film\)$/i, "").trim();
  let created;
  try {
    created = createEntry(db, {
      title,
      year,
      format: "Movie",
      status: opt("status") ?? "Watched",
      rating: opt("rating") ?? null,
      watchedOn: opt("watched-on") ?? null,
      watchedInTheatre: flag("cinema"),
      genres,
      cast,
      directors,
    });
  } catch (e) {
    console.error(`\n  ${e instanceof ValidationError ? e.message : e}\n`);
    sqlite.close();
    process.exit(1);
  }
  console.log(`\n  Added "${created.title}" at /movies/${created.slug}`);

  if (NO_IMAGES) { sqlite.close(); console.log(); return; }

  /* ---- artwork ---- */
  console.log("\n  Artwork");
  const art = film.originalimage?.source ?? film.thumbnail?.source;
  if (!art) {
    console.log("    no artwork on the Wikipedia page");
  } else {
    try {
      const onCommons = /\/wikipedia\/commons\//.test(art);
      const file = commonsFile(art);
      const lic = await licenceOf(onCommons ? "commons" : "en", file);
      const url = onCommons ? sizedCommons(file) : art.split("?")[0];
      const { dest, bytes } = await download(url, THUMBS, thumbnailStem(title));
      db.update(s.movies)
        .set({ posterMatch: "downloaded", posterSource: path.basename(dest) })
        .where(eq(s.movies.id, created.id)).run();
      console.log(`    ${path.basename(dest)}  ${(bytes / 1024).toFixed(0)}KB  [${lic}]`);
      if (/fair use|non-?free/i.test(lic)) {
        console.log("    note: film artwork is copyrighted. It stays in your local assets folder,");
        console.log("          which is excluded from version control.");
      }
    } catch (e) {
      console.log(`    failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  /* ---- headshots ---- */
  console.log("\n  Headshots");
  for (const [people, dir] of [[directors, DIRECTORS], [cast, ACTORS]] as const) {
    for (const person of people) {
      try {
        const r = await headshotFor(person, dir);
        console.log(`    ${person.padEnd(24)} ${r.status}${r.detail ? `  [${r.detail}]` : ""}`);
      } catch (e) {
        console.log(`    ${person.padEnd(24)} failed: ${e instanceof Error ? e.message : e}`);
      }
      await sleep(500);
    }
  }

  sqlite.close();
  console.log(`\n  Run \`npm run import\` to copy the new artwork into the app, then open /movies/${created.slug}\n`);
}

run().catch((e) => { console.error(e); process.exit(1); });
