/**
 * Parsing helpers for the Notion markdown/CSV export.
 *
 * The export encodes relations as `Display Name (url-encoded/path/to/Page%20<id>.md)`
 * inside comma-separated cells, which cannot be split naively — display names
 * themselves contain commas ("Crazy, Stupid, Love"). Everything here works off
 * the `(path)` delimiters instead.
 */

/** A single entry inside a Notion relation cell. */
export interface NotionRef {
  /** Display name as rendered by Notion. */
  name: string;
  /** URL-decoded relative path of the linked page file. */
  path: string;
  /** 32-hex Notion page id extracted from the filename. */
  id: string | null;
}

const REF_RE = /([^()]*?)\s*\(([^()]*?\.md)\)/g;

/**
 * Split a Notion relation cell into its entries.
 *
 * Handles the comma-in-name case by anchoring on the `(...md)` link and taking
 * everything since the previous link as the display name.
 */
export function parseRelation(cell: string | undefined | null): NotionRef[] {
  if (!cell) return [];
  const out: NotionRef[] = [];
  let match: RegExpExecArray | null;
  REF_RE.lastIndex = 0;
  while ((match = REF_RE.exec(cell)) !== null) {
    const name = match[1].replace(/^\s*,\s*/, "").trim();
    const decoded = safeDecode(match[2]);
    if (!name) continue;
    out.push({ name, path: decoded, id: pageIdFromPath(decoded) });
  }
  return out;
}

/** Split a Notion multi-file cell (comma + space separated relative paths). */
export function parseFileList(cell: string | undefined | null): string[] {
  if (!cell) return [];
  return cell
    .split(/,\s+/)
    .map((s) => safeDecode(s.trim()))
    .filter(Boolean);
}

/** Extract the trailing 32-hex Notion page id from an exported filename. */
export function pageIdFromPath(p: string): string | null {
  const base = p.split("/").pop() ?? p;
  const m = base.match(/([0-9a-f]{32})(?:_all)?\.(?:md|csv)$/i);
  return m ? m[1] : null;
}

export function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Convert a Notion star-rating string to a 0–5 number.
 *
 * The tracker uses `★` = 1, `½` = 0.5 and `✰` (hollow star) = 0, e.g.
 * "★★★½✰" → 3.5. Returns null for empty/unparseable values rather than 0, so
 * "unrated" is never confused with "rated zero".
 */
export function parseRating(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const full = (trimmed.match(/★/g) ?? []).length;
  const half = (trimmed.match(/½/g) ?? []).length;
  const hollow = (trimmed.match(/✰/g) ?? []).length;
  if (full + half + hollow === 0) {
    // Not the star format — fall back to a plain number if that's what it is.
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return full + half * 0.5;
}

/** Notion checkbox cells export as the literal strings "Yes" / "No". */
export function parseCheckbox(raw: string | undefined | null): boolean {
  return (raw ?? "").trim().toLowerCase() === "yes";
}

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/**
 * Parse Notion's exported timestamp format: `January 31, 2026 8:41 PM`.
 * Returns an ISO 8601 string, or null when the value is absent/unrecognised.
 * Times are treated as local wall-clock, matching how Notion exported them.
 */
export function parseNotionDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM))?$/i);
  if (!m) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const month = MONTHS[m[1].toLowerCase()];
  if (month === undefined) return null;
  const day = Number(m[2]);
  const year = Number(m[3]);
  let hour = m[4] ? Number(m[4]) : 0;
  const minute = m[5] ? Number(m[5]) : 0;
  const mer = m[6]?.toUpperCase();
  if (mer === "PM" && hour !== 12) hour += 12;
  if (mer === "AM" && hour === 12) hour = 0;
  const d = new Date(year, month, day, hour, minute);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Minimal RFC-4180 CSV reader (quoted fields, embedded commas/newlines/quotes). */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Read a CSV into objects keyed by its header row. */
export function csvToObjects(input: string): Record<string, string>[] {
  const rows = parseCsv(input);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.replace(/^﻿/, "").trim());
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => { o[h] = (r[i] ?? "").trim(); });
    return o;
  });
}

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";
}
