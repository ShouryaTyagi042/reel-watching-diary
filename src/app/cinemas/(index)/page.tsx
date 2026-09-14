import Link from "next/link";
import { CoordPlate } from "@/components/CoordPlate";
import { MovieCard } from "@/components/MovieCard";
import { Poster } from "@/components/Poster";
import { EmptyDiary } from "@/components/EmptyDiary";
import { isAdmin } from "@/lib/auth";
import { getVenues, getUnplacedVisits, getDashboardStats, isEmpty } from "@/lib/queries";
import { formatDate, pluralize } from "@/lib/format";

export const metadata = { title: "Cinemas" };

export default async function CinemasPage() {
  const admin = await isAdmin();
  if (isEmpty()) return <EmptyDiary />;

  const venues = getVenues();
  const unplaced = getUnplacedVisits();
  const stats = getDashboardStats();
  const placed = venues.reduce((n, v) => n + v.visits, 0);

  return (
    <>
      <header className="pt-10 sm:pt-14">
        <h1 className="mt-2 display text-[clamp(2rem,5vw,3.25rem)]">
          Cinemas
        </h1>
        <p className="mt-5 max-w-2xl text-[14px] leading-relaxed text-dim">
          An entry records that you watched something in a cinema, but not which one. Each cinema
          below was placed from the GPS in the photos taken during the visit, that position is what
          tells one cinema from another. Names are yours to fill in, and they are never overwritten.
        </p>
      </header>

      <dl className="mt-9 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        <Stat label="Cinema visits" value={stats.cinemaVisits} />
        <Stat label="Cinemas placed" value={venues.length} />
        <Stat label="Visits with a venue" value={placed} />
        <Stat label="Venue unknown" value={unplaced.length} />
      </dl>

      {venues.length === 0 && unplaced.length === 0 ? (
        <div className="py-24 text-center">
          <h2 className="display text-2xl">No cinema visits yet</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-dim">
            No entry is marked as watched in a cinema yet. Mark one, attach a photo from the
            screening, and the cinema appears here.
          </p>
        </div>
      ) : (
        <>
          {venues.length > 0 && (
            <section className="mt-14">
              <div className="mb-5 flex items-end justify-between border-b border-line pb-3">
                <div>
                  <h2 className="display text-[26px]">Placed cinemas</h2>
                  <p className="mt-1.5 text-[13px] text-faint">Most visited first.</p>
                </div>
              </div>

              <ul className="grid gap-5 lg:grid-cols-2">
                {venues.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/cinemas/${v.slug}`}
 className="group flex gap-5 border border-line bg-surface p-5 transition-colors hover:border-accent"
                    >
                      <div className="w-[76px] shrink-0">
                        {v.lastMoviePoster ? (
                          <Poster title={v.lastMovieTitle ?? "Last film"} path={v.lastMoviePoster} sizes="76px" />
                        ) : (
                          <div className="well aspect-[2/3]" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <h3
 className={`truncate display text-xl leading-tight transition-colors group-hover:text-accent ${
                              v.name ? "text-text" : "italic text-dim"
                            }`}
                          >
                            {v.name ?? "Unnamed cinema"}
                          </h3>
                        </div>

                        <div className="data mt-1.5 text-[11px] text-faint">
                          {admin && v.lat != null && v.lng != null
                            ? `${v.lat.toFixed(4)}° N  ${v.lng.toFixed(4)}° E`
                            : v.lat != null
                              ? "Placed from a photo"
                              : "No position recorded"}
                        </div>

                        <div className="mt-4 flex items-baseline gap-2">
                          <span className="display text-3xl leading-none text-text">{v.visits}</span>
                          <span className="label">{v.visits === 1 ? "visit" : "visits"}</span>
                          {v.averageRating !== null && (
                            <span className="data ml-auto text-[11px] text-accent">
                              avg {v.averageRating.toFixed(1)}★
                            </span>
                          )}
                        </div>

                        {v.lastMovieTitle && (
                          <p className="mt-3 truncate text-[13px] text-dim">
                            Last: <span className="text-text">{v.lastMovieTitle}</span>
                            {v.lastVisitAt && <span className="text-faint">, {formatDate(v.lastVisitAt)}</span>}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {unplaced.length > 0 && (
            <section className="mt-16">
              <div className="mb-5 border-b border-line pb-3">
                <h2 className="display text-[26px]">Cinema not identified</h2>
                <p className="mt-1.5 text-[13px] text-faint">{pluralize(unplaced.length, "visit")}.</p>
              </div>
              <p className="mb-7 max-w-2xl text-[14px] leading-relaxed text-dim">
                These are marked as watched in a cinema, but no geotagged photo is attached, so
                there is nothing to say which cinema it was. They are counted as visits and left
                unplaced rather than guessed at.
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {unplaced.map((m, i) => (
                <MovieCard key={m.id} movie={m} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-bg px-4 py-5">
      <dd className="display text-[30px] leading-none text-text">{value}</dd>
      <dt className="label mt-2.5">{label}</dt>
    </div>
  );
}
