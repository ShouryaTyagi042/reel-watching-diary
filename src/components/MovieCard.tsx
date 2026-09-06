import Link from "next/link";
import { Poster } from "./Poster";
import { Stars } from "./Stars";
import { formatDate } from "@/lib/format";
import type { MovieCard as Row } from "@/lib/queries";

/** A poster tile: the primary way of moving through the diary. */
export function MovieCard({
  movie,
  index = 0,
  animate = true,
  priority = false,
}: {
  movie: Row;
  index?: number;
  animate?: boolean;
  priority?: boolean;
}) {
  const logged = formatDate(movie.createdTime);

  return (
    <Link
      href={`/movies/${movie.slug}`}
      className={`group block ${animate ? "rise" : ""}`}
      style={animate ? { animationDelay: `${Math.min(index, 14) * 28}ms` } : undefined}
    >
      <div className="relative">
        <Poster
          title={movie.title}
          path={movie.posterPath}
          url={movie.posterUrl}
          priority={priority}
          className="transition-transform duration-300 ease-out group-hover:-translate-y-1"
        />
        {/* Amber hairline on hover — the frame catching the house lights. */}
        <div className="pointer-events-none absolute inset-0 opacity-0 shadow-[inset_0_0_0_1px_var(--color-sconce)] transition-opacity duration-300 group-hover:opacity-70" />
        {movie.watchedInTheatre && (
          <div className="absolute left-0 top-0 bg-rose px-1.5 py-0.5">
            <span className="plate text-[9px] font-bold uppercase tracking-[0.14em] text-ink">
              Cinema
            </span>
          </div>
        )}
        {movie.status && movie.status !== "Watched" && (
          <div className="absolute right-0 top-0 bg-ink/85 px-1.5 py-0.5 backdrop-blur-sm">
            <span className="plate text-[9px] uppercase tracking-[0.14em] text-screen">
              {movie.status}
            </span>
          </div>
        )}
      </div>

      <div className="mt-2.5">
        <h3 className="truncate font-display text-[15px] leading-snug text-paper transition-colors group-hover:text-sconce">
          {movie.title}
        </h3>
        <div className="mt-1 flex items-center justify-between gap-2">
          <Stars value={movie.ratingValue} raw={movie.ratingRaw} />
          <span className="plate shrink-0 text-[10px] text-faint">
            {movie.year ?? (logged ? logged.slice(-4) : "—")}
          </span>
        </div>
      </div>
    </Link>
  );
}

/** A horizontally scrolling shelf of poster tiles. */
export function MovieShelf({ movies, emptyNote }: { movies: Row[]; emptyNote: string }) {
  if (!movies.length) {
    return <p className="text-sm text-dim">{emptyNote}</p>;
  }
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="flex gap-4 sm:gap-5">
        {movies.map((m, i) => (
          <div key={m.id} className="w-[132px] shrink-0 sm:w-[156px]">
            <MovieCard movie={m} index={i} />
          </div>
        ))}
      </div>
    </div>
  );
}
