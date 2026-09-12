import Link from "next/link";
import { AddEntryForm } from "@/components/AddEntryForm";
import { getFilterOptions } from "@/lib/queries";

export const metadata = { title: "Add an entry" };

export default function AddPage() {
  // Offer the genres already in use, so the vocabulary stays consistent rather
  // than growing a near-duplicate for every new entry.
  const genres = getFilterOptions().genres.map((g) => g.name);

  return (
    <>
      <nav className="pt-8">
        <Link href="/library" className="label transition-colors hover:text-accent">
          ← Library
        </Link>
      </nav>

      <header className="mt-6">
        <h1 className="mt-2 display text-[clamp(2rem,5vw,3.25rem)]">
          Add to the diary
        </h1>
        <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-dim">
          Only a title is required, everything else can be filled in later. Artwork is saved into
          your thumbnails folder using the diary’s naming convention, so it sits alongside the rest
          of your collection.
        </p>
      </header>

      <AddEntryForm knownGenres={genres} />
    </>
  );
}
