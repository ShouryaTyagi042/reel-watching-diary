"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-28 text-center">
      <h1 className="mt-3 display text-3xl text-text">This page didn’t load</h1>
      <p className="mt-4 text-sm leading-relaxed text-dim">
        The diary reads from a local SQLite file. If this is the first run, the database may not exist
        yet, run <code className="data text-dim">npm run db:migrate &amp;&amp; npm run import</code>.
      </p>
      {error.message && (
        <pre className="mt-6 overflow-x-auto border border-line bg-surface px-4 py-3 text-left data text-[11px] text-faint">
          {error.message}
        </pre>
      )}
      <button
        type="button"
        onClick={reset}
 className="mt-7 border border-accent px-4 py-2 text-[13px] text-accent transition-colors hover:bg-accent hover:text-on-accent"
      >
        Try again
      </button>
    </div>
  );
}
