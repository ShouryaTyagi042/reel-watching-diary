import Image from "next/image";

/**
 * A poster in its well.
 *
 * Artwork comes from the user's own thumbnails folder, copied into /public.
 * A record may instead carry a remote artwork URL, in which case it renders
 * from that. When neither exists we set the title as type rather than borrow
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
 className={`well flex aspect-[2/3] items-end p-3 ${className}`}
        role="img"
        aria-label={`No artwork for ${title}`}
      >
        <div>
          <div className="display text-[17px] text-dim">{title}</div>
          <div className="label mt-1.5">no artwork</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`well aspect-[2/3] ${className}`}>
      <Image src={src} alt={`${title} artwork`} fill sizes={sizes} priority={priority} className="object-cover" />
    </div>
  );
}
