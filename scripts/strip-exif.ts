/**
 * Re-encode the already-served photos without their metadata.
 *
 *   npx tsx scripts/strip-exif.ts --dry-run
 *   npx tsx scripts/strip-exif.ts
 *
 * New uploads are stripped on the way in. This is for the ones published before
 * that was true. Only the copy under public/ is touched; the originals in your
 * assets folder keep their EXIF and are never opened for writing.
 */
import fs from "node:fs";
import path from "node:path";
import exifr from "exifr";
import sharp from "sharp";

const DRY = process.argv.includes("--dry-run");
const DIR = path.join(process.cwd(), "public", "shots");

async function gps(file: string): Promise<string | null> {
  try {
    const m = await exifr.parse(file, { gps: true });
    return typeof m?.latitude === "number" ? `${m.latitude.toFixed(4)}, ${m.longitude.toFixed(4)}` : null;
  } catch {
    return null;
  }
}

async function main() {
  if (!fs.existsSync(DIR)) {
    console.log("\n  Nothing published yet.\n");
    return;
  }

  const files = fs.readdirSync(DIR).filter((f) => !f.startsWith(".") && /\.(jpe?g|png|webp)$/i.test(f));
  console.log(`\n  ${files.length} served photo${files.length === 1 ? "" : "s"}\n`);

  let stripped = 0;
  let clean = 0;

  for (const name of files) {
    const file = path.join(DIR, name);
    const before = await gps(file);

    if (!before) {
      clean++;
      console.log(`    ${name.padEnd(30)} no GPS already`);
      continue;
    }
    if (DRY) {
      stripped++;
      console.log(`    ${name.padEnd(30)} would strip  (${before})`);
      continue;
    }

    const tmp = `${file}.stripping`;
    const ext = path.extname(name).toLowerCase();
    const pipe = sharp(file).rotate();
    if (ext === ".png") await pipe.png().toFile(tmp);
    else await pipe.jpeg({ quality: 86 }).toFile(tmp);
    fs.renameSync(tmp, file);

    const after = await gps(file);
    stripped++;
    console.log(`    ${name.padEnd(30)} stripped     (${before} -> ${after ?? "none"})`);
    if (after) console.log("      still carries GPS, look at this one by hand");
  }

  console.log(`\n  ${stripped} ${DRY ? "would be stripped" : "stripped"}, ${clean} already clean`);
  console.log("  Originals in your assets folder are untouched.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
