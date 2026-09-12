import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-28 text-center">
      <h1 className="mt-3 display text-3xl text-text">Nothing here</h1>
      <p className="mt-4 text-sm leading-relaxed text-dim">
        That address isn’t part of the diary.
      </p>
      <Link
        href="/"
 className="mt-7 inline-block border border-accent px-4 py-2 text-[13px] text-accent transition-colors hover:bg-accent hover:text-on-accent"
      >
        Back to the diary
      </Link>
    </div>
  );
}
