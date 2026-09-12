import Image from "next/image";
import Link from "next/link";

/**
 * A face.
 *
 * Headshots come from `src/Actors` and `src/Directors`, matched by name during
 * import. When there is no photo for someone we draw their initials rather than
 * borrowing a stock face, the same rule the posters follow.
 */
export function Avatar({
  name,
  photoPath,
  size = 96,
 className = "",
}: {
  name: string;
  photoPath?: string | null;
  size?: number;
 className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
 className={`well relative aspect-square overflow-hidden rounded-full ${className}`}
      style={{ maxWidth: size }}
    >
      {photoPath ? (
        <Image
          src={photoPath}
          alt={name}
          fill
          sizes={`${size}px`}
 className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <span
 className="flex h-full w-full items-center justify-center display text-faint"
          style={{ fontSize: Math.max(13, size * 0.3) }}
          aria-hidden
        >
          {initials}
        </span>
      )}
    </div>
  );
}

/** Avatar + name, linking to the person's page. Used wherever credits appear. */
export function PersonChip({
  name,
  slug,
  photoPath,
  role,
  size = 96,
}: {
  name: string;
  slug: string;
  photoPath?: string | null;
  role?: string;
  size?: number;
}) {
  return (
    <Link href={`/people/${slug}`} className="group block text-center">
      <Avatar name={name} photoPath={photoPath} size={size} className="mx-auto w-full" />
      <span className="mt-2.5 block text-[12px] leading-snug text-dim transition-colors group-hover:text-accent">
        {name}
      </span>
      {role && <span className="label mt-0.5 block text-[9px]">{role}</span>}
    </Link>
  );
}
