/** Presentation helpers. Shared by server components and client components. */

/** Ratings are whole numbers out of this. */
export const RATING_MAX = 10;

/** "7/10", or null when unrated. */
export function ratingText(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return `${Number.isInteger(value) ? value : value.toFixed(1)}/${RATING_MAX}`;
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
