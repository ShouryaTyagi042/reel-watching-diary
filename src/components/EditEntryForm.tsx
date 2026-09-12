"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PencilSimple, X } from "@phosphor-icons/react";

const FORMATS = ["Movie", "TV Show"];
const STATUSES = ["Watched", "Watching", "To Watch"];
const RATINGS = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5];

export interface EditableEntry {
  slug: string;
  title: string;
  year: number | null;
  format: string | null;
  status: string | null;
  rating: number | null;
  seriesName: string | null;
  watchedInTheatre: boolean;
  watchedOn: string | null;
  genres: string[];
  cast: string[];
  directors: string[];
}

/**
 * Edit an entry in place.
 *
 * Only the fields that actually change are sent. The database is the source of
 * truth, so a saved edit is simply the record now; nothing later reverts it.
 */
export function EditEntryForm({
  entry,
  knownGenres,
}: {
  entry: EditableEntry;
  knownGenres: string[];
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(entry.title);
  const [year, setYear] = useState(entry.year?.toString() ?? "");
  const [format, setFormat] = useState(entry.format ?? "Movie");
  const [status, setStatus] = useState(entry.status ?? "Watched");
  const [rating, setRating] = useState(entry.rating?.toString() ?? "");
  const [seriesName, setSeriesName] = useState(entry.seriesName ?? "");
  const [inCinema, setInCinema] = useState(entry.watchedInTheatre);
  const [watchedOn, setWatchedOn] = useState(entry.watchedOn?.slice(0, 10) ?? "");
  const [genres, setGenres] = useState<string[]>(entry.genres);
  const [cast, setCast] = useState(entry.cast.join(", "));
  const [directors, setDirectors] = useState(entry.directors.join(", "));


  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/movies/${entry.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "The entry could not be saved.");
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "The entry could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const ok = await send({
      title: title.trim(),
      year: year || null,
      format,
      status,
      rating: rating || null,
      seriesName: seriesName.trim() || null,
      watchedInTheatre: inCinema,
      watchedOn: watchedOn || null,
      genres,
      cast: splitList(cast),
      directors: splitList(directors),
    });
    if (ok) setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 border border-line px-3.5 py-2 text-[13px] text-dim transition-colors hover:border-accent hover:text-accent"
      >
        <PencilSimple size={14} />
        Edit entry
      </button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={reduce ? false : { opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden border border-line"
      >
        <form onSubmit={save} className="p-5 sm:p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="display text-[20px]">Edit entry</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close editor"
              className="grid h-8 w-8 place-items-center text-faint transition-colors hover:text-text"
            >
              <X size={16} />
            </button>
          </div>


          <div className="grid gap-5">
            <Field label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={300} className={INPUT} />
            </Field>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Release year">
                <input
                  value={year}
                  onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                  inputMode="numeric" className={INPUT}
                />
              </Field>
              <Field label="Format">
                <select value={format} onChange={(e) => setFormat(e.target.value)} className={INPUT}>
                  {FORMATS.map((f) => <option key={f} value={f} className="bg-bg text-text">{f}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={INPUT}>
                  {STATUSES.map((v) => <option key={v} value={v} className="bg-bg text-text">{v}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Rating">
                <select value={rating} onChange={(e) => setRating(e.target.value)} className={INPUT}>
                  <option value="" className="bg-bg text-text">Not rated</option>
                  {RATINGS.map((r) => (
                    <option key={r} value={r} className="bg-bg text-text">{r} of 5</option>
                  ))}
                </select>
              </Field>
              <Field label="Logged on">
                <input type="date" value={watchedOn} onChange={(e) => setWatchedOn(e.target.value)} className={INPUT} />
              </Field>
            </div>

            <Field label="Genres">
              <ul className="flex flex-wrap gap-2">
                {[...new Set([...knownGenres, ...genres])].map((g) => {
                  const on = genres.includes(g);
                  return (
                    <li key={g}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => setGenres((c) => (on ? c.filter((x) => x !== g) : [...c, g]))}
                        className={`border px-2.5 py-1 text-[12px] transition-colors ${
                          on ? "border-accent bg-accent-quiet text-accent" : "border-line text-dim hover:border-line-strong hover:text-text"
                        }`}
                      >
                        {g}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Director" hint="Separate several with commas">
                <input value={directors} onChange={(e) => setDirectors(e.target.value)} className={INPUT} />
              </Field>
              <Field label="Cast" hint="Commas, in billing order">
                <input value={cast} onChange={(e) => setCast(e.target.value)} className={INPUT} />
              </Field>
            </div>

            <Field label="Series">
              <input value={seriesName} onChange={(e) => setSeriesName(e.target.value)} placeholder="Optional" className={INPUT} />
            </Field>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={inCinema}
                onChange={(e) => setInCinema(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              />
              <span>
                <span className="block text-[14px]">Watched in a cinema</span>
                <span className="block text-[12px] leading-relaxed text-faint">
                  Turning this on records a visit with an unknown venue. Turning it off removes the
                  visit. Attaching a geotagged photo from the screening is what places the cinema.
                </span>
              </span>
            </label>
          </div>

          {error && (
            <p role="alert" className="mt-5 border border-accent px-4 py-3 text-[13px] text-accent">
              {error}
            </p>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="bg-accent px-5 py-2.5 text-[14px] font-medium text-on-accent transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Saving" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="text-[13px] text-dim transition-colors hover:text-text"
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </AnimatePresence>
  );
}

const INPUT =
  "w-full border border-line bg-surface px-3 py-2.5 text-[14px] text-text placeholder:text-faint focus:border-accent focus:outline-none";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-2 block">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

function splitList(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}
