import Image from "next/image";

/**
 * A poster in its frame.
 *
 * Posters come from the user's own thumbnails folder, copied into /public.
 * A record may instead carry a remote artwork URL, in which case it renders from
 * that. When neither exists we draw a typographic placeholder rather than borrow
 * someone else's art.
 */
export function Poster({
  title,
  path,
  url,
  sizes = "(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px",
  priority = false,
  className = "",
}: {
  title: string;
  path?: string | null;
  url?: string | null;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const src = path ?? url ?? null;

  if (!src) {
    return (
      <div
        className={`frame flex aspect-[2/3] items-center justify-center px-3 ${className}`}
        role="img"
        aria-label={`No poster available for ${title}`}
      >
        <div className="text-center">
          <div className="font-display text-lg leading-tight text-dim">{title}</div>
          <div className="eyebrow mt-2">no poster in export</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`frame aspect-[2/3] ${className}`}>
      <Image
        src={src}
        alt={`${title} poster`}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}
