"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Diary" },
  { href: "/library", label: "Library" },
  { href: "/cinemas", label: "Cinemas" },
  { href: "/people", label: "People" },
  { href: "/quotes", label: "Lines" },
  { href: "/data-health", label: "Data" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-edge/70 bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-4 py-3.5 sm:px-6 lg:px-10">
        <Link href="/" className="group flex items-baseline gap-2.5" onClick={() => setOpen(false)}>
          <span className="font-display text-xl leading-none text-paper transition-colors group-hover:text-sconce">
            Reel
          </span>
          <span className="plate hidden text-[10px] uppercase tracking-[0.22em] text-faint sm:inline">
            a watching diary
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 sm:flex" aria-label="Main">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`px-3 py-1.5 text-[13px] tracking-wide transition-colors ${
                isActive(l.href)
                  ? "text-sconce"
                  : "text-dim hover:text-paper"
              }`}
            >
              {l.label}
              {isActive(l.href) && (
                <span className="mt-1 block h-px bg-sconce" aria-hidden />
              )}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="ml-auto p-2 text-dim transition-colors hover:text-paper sm:hidden"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            {open ? (
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" />
            ) : (
              <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="1.5" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-edge/70 sm:hidden" aria-label="Main">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`block border-b border-edge/40 px-5 py-3.5 text-sm ${
                isActive(l.href) ? "text-sconce" : "text-dim"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
