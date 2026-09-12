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
        <h1 className="mt-2 display text-[clamp(2rem,5vw,3.25rem)]">
          Lines worth keeping
        </h1>
      </header>

      {quotes.length === 0 ? (
        <div className="py-24 text-center">
          <h2 className="display text-2xl">No lines saved yet</h2>
          <p className="mt-3 text-sm text-dim">
            Lines saved against an entry show up here.
          </p>
        </div>
      ) : (
        <ul className="mt-12 space-y-12">
          {quotes.map((q) => (
            <li key={q.id}>
              <figure className="border-l-2 border-accent pl-5 sm:pl-8">
                <blockquote className="max-w-3xl display text-[clamp(1.25rem,3vw,2rem)] font-light leading-[1.25] text-text">
                  “{q.text}”
                </blockquote>
                <figcaption className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {q.saidBy && <span className="label">{q.saidBy}</span>}
                  {q.movieSlug ? (
                    <Link href={`/movies/${q.movieSlug}`} className="label text-dim transition-colors hover:text-accent">
                      {q.movieTitle}
                    </Link>
                  ) : (
                    <span className="label text-faint">no linked entry</span>
                  )}
                  {q.favorite && <span className="data text-[10px] text-accent">★ favourite</span>}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
