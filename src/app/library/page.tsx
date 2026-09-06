import { Suspense } from "react";
import Link from "next/link";
import { MovieCard } from "@/components/MovieCard";
import { LibraryControls } from "@/components/LibraryControls";
import { EmptyDiary } from "@/components/EmptyDiary";
import { getLibrary, getFilterOptions, isEmpty, type LibraryFilters } from "@/lib/queries";

export const metadata = { title: "Library" };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isEmpty()) return <EmptyDiary />;

  const sp = await searchParams;
  const first = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const filters: LibraryFilters = {
    q: first("q"), status: first("status"), format: first("format"),
    genre: first("genre"), director: first("director"), logYear: first("logYear"),
    releaseFrom: first("releaseFrom"), releaseTo: first("releaseTo"),
    minRating: first("minRating"), cinema: first("cinema"),
    sort: first("sort"), page: first("page"),
  };

  const { rows, total, page, pageCount } = getLibrary(filters);
  const options = getFilterOptions();

  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v && k !== "page") p.set(k, v); });
    if (n > 1) p.set("page", String(n));
    return `/library${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <>
      <header className="pt-10 sm:pt-14">
        <div className="eyebrow">Everything logged</div>
        <h1 className="mt-2 font-display text-[clamp(2rem,5vw,3.25rem)] font-light leading-none text-paper">
          Library
        </h1>
      </header>

      <div className="mt-8">
        <Suspense fallback={<div className="h-14 animate-pulse border border-edge bg-velvet/30" />}>
          <LibraryControls options={options} total={total} showing={rows.length} />
        </Suspense>
      </div>

      {rows.length === 0 ? (
        <div className="py-24 text-center">
          <h2 className="font-display text-2xl text-paper">Nothing matches those filters</h2>
          <p className="mt-3 text-sm text-dim">
            Try widening the search, or clear the filters to see everything again.
          </p>
          <Link
            href="/library"
            className="mt-6 inline-block border border-sconce/60 px-4 py-2 text-[13px] text-sconce transition-colors hover:bg-sconce hover:text-ink"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {rows.map((m, i) => (
              <MovieCard key={m.id} movie={m} index={i} priority={i < 6} />
            ))}
          </div>

          {pageCount > 1 && (
            <nav className="mt-14 flex items-center justify-center gap-2" aria-label="Pagination">
              <PageLink href={pageHref(page - 1)} disabled={page === 1}>← Previous</PageLink>
              <span className="plate px-4 text-[11px] text-faint">
                Page {page} of {pageCount}
              </span>
              <PageLink href={pageHref(page + 1)} disabled={page === pageCount}>Next →</PageLink>
            </nav>
          )}
        </>
      )}
    </>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return <span className="border border-edge/50 px-3.5 py-2 text-[13px] text-faint/50">{children}</span>;
  }
  return (
    <Link href={href} className="border border-edge px-3.5 py-2 text-[13px] text-dim transition-colors hover:border-sconce hover:text-sconce">
      {children}
    </Link>
  );
}
