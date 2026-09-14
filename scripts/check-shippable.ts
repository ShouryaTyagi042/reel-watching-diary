/**
 * Refuse to build an image with nothing in it.
 *
 *   npx tsx scripts/check-shippable.ts
 *
 * The diary and its artwork are not in the repository: .gitignore excludes them
 * because the repository is public. They reach the image from one machine, in
 * the Docker build context, and if .dockerignore ever excludes them by accident
 * — by being brought in line with .gitignore, say — the build still succeeds and
 * deploys a site with no films in it, which looks like data loss.
 *
 * This runs inside the build, before `next build`, and turns that into a failure.
 */
import fs from "node:fs";
import path from "node:path";
import { openDb } from "../src/db/connect";
import * as s from "../src/db/schema";

const ROOT = process.cwd();
let failures = 0;

function check(name: string, ok: boolean, detail: string) {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}\n       ${detail}`);
  }
}

console.log("\nIs there anything to ship?");

const dbPath = process.env.DIARY_DB ?? path.join(ROOT, "data", "diary.db");
const hasDb = fs.existsSync(dbPath);
check("the diary is present", hasDb, `${dbPath} is missing — .dockerignore is probably excluding data/`);

if (hasDb) {
  const { db, sqlite } = openDb(dbPath);
  const films = db.select().from(s.movies).all().length;
  check(`the diary has entries (${films})`, films > 0, "the database is present but empty");
  sqlite.close();
}

for (const dir of ["posters", "people"]) {
  const full = path.join(ROOT, "public", dir);
  const count = fs.existsSync(full) ? fs.readdirSync(full).filter((f) => !f.startsWith(".")).length : 0;
  check(`public/${dir} has images (${count})`, count > 0,
    `empty — .dockerignore is probably excluding public/${dir}`);
}

console.log("\n" + "-".repeat(54));
if (failures) {
  console.log(`${failures} check${failures === 1 ? "" : "s"} failed. Refusing to build an empty site.\n`);
  process.exit(1);
}
console.log("Everything the site needs is in the build context.\n");
