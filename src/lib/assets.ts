/**
 * Poster / headshot matching.
 *
 * The Notion export ships each record's cover inside
 * `Databases/Movies and TV Shows/<Title>/<file>`, and the user separately curated
 * `src/Movies Thumbnails/*`. Those two sets turn out to be the *same bytes*, so
 * the mapping between a thumbnail and a movie is established by content hash —
 * no filename guessing, no chance of hanging the wrong poster on a record.
 *
 * Match order:
 *   1. content-hash  — a `src/Movies Thumbnails` file whose MD5 equals the
 *                      record's cover file in the export. Exact by construction.
 *   2. export-cover  — the export's own cover file (used when the curated folder
 *                      has no byte-identical copy).
 *   3. slug          — filename slug vs title slug, for records whose Notion cover
 *                      is a remote URL. Only accepted on a strong match.
 * Anything else is left unmatched and reported, rather than guessed at.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { slugify } from "./notion";

export type PosterMatchKind = "content-hash" | "export-cover" | "slug";

export interface ThumbFile {
  absPath: string;
  fileName: string;
  md5: string;
  slug: string;
}

export function md5File(absPath: string): string {
  return crypto.createHash("md5").update(fs.readFileSync(absPath)).digest("hex");
}

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

export function isImage(name: string): boolean {
  return IMAGE_EXT.has(path.extname(name).toLowerCase());
}

/** Index every image in a directory by MD5 and by filename slug. */
export function indexImageDir(dir: string): ThumbFile[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => !f.startsWith(".") && isImage(f))
    .map((fileName) => {
      const absPath = path.join(dir, fileName);
      return {
        absPath,
        fileName,
        md5: md5File(absPath),
        slug: slugify(path.basename(fileName, path.extname(fileName))),
      };
    });
}

/**
 * Filename slugs that are generic browser-download names and therefore carry no
 * information about which movie they belong to. Never slug-match on these.
 */
const AMBIGUOUS_SLUGS = new Set([
  "images", "images-1", "images-2", "images-3",
  "download", "download-1", "download-2", "download-3", "download-4",
  "untitled", "unknown", "image", "poster",
]);

/**
 * Score a filename slug against a title slug. Returns null when the evidence is
 * too weak to be safe — the caller then reports the record as unmatched.
 */
export function slugMatchScore(titleSlug: string, fileSlug: string): number | null {
  if (AMBIGUOUS_SLUGS.has(fileSlug)) return null;
  if (titleSlug === fileSlug) return 1;

  const tTokens = titleSlug.split("-").filter((t) => t.length > 1 && !STOP.has(t));
  const fTokens = fileSlug.split("-").filter((t) => t.length > 1 && !STOP.has(t));
  if (!tTokens.length || !fTokens.length) return null;

  const shared = tTokens.filter((t) => fTokens.includes(t));
  if (!shared.length) return null;

  // Jaccard-ish: require most of the shorter side to be covered.
  const coverage = shared.length / Math.min(tTokens.length, fTokens.length);
  const overall = shared.length / new Set([...tTokens, ...fTokens]).size;
  if (coverage < 1 || overall < 0.5) return null;
  return overall;
}

const STOP = new Set(["the", "a", "an", "of", "and", "ii", "2"]);

/** Levenshtein distance, used only for near-miss headshot filenames. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

export type PhotoMatchKind = "exact" | "fuzzy";

/**
 * Match a person to a headshot in `src/Actors` / `src/Directors`.
 *
 * Exact slug match first. Failing that, a single near-miss within an edit
 * distance of 2 is accepted — the photo folders contain hand-typed filenames
 * with occasional typos ("micael_cera.webp" for Michael Cera). A fuzzy match is
 * only taken when exactly one candidate is close enough, and it is reported so
 * it can be checked rather than trusted silently.
 */
export function matchPersonPhoto(
  name: string,
  pool: ThumbFile[],
): { file: ThumbFile; kind: PhotoMatchKind } | null {
  const target = slugify(name);
  const exact = pool.find((p) => p.slug === target);
  if (exact) return { file: exact, kind: "exact" };

  if (target.length < 7) return null;
  const near = pool.filter((p) => Math.abs(p.slug.length - target.length) <= 2 && editDistance(p.slug, target) <= 2);
  return near.length === 1 ? { file: near[0], kind: "fuzzy" } : null;
}

/** Copy a source image into /public under a deterministic name. */
export function copyAsset(srcAbs: string, publicDir: string, baseName: string): string {
  fs.mkdirSync(publicDir, { recursive: true });
  const ext = path.extname(srcAbs).toLowerCase() || ".jpg";
  const fileName = `${baseName}${ext}`;
  const dest = path.join(publicDir, fileName);
  // Skip the write when the bytes already match — keeps re-imports cheap and
  // leaves mtimes alone so Next's image cache stays warm.
  if (!fs.existsSync(dest) || md5File(dest) !== md5File(srcAbs)) {
    fs.copyFileSync(srcAbs, dest);
  }
  return fileName;
}
