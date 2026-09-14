/**
 * Fill in who each credited actor played.
 *
 *   npx tsx scripts/backfill-roles.ts --dry-run
 *   npx tsx scripts/backfill-roles.ts
 *   npx tsx scripts/backfill-roles.ts --only the-prestige
 *   npx tsx scripts/backfill-roles.ts --only super-bad --page "Superbad"
 *
 * Use --page when your title differs from Wikipedia's, which happens with
 * spelling ("Super Bad" against "Superbad") or with a typo you would rather keep
 * than have a script quietly rewrite.
 *
 * Reads the Cast section of each entry's Wikipedia article and matches the
 * character names onto the people already credited here.
 *
 * Nothing is invented. An actor the article does not mention keeps no role, and
 * is listed at the end so the gap is visible rather than silent. Existing roles
 * are left alone unless --overwrite is passed.
 */
import { and, eq, isNull } from "drizzle-orm";
import { openDb } from "../src/db/connect";
import * as s from "../src/db/schema";
import { fetchCastRoles, matchRoles, wikiFetch } from "../src/lib/cast-roles";

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined;
};

const DRY = flag("dry-run");
const OVERWRITE = flag("overwrite");
const ONLY = opt("only");
const PAGE = opt("page");

const UA = "ReelDiary/1.0 (personal film diary, local single-user use)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Find the Wikipedia article for an entry.
 *
 * Tries the disambiguated title first, because "About Time" is a short story and
 * "About Time (2013 film)" is the film. Confirms the page really is about a film
 * before using it, so a novel of the same name cannot supply a cast list.
 */
async function resolveArticle(title: string, year: number | null): Promise<string | null> {
  const candidates = [
    PAGE ?? null,
    year ? `${title} (${year} film)` : null,
    `${title} (film)`,
    title,
  ].filter((v): v is string => !!v);

  for (const candidate of candidates) {
    // wikiFetch throws on a real failure rather than returning null, so a rate
    // limit can never be mistaken for "this film has no article".
    const res = await wikiFetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(candidate.replace(/\s+/g, "_"))}?redirect=true`,
    );
    await sleep(900);
    if (!res) continue;

    const page = (await res.json()) as {
      title?: string;
      type?: string;
      description?: string;
      extract?: string;
    };
    if (page.type !== "standard") continue;
    const looksRight = /\b(film|miniseries|television series|tv series)\b/i.test(
      `${page.description ?? ""} ${page.extract ?? ""}`,
    );
    if (looksRight && page.title) return page.title;
  }
  return null;
}

async function main() {
  const { sqlite, db } = openDb();

  const movies = db
    .select({ id: s.movies.id, title: s.movies.title, slug: s.movies.slug, year: s.movies.year })
    .from(s.movies)
    .all()
    .filter((m) => (ONLY ? m.slug === ONLY : true));

  if (!movies.length) {
    console.error(ONLY ? `\n  No entry at "${ONLY}".\n` : "\n  No entries.\n");
    sqlite.close();
    process.exit(1);
  }

  console.log(`\n  ${DRY ? "Dry run over" : "Filling in"} ${movies.length} ${movies.length === 1 ? "entry" : "entries"}\n`);

  let filled = 0;
  let kept = 0;
  const noArticle: string[] = [];
  const noCastSection: string[] = [];
  const stillUnknown: string[] = [];

  for (const movie of movies) {
    const credited = db
      .select({ name: s.actors.name, slug: s.actors.slug, id: s.actors.id, role: s.movieActors.role })
      .from(s.movieActors)
      .innerJoin(s.actors, eq(s.actors.id, s.movieActors.actorId))
      .where(eq(s.movieActors.movieId, movie.id))
      .orderBy(s.movieActors.position)
      .all();

    if (!credited.length) continue;

    const article = await resolveArticle(movie.title, movie.year);
    if (!article) {
      noArticle.push(movie.title);
      console.log(`  ${movie.title}\n    no article found`);
      continue;
    }

    let roles;
    try {
      roles = await fetchCastRoles(article);
    } catch (e) {
      console.log(`  ${movie.title}\n    lookup failed: ${e instanceof Error ? e.message : e}`);
      continue;
    }
    await sleep(1200);

    if (!roles.length) {
      noCastSection.push(movie.title);
      console.log(`  ${movie.title}  (${article})\n    no cast section in the expected shape`);
      continue;
    }

    const { matched, unmatched } = matchRoles(credited, roles);
    console.log(`  ${movie.title}  (${article})`);

    for (const hit of matched) {
      const person = credited.find((c) => c.slug === hit.slug)!;
      if (person.role && !OVERWRITE) {
        kept++;
        console.log(`    ${hit.name.padEnd(24)} ${person.role}   (already set, kept)`);
        continue;
      }
      if (!DRY) {
        db.update(s.movieActors)
          .set({ role: hit.role })
          .where(and(eq(s.movieActors.movieId, movie.id), eq(s.movieActors.actorId, person.id)))
          .run();
      }
      filled++;
      console.log(`    ${hit.name.padEnd(24)} ${hit.role}`);
    }

    for (const name of unmatched) {
      stillUnknown.push(`${movie.title}: ${name}`);
      console.log(`    ${name.padEnd(24)} not named in the cast section`);
    }
    console.log();
  }

  console.log("-".repeat(58));
  console.log(`  ${filled} role${filled === 1 ? "" : "s"} ${DRY ? "would be filled" : "filled"}${kept ? `, ${kept} already set and kept` : ""}`);
  if (noArticle.length) console.log(`  ${noArticle.length} without an article: ${noArticle.join(", ")}`);
  if (noCastSection.length) console.log(`  ${noCastSection.length} without a parseable cast section: ${noCastSection.join(", ")}`);
  if (stillUnknown.length) {
    console.log(`  ${stillUnknown.length} credits left without a character:`);
    for (const line of stillUnknown.slice(0, 20)) console.log(`    ${line}`);
    if (stillUnknown.length > 20) console.log(`    and ${stillUnknown.length - 20} more`);
  }
  console.log(DRY ? "\n  Dry run, nothing written.\n" : "\n  Done.\n");

  sqlite.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
