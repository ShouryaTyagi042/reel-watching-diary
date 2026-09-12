import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-28 text-center">
      <h1 className="display text-3xl">No such genre</h1>
      <p className="mt-4 text-sm leading-relaxed text-dim">
        Genres come from the entries in your diary.
      </p>
      <Link
        href="/genres"
        className="mt-7 inline-block bg-accent px-4 py-2.5 text-[13px] font-medium text-on-accent transition-transform active:scale-[0.98]"
      >
        All genres
      </Link>
    </div>
  );
}
