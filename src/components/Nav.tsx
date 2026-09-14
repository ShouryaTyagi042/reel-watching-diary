"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  DotsThree,
  FilmSlate,
  MapPin,
  Plus,
  Quotes,
  SignIn,
  SignOut,
  SquaresFour,
  Tag,
  Users,
  X,
} from "@phosphor-icons/react";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/", label: "Diary" },
  { href: "/library", label: "Library" },
  { href: "/cinemas", label: "Cinemas" },
  { href: "/genres", label: "Genres" },
  { href: "/people", label: "People" },
  { href: "/quotes", label: "Lines" },
];

/*
 * On a phone the navigation sits at the bottom, within reach of a thumb, so it
 * is a bar of destinations rather than a list behind a hamburger.
 *
 * Four of the six sections get a tab. Genres and Lines are ways of re-sorting
 * the same films rather than places you go, so they live in the sheet with the
 * theme and the owner's controls. Five slots is the ceiling before the labels
 * stop being readable at this width.
 */
const TABS = [
  { href: "/", label: "Diary", icon: FilmSlate },
  { href: "/library", label: "Library", icon: SquaresFour },
  { href: "/cinemas", label: "Cinemas", icon: MapPin },
  { href: "/people", label: "People", icon: Users },
];

const SHEET_LINKS = [
  { href: "/genres", label: "Genres", icon: Tag },
  { href: "/quotes", label: "Lines", icon: Quotes },
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

  // A route change can come from anywhere, including the back button.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const sheetActive = SHEET_LINKS.some((l) => isActive(l.href));

  return (
    <>
      {/*
        The header stops being sticky on a phone. Navigation is at the bottom
        now, so pinning another 68px to the top would spend a tenth of the
        screen on chrome the thumb cannot reach anyway.
      */}
      <header className="static z-40 border-b border-line bg-bg/85 backdrop-blur-xl lg:sticky lg:top-0">
        <div className="mx-auto flex h-[68px] w-full max-w-[1440px] items-center gap-6 px-4 sm:px-6 lg:px-10">
          <Link
            href="/"
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
            {admin ? (
              <>
                <Link
                  href="/add"
 className="hidden items-center gap-1.5 bg-accent px-3.5 py-2 text-[13px] font-medium text-on-accent transition-transform active:scale-[0.98] sm:inline-flex"
                >
                  <Plus size={14} weight="bold" />
                  Add entry
                </Link>
                <button
                  type="button"
                  onClick={signOut}
                  disabled={signingOut}
                  aria-label="Sign out"
                  title="Sign out"
 className="hidden h-9 w-9 place-items-center text-faint transition-colors hover:text-text disabled:opacity-50 sm:grid"
                >
                  <SignOut size={16} />
                </button>
              </>
            ) : (
              <Link
                href="/signin"
 className="hidden items-center gap-1.5 px-3 py-2 text-[13px] text-faint transition-colors hover:text-text sm:inline-flex"
              >
                <SignIn size={14} />
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ---- The phone's navigation: a floating bar, and a sheet above it ---- */}

      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
            className="fixed inset-0 z-40 bg-bg/70 backdrop-blur-[2px] lg:hidden"
          />
        )}
      </AnimatePresence>

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 38 }}
              className="pointer-events-auto mx-3 mb-2 max-w-[460px] border border-line-strong bg-surface/90 backdrop-blur-2xl sm:mx-auto"
            >
              {SHEET_LINKS.map((l) => {
                const active = isActive(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? "page" : undefined}
 className={`flex items-center gap-3 border-b border-line px-4 py-3.5 text-[14px] transition-colors ${
                      active ? "text-accent" : "text-dim"
                    }`}
                  >
                    <l.icon size={17} weight={active ? "fill" : "regular"} />
                    {l.label}
                  </Link>
                );
              })}

              <div className="flex items-center justify-between gap-3 px-2.5 py-2.5">
                <ThemeToggle />
                {admin ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={signOut}
                      disabled={signingOut}
 className="px-3 py-2 text-[13px] text-faint transition-colors active:text-text disabled:opacity-50"
                    >
                      Sign out
                    </button>
                    <Link
                      href="/add"
 className="inline-flex items-center gap-1.5 bg-accent px-3.5 py-2 text-[13px] font-medium text-on-accent transition-transform active:scale-[0.98]"
                    >
                      <Plus size={14} weight="bold" />
                      Add entry
                    </Link>
                  </div>
                ) : (
                  <Link
                    href="/signin"
 className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] text-dim transition-colors active:text-text"
                  >
                    <SignIn size={14} />
                    Sign in
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <nav
          aria-label="Main"
          className="pointer-events-auto mx-3 mb-3 flex max-w-[460px] items-stretch border border-line-strong bg-surface/80 shadow-[0_12px_40px_-12px_hsl(var(--shadow)/0.45)] backdrop-blur-2xl sm:mx-auto"
        >
          {TABS.map((t) => {
            const active = isActive(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
 className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] transition-colors ${
                  active ? "text-accent" : "text-faint"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="tab-active"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 38 }}
                    className="absolute inset-x-0 top-0 h-px bg-accent"
                  />
                )}
                <t.icon size={19} weight={active ? "fill" : "regular"} />
                {t.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "More"}
 className={`relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] transition-colors ${
              open || sheetActive ? "text-accent" : "text-faint"
            }`}
          >
            {sheetActive && !open && (
              <motion.span
                layoutId="tab-active"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 38 }}
                className="absolute inset-x-0 top-0 h-px bg-accent"
              />
            )}
            {open ? <X size={19} /> : <DotsThree size={19} weight="bold" />}
            {open ? "Close" : "More"}
          </button>
        </nav>
      </div>
    </>
  );
}
