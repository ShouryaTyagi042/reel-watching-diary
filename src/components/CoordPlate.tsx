import Link from "next/link";
import { coordText, mapUrl } from "@/lib/format";

/**
 * The coordinate plate — this app's signature device.
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
}: {
  lat: number | null;
  lng: number | null;
  name?: string | null;
  label?: string;
  href?: string;
  compact?: boolean;
}) {
  const coords = coordText(lat, lng);
  const title = name ?? (coords ? "Unnamed cinema" : label ?? "Cinema not identified");

  const body = (
    <div
      className={`group/plate relative flex items-center gap-3 border border-edge bg-velvet/60 ${
        compact ? "px-2.5 py-1.5" : "px-3.5 py-3"
      } transition-colors hover:border-rose/60`}
    >
      <Crosshair muted={!coords} compact={compact} />
      <div className="min-w-0">
        <div
          className={`truncate font-medium ${compact ? "text-[13px]" : "text-sm"} ${
            name ? "text-paper" : "text-dim italic"
          }`}
        >
          {title}
        </div>
        <div className={`plate mt-0.5 truncate ${compact ? "text-[10px]" : "text-[11px]"} text-faint`}>
          {coords ?? "no position recorded"}
        </div>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function Crosshair({ muted, compact }: { muted: boolean; compact: boolean }) {
  const s = compact ? 18 : 24;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`shrink-0 ${muted ? "text-faint" : "text-rose"}`}
    >
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <path d="M12 0.5v5M12 18.5v5M0.5 12h5M18.5 12h5" stroke="currentColor" strokeWidth="1" opacity="0.8" />
    </svg>
  );
}

/** Small inline link out to a map for a set of coordinates. */
export function MapLink({ lat, lng }: { lat: number; lng: number }) {
  return (
    <a
      href={mapUrl(lat, lng)}
      target="_blank"
      rel="noreferrer noopener"
      className="plate text-faint underline decoration-edge-2 underline-offset-4 transition-colors hover:text-screen"
    >
      Open in map ↗
    </a>
  );
}
