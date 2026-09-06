import Link from "next/link";
import { getQuotes, isEmpty } from "@/lib/queries";
import { EmptyDiary } from "@/components/EmptyDiary";

export const metadata = { title: "Lines" };

export default function QuotesPage() {
  if (isEmpty()) return <EmptyDiary />;
  const quotes = getQuotes();

  return (
    <>
      <header className="pt-10 sm:pt-14">
        <div className="eyebrow">From the Notion “Quotes” database</div>
        <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3.25rem)] font-light leading-none text-paper">
          Lines worth keeping
        </h1>
      </header>

      {quotes.length === 0 ? (
        <div className="py-24 text-center">
          <h2 className="font-display text-2xl text-paper">No lines saved yet</h2>
          <p className="mt-3 text-sm text-dim">
            Add quotes to the Notion tracker and re-run the import to see them here.
          </p>
        </div>
      ) : (
        <ul className="mt-12 space-y-12">
          {quotes.map((q) => (
            <li key={q.id}>
              <figure className="border-l-2 border-sconce-dim pl-5 sm:pl-8">
                <blockquote className="max-w-3xl font-display text-[clamp(1.25rem,3vw,2rem)] font-light leading-[1.25] text-paper">
                  “{q.text}”
                </blockquote>
                <figcaption className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {q.saidBy && <span className="eyebrow">{q.saidBy}</span>}
                  {q.movieSlug ? (
                    <Link href={`/movies/${q.movieSlug}`} className="eyebrow text-dim transition-colors hover:text-sconce">
                      {q.movieTitle}
                    </Link>
                  ) : (
                    <span className="eyebrow text-faint">no linked entry</span>
                  )}
                  {q.favorite && <span className="plate text-[10px] text-sconce">★ favourite</span>}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
