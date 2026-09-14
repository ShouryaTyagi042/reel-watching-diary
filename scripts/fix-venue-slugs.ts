/**
 * One-off: give named cinemas a label and slug derived from their name.
 *
 * Venues created from photo GPS were labelled "Cinema at <lat>, <lng>" and
 * slugged venue-<lat>-<lng>. Naming one used to set only `name`, so the
 * position stayed in the label and in the public URL. `renameVenue` now derives
 * both; this repairs the rows renamed before that.
 *
 * Coordinates themselves are not touched. They stay in lat/lng, where they are
 * admin-only.
 */
import { openDb } from "../src/db/connect";
import * as s from "../src/db/schema";
import { slugify } from "../src/lib/import-format";
import { eq } from "drizzle-orm";

const { db } = openDb();
const venues = db.select().from(s.venues).all();
const taken = new Set(venues.map((v) => v.slug));

let changed = 0;
for (const v of venues) {
  if (!v.name) continue;
  const wantLabel = v.name;
  let wantSlug = slugify(v.name) || "cinema";
  if (wantSlug !== v.slug) {
    taken.delete(v.slug);
    let n = 1;
    while (taken.has(wantSlug)) wantSlug = `${slugify(v.name)}-${++n}`;
    taken.add(wantSlug);
  }
  if (v.label === wantLabel && v.slug === wantSlug) continue;
  db.update(s.venues).set({ label: wantLabel, slug: wantSlug }).where(eq(s.venues.id, v.id)).run();
  console.log(`  ${v.name}`);
  console.log(`    label  ${v.label}  ->  ${wantLabel}`);
  console.log(`    slug   ${v.slug}  ->  ${wantSlug}`);
  changed++;
}
console.log(`\n${changed} venue${changed === 1 ? "" : "s"} repaired.`);
