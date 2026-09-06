/**
 * Venue derivation from photo GPS.
 *
 * The Notion export has no cinema names — only a `Theatre` yes/no checkbox. The
 * photos attached as "Movie Shots" during theatre visits do carry GPS EXIF, and
 * that is the only evidence in the source data that distinguishes one cinema
 * from another. Shots within `CLUSTER_RADIUS_M` of each other are treated as the
 * same venue.
 */
export const CLUSTER_RADIUS_M = 250;

export interface GeoPoint { lat: number; lng: number }

/** Great-circle distance in metres. */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface Cluster<T> { centroid: GeoPoint; items: T[] }

/**
 * Single-link clustering: an item joins the first cluster whose centroid is
 * within `radiusM`, otherwise it starts a new one. Deterministic for a given
 * input order, which the importer fixes by sorting on coordinates.
 */
export function clusterByProximity<T extends GeoPoint>(
  points: T[],
  radiusM = CLUSTER_RADIUS_M,
): Cluster<T>[] {
  const clusters: Cluster<T>[] = [];
  for (const p of points) {
    const hit = clusters.find((c) => haversineMeters(c.centroid, p) <= radiusM);
    if (hit) {
      hit.items.push(p);
      hit.centroid = {
        lat: hit.items.reduce((s, i) => s + i.lat, 0) / hit.items.length,
        lng: hit.items.reduce((s, i) => s + i.lng, 0) / hit.items.length,
      };
    } else {
      clusters.push({ centroid: { lat: p.lat, lng: p.lng }, items: [p] });
    }
  }
  return clusters;
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
