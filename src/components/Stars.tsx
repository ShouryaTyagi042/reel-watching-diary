import { starParts } from "@/lib/format";

/**
 * Rating meter.
 *
 * A row of bars rather than star glyphs. Bars read at any size, sit naturally
 * beside tabular numbers, and carry the accent without adding a second colour.
 * The value itself is announced in text, so the unfilled portion is a track
 * rather than information.
 */
export function Stars({
  value,
  raw,
  size = "sm",
}: {
  value: number | null;
  raw?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const parts = starParts(value);
  if (!parts) return <span className="label text-faint">Unrated</span>;

  const dims = {
    sm: { w: "w-[5px]", h: "h-2.5", gap: "gap-[3px]" },
    md: { w: "w-[6px]", h: "h-3.5", gap: "gap-1" },
    lg: { w: "w-2", h: "h-6", gap: "gap-1.5" },
  }[size];

  const filled = parts.full;
  const half = parts.half;

  return (
    <span
 className={`inline-flex items-end ${dims.gap}`}
      title={raw ? `${raw} (${value} of 5)` : `${value} of 5`}
      aria-label={`Rated ${value} out of 5`}
    >
      {Array.from({ length: 5 }, (_, i) => {
        const full = i < filled;
        const isHalf = half && i === filled;
        return (
          <span
            key={i}
            aria-hidden
 className={`${dims.w} ${dims.h} relative overflow-hidden bg-line-strong`}
          >
            {(full || isHalf) && (
              <span
 className="absolute inset-x-0 bottom-0 bg-accent"
                style={{ height: full ? "100%" : "50%" }}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}
