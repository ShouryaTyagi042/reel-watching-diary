import { RATING_MAX } from "@/lib/format";

/**
 * Rating meter.
 *
 * A row of ten bars, one per point. Bars read at any size, sit naturally
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
  if (value === null || value === undefined) return <span className="label text-faint">Unrated</span>;

  const dims = {
    sm: { w: "w-[3px]", h: "h-2.5", gap: "gap-[2px]" },
    md: { w: "w-[4px]", h: "h-3.5", gap: "gap-[3px]" },
    lg: { w: "w-[5px]", h: "h-6", gap: "gap-1" },
  }[size];

  const filled = Math.round(Math.max(0, Math.min(RATING_MAX, value)));
  const label = `${value} of ${RATING_MAX}`;

  return (
    <span
      className={`inline-flex items-end ${dims.gap}`}
      title={raw && raw !== `${value}/${RATING_MAX}` ? `${label} (recorded as ${raw})` : label}
      aria-label={`Rated ${value} out of ${RATING_MAX}`}
    >
      {Array.from({ length: RATING_MAX }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={`${dims.w} ${dims.h} ${i < filled ? "bg-accent" : "bg-line-strong"}`}
        />
      ))}
    </span>
  );
}
