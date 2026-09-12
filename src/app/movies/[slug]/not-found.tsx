import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-28 text-center">
      <h1 className="mt-3 display text-3xl text-text">No such entry</h1>
      <p className="mt-4 text-sm leading-relaxed text-dim">
        This diary has no record with that address. It may have been renamed since the last import.
      </p>
      <Link
        href="/library"
 className="mt-7 inline-block border border-accent px-4 py-2 text-[13px] text-accent transition-colors hover:bg-accent hover:text-on-accent"
      >
        Browse the library
      </Link>
    </div>
  );
}
