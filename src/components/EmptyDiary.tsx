import Link from "next/link";

/** Shown when the database exists but no import has been run yet. */
export function EmptyDiary() {
  return (
    <div className="mx-auto max-w-xl py-24 text-center">
      <div className="eyebrow">Nothing imported yet</div>
      <h1 className="mt-3 font-display text-4xl text-paper">The diary is empty</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-dim">
        Run the importer to read the Notion export and fill this in.
      </p>
      <pre className="mt-6 overflow-x-auto border border-edge bg-velvet/60 px-4 py-3 text-left plate text-screen">
        npm run db:migrate{"\n"}npm run import
      </pre>
      <p className="mt-6 text-sm text-faint">
        The importer reads <code className="plate text-dim">../d</code> for the export and{" "}
        <code className="plate text-dim">../src</code> for the thumbnails.{" "}
        <Link href="/data-health" className="text-sconce underline underline-offset-4">
          Import report
        </Link>
      </p>
    </div>
  );
}
