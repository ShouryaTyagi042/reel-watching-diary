import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

/**
 * A titled band of content.
 *
 * The heading stacks vertically. No small explainer floating in the opposite
 * corner, and no numbering: if the reader can count the sections, a number adds
 * nothing.
 */
export function Section({
  title,
  note,
  action,
  children,
 className = "",
}: {
  title: string;
  note?: string;
  action?: { href: string; label: string };
  children: ReactNode;
 className?: string;
}) {
  return (
    <section className={`mt-20 ${className}`}>
      <div className="mb-6 flex items-end justify-between gap-4 border-b border-line pb-3.5">
        <div>
          <h2 className="display text-[26px] sm:text-[32px]">{title}</h2>
          {note && <p className="mt-1.5 text-[13px] text-faint">{note}</p>}
        </div>
        {action && (
          <Link
            href={action.href}
 className="group inline-flex shrink-0 items-center gap-1.5 pb-1 text-[13px] text-dim transition-colors hover:text-accent"
          >
            {action.label}
            <ArrowRight size={13} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
