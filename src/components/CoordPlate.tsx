import Link from "next/link";
import { Crosshair, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { coordText, mapUrl } from "@/lib/format";

/**
 * The coordinate data, this diary's signature device.
 *
 * An entry records that you were in a cinema, not which one. What it does hold,
 * in the EXIF of the photos taken during the visit, is a position. So a cinema
 * is shown as what it actually is in the data: a fix on the earth, read like an
 * instrument, waiting for a name.
 */
export function CoordPlate({
  lat,
  lng,
  name,
  label,
  href,
  compact = false,
  admin = false,
}: {
  lat: number | null;
  lng: number | null;
  name?: string | null;
  label?: string;
  href?: string;
  compact?: boolean;
  /**
   * A position is a record of where a person physically was, with a timestamp.
   * Visitors get the cinema's name; the fix itself belongs to the owner.
   */
  admin?: boolean;
}) {
  const coords = admin ? coordText(lat, lng) : null;
  const placed = lat !== null && lng !== null;
  const title = name ?? (placed ? "Unnamed cinema" : label ?? "Cinema not identified");

  const body = (
    <div
 className={`flex items-center gap-3 border border-line bg-surface transition-colors hover:border-accent ${
        compact ? "px-3 py-2" : "px-4 py-3.5"
      }`}
    >
      <Crosshair
        size={compact ? 18 : 22}
        weight="light"
 className={coords ? "shrink-0 text-accent" : "shrink-0 text-faint"}
      />
      <div className="min-w-0">
        <div
 className={`truncate font-medium ${compact ? "text-[13px]" : "text-sm"} ${
            name ? "text-text" : "text-dim"
          }`}
        >
          {title}
        </div>
        {(coords || !placed) && (
          <div className={`data mt-0.5 truncate text-faint ${compact ? "text-[10px]" : "text-[11px]"}`}>
            {coords ?? "no position recorded"}
          </div>
        )}
      </div>
    </div>
  );

  return href ? <Link href={href} className="block">{body}</Link> : body;
}

/** Link out to a map for a set of coordinates. */
export function MapLink({ lat, lng }: { lat: number; lng: number }) {
  return (
    <a
      href={mapUrl(lat, lng)}
      target="_blank"
      rel="noreferrer noopener"
 className="data inline-flex items-center gap-1 text-faint underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent"
    >
      Open in map
      <ArrowUpRight size={12} weight="bold" />
    </a>
  );
}
