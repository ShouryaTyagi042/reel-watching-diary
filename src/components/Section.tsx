import Link from "next/link";
import type { ReactNode } from "react";

/** A titled band of content. The eyebrow states what the section counts. */
export function Section({
  eyebrow,
  title,
  action,
  children,
  className = "",
}: {
  eyebrow?: string;
  title: string;
  action?: { href: string; label: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-14 ${className}`}>
      <div className="mb-5 flex items-end justify-between gap-4 border-b border-edge/60 pb-3">
        <div>
          {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
          <h2 className="font-display text-2xl leading-none text-paper sm:text-[28px]">{title}</h2>
        </div>
        {action && (
          <Link
            href={action.href}
            className="eyebrow shrink-0 pb-1 text-dim transition-colors hover:text-sconce"
          >
            {action.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
