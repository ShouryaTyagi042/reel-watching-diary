"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-28 text-center">
      <div className="eyebrow">Something broke</div>
      <h1 className="mt-3 font-display text-3xl text-paper">This page didn’t load</h1>
      <p className="mt-4 text-sm leading-relaxed text-dim">
        The diary reads from a local SQLite file. If this is the first run, the database may not exist
        yet — run <code className="plate text-screen">npm run db:migrate &amp;&amp; npm run import</code>.
      </p>
      {error.message && (
        <pre className="mt-6 overflow-x-auto border border-edge bg-velvet/40 px-4 py-3 text-left plate text-[11px] text-faint">
          {error.message}
        </pre>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-7 border border-sconce/60 px-4 py-2 text-[13px] text-sconce transition-colors hover:bg-sconce hover:text-ink"
      >
        Try again
      </button>
    </div>
  );
}
