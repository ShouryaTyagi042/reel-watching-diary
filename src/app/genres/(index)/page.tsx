import Link from "next/link";
import { Poster } from "@/components/Poster";
import { EmptyDiary } from "@/components/EmptyDiary";
import { Stagger, StaggerItem } from "@/components/Motion";
import { getGenres, isEmpty } from "@/lib/queries";

export const metadata = { title: "Genres" };

export default function GenresPage() {
  if (isEmpty()) return <EmptyDiary />;

  const genres = getGenres();
  const used = genres.filter((g) => g.total > 0);
  const unused = genres.filter((g) => g.total === 0);
  const max = Math.max(1, ...used.map((g) => g.total));

  return (
    <>
      <header className="pt-12 sm:pt-20">
        <h1 className="display text-[clamp(2.5rem,6vw,4rem)]">Genres</h1>
        <p className="mt-3 max-w-prose text-[14px] leading-relaxed text-faint">
          {used.length} in play across {used.reduce((n, g) => n + g.total, 0)} credits.
          Counts are live, so they stay true as entries are added.
        </p>
      </header>

      {/*
        Mixed tile sizes rather than a row of equal cards: the busiest genres
        take more room, which is itself the information.
      */}
      <Stagger className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" as="ul">
        {used.map((g, i) => {
          const big = i < 2;
          return (
            <StaggerItem key={g.slug} as="li" className={big ? "col-span-2" : ""}>
              <Link
                href={`/genres/${g.slug}`}
                className="group relative flex h-full min-h-[190px] flex-col justify-between overflow-hidden border border-line p-5 transition-colors hover:border-accent"
              >
                {g.posterPath || g.posterUrl ? (
                  <div className="pointer-events-none absolute inset-0 opacity-[0.13] transition-opacity duration-500 group-hover:opacity-25">
                    <Poster title="" path={g.posterPath} url={g.posterUrl} sizes="360px" className="h-full w-full" />
                  </div>
                ) : null}

                <div className="relative flex items-baseline gap-3">
                  <span className="display text-[40px] leading-none">{g.total}</span>
                  {g.averageRating !== null && (
                    <span className="data text-[11px] text-faint">avg {g.averageRating.toFixed(1)}</span>
                  )}
                </div>

                <div className="relative">
                  <h2 className="display text-[21px] transition-colors group-hover:text-accent">{g.name}</h2>
                  <p className="mt-1.5 text-[11.5px] text-faint">
                    {[
                      g.watched && `${g.watched} watched`,
                      g.watching && `${g.watching} watching`,
                      g.toWatch && `${g.toWatch} to watch`,
                    ].filter(Boolean).join(", ")}
                  </p>
                  <span className="mt-3 block h-1 bg-line">
                    <span
                      className="block h-full bg-line-strong transition-colors group-hover:bg-accent"
                      style={{ width: `${(g.total / max) * 100}%` }}
                    />
                  </span>
                </div>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>

      {unused.length > 0 && (
        <section className="mt-16">
          <h2 className="display text-[22px]">Not used yet</h2>
          <p className="mt-2 max-w-prose text-[13px] text-faint">
            Defined in the collection but not yet attached to an entry. Kept rather than dropped.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {unused.map((g) => (
              <li key={g.slug} className="border border-line px-2.5 py-1 text-[12.5px] text-faint">
                {g.name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
