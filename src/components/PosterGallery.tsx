"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import { ArrowUpRight, CaretLeft, CaretRight, Check, LinkSimple, Shapes } from "@phosphor-icons/react";
import { Poster } from "./Poster";
import { Stars } from "./Stars";
import { ratingText } from "@/lib/format";
import { slugify } from "@/lib/import-format";
import type { MovieCard as Row } from "@/lib/queries";

export type GalleryView = "grid" | "carousel";

const EASE = [0.16, 1, 0.3, 1] as const;
const LIFT = { type: "spring", stiffness: 420, damping: 30, mass: 0.7 } as const;

/**
 * The library's poster wall, and the thing the diary is for looking at.
 *
 * Pointing at a poster, or reaching it with the keyboard, makes it the one in
 * hand: it lifts, the rest of the wall falls back, and its title, rating and a
 * few actions come up over the artwork. Choosing it still goes through
 * PosterFlight, which carries the artwork on to the film page.
 *
 * "In hand" is one index shared by pointer and keyboard, so the two can never
 * disagree about which poster is lit. The pointer wins while it is over the
 * wall; a key press hands control back to focus.
 *
 * The carousel drags with a mouse as well as scrolling natively under touch and
 * trackpads. A drag that ends over a poster must not also open it, and the
 * click it produces is swallowed at the window, which is the only place that
 * runs before PosterFlight's own capture handler.
 */
/** Whether anything can hover here. Where nothing can, titles stay visible. */
function useCanHover(): boolean {
  const [can, setCan] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover)");
    setCan(mq.matches);
    const on = () => setCan(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return can;
}

export function PosterGallery({ movies, view }: { movies: Row[]; view: GalleryView }) {
  const reduce = useReducedMotion();
  const canHover = useCanHover();
  const tiles = useRef<(HTMLAnchorElement | null)[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const active = hovered ?? focused;

  // Remount on a change of page, filter or view so the entrance plays for the
  // new set, rather than being skipped as already animated.
  const setKey = `${view}-${movies.length ? `${movies[0].id}-${movies.length}` : "empty"}`;

  useEffect(() => {
    setHovered(null);
    setFocused(null);
  }, [setKey]);

  function columns(): number {
    const els = tiles.current.filter(Boolean) as HTMLElement[];
    if (view === "carousel" || els.length < 2) return 1;
    const top = els[0].getBoundingClientRect().top;
    const n = els.findIndex((el) => Math.abs(el.getBoundingClientRect().top - top) > 4);
    return n === -1 ? els.length : n;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const from = focused ?? active ?? -1;
    const last = movies.length - 1;
    const cols = columns();
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ...(view === "grid" ? { ArrowDown: cols, ArrowUp: -cols } : {}),
    };
    let next: number | null = null;
    if (e.key in step) next = from === -1 ? 0 : from + step[e.key];
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next === null) return;

    e.preventDefault();
    next = Math.max(0, Math.min(last, next));
    setHovered(null);
    const el = tiles.current[next];
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({
      block: "nearest",
      inline: view === "carousel" ? "center" : "nearest",
      behavior: reduce ? "auto" : "smooth",
    });
  }

  const tileProps = (i: number) => ({
    movie: movies[i],
    index: i,
    active: active === i,
    dimmed: active !== null && active !== i,
    tabbable: (focused ?? 0) === i,
    reduce: !!reduce,
    canHover,
    view,
    tileRef: (el: HTMLAnchorElement | null) => { tiles.current[i] = el; },
    onHover: (on: boolean) => setHovered(on ? i : null),
    onFocus: () => setFocused(i),
  });

  const body =
    view === "carousel" ? (
      <Carousel reduce={!!reduce} count={movies.length}>
        {movies.map((m, i) => (
          <motion.li
            key={m.id}
            className="w-[min(62vw,220px)] shrink-0 snap-center sm:w-[230px] lg:w-[250px]"
            variants={{
              hidden: { opacity: 0, x: 40 },
              shown: { opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE } },
            }}
          >
            <Tile {...tileProps(i)} />
          </motion.li>
        ))}
      </Carousel>
    ) : (
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {movies.map((m, i) => (
          <motion.li
            key={m.id}
            variants={{
              hidden: { opacity: 0, y: 16, scale: 0.98 },
              shown: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: EASE } },
            }}
          >
            <Tile {...tileProps(i)} />
          </motion.li>
        ))}
      </ul>
    );

  return (
    <motion.div
      key={setKey}
      role="region"
      aria-label={`Library, ${view === "grid" ? "grid" : "carousel"} view. Arrow keys move between films.`}
      onKeyDown={onKeyDown}
      onPointerLeave={() => setHovered(null)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(null);
      }}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: reduce ? 0 : view === "grid" ? 0.03 : 0.045 } } }}
      initial={reduce ? false : "hidden"}
      animate="shown"
    >
      {body}
    </motion.div>
  );
}

