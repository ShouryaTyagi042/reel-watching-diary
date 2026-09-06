"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { thumbnailStem } from "@/lib/thumbnail-name";

/**
 * Attach artwork to an entry.
 *
 * The file is saved into your thumbnails folder under the diary's naming
 * convention — the title in lower snake_case, e.g. `mirzapur_the_movie.jpg` —
 * so it sits alongside the ones already there and is picked up automatically by
 * any later import.
 */
export function ThumbnailUpload({
  slug,
  title,
  currentPoster,
  currentSource,
  compact = false,
}: {
  slug: string;
  title: string;
  currentPoster?: string | null;
  /** Filename the artwork is currently stored under, when it came from a file. */
  currentSource?: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // The extension follows whatever image is chosen, so only the stem is known
  // up front. Once a file is saved we show its real name instead.
  const stem = thumbnailStem(title);
  const knownName = saved ?? currentSource ?? null;

  async function upload(file: File) {
    setError(null);
    setSaved(null);

    if (!file.type.startsWith("image/")) {
      setError("Pick an image file — JPEG, PNG, WebP, AVIF or GIF.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 8 MB.`);
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/movies/${slug}/poster`, { method: "POST", body });
      const json = (await res.json().catch(() => null)) as
        | { fileName?: string; error?: string }
        | null;
      if (!res.ok) throw new Error(json?.error ?? "The image could not be saved.");
      setSaved(json?.fileName ?? null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The image could not be saved.");
      setPreview(null);
    } finally {
      setBusy(false);
      URL.revokeObjectURL(localPreview);
    }
  }

  const shown = preview ?? currentPoster ?? null;

  return (
    <div className={compact ? "" : "border border-edge bg-velvet/30 p-5"}>
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={shown ? `Replace the artwork for ${title}` : `Add artwork for ${title}`}
          className="group relative aspect-[2/3] w-[84px] shrink-0 overflow-hidden border border-dashed border-edge-2 bg-velvet transition-colors hover:border-sconce focus-visible:border-sconce disabled:opacity-60"
        >
          {shown ? (
            <Image src={shown} alt="" fill sizes="84px" className="object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-2xl text-faint transition-colors group-hover:text-sconce">
              +
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-ink/70">
              <span className="plate text-[10px] text-sconce">saving…</span>
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="border border-edge px-3 py-1.5 text-[13px] text-dim transition-colors hover:border-sconce hover:text-sconce disabled:opacity-50"
          >
            {busy ? "Saving…" : shown ? "Replace artwork" : "Choose an image"}
          </button>

          <p className="plate mt-2.5 text-[10px] leading-relaxed text-faint">
            {knownName ? (
              <>
                In your thumbnails folder as <span className="text-screen">{knownName}</span>
              </>
            ) : (
              <>
                Saves to your thumbnails folder as{" "}
                <span className="text-screen">{stem}</span>, keeping the image’s own extension
              </>
            )}
          </p>

          {saved && (
            <p role="status" className="mt-2 text-[12px] text-sconce">
              Saved as {saved}.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-[12px] text-rose">
              {error}
            </p>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

