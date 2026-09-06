"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

export interface FilterOptions {
  statuses: string[];
  formats: string[];
  genres: { name: string; slug: string; count: number }[];
  directors: { name: string; slug: string; count: number }[];
  venues: { slug: string; label: string; name: string | null; count: number }[];
  logYears: string[];
  releaseMin: number | null;
  releaseMax: number | null;
}

const SORT_LABELS: Record<string, string> = {
  recent: "Recently logged",
  oldest: "Oldest first",
  rating_desc: "Highest rated",
  rating_asc: "Lowest rated",
  title_asc: "Title A–Z",
  title_desc: "Title Z–A",
  year_desc: "Newest release",
  year_asc: "Oldest release",
};

/**
 * Search, filter and sort controls. State lives in the URL so any view of the
 * library can be linked to, bookmarked, or reloaded without losing its place.
 */
export function LibraryControls({
  options,
  total,
  showing,
}: {
  options: FilterOptions;
  total: number;
  showing: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(false);

  // Keep the box in step when the URL changes from elsewhere (e.g. "clear all").
  useEffect(() => {
    setQ(params.get("q") ?? "");
  }, [params]);

  const push = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      next.delete("page"); // any change to the query returns to the first page
      startTransition(() => {
        router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
      });
    },
    [params, pathname, router],
  );

  const set = (key: string, value: string) =>
    push((p) => (value ? p.set(key, value) : p.delete(key)));

  // Debounce typing so we're not re-querying on every keystroke.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => set("q", q), 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = ["status", "format", "genre", "director", "logYear", "cinema", "minRating", "releaseFrom", "releaseTo"]
    .filter((k) => params.get(k));
  const activeCount = active.length + (params.get("q") ? 1 : 0);

  return (
    <div className="border-b border-edge/60 pb-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden
          >
            <circle cx="6.5" cy="6.5" r="4.75" stroke="currentColor" strokeWidth="1.3" />
            <path d="M10.2 10.2L14 14" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles, cast, directors…"
            aria-label="Search the library"
            className="w-full border border-edge bg-velvet/50 py-2.5 pl-9 pr-9 text-sm text-paper placeholder:text-faint focus:border-sconce focus:outline-none"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-faint hover:text-paper"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`flex items-center gap-2 border px-3.5 py-2.5 text-[13px] transition-colors ${
            activeCount
              ? "border-sconce/60 text-sconce"
              : "border-edge text-dim hover:border-edge-2 hover:text-paper"
          }`}
        >
          Filters
          {activeCount > 0 && (
            <span className="plate bg-sconce px-1.5 text-[10px] font-bold text-ink">{activeCount}</span>
          )}
        </button>

        <label className="flex items-center gap-2">
          <span className="sr-only">Sort by</span>
          <select
            value={params.get("sort") ?? "recent"}
            onChange={(e) => set("sort", e.target.value === "recent" ? "" : e.target.value)}
            className="border border-edge bg-velvet/50 px-3 py-2.5 text-[13px] text-dim focus:border-sconce focus:outline-none"
          >
            {Object.entries(SORT_LABELS).map(([v, label]) => (
              <option key={v} value={v} className="bg-ink text-paper">{label}</option>
            ))}
          </select>
        </label>

        <span className={`plate ml-auto text-[11px] ${pending ? "text-sconce" : "text-faint"}`} aria-live="polite">
          {pending ? "filtering…" : `${showing} of ${total}`}
        </span>
      </div>

      {open && (
        <div className="mt-5 grid gap-x-6 gap-y-5 border border-edge bg-velvet/30 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Status" value={params.get("status") ?? ""} onChange={(v) => set("status", v)}
            options={options.statuses.map((s) => ({ value: s, label: s }))} allLabel="Any status" />

          <Select label="Format" value={params.get("format") ?? ""} onChange={(v) => set("format", v)}
            options={options.formats.map((s) => ({ value: s, label: s }))} allLabel="Any format" />

          <Select label="Genre" value={params.get("genre") ?? ""} onChange={(v) => set("genre", v)}
            options={options.genres.map((g) => ({ value: g.slug, label: `${g.name} (${g.count})` }))}
            allLabel="Any genre" />

          <Select label="Director" value={params.get("director") ?? ""} onChange={(v) => set("director", v)}
            options={options.directors.map((d) => ({ value: d.slug, label: `${d.name} (${d.count})` }))}
            allLabel="Any director" />

          <Select label="Logged in" value={params.get("logYear") ?? ""} onChange={(v) => set("logYear", v)}
            options={options.logYears.map((y) => ({ value: y, label: y }))} allLabel="Any year" />

          <Select
            label="Cinema"
            value={params.get("cinema") ?? ""}
            onChange={(v) => set("cinema", v)}
            allLabel="Anywhere"
            options={[
              { value: "any", label: "Seen in a cinema" },
              { value: "none", label: "Not in a cinema" },
              ...options.venues.map((v) => ({
                value: v.slug,
                label: `${v.name ?? v.label} (${v.count})`,
              })),
            ]}
          />

          <Select label="Rated at least" value={params.get("minRating") ?? ""} onChange={(v) => set("minRating", v)}
            allLabel="Any rating"
            options={["5", "4.5", "4", "3.5", "3", "2"].map((r) => ({ value: r, label: `${r} stars` }))} />

          <div>
            <span className="eyebrow mb-2 block">Released between</span>
            <div className="flex items-center gap-2">
              <input
                type="number" inputMode="numeric"
                placeholder={options.releaseMin?.toString() ?? "from"}
                defaultValue={params.get("releaseFrom") ?? ""}
                onBlur={(e) => set("releaseFrom", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && set("releaseFrom", e.currentTarget.value)}
                aria-label="Released from year"
                className="w-full min-w-0 border border-edge bg-ink px-2.5 py-2 text-[13px] text-paper placeholder:text-faint focus:border-sconce focus:outline-none"
              />
              <span className="text-faint">–</span>
              <input
                type="number" inputMode="numeric"
                placeholder={options.releaseMax?.toString() ?? "to"}
                defaultValue={params.get("releaseTo") ?? ""}
                onBlur={(e) => set("releaseTo", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && set("releaseTo", e.currentTarget.value)}
                aria-label="Released to year"
                className="w-full min-w-0 border border-edge bg-ink px-2.5 py-2 text-[13px] text-paper placeholder:text-faint focus:border-sconce focus:outline-none"
              />
            </div>
          </div>

          {activeCount > 0 && (
            <div className="flex items-end lg:col-start-4">
              <button
                type="button"
                onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
                className="text-[13px] text-rose underline decoration-rose/40 underline-offset-4 hover:decoration-rose"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Select({
  label, value, onChange, options, allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-edge bg-ink px-2.5 py-2 text-[13px] text-paper focus:border-sconce focus:outline-none"
      >
        <option value="" className="bg-ink text-paper">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink text-paper">{o.label}</option>
        ))}
      </select>
    </label>
  );
}
