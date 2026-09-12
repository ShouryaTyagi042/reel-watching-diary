"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Poster } from "./Poster";
import { Stars } from "./Stars";
import type { MovieCard as Row } from "@/lib/queries";

/**
 * A poster tile, the main way of moving through the diary.
 *
 * On hover the artwork lifts and the accent hairline closes around it. The
 * motion is feedback, showing which tile the pointer owns, and it collapses to
 * a plain colour change under reduced motion.
 */
export function MovieCard({ movie, priority = false }: { movie: Row; priority?: boolean }) {
  const reduce = useReducedMotion();

  return (
    <Link href={`/movies/${movie.slug}`} className="group block">
      <motion.div
 className="relative"
        whileHover={reduce ? undefined : { y: -6 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
      >
        <Poster
          title={movie.title}
          path={movie.posterPath}
          url={movie.posterUrl}
          priority={priority}
        />
        <div className="pointer-events-none absolute inset-0 opacity-0 shadow-[inset_0_0_0_1.5px_var(--accent)] transition-opacity duration-300 group-hover:opacity-100" />
        {movie.watchedInTheatre && (
          <span className="absolute left-0 top-0 bg-accent px-1.5 py-0.5 data text-[9px] font-bold uppercase tracking-[0.12em] text-on-accent">
            Cinema
          </span>
        )}
        {movie.status && movie.status !== "Watched" && (
          <span className="absolute right-0 top-0 bg-bg/90 px-1.5 py-0.5 data text-[9px] uppercase tracking-[0.12em] text-dim backdrop-blur-sm">
            {movie.status}
          </span>
        )}
      </motion.div>

      <div className="mt-2.5">
        <h3 className="truncate text-[14px] font-medium leading-snug transition-colors group-hover:text-accent">
          {movie.title}
        </h3>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <Stars value={movie.ratingValue} raw={movie.ratingRaw} />
          <span className="data shrink-0 text-[10px] text-faint">{movie.year ?? ""}</span>
        </div>
      </div>
    </Link>
  );
}

/** A horizontally scrolling shelf of tiles. */
export function MovieShelf({ movies, emptyNote }: { movies: Row[]; emptyNote: string }) {
  if (!movies.length) return <p className="text-sm text-dim">{emptyNote}</p>;
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="flex gap-4 sm:gap-5">
        {movies.map((m) => (
          <div key={m.id} className="w-[134px] shrink-0 sm:w-[158px]">
            <MovieCard movie={m} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** The library and detail grids. Tiles  in as the grid enters the viewport. */
export function MovieGrid({ movies, priorityCount = 6 }: { movies: Row[]; priorityCount?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
 className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
      variants={{ hidden: {}, shown: { transition: { staggerChildren: reduce ? 0 : 0.035 } } }}
      initial={reduce ? false : "hidden"}
      whileInView="shown"
      viewport={{ once: true, amount: 0.05 }}
    >
      {movies.map((m, i) => (
        <motion.div
          key={m.id}
          variants={{
            hidden: { opacity: 0, y: 16 },
            shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
          }}
        >
          <MovieCard movie={m} priority={i < priorityCount} />
        </motion.div>
      ))}
    </motion.div>
  );
}
