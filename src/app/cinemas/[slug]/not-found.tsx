import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-28 text-center">
      <div className="eyebrow">404</div>
      <h1 className="mt-3 font-display text-3xl text-paper">No such cinema</h1>
      <p className="mt-4 text-sm leading-relaxed text-dim">
        Cinemas are created by the importer from photo GPS. This one is not in the database.
      </p>
      <Link
        href="/cinemas"
        className="mt-7 inline-block border border-sconce/60 px-4 py-2 text-[13px] text-sconce transition-colors hover:bg-sconce hover:text-ink"
      >
        All cinemas
      </Link>
    </div>
  );
}
