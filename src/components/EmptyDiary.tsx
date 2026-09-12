import Link from "next/link";

/** Shown when the database exists but no import has been run yet. */
export function EmptyDiary() {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <div className="label">Nothing imported yet</div>
      <h1 className="mt-3 display text-4xl text-text">The diary is empty</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-dim">
        Add your first entry, or run the importer to load an existing collection.
      </p>
      <pre className="mt-6 overflow-x-auto border border-line bg-surface px-4 py-3 text-left data text-dim">
        npm run db:migrate{"\n"}npm run import
      </pre>
      <p className="mt-6 text-sm text-faint">
        The importer reads <code className="data text-dim">../d</code> for the export and{" "}
        <code className="data text-dim">../src</code> for the thumbnails.{" "}
        <Link href="/data-health" className="text-accent underline underline-offset-4">
          Import report
        </Link>
      </p>
    </div>
  );
}
