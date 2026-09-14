"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { List, X, Plus, SignOut, SignIn } from "@phosphor-icons/react";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Diary" },
  { href: "/library", label: "Library" },
  { href: "/cinemas", label: "Cinemas" },
  { href: "/genres", label: "Genres" },
  { href: "/people", label: "People" },
  { href: "/quotes", label: "Lines" },
];

export function Nav({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const reduce = useReducedMotion();

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // A full load, not a router refresh: the session is a property of the whole
      // app, and cached router entries can otherwise still render as signed in.
      window.location.assign("/");
    }
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] w-full max-w-[1440px] items-center gap-6 px-4 sm:px-6 lg:px-10">
        <Link
          href="/"
          onClick={() => setOpen(false)}
 className="display text-[26px] leading-none transition-colors hover:text-accent"
        >
          Reel
        </Link>

        <nav className="ml-auto hidden items-center lg:flex" aria-label="Main">
          {LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
 className={`relative px-3.5 py-2 text-[13.5px] transition-colors ${
                  active ? "text-text" : "text-faint hover:text-text"
                }`}
              >
                {l.label}
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
 className="absolute inset-x-2.5 -bottom-px h-px bg-accent"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-4">
          <ThemeToggle />
          <Link
            href="/add"
            onClick={() => setOpen(false)}
 className="hidden items-center gap-1.5 bg-accent px-3.5 py-2 text-[13px] font-medium text-on-accent transition-transform active:scale-[0.98] sm:inline-flex"
          >
            <Plus size={14} weight="bold" />
            Add entry
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
 className="grid h-9 w-9 place-items-center text-faint transition-colors hover:text-text lg:hidden"
          >
            {open ? <X size={18} /> : <List size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-line lg:hidden" aria-label="Main">
          {[...LINKS, admin ? { href: "/add", label: "Add entry" } : { href: "/signin", label: "Sign in" }].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(l.href) ? "page" : undefined}
 className={`block border-b border-line px-5 py-3.5 text-sm last:border-b-0 ${
                isActive(l.href) ? "text-accent" : "text-dim"
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
