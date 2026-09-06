import Link from "next/link";
import { Poster } from "@/components/Poster";
import { Stars } from "@/components/Stars";
import { Section } from "@/components/Section";
import { MovieShelf } from "@/components/MovieCard";
import { Ledger, type LedgerItem } from "@/components/Ledger";
import { CoordPlate } from "@/components/CoordPlate";
import { PersonChip } from "@/components/Avatar";
import { EmptyDiary } from "@/components/EmptyDiary";
import {
  getDashboardStats, getRecentlyLogged, getTopRated, getWatchlist, getInProgress,
  getGenreBreakdown, getVenues, getQuotes, getMonthlyActivity, getTopPeople, isEmpty,
} from "@/lib/queries";
import { formatDate, pluralize } from "@/lib/format";

export default function DiaryPage() {
  if (isEmpty()) return <EmptyDiary />;

  const stats = getDashboardStats();
  const recent = getRecentlyLogged(14);
  const [latest, ...rest] = recent;
  const topRated = getTopRated(8);
  const watching = getInProgress(6);
  const watchlist = getWatchlist(8);
  const genres = getGenreBreakdown().filter((g) => g.count > 0);
  const venues = getVenues();
  const quotes = getQuotes(3);
  const people = getTopPeople(16);
  const months = getMonthlyActivity();
  const peakMonth = Math.max(1, ...months.map((m) => m.count));
  const maxGenre = Math.max(1, ...genres.map((g) => g.count));

  const ledger: LedgerItem[] = [
    { label: "Entries", value: stats.total, note: `${stats.movies} films · ${stats.tvShows} shows`, href: "/library" },
    { label: "Watched", value: stats.watched, note: `${stats.toWatch} still to watch`, href: "/library?status=Watched" },
    {
      label: `Logged in ${stats.currentYear}`,
      value: stats.thisYear,
      note: `${stats.thisMonth} in ${stats.currentMonthLabel}`,
      href: `/library?logYear=${stats.currentYear}`,
    },
    {
      label: "Average rating",
      value: stats.averageRating !== null ? stats.averageRating.toFixed(2) : "—",
      suffix: stats.averageRating !== null ? "/5" : undefined,
      note: stats.ratedCount ? `across ${pluralize(stats.ratedCount, "rated entry", "rated entries")}` : "nothing rated yet",
    },
    {
      label: "Cinema visits",
      value: stats.cinemaVisits,
      note: `${stats.venuesIdentified} ${stats.venuesIdentified === 1 ? "venue" : "venues"} placed by photo`,
      href: "/cinemas",
    },
    {
      label: "People credited",
      value: stats.actorsCount + stats.directorsCount,
      note: `${stats.directorsCount} directors · ${stats.genresUsed} genres in play`,
      href: "/people",
    },
  ];

  return (
    <>
      {/* ---- Hero: the last thing watched, given the room it deserves ---- */}
      {latest && (
        <section className="relative pt-10 sm:pt-16">
          {/* The cool spill of a projected image against a dark wall. */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-10 left-0 h-[420px] w-full max-w-2xl opacity-60 blur-[90px]"
            style={{
              background:
                "radial-gradient(closest-side, rgba(168,198,228,0.20), rgba(212,101,124,0.10) 55%, transparent 78%)",
            }}
          />
          <div className="relative grid gap-8 sm:grid-cols-[minmax(0,190px)_1fr] sm:gap-10 lg:grid-cols-[minmax(0,240px)_1fr]">
            <Link href={`/movies/${latest.slug}`} className="group block w-[150px] sm:w-full">
              <Poster
                title={latest.title}
                path={latest.posterPath}
                url={latest.posterUrl}
                priority
                sizes="(max-width: 640px) 150px, 240px"
                className="transition-transform duration-500 group-hover:-translate-y-1.5"
              />
            </Link>

            <div className="flex min-w-0 flex-col justify-center">
              <div className="eyebrow">
                Last entry · {formatDate(latest.createdTime) ?? "undated"}
              </div>
              <h1 className="mt-3 font-display text-[clamp(2.25rem,6.5vw,4.5rem)] font-light leading-[0.95] tracking-[-0.02em] text-paper">
                <Link href={`/movies/${latest.slug}`} className="transition-colors hover:text-sconce">
                  {latest.title}
                </Link>
              </h1>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Stars value={latest.ratingValue} raw={latest.ratingRaw} size="lg" />
                {latest.year && <span className="plate text-dim">{latest.year}</span>}
                {latest.genres && <span className="plate text-dim">{latest.genres}</span>}
                {latest.format && <span className="plate text-faint">{latest.format}</span>}
              </div>

              {latest.watchedInTheatre && (
                <div className="mt-6 max-w-sm">
                  <CoordPlate
                    lat={latest.venueLat}
                    lng={latest.venueLng}
                    name={latest.venueName}
                    label={latest.venueLabel ?? undefined}
                    href={latest.venueSlug ? `/cinemas/${latest.venueSlug}` : "/cinemas"}
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ---- The running totals ---- */}
      <section className="mt-14">
        <Ledger items={ledger} />
        {months.length > 1 && (
          <div className="mt-8">
            <div className="eyebrow mb-3">
              Entries by month · {months[0].label} {months[0].year} – {months[months.length - 1].label}{" "}
              {months[months.length - 1].year}
            </div>
            <ol className="flex items-end gap-1.5 overflow-x-auto pb-1 sm:gap-2.5">
              {months.map((m) => (
                <li key={m.key} className="group flex w-9 shrink-0 flex-col items-center gap-1.5">
                  <span className="plate text-[10px] text-faint group-hover:text-sconce">
                    {m.count || ""}
                  </span>
                  <span
                    className={`w-full transition-colors ${
                      m.count ? "bg-sconce-dim group-hover:bg-sconce" : "bg-edge/70"
                    }`}
                    style={{ height: `${Math.max(3, (m.count / peakMonth) * 52)}px` }}
                    aria-hidden
                  />
                  <span className="plate text-[10px] text-faint">{m.label}</span>
                  <span className="sr-only">
                    {m.count} entries in {m.label} {m.year}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      {/* ---- Shelves ---- */}
      {rest.length > 0 && (
        <Section eyebrow="Working backwards" title="Recently logged" action={{ href: "/library", label: "All entries" }}>
          <MovieShelf movies={rest} emptyNote="Nothing logged yet." />
        </Section>
      )}

      {watching.length > 0 && (
        <Section eyebrow="Part-way through" title="Still watching">
          <MovieShelf movies={watching} emptyNote="Nothing in progress." />
        </Section>
      )}

      <Section
        eyebrow={stats.ratedCount ? `Top of ${stats.ratedCount} rated` : "Ratings"}
        title="Highest rated"
        action={{ href: "/library?sort=rating_desc", label: "By rating" }}
      >
        <MovieShelf movies={topRated} emptyNote="No ratings recorded in the export." />
      </Section>

      {/* ---- Cinemas ---- */}
      <Section
        eyebrow={`${pluralize(stats.cinemaVisits, "visit")} on record`}
        title="Cinemas"
        action={{ href: "/cinemas", label: "All cinemas" }}
      >
        {venues.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((v) => (
              <div key={v.id} className="border border-edge bg-velvet/40 p-5 transition-colors hover:border-rose/50">
                <CoordPlate
                  lat={v.lat}
                  lng={v.lng}
                  name={v.name}
                  label={v.label}
                  href={`/cinemas/${v.slug}`}
                  compact
                />
                <div className="mt-4 flex items-baseline justify-between">
                  <span className="font-display text-3xl leading-none text-paper">{v.visits}</span>
                  <span className="eyebrow">{v.visits === 1 ? "visit" : "visits"}</span>
                </div>
                {v.lastMovieTitle && (
                  <p className="mt-3 text-[13px] leading-snug text-dim">
                    Last seen here:{" "}
                    <Link href={`/movies/${v.lastMovieSlug}`} className="text-paper underline decoration-edge-2 underline-offset-4 hover:text-sconce">
                      {v.lastMovieTitle}
                    </Link>
                    {v.lastVisitAt && <span className="text-faint"> · {formatDate(v.lastVisitAt)}</span>}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-dim">
            No cinema visits have a position yet. The Notion export records only a Theatre yes/no
            checkbox — venues are worked out from the GPS in the photos attached to an entry.
          </p>
        )}
      </Section>

      {/* ---- Genres ---- */}
      {genres.length > 0 && (
        <Section eyebrow="What gets watched" title="By genre">
          <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {genres.map((g) => (
              <li key={g.slug}>
                <Link href={`/library?genre=${g.slug}`} className="group flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-[13px] text-dim transition-colors group-hover:text-paper">
                    {g.name}
                  </span>
                  <span className="h-2 flex-1 bg-edge/60">
                    <span
                      className="block h-full bg-sconce-dim transition-colors group-hover:bg-sconce"
                      style={{ width: `${(g.count / maxGenre) * 100}%` }}
                    />
                  </span>
                  <span className="plate w-5 shrink-0 text-right text-[11px] text-faint">{g.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ---- Faces ---- */}
      {people.length > 0 && (
        <Section
          eyebrow="Credited in more than one entry"
          title="Faces that keep coming back"
          action={{ href: "/people", label: "Everyone" }}
        >
          <ul className="grid grid-cols-4 gap-x-4 gap-y-7 sm:grid-cols-6 lg:grid-cols-8">
            {people.map((p) => (
              <li key={p.slug}>
                <PersonChip
                  name={p.name}
                  slug={p.slug}
                  photoPath={p.photoPath}
                  role={
                    p.directed > 0
                      ? `${p.directed} directed`
                      : `${p.actedIn} entries`
                  }
                  size={96}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ---- Quotes ---- */}
      {quotes.length > 0 && (
        <Section eyebrow={`${stats.quotesCount} kept`} title="Lines worth keeping" action={{ href: "/quotes", label: "All lines" }}>
          <div className="grid gap-6 sm:grid-cols-3">
            {quotes.map((q) => (
              <figure key={q.id} className="border-l-2 border-sconce-dim pl-4">
                <blockquote className="font-display text-lg leading-snug text-paper">“{q.text}”</blockquote>
                <figcaption className="eyebrow mt-3">
                  {q.saidBy}
                  {q.movieSlug && (
                    <>
                      {" · "}
                      <Link href={`/movies/${q.movieSlug}`} className="text-dim transition-colors hover:text-sconce">
                        {q.movieTitle}
                      </Link>
                    </>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>
      )}

      {watchlist.length > 0 && (
        <Section eyebrow="Queued up" title="To watch" action={{ href: "/library?status=To+Watch", label: "The list" }}>
          <MovieShelf movies={watchlist} emptyNote="Nothing on the list." />
        </Section>
      )}
    </>
  );
}
