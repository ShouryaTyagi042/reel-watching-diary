import Link from "next/link";
import { CoordPlate } from "@/components/CoordPlate";
import { MovieCard } from "@/components/MovieCard";
import { Poster } from "@/components/Poster";
import { EmptyDiary } from "@/components/EmptyDiary";
import { getVenues, getUnplacedVisits, getDashboardStats, isEmpty } from "@/lib/queries";
import { formatDate, pluralize } from "@/lib/format";

export const metadata = { title: "Cinemas" };

export default function CinemasPage() {
  if (isEmpty()) return <EmptyDiary />;

  const venues = getVenues();
  const unplaced = getUnplacedVisits();
  const stats = getDashboardStats();
  const placed = venues.reduce((n, v) => n + v.visits, 0);

  return (
    <>
      <header className="pt-10 sm:pt-14">
        <div className="eyebrow">Where the watching happened</div>
        <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3.25rem)] font-light leading-none text-paper">
          Cinemas
        </h1>
        <p className="mt-5 max-w-2xl text-[14px] leading-relaxed text-dim">
          The Notion tracker records only whether something was watched in a cinema — it never held a
          venue name. Each cinema below was placed from the GPS in the photos taken during the visit,
          which is the only evidence in the export that tells one cinema from another. Names are yours
          to fill in; the importer never overwrites them.
        </p>
      </header>

      <dl className="mt-9 grid grid-cols-2 gap-px border border-edge bg-edge/70 sm:grid-cols-4">
        <Stat label="Cinema visits" value={stats.cinemaVisits} />
        <Stat label="Cinemas placed" value={venues.length} />
        <Stat label="Visits with a venue" value={placed} />
        <Stat label="Venue unknown" value={unplaced.length} />
      </dl>

      {venues.length === 0 && unplaced.length === 0 ? (
        <div className="py-24 text-center">
          <h2 className="font-display text-2xl text-paper">No cinema visits yet</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-dim">
            Nothing in the export has the Theatre box ticked. Tick it in Notion, attach a photo from
            the screening, and re-run the import to see the cinema appear here.
          </p>
        </div>
      ) : (
        <>
          {venues.length > 0 && (
            <section className="mt-14">
              <div className="mb-5 flex items-end justify-between border-b border-edge/60 pb-3">
                <div>
                  <div className="eyebrow mb-1.5">Most visited first</div>
                  <h2 className="font-display text-2xl leading-none text-paper">Placed cinemas</h2>
                </div>
              </div>

              <ul className="grid gap-5 lg:grid-cols-2">
                {venues.map((v, i) => (
                  <li key={v.id}>
                    <Link
                      href={`/cinemas/${v.slug}`}
                      className="group flex gap-5 border border-edge bg-velvet/30 p-5 transition-colors hover:border-rose/60"
                    >
                      <div className="w-[76px] shrink-0">
                        {v.lastMoviePoster ? (
                          <Poster title={v.lastMovieTitle ?? "Last film"} path={v.lastMoviePoster} sizes="76px" />
                        ) : (
                          <div className="frame aspect-[2/3]" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="plate text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                          <h3
                            className={`truncate font-display text-xl leading-tight transition-colors group-hover:text-sconce ${
                              v.name ? "text-paper" : "italic text-dim"
                            }`}
                          >
                            {v.name ?? "Unnamed cinema"}
                          </h3>
                        </div>

                        <div className="plate mt-1.5 text-[11px] text-faint">
                          {v.lat != null && v.lng != null
                            ? `${v.lat.toFixed(4)}° N  ${v.lng.toFixed(4)}° E`
                            : "no position recorded"}
                        </div>

                        <div className="mt-4 flex items-baseline gap-2">
                          <span className="font-display text-3xl leading-none text-paper">{v.visits}</span>
                          <span className="eyebrow">{v.visits === 1 ? "visit" : "visits"}</span>
                          {v.averageRating !== null && (
                            <span className="plate ml-auto text-[11px] text-sconce">
                              avg {v.averageRating.toFixed(1)}★
                            </span>
                          )}
                        </div>

                        {v.lastMovieTitle && (
                          <p className="mt-3 truncate text-[13px] text-dim">
                            Last: <span className="text-paper">{v.lastMovieTitle}</span>
                            {v.lastVisitAt && <span className="text-faint"> · {formatDate(v.lastVisitAt)}</span>}
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
              <div className="mb-5 border-b border-edge/60 pb-3">
                <div className="eyebrow mb-1.5">{pluralize(unplaced.length, "visit")}</div>
                <h2 className="font-display text-2xl leading-none text-paper">Cinema not identified</h2>
              </div>
              <p className="mb-7 max-w-2xl text-[14px] leading-relaxed text-dim">
                These were watched in a cinema — the Theatre box is ticked in Notion — but no
                geotagged photo is attached, so there is nothing in the export to say which cinema it
                was. They are counted as visits and left unplaced rather than guessed at.
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {unplaced.map((m, i) => (
                  <MovieCard key={m.id} movie={m} index={i} />
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
    <div className="bg-ink px-4 py-5">
      <dd className="font-display text-[30px] leading-none text-paper">{value}</dd>
      <dt className="eyebrow mt-2.5">{label}</dt>
    </div>
  );
}
