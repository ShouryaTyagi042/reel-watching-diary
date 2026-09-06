"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { thumbnailStem } from "@/lib/thumbnail-name";

const FORMATS = ["Movie", "TV Show"] as const;
const STATUSES = ["Watched", "Watching", "To Watch"] as const;

/** Half-star steps, shown in the diary's own notation. */
const RATINGS = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].map((v) => ({
  value: v,
  label: "★".repeat(Math.floor(v)) + (v % 1 ? "½" : "") + "✰".repeat(5 - Math.ceil(v)),
}));

export function AddEntryForm({ knownGenres }: { knownGenres: string[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [format, setFormat] = useState<string>("Movie");
  const [status, setStatus] = useState<string>("Watched");
  const [rating, setRating] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [cast, setCast] = useState("");
  const [directors, setDirectors] = useState("");
  const [seriesName, setSeriesName] = useState("");
  const [inCinema, setInCinema] = useState(false);
  const [watchedOn, setWatchedOn] = useState("");
  const [notes, setNotes] = useState("");

  const [poster, setPoster] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleGenre = (g: string) =>
    setGenres((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Give the entry a title.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          notes: notes.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { slug?: string; error?: string }
        | null;
      if (!res.ok || !json?.slug) {
        throw new Error(json?.error ?? "The entry could not be saved.");
      }

      // Artwork is uploaded after the entry exists, because the filename is
      // derived from the saved title.
      if (poster) {
        const body = new FormData();
        body.append("file", poster);
        const up = await fetch(`/api/movies/${json.slug}/poster`, { method: "POST", body });
        if (!up.ok) {
          const upJson = (await up.json().catch(() => null)) as { error?: string } | null;
          // The entry saved fine; only the image failed. Say so rather than
          // implying the whole thing was lost.
          router.push(`/movies/${json.slug}?artwork=failed`);
          router.refresh();
          return;
        }
      }

      router.push(`/movies/${json.slug}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The entry could not be saved.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,220px)_1fr]">
      {/* ---- Artwork ---- */}
      <div>
        <span className="eyebrow mb-3 block">Artwork</span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative block aspect-[2/3] w-full overflow-hidden border border-dashed border-edge-2 bg-velvet transition-colors hover:border-sconce focus-visible:border-sconce"
          aria-label="Choose artwork for this entry"
        >
          {posterPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={posterPreview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
              <span className="text-3xl text-faint transition-colors group-hover:text-sconce">+</span>
              <span className="text-[12px] leading-snug text-faint">Choose an image</span>
            </span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > 8 * 1024 * 1024) {
              setError(`That image is ${(f.size / 1024 / 1024).toFixed(1)} MB. The limit is 8 MB.`);
              return;
            }
            setPoster(f);
            setPosterPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
        {title.trim() && (
          <p className="plate mt-2.5 text-[10px] leading-relaxed text-faint">
            Saves as <span className="text-screen">{thumbnailStem(title.trim())}</span> in your
            thumbnails folder, keeping the image’s own extension
          </p>
        )}
        {poster && (
          <button
            type="button"
            onClick={() => { setPoster(null); setPosterPreview(null); }}
            className="mt-2 text-[12px] text-rose underline decoration-rose/40 underline-offset-4"
          >
            Remove image
          </button>
        )}
      </div>

      {/* ---- Fields ---- */}
      <div className="grid gap-6">
        <Field label="Title" required>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={300}
            autoFocus
            placeholder="What did you watch?"
            className={inputCls}
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-3">
          <Field label="Release year">
            <input
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
              inputMode="numeric"
              placeholder="2026"
              className={inputCls}
            />
          </Field>
          <Field label="Format">
            <select value={format} onChange={(e) => setFormat(e.target.value)} className={inputCls}>
              {FORMATS.map((f) => (
                <option key={f} value={f} className="bg-ink text-paper">{f}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              {STATUSES.map((v) => (
                <option key={v} value={v} className="bg-ink text-paper">{v}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Rating">
            <select value={rating} onChange={(e) => setRating(e.target.value)} className={inputCls}>
              <option value="" className="bg-ink text-paper">Not rated</option>
              {RATINGS.map((r) => (
                <option key={r.value} value={r.value} className="bg-ink text-paper">
                  {r.label}  ({r.value})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Watched on" hint="Leave blank to use today">
            <input
              type="date"
              value={watchedOn}
              onChange={(e) => setWatchedOn(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Genres">
          <ul className="flex flex-wrap gap-2">
            {knownGenres.map((g) => {
              const on = genres.includes(g);
              return (
                <li key={g}>
                  <button
                    type="button"
                    onClick={() => toggleGenre(g)}
                    aria-pressed={on}
                    className={`border px-2.5 py-1 text-[12px] transition-colors ${
                      on
                        ? "border-sconce bg-sconce/10 text-sconce"
                        : "border-edge text-dim hover:border-edge-2 hover:text-paper"
                    }`}
                  >
                    {g}
                  </button>
                </li>
              );
            })}
          </ul>
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Director" hint="Separate several with commas">
            <input
              value={directors}
              onChange={(e) => setDirectors(e.target.value)}
              placeholder="Christopher Nolan"
              className={inputCls}
            />
          </Field>
          <Field label="Cast" hint="Separate with commas, in billing order">
            <input
              value={cast}
              onChange={(e) => setCast(e.target.value)}
              placeholder="Matt Damon, Tom Holland"
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Series" hint="For entries that belong to a run, e.g. a Bond cycle">
          <input
            value={seriesName}
            onChange={(e) => setSeriesName(e.target.value)}
            placeholder="Optional"
            className={inputCls}
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={inCinema}
            onChange={(e) => setInCinema(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-rose"
          />
          <span>
            <span className="block text-[14px] text-paper">Watched in a cinema</span>
            <span className="block text-[12px] leading-relaxed text-faint">
              Counted as a cinema visit. The venue stays unknown until a geotagged photo from the
              screening is attached to the entry.
            </span>
          </span>
        </label>

        <Field label="A line worth keeping" hint="Optional — saved with the entry">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional"
            className={`${inputCls} resize-y`}
          />
        </Field>

        {error && (
          <p role="alert" className="border border-rose/50 px-4 py-3 text-[13px] text-rose">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={busy || !title.trim()}
            className="border border-sconce bg-sconce px-5 py-2.5 text-[14px] text-ink transition-colors hover:bg-transparent hover:text-sconce disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Saving…" : "Add to diary"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={busy}
            className="text-[13px] text-dim transition-colors hover:text-paper"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

const inputCls =
  "w-full border border-edge bg-velvet/50 px-3 py-2.5 text-[14px] text-paper placeholder:text-faint focus:border-sconce focus:outline-none";

function Field({
  label, hint, required, children,
}: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block">
        {label}
        {required && <span className="ml-1 text-rose">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

function splitList(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}
