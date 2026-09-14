import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Poster } from "@/components/Poster";
import { Stars } from "@/components/Stars";
import { Section } from "@/components/Section";
import { MovieShelf } from "@/components/MovieCard";
import { CoordPlate } from "@/components/CoordPlate";
import { EmptyDiary } from "@/components/EmptyDiary";
import { isAdmin } from "@/lib/auth";
import { Reveal, Stagger, StaggerItem, Magnetic } from "@/components/Motion";
import {
  getDashboardStats, getRecentlyLogged, getTopRated, getWatchlist, getInProgress,
  getGenreBreakdown, getVenues, getQuotes, getMonthlyActivity, getTopPeople, isEmpty,
} from "@/lib/queries";
import { formatDate, pluralize } from "@/lib/format";
import { PersonChip } from "@/components/Avatar";

export default async function DiaryPage() {
  const admin = await isAdmin();
  if (isEmpty()) return <EmptyDiary />;

  const stats = getDashboardStats();
  const recent = getRecentlyLogged(14);
  const [latest, ...rest] = recent;
  const topRated = getTopRated(8);
  const watching = getInProgress(6);
  const watchlist = getWatchlist(8);
  const genres = getGenreBreakdown().filter((g) => g.count > 0);
  const venues = getVenues();
  const quotes = getQuotes(2);
  const people = getTopPeople(16);
  const months = getMonthlyActivity();
  const peak = Math.max(1, ...months.map((m) => m.count));
  const maxGenre = Math.max(1, ...genres.map((g) => g.count));

  return (
    <>
      {/* Hero: the last thing watched, given the room it deserves. */}
      {latest && (
        <section className="grid items-end gap-10 pt-12 sm:pt-16 lg:grid-cols-[1fr_minmax(0,320px)] lg:gap-16 lg:pt-24">
          <div className="order-2 lg:order-1">
            {/* The hero carries the page's one uppercase label. */}
            <div className="label">Last entry, {formatDate(latest.createdTime) ?? "undated"}</div>
            <h1 className="display mt-4 text-[clamp(2.75rem,8vw,5.5rem)]">
              <Link href={`/movies/${latest.slug}`} className="transition-colors hover:text-accent">
                {latest.title}
              </Link>
            </h1>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Stars value={latest.ratingValue} raw={latest.ratingRaw} size="lg" />
              <span className="data text-[13px] text-dim">
                {[latest.year, latest.genres, latest.format].filter(Boolean).join("   ")}
              </span>
            </div>
            <Magnetic className="mt-9 inline-block">
              <Link
                href={`/movies/${latest.slug}`}
 className="inline-flex items-center gap-2 bg-accent px-5 py-3 text-[14px] font-medium text-on-accent transition-transform active:scale-[0.98]"
              >
                Open entry
                <ArrowRight size={15} weight="bold" />
              </Link>
            </Magnetic>
          </div>

          <Link href={`/movies/${latest.slug}`} className="order-1 block w-[168px] lg:order-2 lg:w-full">
            <Poster
              title={latest.title}
              path={latest.posterPath}
              url={latest.posterUrl}
              priority
              sizes="(max-width: 1024px) 168px, 320px"
            />
          </Link>
        </section>
      )}

      {/* Running totals, set as a ledger rather than a row of cards. */}
      <Reveal className="mt-20">
        <Stagger className="grid grid-cols-2 border-t border-line sm:grid-cols-3 lg:grid-cols-6">
          {[
            { v: stats.total, k: "Entries", n: `${stats.movies} films, ${stats.tvShows} shows`, href: "/library" },
            { v: stats.watched, k: "Watched", n: `${stats.toWatch} still to watch`, href: "/library?status=Watched" },
            { v: stats.thisYear, k: `Logged in ${stats.currentYear}`, n: `${stats.thisMonth} this month`, href: `/library?logYear=${stats.currentYear}` },
            { v: stats.averageRating !== null ? stats.averageRating.toFixed(2) : "0", k: "Average rating", n: `across ${stats.ratedCount} rated` },
            { v: stats.cinemaVisits, k: "Cinema visits", n: `${stats.venuesIdentified} venues placed`, href: "/cinemas" },
            { v: stats.actorsCount + stats.directorsCount, k: "People", n: `${stats.genresUsed} genres in play`, href: "/people" },
          ].map((s) => {
            const inner = (
              <div className="border-b border-line py-6 pr-4 transition-colors group-hover:border-accent">
                <div className="display text-[34px] leading-none">{s.v}</div>
                <div className="label mt-3">{s.k}</div>
                <p className="mt-1 text-[11.5px] text-faint">{s.n}</p>
              </div>
            );
            return (
              <StaggerItem key={s.k} className="group">
                {s.href ? <Link href={s.href}>{inner}</Link> : inner}
              </StaggerItem>
            );
          })}
        </Stagger>
      </Reveal>

      {/* Rhythm of the year. */}
      {months.length > 1 && (
        <Reveal className="mt-14">
          <h2 className="sr-only">Entries by month</h2>
          <ol className="flex items-end gap-1.5 overflow-x-auto pb-1 sm:gap-3">
            {months.map((m) => (
              <li key={m.key} className="group flex w-9 shrink-0 flex-col items-center gap-2">
                <span className="data text-[10px] text-faint">{m.count || ""}</span>
                <span
 className={`w-full transition-colors ${m.count ? "bg-line-strong group-hover:bg-accent" : "bg-line"}`}
                  style={{ height: `${Math.max(3, (m.count / peak) * 56)}px` }}
                  aria-hidden
                />
                <span className="data text-[10px] text-faint">{m.label}</span>
                <span className="sr-only">{m.count} entries in {m.label} {m.year}</span>
              </li>
            ))}
          </ol>
        </Reveal>
      )}

      {rest.length > 0 && (
        <Section title="Recently logged" action={{ href: "/library", label: "All entries" }}>
          <MovieShelf movies={rest} emptyNote="Nothing logged yet." />
        </Section>
      )}

      {watching.length > 0 && (
        <Section title="Still watching">
          <MovieShelf movies={watching} emptyNote="Nothing in progress." />
        </Section>
      )}

      <Section
        title="Highest rated"
        note={stats.ratedCount ? `Top of ${stats.ratedCount} rated entries` : undefined}
        action={{ href: "/library?sort=rating_desc", label: "By rating" }}
      >
        <MovieShelf movies={topRated} emptyNote="No ratings recorded yet." />
      </Section>

      <Section
        title="Cinemas"
        note={`${pluralize(stats.cinemaVisits, "visit")} on record`}
        action={{ href: "/cinemas", label: "All cinemas" }}
      >
        {venues.length ? (
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((v) => (
              <StaggerItem key={v.id}>
                <Link href={`/cinemas/${v.slug}`} className="group block border border-line p-5 transition-colors hover:border-accent">
                  <CoordPlate
                    lat={admin ? v.lat : null}
                    lng={admin ? v.lng : null}
                    name={v.name}
                    label={v.label}
                    compact
                    admin={admin}
                  />
                  <div className="mt-5 flex items-baseline justify-between">
                    <span className="display text-[30px] leading-none">{v.visits}</span>
                    <span className="label">{v.visits === 1 ? "visit" : "visits"}</span>
                  </div>
                  {v.lastMovieTitle && (
                    <p className="mt-3 truncate text-[13px] text-dim">
                      Last: <span className="text-text">{v.lastMovieTitle}</span>
                    </p>
                  )}
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        ) : (
          <p className="max-w-prose text-sm text-dim">
            No cinema visit has a position yet. Venues come from the GPS in photos attached to an
            entry, so add a photo taken at the screening and the cinema appears here.
          </p>
        )}
      </Section>

      {genres.length > 0 && (
        <Section title="By genre" action={{ href: "/genres", label: "All genres" }}>
          <Stagger className="grid gap-x-10 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-3" as="ul">
            {genres.map((g) => (
              <StaggerItem key={g.slug} as="li">
                <Link href={`/genres/${g.slug}`} className="group flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-[13px] text-dim transition-colors group-hover:text-text">
                    {g.name}
                  </span>
                  <span className="h-1.5 flex-1 bg-line">
                    <span
 className="block h-full bg-line-strong transition-colors group-hover:bg-accent"
                      style={{ width: `${(g.count / maxGenre) * 100}%` }}
                    />
                  </span>
                  <span className="data w-5 shrink-0 text-right text-[11px] text-faint">{g.count}</span>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}

      {people.length > 0 && (
        <Section title="Faces that keep coming back" action={{ href: "/people", label: "Everyone" }}>
          <Stagger className="grid grid-cols-4 gap-x-4 gap-y-8 sm:grid-cols-6 lg:grid-cols-8" as="ul">
            {people.map((p) => (
              <StaggerItem key={p.slug} as="li">
                <PersonChip
                  name={p.name}
                  slug={p.slug}
                  photoPath={p.photoPath}
                  role={p.directed > 0 ? `${p.directed} directed` : `${p.actedIn} entries`}
                  size={96}
                />
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}

      {quotes.length > 0 && (
        <Section title="Lines worth keeping" action={{ href: "/quotes", label: "All lines" }}>
          <div className="grid gap-8 sm:grid-cols-2">
            {quotes.map((q) => (
              <Reveal key={q.id}>
                <figure className="border-l-2 border-accent pl-5">
                  <blockquote className="display text-[20px] leading-[1.25] sm:text-[23px]">
                    {q.text}
                  </blockquote>
                  <figcaption className="label mt-3.5">
                    {q.saidBy}
                    {q.movieSlug && (
                      <>
                        {", "}
                        <Link href={`/movies/${q.movieSlug}`} className="text-dim transition-colors hover:text-accent">
                          {q.movieTitle}
                        </Link>
                      </>
                    )}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {watchlist.length > 0 && (
        <Section title="To watch" action={{ href: "/library?status=To+Watch", label: "The list" }}>
          <MovieShelf movies={watchlist} emptyNote="Nothing on the list." />
        </Section>
      )}
    </>
  );
}
