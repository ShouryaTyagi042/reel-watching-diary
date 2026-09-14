import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Poster } from "@/components/Poster";
import { Stars } from "@/components/Stars";
import { CoordPlate, MapLink } from "@/components/CoordPlate";
import { PersonChip } from "@/components/Avatar";
import { ThumbnailUpload } from "@/components/ThumbnailUpload";
import { EditEntryForm } from "@/components/EditEntryForm";
import { ShotUpload } from "@/components/ShotUpload";
import { CinemaPicker } from "@/components/CinemaPicker";
import { getMovieBySlug, getFilterOptions, getKnownVenues } from "@/lib/queries";
import { formatDate, formatDateTime } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = getMovieBySlug(slug);
  return { title: data?.movie.title ?? "Not found" };
}

export default async function MoviePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = getMovieBySlug(slug);
  if (!data) notFound();

  const { movie, genres, cast, directors, quotes, shots, visit, series } = data;
  const logged = formatDate(movie.createdTime);

  return (
    <article className="pb-10">
      <nav className="pt-8">
        <Link href="/library" className="label transition-colors hover:text-accent">
          ← Library
        </Link>
      </nav>

      {/* ---- Header ---- */}
      <header className="mt-6 grid gap-8 sm:grid-cols-[minmax(0,200px)_1fr] sm:gap-10 lg:grid-cols-[minmax(0,260px)_1fr]">
        <div className="w-[160px] sm:w-full">
          <Poster
            title={movie.title}
            path={movie.posterPath}
            url={movie.posterUrl}
            priority
            sizes="(max-width: 640px) 160px, 260px"
          />
          <div className="mt-4">
            <ThumbnailUpload
              slug={movie.slug}
              title={movie.title}
              currentPoster={movie.posterPath ?? movie.posterUrl}
              currentSource={movie.posterSource}
              compact
            />
          </div>
        </div>

        <div className="min-w-0">
          <h1 className="mt-2.5 display text-[clamp(2rem,6vw,3.75rem)] font-light leading-[0.98] tracking-[-0.02em] text-text">
            {movie.title}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Stars value={movie.ratingValue} raw={movie.ratingRaw} size="md" />
            {movie.ratingRaw && (
              <span className="data text-[11px] text-faint" title="As recorded">
                {movie.ratingRaw}
              </span>
            )}
          </div>

          {genres.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {genres.map((g) => (
                <li key={g.slug}>
                  <Link
                    href={`/library?genre=${g.slug}`}
 className="border border-line px-2.5 py-1 text-[12px] text-dim transition-colors hover:border-accent hover:text-accent"
                  >
                    {g.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <dl className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Released">{movie.year ?? <Missing />}</Field>
            <Field label="Logged" hint="When this entry was added to the diary">
              {logged ?? <Missing />}
            </Field>
            <Field label="Status">{movie.status ?? <Missing />}</Field>
            <Field label="Format">{movie.format ?? <Missing />}</Field>
            {directors.length > 0 && (
              <Field label={directors.length > 1 ? "Directors" : "Director"}>
                {directors.map((d, i) => (
                  <span key={d.slug}>
                    {i > 0 && ", "}
                    <Link href={`/people/${d.slug}`} className="underline decoration-line-strong underline-offset-4 hover:text-accent">
                      {d.name}
                    </Link>
                  </span>
                ))}
              </Field>
            )}
            {movie.seriesName && (
              <Field label="Series">
                <Link href={`/library?q=${encodeURIComponent(movie.seriesName)}`} className="underline decoration-line-strong underline-offset-4 hover:text-accent">
                  {movie.seriesName}
                </Link>
              </Field>
            )}
            <Field label="Seen in a cinema">{movie.watchedInTheatre ? "Yes" : "No"}</Field>
          </dl>

          <div className="mt-8">
            <EditEntryForm
              knownGenres={getFilterOptions().genres.map((g) => g.name)}
              entry={{
                slug: movie.slug,
                title: movie.title,
                year: movie.year,
                format: movie.format,
                status: movie.status,
                rating: movie.ratingValue,
                seriesName: movie.seriesName,
                watchedInTheatre: movie.watchedInTheatre,
                watchedOn: movie.createdTime,
                genres: genres.map((g) => g.name),
                cast: cast.map((c) => (c.role ? `${c.name} as ${c.role}` : c.name)),
                directors: directors.map((d) => d.name),
              }}
            />
          </div>
        </div>
      </header>

      {/* ---- The cinema visit ---- */}
      {movie.watchedInTheatre && (
        <Block note="Where it was seen" title="Cinema visit">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-start">
            <div>
              <CoordPlate
                lat={visit?.lat ?? null}
                lng={visit?.lng ?? null}
                name={visit?.venueName}
                label={visit?.venueLabel ?? undefined}
                href={visit?.venueSlug ? `/cinemas/${visit.venueSlug}` : undefined}
              />
              {visit?.lat != null && visit?.lng != null && (
                <div className="mt-2">
                  <MapLink lat={visit.lat} lng={visit.lng} />
                </div>
              )}
            </div>
            <div className="text-[13px] leading-relaxed text-dim">
              {visit?.visitedAt && (
                <p>
                  <span className="text-text">{formatDateTime(visit.visitedAt)}</span>{" "}
                  <span className="text-faint">
                    ({visit.visitedAtSource === "photo-exif"
                      ? "from the timestamp on a photo taken during the screening"
                      : "from the entry’s own date, no photo to place it more precisely"})
                  </span>
                </p>
              )}
              {!visit?.venueSlug && (
                <p className="text-faint">
                  This entry records that it was watched in a cinema, but not which one.
                </p>
              )}
              <div className="mt-4">
                <CinemaPicker
                  slug={movie.slug}
                  current={{
                    id: visit?.venueId ?? null,
                    name: visit?.venueName ?? null,
                    label: visit?.venueLabel ?? null,
                  }}
                  venues={getKnownVenues()}
                />
              </div>
            </div>
          </div>
        </Block>
      )}

      {/* ---- Photos from the screening ---- */}
      <Block
        title="Shots from the night"
        note={shots.length ? `${shots.length} ${shots.length === 1 ? "photo" : "photos"}` : "Add a photo to place the cinema"}
      >
        <ShotUpload
          slug={movie.slug}
          title={movie.title}
          watchedInTheatre={movie.watchedInTheatre}
          shots={shots.map((sh) => ({
            id: sh.id, path: sh.path, capturedAt: sh.capturedAt,
            lat: sh.lat, lng: sh.lng, sourceName: sh.sourceName,
          }))}
        />
      </Block>

      {/* ---- Quotes ---- */}
      {quotes.length > 0 && (
        <Block note={`${quotes.length} kept`} title="Lines">
          <ul className="space-y-6">
            {quotes.map((q) => (
              <li key={q.id}>
                <figure className="border-l-2 border-accent pl-5">
                  <blockquote className="display text-[19px] leading-snug text-text sm:text-[22px]">
                    “{q.text}”
                  </blockquote>
                  {q.saidBy && <figcaption className="label mt-3">{q.saidBy}</figcaption>}
                </figure>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/* ---- Credits ---- */}
      {(cast.length > 0 || directors.length > 0) && (
        <Block
          note={[
            directors.length && `${directors.length} ${directors.length === 1 ? "director" : "directors"}`,
            cast.length && `${cast.length} cast`,
          ].filter(Boolean).join(", ")}
          title="Credits"
        >
          <ul className="grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {directors.map((p) => (
              <li key={`d-${p.slug}`}>
                <PersonChip name={p.name} slug={p.slug} photoPath={p.photoPath} role="Director" size={104} />
              </li>
            ))}
            {cast.map((p) => (
              <li key={`a-${p.slug}`}>
                <PersonChip
                  name={p.name}
                  slug={p.slug}
                  photoPath={p.photoPath}
                  role={p.role ?? undefined}
                  size={104}
                />
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/* ---- Rest of the series ---- */}
      {series.length > 0 && (
        <Block note={movie.seriesName ?? "Series"} title="Also in this series">
          <div className="flex flex-wrap gap-5">
            {series.map((m) => (
              <Link key={m.slug} href={`/movies/${m.slug}`} className="group w-[120px]">
                <Poster title={m.title} path={m.posterPath} url={m.posterUrl} sizes="120px"
 className="transition-transform duration-300 group-hover:-translate-y-1" />
                <span className="mt-2 block truncate text-[13px] text-dim transition-colors group-hover:text-accent">
                  {m.title}
                </span>
              </Link>
            ))}
          </div>
        </Block>
      )}

      {/* ---- Provenance ---- */}
      <details className="mt-16 border border-line bg-surface">
        <summary className="cursor-pointer px-5 py-4 text-[13px] text-dim transition-colors hover:text-text">
          Record details
        </summary>
        <dl className="grid gap-x-8 gap-y-3 border-t border-line px-5 py-5 sm:grid-cols-2">
          <Field label="Record id"><code className="data text-[11px]">{movie.id}</code></Field>
          <Field label="Added">
            {movie.sourcePath ? "Seeded from an imported collection" : "Created here"}
          </Field>
          {movie.sourcePath && (
            <Field label="Source file">
              <code className="data text-[11px] break-all">{movie.sourcePath}</code>
            </Field>
          )}
          {movie.coverRaw && (
            <Field label="Original artwork reference">
              <code className="data text-[11px] break-all">{movie.coverRaw}</code>
            </Field>
          )}
          <Field label="Artwork matched by">
            {movie.posterMatch
              ? { "content-hash": "identical bytes in your thumbnails folder",
                  "export-cover": "the artwork shipped alongside the record",
                  slug: "filename match",
                  uploaded: "uploaded here" }[movie.posterMatch] ?? movie.posterMatch
              : "not matched, no local artwork"}
          </Field>
          <Field label="Rating as stored"><code className="data text-[11px]">{movie.ratingRaw ?? "-"}</code></Field>
          <Field label="Title as stored"><code className="data text-[11px]">“{movie.titleRaw}”</code></Field>
        </dl>
      </details>
    </article>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="label" title={hint}>{label}</dt>
      <dd className="mt-1.5 text-[14px] text-text">{children}</dd>
    </div>
  );
}

function Missing() {
  return <span className="text-faint italic">Not recorded</span>;
}

function Block({ note, title, children }: { note?: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-16">
      <div className="mb-6 border-b border-line pb-3.5">
        <h2 className="display text-[26px]">{title}</h2>
        {note && <p className="mt-1.5 text-[13px] text-faint">{note}</p>}
      </div>
      {children}
    </section>
  );
}
