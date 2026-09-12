/** Presentation helpers. Shared by server components and client components. */

/** A movie's rating split into the glyphs itself uses. */
export interface StarParts { full: number; half: boolean; empty: number }

export function starParts(value: number | null): StarParts | null {
  if (value === null || value === undefined) return null;
  const clamped = Math.max(0, Math.min(5, value));
  const full = Math.floor(clamped);
  const half = clamped - full >= 0.5;
  return { full, half, empty: 5 - full - (half ? 1 : 0) };
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric",
});
const DATE_TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
});

export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : DATE_FMT.format(d);
}

export function formatDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : DATE_TIME_FMT.format(d);
}

export function yearOf(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

/** "Cinema at 51.5074, -0.1278" → the coordinates alone. */
export function coordText(lat: number | null, lng: number | null): string | null {
  if (lat === null || lng === null) return null;
  return `${lat.toFixed(4)}° ${lat >= 0 ? "N" : "S"}  ${lng.toFixed(4)}° ${lng >= 0 ? "E" : "W"}`;
}

export function mapUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
