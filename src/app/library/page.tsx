import { Suspense } from "react";
import Link from "next/link";
import { MovieGrid } from "@/components/MovieCard";
import { ExpandingGrid } from "@/components/ExpandingGrid";
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
      <header data-fade className="pt-12 sm:pt-20">
        <h1 className="display text-[clamp(2.5rem,6vw,4rem)]">Library</h1>
        <p className="mt-3 text-[14px] text-faint">Everything logged, {total} entries.</p>
      </header>

      <div data-fade className="mt-8">
        <Suspense fallback={<div className="h-14 animate-pulse border border-line bg-surface-2" />}>
          <LibraryControls options={options} total={total} showing={rows.length} />
        </Suspense>
      </div>

      {rows.length === 0 ? (
        <div className="py-24 text-center">
          <h2 className="display text-2xl">Nothing matches those filters</h2>
          <p className="mt-3 text-sm text-dim">
            Try widening the search, or clear the filters to see everything again.
          </p>
          <Link
            href="/library"
 className="mt-7 inline-block bg-accent px-4 py-2.5 text-[13px] font-medium text-on-accent transition-transform active:scale-[0.98]"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <>
          <ExpandingGrid>
            <MovieGrid movies={rows} />
          </ExpandingGrid>

          {pageCount > 1 && (
            <nav data-fade className="mt-14 flex items-center justify-center gap-2" aria-label="Pagination">
              <PageLink href={pageHref(page - 1)} disabled={page === 1}>← Previous</PageLink>
              <span className="data px-4 text-[11px] text-faint">
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
    return <span className="border border-line px-3.5 py-2 text-[13px] text-faint opacity-40">{children}</span>;
  }
  return (
    <Link href={href} className="border border-line px-3.5 py-2 text-[13px] text-dim transition-colors hover:border-accent hover:text-accent">
      {children}
    </Link>
  );
}
