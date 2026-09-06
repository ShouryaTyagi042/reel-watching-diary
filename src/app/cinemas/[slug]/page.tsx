import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MovieCard } from "@/components/MovieCard";
import { MapLink } from "@/components/CoordPlate";
import { VenueNameForm } from "@/components/VenueNameForm";
import { getVenueBySlug } from "@/lib/queries";
import { formatDate, formatDateTime, coordText } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = getVenueBySlug(slug);
  return { title: data?.venue.name ?? data?.venue.label ?? "Cinema" };
}

export default async function CinemaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = getVenueBySlug(slug);
  if (!data) notFound();

  const { venue, movies, shots } = data;
  const rated = movies.filter((m) => m.ratingValue !== null);
  const avg = rated.length
    ? rated.reduce((sum, m) => sum + (m.ratingValue ?? 0), 0) / rated.length
    : null;
  const visits = movies.map((m) => m.visitedAt).filter(Boolean) as string[];
  const coords = coordText(venue.lat, venue.lng);

  return (
    <article className="pb-10">
      <nav className="pt-8">
        <Link href="/cinemas" className="eyebrow transition-colors hover:text-sconce">
          ← Cinemas
        </Link>
      </nav>

      <header className="mt-6 border-b border-edge/60 pb-9">
        <div className="eyebrow">
          {venue.source === "photo-gps" ? "Placed from photo GPS" : venue.source}
        </div>
        <h1
          className={`mt-2.5 font-display text-[clamp(2rem,6vw,3.75rem)] font-light leading-[0.98] tracking-[-0.02em] ${
            venue.name ? "text-paper" : "italic text-dim"
          }`}
        >
          {venue.name ?? "Unnamed cinema"}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <span className="plate text-[13px] text-screen">{coords ?? "no position recorded"}</span>
          {venue.lat != null && venue.lng != null && <MapLink lat={venue.lat} lng={venue.lng} />}
        </div>

        <div className="mt-6">
          <VenueNameForm id={venue.id} name={venue.name} />
        </div>

        {venue.notes && <p className="mt-6 max-w-2xl text-[13px] leading-relaxed text-faint">{venue.notes}</p>}
      </header>

      <dl className="mt-9 grid grid-cols-2 gap-px border border-edge bg-edge/70 sm:grid-cols-4">
        <Stat label="Visits" value={String(movies.length)} />
        <Stat label="Average rating" value={avg !== null ? `${avg.toFixed(1)}` : "—"} note={rated.length ? `over ${rated.length} rated` : "nothing rated"} />
        <Stat label="First visit" value={visits.length ? formatDate(visits[visits.length - 1]) ?? "—" : "—"} />
        <Stat label="Most recent" value={visits.length ? formatDate(visits[0]) ?? "—" : "—"} />
      </dl>

      <section className="mt-14">
        <div className="mb-5 border-b border-edge/60 pb-3">
          <div className="eyebrow mb-1.5">Newest first</div>
          <h2 className="font-display text-2xl leading-none text-paper">Watched here</h2>
        </div>

        {movies.length === 0 ? (
          <p className="py-10 text-sm text-dim">
            No entries are linked to this cinema yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {movies.map((m, i) => (
                <MovieCard key={m.id} movie={m} index={i} priority={i < 4} />
              ))}
            </div>

            {/* A visit ledger — the dates read as a short history of the room. */}
            <ol className="mt-10 border-t border-edge/50">
              {movies.map((m) => (
                <li key={m.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-edge/40 py-3">
                  <span className="plate w-40 shrink-0 text-[11px] text-faint">
                    {formatDateTime(m.visitedAt) ?? "undated"}
                  </span>
                  <Link href={`/movies/${m.slug}`} className="text-[14px] text-paper transition-colors hover:text-sconce">
                    {m.title}
                  </Link>
                  {m.ratingRaw && <span className="plate ml-auto text-[11px] text-sconce">{m.ratingRaw}</span>}
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      {shots.length > 0 && (
        <section className="mt-14">
          <div className="mb-5 border-b border-edge/60 pb-3">
            <div className="eyebrow mb-1.5">{shots.length} {shots.length === 1 ? "photo" : "photos"} taken here</div>
            <h2 className="font-display text-2xl leading-none text-paper">From the room</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {shots.map((sh) => (
              <figure key={sh.id} className="frame">
                <Link href={`/movies/${sh.movieSlug}`} className="group block">
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={sh.path}
                      alt={`Photo taken at this cinema during ${sh.movieTitle}`}
                      fill
                      sizes="(max-width: 640px) 45vw, 260px"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <figcaption className="plate border-t border-edge/60 px-2.5 py-2 text-[10px] text-faint">
                    <span className="block truncate text-dim">{sh.movieTitle}</span>
                    {formatDateTime(sh.capturedAt)}
                  </figcaption>
                </Link>
              </figure>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-ink px-4 py-5">
      <dd className="font-display text-[26px] leading-none text-paper">{value}</dd>
      <dt className="eyebrow mt-2.5">{label}</dt>
      {note && <p className="mt-1 text-[11px] text-faint">{note}</p>}
    </div>
  );
}
