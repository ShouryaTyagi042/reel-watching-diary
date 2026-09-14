"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ImageSquare, Trash, Crosshair } from "@phosphor-icons/react";

interface Shot {
  id: string;
  path: string;
  capturedAt: string | null;
  lat: number | null;
  lng: number | null;
  sourceName: string | null;
}

/**
 * Photos from a screening.
 *
 * This is the one upload that can change where an entry was watched: the GPS on
 * a photo is the only thing in the diary that tells one cinema from another. The
 * result of each upload says plainly whether a cinema was placed, and if not,
 * why not.
 */
export function ShotUpload({
  slug,
  title,
  shots,
  admin,
  watchedInTheatre,
}: {
  slug: string;
  title: string;
  shots: Shot[];
  /** Visitors see the photos. Adding and removing them belongs to the owner. */
  admin: boolean;
  watchedInTheatre: boolean;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string[] | null>(null);

  async function upload(files: FileList) {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const body = new FormData();
      for (const f of Array.from(files)) body.append("file", f);
      const res = await fetch(`/api/movies/${slug}/shots`, { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "The photos could not be saved.");

      const lines: string[] = [];
      for (const s of json.saved ?? []) {
        if (s.venue) {
          lines.push(
            s.venue.created
              ? `Placed a new cinema at ${s.venue.label.replace("Cinema at ", "")}. Name it on the cinema page.`
              : `Matched ${s.venue.name ?? "a cinema already on record"}${
                  s.venue.distanceM !== undefined ? `, ${s.venue.distanceM} m away` : ""
                }.`,
          );
        } else if (s.venueNote) {
          lines.push(s.venueNote);
        }
      }
      for (const f of json.failed ?? []) lines.push(`${f.name}: ${f.error}`);
      setResult(lines.length ? [...new Set(lines)] : ["Saved."]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The photos could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/movies/${slug}/shots?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "The photo could not be removed.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The photo could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {shots.map((sh) => (
          <motion.figure
            key={sh.id}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="well group relative"
          >
            <div className="relative aspect-[4/3]">
              <Image
                src={sh.path}
                alt={`Photo taken during ${title}`}
                fill
                sizes="(max-width: 640px) 45vw, 260px"
                className="object-cover"
              />
            </div>
            <figcaption className="data flex items-center gap-1.5 border-t border-line px-2.5 py-2 text-[10px] text-faint">
              {sh.lat !== null && sh.lng !== null && <Crosshair size={11} className="shrink-0 text-accent" />}
              <span className="truncate">
                {sh.capturedAt
                  ? new Date(sh.capturedAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      // The minute you were sitting in a named cinema is the
                      // owner's to see, not a visitor's.
                      ...(admin ? { hour: "numeric" as const, minute: "2-digit" as const } : {}),
                    })
                  : sh.sourceName ?? "Photo"}
              </span>
            </figcaption>
            {admin && (
            <button
              type="button"
              onClick={() => remove(sh.id)}
              disabled={busy}
              aria-label={`Remove photo ${sh.sourceName ?? ""}`.trim()}
              className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center bg-bg/85 text-faint opacity-0 backdrop-blur-sm transition-opacity hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Trash size={13} />
            </button>
            )}
          </motion.figure>
        ))}

        {admin && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="group flex aspect-[4/3] flex-col items-center justify-center gap-2 border border-dashed border-line-strong bg-surface-2 px-3 text-center transition-colors hover:border-accent disabled:opacity-60"
        >
          <ImageSquare size={22} className="text-faint transition-colors group-hover:text-accent" />
          <span className="text-[12px] leading-snug text-faint">
            {busy ? "Saving" : shots.length ? "Add more" : "Add photos"}
          </span>
        </button>
        )}
      </div>

      {admin && (
      <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
        {watchedInTheatre
          ? "A photo with GPS places the cinema. Photos within 250 m of one already on record count as the same cinema."
          : "Mark this entry as watched in a cinema first, then a photo with GPS will place the venue."}
      </p>
      )}

      {result && (
        <ul role="status" className="mt-3 space-y-1">
          {result.map((line) => (
            <li key={line} className="text-[12.5px] leading-relaxed text-dim">{line}</li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="mt-3 text-[12.5px] text-accent">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) upload(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
