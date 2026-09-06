import { starParts } from "@/lib/format";

/**
 * Rating meter. Rendered in the same notation the Notion tracker uses —
 * filled stars, an optional half, and hollow stars for the remainder — so the
 * app shows the rating the way it was written, not a reinterpretation of it.
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
  if (!parts) {
    return <span className="eyebrow text-faint">Unrated</span>;
  }
  const px = { sm: "text-[13px]", md: "text-base", lg: "text-2xl" }[size];
  const gap = { sm: "gap-[1px]", md: "gap-[2px]", lg: "gap-[3px]" }[size];

  return (
    <span
      className={`inline-flex items-center ${gap} ${px} leading-none text-sconce`}
      title={raw ? `${raw} (${value}/5)` : `${value}/5`}
      aria-label={`Rated ${value} out of 5`}
    >
      {Array.from({ length: parts.full }, (_, i) => (
        <span key={`f${i}`} aria-hidden>★</span>
      ))}
      {parts.half && (
        <span key="h" aria-hidden className="relative inline-block">
          <span className="text-sconce-dim">★</span>
          <span
            className="absolute inset-0 overflow-hidden text-sconce"
            style={{ clipPath: "inset(0 50% 0 0)" }}
          >
            ★
          </span>
        </span>
      )}
      {Array.from({ length: parts.empty }, (_, i) => (
        <span key={`e${i}`} aria-hidden className="text-star-off">★</span>
      ))}
    </span>
  );
}
