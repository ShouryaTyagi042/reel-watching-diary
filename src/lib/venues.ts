/**
 * Placing a cinema from a photo.
 *
 * Nothing in the diary carries a cinema name. What a photo taken during a visit
 * does carry is a position, and that is the only thing that tells one cinema
 * from another. A fix within `CLUSTER_RADIUS_M` of a cinema already on record is
 * that same cinema; anything further away is a new one.
 *
 * A venue is always created unnamed. Naming is the user's, and once set nothing
 * here overwrites it.
 */
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { haversineMeters, formatCoords, CLUSTER_RADIUS_M } from "./geo";
import type { DiaryDb } from "./entry";

const venueId = (key: string) =>
  crypto.createHash("sha1").update(`venue:${key}`).digest("hex").slice(0, 32);

export interface ResolvedVenue {
  id: string;
  created: boolean;
  name: string | null;
  label: string;
  slug: string;
  distanceM?: number;
}

/** Find the cinema at this position, or record a new one. */
export function resolveVenue(db: DiaryDb, lat: number, lng: number): ResolvedVenue {
  const existing = db.select().from(s.venues).all();

  let nearest: { v: (typeof existing)[number]; d: number } | null = null;
  for (const v of existing) {
    if (v.lat === null || v.lng === null) continue;
    const d = haversineMeters({ lat: v.lat, lng: v.lng }, { lat, lng });
    if (!nearest || d < nearest.d) nearest = { v, d };
  }

  if (nearest && nearest.d <= CLUSTER_RADIUS_M) {
    return {
      id: nearest.v.id,
      created: false,
      name: nearest.v.name,
      label: nearest.v.label,
      slug: nearest.v.slug,
      distanceM: Math.round(nearest.d),
    };
  }

  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const id = venueId(key);
  const label = `Cinema at ${formatCoords(lat, lng)}`;
  const slug = `venue-${key.replace(/[.,]/g, "-")}`;

  db.insert(s.venues)
    .values({
      id, name: null, label, slug, lat, lng, source: "photo-gps",
      notes: "Placed from the GPS on a photo taken during a visit.",
    })
    .onConflictDoNothing()
    .run();

  return { id, created: true, name: null, label, slug };
}

/**
 * Recentre a cinema on the mean of every geotagged photo taken there, so the
 * position sharpens as more visits are recorded rather than staying pinned to
 * whichever photo happened to arrive first.
 */
export function recentreVenue(db: DiaryDb, id: string) {
  const points = db
    .select({ lat: s.movieShots.lat, lng: s.movieShots.lng })
    .from(s.movieShots)
    .where(eq(s.movieShots.venueId, id))
    .all()
    .filter((p): p is { lat: number; lng: number } => p.lat !== null && p.lng !== null);

  if (!points.length) return;
  const lat = points.reduce((a, p) => a + p.lat, 0) / points.length;
  const lng = points.reduce((a, p) => a + p.lng, 0) / points.length;

  db.update(s.venues)
    .set({
      lat, lng,
      notes: `Placed from the GPS on ${points.length} photo${points.length === 1 ? "" : "s"} taken during visits.`,
    })
    .where(eq(s.venues.id, id))
    .run();
}

/** Drop a cinema that no longer has a single visit pointing at it. */
export function pruneEmptyVenues(db: DiaryDb) {
  const orphans = db
    .select({ id: s.venues.id })
    .from(s.venues)
    .all()
    .filter(
      (v) =>
        !db.select({ id: s.cinemaVisits.id }).from(s.cinemaVisits)
          .where(eq(s.cinemaVisits.venueId, v.id)).get(),
    );
  for (const o of orphans) db.delete(s.venues).where(eq(s.venues.id, o.id)).run();
  return orphans.length;
}