/* ------------------------------------------------------------------- tile -- */

function Tile({
  movie, index, active, dimmed, tabbable, reduce, canHover, view, tileRef, onHover, onFocus,
}: {
  movie: Row;
  index: number;
  active: boolean;
  dimmed: boolean;
  tabbable: boolean;
  reduce: boolean;
  canHover: boolean;
  view: GalleryView;
  tileRef: (el: HTMLAnchorElement | null) => void;
  onHover: (on: boolean) => void;
  onFocus: () => void;
}) {
  const href = `/movies/${movie.slug}`;
  const rating = ratingText(movie.ratingValue);
  const genres = movie.genres ? movie.genres.split(", ") : [];

  return (
    <motion.div
      className="relative"
      style={{ zIndex: active ? 10 : 1 }}
      onPointerEnter={(e) => e.pointerType === "mouse" && onHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && onHover(false)}
      onFocusCapture={onFocus}
      initial={false}
      animate={{
        scale: active && !reduce ? 1.045 : 1,
        opacity: dimmed ? 0.38 : 1,
        filter: dimmed ? "saturate(0.55)" : "saturate(1)",
      }}
      transition={reduce ? { duration: 0 } : { ...LIFT, opacity: { duration: 0.25 }, filter: { duration: 0.25 } }}
    >
      <Link
        ref={tileRef}
        href={href}
        data-tile=""
        draggable={false}
        tabIndex={tabbable ? 0 : -1}
        aria-label={`${movie.title}${movie.year ? `, ${movie.year}` : ""}${rating ? `, rated ${rating}` : ", unrated"}`}
        className="relative block outline-none focus-visible:outline-none"
      >
        <Poster
          title={movie.title}
          path={movie.posterPath}
          url={movie.posterUrl}
          priority={index < 6}
          sizes={view === "carousel" ? "250px" : "(max-width: 640px) 48vw, (max-width: 1024px) 30vw, 220px"}
          className="pointer-events-none select-none"
        />

        {/* The hairline that says which poster is in hand. */}
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1.5px_var(--accent)] transition-opacity duration-300 ${
            active ? "opacity-100" : "opacity-0"
          }`}
        />

        {movie.watchedInTheatre && (
          <span className="absolute left-0 top-0 bg-accent px-1.5 py-0.5 data text-[9px] font-bold uppercase tracking-[0.12em] text-on-accent">
            Cinema
          </span>
        )}
        {movie.status && movie.status !== "Watched" && !active && (
          <span className="absolute right-0 top-0 bg-bg/90 px-1.5 py-0.5 data text-[9px] uppercase tracking-[0.12em] text-dim backdrop-blur-sm">
            {movie.status}
          </span>
        )}

        {/* Title and rating, over the artwork. Always shown where nothing can hover. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-3 pt-14 text-white"
          initial={false}
          animate={{ opacity: active || !canHover ? 1 : 0, y: active || !canHover || reduce ? 0 : 8 }}
          transition={reduce ? { duration: 0 } : { duration: 0.32, ease: EASE }}
        >
          <div className="display line-clamp-2 text-[15px] leading-[1.1] sm:text-[17px]">{movie.title}</div>
          <div className="mt-2 flex items-center gap-2.5">
            {movie.ratingValue !== null ? (
              <>
                <span className="[&_.bg-line-strong]:bg-white/25">
                  <Stars value={movie.ratingValue} />
                </span>
                <span className="data text-[11px] text-white/90">{rating}</span>
              </>
            ) : (
              <span className="data text-[10px] uppercase tracking-[0.12em] text-white/60">Unrated</span>
            )}
            {movie.year && <span className="data ml-auto text-[10px] text-white/60">{movie.year}</span>}
          </div>
          {genres.length > 0 && (
            <div className="mt-1.5 hidden truncate text-[11px] text-white/55 sm:block">{genres.slice(0, 3).join(" · ")}</div>
          )}
        </motion.div>
      </Link>

      <ActionMenu movie={movie} href={href} genre={genres[0] ?? null} open={active} reduce={reduce} />
    </motion.div>
  );
}

/* ------------------------------------------------------------ action menu -- */

function ActionMenu({
  movie, href, genre, open, reduce,
}: {
  movie: Row;
  href: string;
  genre: string | null;
  open: boolean;
  reduce: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${href}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* Clipboard refused (insecure context or denied): nothing to undo. */
    }
  }

  const btn =
    "grid h-8 w-8 place-items-center bg-black/65 text-white backdrop-blur-md transition-colors hover:bg-accent hover:text-on-accent focus-visible:bg-accent focus-visible:text-on-accent";
  const item = {
    hidden: { opacity: 0, x: 8 },
    shown: { opacity: 1, x: 0, transition: reduce ? { duration: 0 } : { duration: 0.24, ease: EASE } },
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="toolbar"
          data-fade=""
          aria-label={`Actions for ${movie.title}`}
          className="absolute right-2 top-2 z-20 flex flex-col gap-1"
          initial="hidden"
          animate="shown"
          exit="hidden"
          variants={{ hidden: {}, shown: { transition: { staggerChildren: reduce ? 0 : 0.04 } } }}
        >
          <motion.div variants={item}>
            <Link href={href} className={btn} title="Open" aria-label={`Open ${movie.title}`} tabIndex={-1}>
              <ArrowUpRight size={15} weight="bold" />
            </Link>
          </motion.div>
          <motion.div variants={item}>
            <button type="button" onClick={copy} className={btn} title={copied ? "Copied" : "Copy link"} aria-label={`Copy link to ${movie.title}`}>
              {copied ? <Check size={15} weight="bold" /> : <LinkSimple size={15} weight="bold" />}
            </button>
          </motion.div>
          {genre && (
            <motion.div variants={item}>
              <Link
                href={`/library?genre=${slugify(genre)}`}
                className={btn}
                title={`More ${genre}`}
                aria-label={`More ${genre} films`}
              >
                <Shapes size={15} weight="bold" />
              </Link>
            </motion.div>
          )}
          <span className="sr-only" aria-live="polite">{copied ? "Link copied" : ""}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* --------------------------------------------------------------- carousel -- */

function Carousel({ children, reduce, count }: { children: React.ReactNode; reduce: boolean; count: number }) {
  const scroller = useRef<HTMLUListElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const { scrollXProgress } = useScroll({ container: scroller });
  const progress = useSpring(scrollXProgress, { stiffness: 260, damping: 40, restDelta: 0.001 });

  function page(dir: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  }

  function onPointerDown(e: React.PointerEvent<HTMLUListElement>) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft, moved: false };
  }

  function onPointerMove(e: React.PointerEvent<HTMLUListElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 5) return;
    if (!d.moved) {
      d.moved = true;
      setGrabbing(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    e.currentTarget.scrollLeft = d.left - dx;
  }

  function endDrag() {
    const d = drag.current;
    drag.current = null;
    setGrabbing(false);
    if (!d?.moved) return;
    // The click that follows a drag is not a choice. Take it at the window,
    // ahead of PosterFlight, and stop listening if no click comes.
    const swallow = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    window.addEventListener("click", swallow, { capture: true, once: true });
    window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4">
        <span className="data text-[11px] text-faint">
          Drag, scroll, or use <kbd className="font-sans">←</kbd> <kbd className="font-sans">→</kbd> · {count} here
        </span>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => page(-1)} aria-label="Scroll back"
            className="grid h-9 w-9 place-items-center border border-line text-dim transition-colors hover:border-accent hover:text-accent">
            <CaretLeft size={14} weight="bold" />
          </button>
          <button type="button" onClick={() => page(1)} aria-label="Scroll forward"
            className="grid h-9 w-9 place-items-center border border-line text-dim transition-colors hover:border-accent hover:text-accent">
            <CaretRight size={14} weight="bold" />
          </button>
        </div>
      </div>

      <ul
        ref={scroller}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDragStart={(e) => e.preventDefault()}
        className={`-mx-4 flex gap-4 overflow-x-auto px-4 py-6 [scrollbar-width:none] sm:mx-0 sm:gap-5 sm:px-1 [&::-webkit-scrollbar]:hidden ${
          grabbing ? "cursor-grabbing select-none" : "cursor-grab snap-x snap-mandatory"
        } [mask-image:linear-gradient(to_right,transparent,black_2.5rem,black_calc(100%-2.5rem),transparent)]`}
      >
        {children}
        <li aria-hidden className="w-px shrink-0" />
      </ul>

      <div className="mt-2 h-px bg-line" aria-hidden>
        <motion.div className="h-px origin-left bg-accent" style={{ scaleX: progress }} />
      </div>
    </div>
  );
}
