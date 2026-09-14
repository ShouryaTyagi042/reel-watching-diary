"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Crosshair, Plus, X } from "@phosphor-icons/react";

export interface KnownVenue {
  id: string;
  name: string | null;
  label: string;
  visits: number;
  hasPosition: boolean;
}

/**
 * Say which cinema an entry was watched at.
 *
 * A geotagged photo places a cinema precisely, but not every visit leaves one,
 * and a cinema you can name is more use than one you cannot. This is the way to
 * say it directly: pick one already on record, or name a new one.
 *
 * A cinema named here has no position. That is not a gap to apologise for, it
 * is simply what is known. Attaching a photo from a visit adds the position
 * later.
 */
export function CinemaPicker({
  slug,
  current,
  venues,
}: {
  slug: string;
  current: { id: string | null; name: string | null; label: string | null };
  venues: KnownVenue[];
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/movies/${slug}/cinema`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "The cinema could not be saved.");
      setOpen(false);
      setNaming(false);
      setName("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The cinema could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 border border-line px-3 py-1.5 text-[12.5px] text-dim transition-colors hover:border-accent hover:text-accent"
        >
          <Crosshair size={13} />
          {current.id ? "Change cinema" : "Set the cinema"}
        </button>
        {error && <span role="alert" className="text-[12px] text-accent">{error}</span>}
      </div>
    );
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="border border-line bg-surface p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="label">Which cinema?</span>
        <button
          type="button"
          onClick={() => { setOpen(false); setNaming(false); setError(null); }}
          aria-label="Close"
          className="grid h-7 w-7 place-items-center text-faint transition-colors hover:text-text"
        >
          <X size={14} />
        </button>
      </div>

      <ul className="space-y-1.5">
        {venues.map((v) => {
          const isCurrent = v.id === current.id;
          return (
            <li key={v.id}>
              <button
                type="button"
                disabled={busy || isCurrent}
                onClick={() => send({ venueId: v.id })}
                className={`flex w-full items-center justify-between gap-3 border px-3 py-2 text-left transition-colors ${
                  isCurrent
                    ? "border-accent text-accent"
                    : "border-line text-dim hover:border-accent hover:text-text"
                } disabled:cursor-default`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px]">{v.name ?? v.label}</span>
                  <span className="data block text-[10px] text-faint">
                    {v.visits} {v.visits === 1 ? "visit" : "visits"}
                    {v.hasPosition ? ", placed by photo" : ", no position"}
                  </span>
                </span>
                {isCurrent && <span className="data shrink-0 text-[10px]">current</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {naming ? (
        <form
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) send({ name: name.trim() }); }}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <label className="sr-only" htmlFor={`cinema-name-${slug}`}>New cinema name</label>
          <input
            id={`cinema-name-${slug}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What is it called?"
            maxLength={120}
            autoFocus
            className="min-w-0 flex-1 border border-line bg-bg px-3 py-2 text-[13.5px] text-text placeholder:text-faint focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="bg-accent px-3.5 py-2 text-[13px] font-medium text-on-accent transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? "Saving" : "Add"}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setNaming(true)}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-dim transition-colors hover:text-accent"
        >
          <Plus size={12} weight="bold" />
          A cinema that is not listed
        </button>
      )}

      {current.id && (
        <button
          type="button"
          onClick={() => send({ venueId: null })}
          disabled={busy}
          className="mt-3 block text-[12px] text-faint transition-colors hover:text-accent"
        >
          Forget which cinema it was
        </button>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-faint">
        A cinema named here has no position. Attach a geotagged photo from a visit to place it.
      </p>

      {error && <p role="alert" className="mt-2 text-[12px] text-accent">{error}</p>}
    </motion.div>
  );
}
