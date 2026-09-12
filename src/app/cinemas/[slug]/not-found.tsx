import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-28 text-center">
      <h1 className="mt-3 display text-3xl text-text">No such cinema</h1>
      <p className="mt-4 text-sm leading-relaxed text-dim">
        Cinemas are created by the importer from photo GPS. This one is not in the database.
      </p>
      <Link
        href="/cinemas"
 className="mt-7 inline-block border border-accent px-4 py-2 text-[13px] text-accent transition-colors hover:bg-accent hover:text-on-accent"
      >
        All cinemas
      </Link>
    </div>
  );
}
