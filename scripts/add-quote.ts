/**
 * Keep a line from something in the diary.
 *
 *   npx tsx scripts/add-quote.ts the-secret-life-of-walter-mitty \
 *     "Beautiful things don't ask for attention." --by "Sean O'Connell"
 *
 * Several at once, each with its own speaker:
 *
 *   npx tsx scripts/add-quote.ts <slug> --file lines.txt
 *   (one per line, as  Speaker | The line)
 *
 * Re-running is safe: the id is derived from the entry and the text, so the
 * same line cannot be stored twice.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { openDb } from "../src/db/connect";
import * as s from "../src/db/schema";

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined;
};
const positional = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));

const slug = positional[0];
if (!slug) {
  console.error('Usage: npx tsx scripts/add-quote.ts <movie-slug> "the line" --by "Speaker"');
  process.exit(1);
}

/**
 * Match the punctuation already in the diary.
 *
 * Every line stored so far uses straight apostrophes and quotes. Typing or
 * pasting from elsewhere brings curly ones, and a diary where half the lines
 * are typographically different from the other half reads as sloppy. Em dashes
 * become hyphens for the same reason.
 */
function normalise(text: string): string {
  return text
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}

const quoteId = (movieId: string, text: string) =>
  crypto.createHash("sha1").update(`quote:${movieId}:${text}`).digest("hex").slice(0, 32);

interface Line {
  text: string;
  saidBy: string | null;
}

function collect(): Line[] {
  const file = opt("file");
  if (file) {
    return fs
      .readFileSync(file, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const bar = l.indexOf("|");
        return bar > 0
          ? { saidBy: normalise(l.slice(0, bar)) || null, text: normalise(l.slice(bar + 1)) }
          : { saidBy: null, text: normalise(l) };
      })
      .filter((l) => l.text.length > 0);
  }
  const text = positional[1];
  if (!text) {
    console.error("  Give the line to keep, or pass --file with one per line.");
    process.exit(1);
  }
  return [{ text: normalise(text), saidBy: opt("by") ? normalise(opt("by")!) : null }];
}

const { sqlite, db } = openDb();

const movie = db
  .select({ id: s.movies.id, title: s.movies.title })
  .from(s.movies)
  .where(eq(s.movies.slug, slug))
  .get();

if (!movie) {
  console.error(`\n  No entry at "${slug}". Nothing was written.\n`);
  sqlite.close();
  process.exit(1);
}

const lines = collect();
console.log(`\n  ${movie.title}`);

let added = 0;
let already = 0;

for (const line of lines) {
  const id = quoteId(movie.id, line.text);
  const exists = db.select({ id: s.quotes.id }).from(s.quotes).where(eq(s.quotes.id, id)).get();

  if (exists) {
    already++;
    console.log(`    already kept  ${line.text.slice(0, 56)}${line.text.length > 56 ? "..." : ""}`);
    continue;
  }

  db.insert(s.quotes)
    .values({
      id,
      text: line.text,
      saidBy: line.saidBy,
      favorite: flag("favorite"),
      createdTime: new Date().toISOString(),
      movieId: movie.id,
    })
    .run();

  added++;
  console.log(`    kept          ${line.text.slice(0, 56)}${line.text.length > 56 ? "..." : ""}`);
  if (line.saidBy) console.log(`                  ${line.saidBy}`);
}

const total = db.select({ id: s.quotes.id }).from(s.quotes).where(eq(s.quotes.movieId, movie.id)).all().length;
console.log(`\n  ${added} added, ${already} already there. ${total} line${total === 1 ? "" : "s"} on this entry.`);
console.log(`  /movies/${slug}\n`);

sqlite.close();
