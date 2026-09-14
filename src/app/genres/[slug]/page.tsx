import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { MovieGrid } from "@/components/MovieCard";
import { GenreAperture } from "@/components/GenreAperture";
import { getGenreBySlug } from "@/lib/queries";
import { pluralize } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = getGenreBySlug(slug);
  return { title: data?.genre.name ?? "Not found" };
}

export default async function GenrePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = getGenreBySlug(slug);
  if (!data) notFound();

  const { genre, movies, averageRating } = data;
  const watched = movies.filter((m) => m.status === "Watched").length;
  const inCinema = movies.filter((m) => m.watchedInTheatre).length;

  return (
    <article className="pb-10">
      <nav className="pt-8">
        <Link href="/genres" className="label inline-flex items-center gap-1.5 transition-colors hover:text-accent">
          <ArrowLeft size={12} weight="bold" />
          Genres
        </Link>
      </nav>

      <header className="mt-7 border-b border-line pb-9">
        <h1 className="display text-[clamp(2.5rem,7vw,4.5rem)]">{genre.name}</h1>
        <p className="mt-3 text-[14px] text-faint">
          {pluralize(movies.length, "entry", "entries")}, {watched} watched
          {inCinema > 0 ? `, ${inCinema} seen in a cinema` : ""}
          {averageRating !== null ? `, ${averageRating.toFixed(1)} average` : ""}
        </p>
      </header>

      {movies.length === 0 ? (
        <div className="py-24 text-center">
          <h2 className="display text-2xl">Nothing tagged {genre.name} yet</h2>
          <p className="mt-3 text-sm text-dim">
            This genre is defined in your collection but no entry uses it.
          </p>
          <Link
            href="/add"
            className="mt-7 inline-block bg-accent px-4 py-2.5 text-[13px] font-medium text-on-accent transition-transform active:scale-[0.98]"
          >
            Add an entry
          </Link>
        </div>
      ) : (
        <div className="mt-10">
          <GenreAperture>
            <MovieGrid movies={movies} entrance={false} />
          </GenreAperture>
        </div>
      )}
    </article>
  );
}
