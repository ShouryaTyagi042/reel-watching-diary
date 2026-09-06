import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Poster } from "@/components/Poster";
import { Stars } from "@/components/Stars";
import { CoordPlate, MapLink } from "@/components/CoordPlate";
import { PersonChip } from "@/components/Avatar";
import { ThumbnailUpload } from "@/components/ThumbnailUpload";
import { getMovieBySlug } from "@/lib/queries";
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
        <Link href="/library" className="eyebrow transition-colors hover:text-sconce">
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
          <div className="eyebrow">
            {[movie.format, movie.status].filter(Boolean).join(" · ") || "Entry"}
          </div>
          <h1 className="mt-2.5 font-display text-[clamp(2rem,6vw,3.75rem)] font-light leading-[0.98] tracking-[-0.02em] text-paper">
            {movie.title}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Stars value={movie.ratingValue} raw={movie.ratingRaw} size="md" />
            {movie.ratingRaw && (
              <span className="plate text-[11px] text-faint" title="As recorded">
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
                    className="border border-edge px-2.5 py-1 text-[12px] text-dim transition-colors hover:border-sconce hover:text-sconce"
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
                    <Link href={`/people/${d.slug}`} className="underline decoration-edge-2 underline-offset-4 hover:text-sconce">
                      {d.name}
                    </Link>
                  </span>
                ))}
              </Field>
            )}
            {movie.seriesName && (
              <Field label="Series">
                <Link href={`/library?q=${encodeURIComponent(movie.seriesName)}`} className="underline decoration-edge-2 underline-offset-4 hover:text-sconce">
                  {movie.seriesName}
                </Link>
              </Field>
            )}
            <Field label="Seen in a cinema">{movie.watchedInTheatre ? "Yes" : "No"}</Field>
          </dl>
        </div>
      </header>

      {/* ---- The cinema visit ---- */}
      {movie.watchedInTheatre && (
        <Block eyebrow="Where it was seen" title="Cinema visit">
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
                  <span className="text-paper">{formatDateTime(visit.visitedAt)}</span>{" "}
                  <span className="text-faint">
                    ({visit.visitedAtSource === "photo-exif"
                      ? "from the timestamp on a photo taken during the screening"
                      : "from the entry’s own date — no photo to place it more precisely"})
                  </span>
                </p>
              )}
              {!visit?.venueSlug && (
                <p className="mt-3 text-faint">
                  This entry records that it was watched in a cinema, but not which one. No
                  geotagged photo is attached, so the venue is unknown.
                </p>
              )}
            </div>
          </div>
        </Block>
      )}

      {/* ---- Photos from the screening ---- */}
      {shots.length > 0 && (
        <Block eyebrow={`${shots.length} ${shots.length === 1 ? "photo" : "photos"}`} title="Shots from the night">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {shots.map((sh) => (
              <figure key={sh.id} className="frame">
                <div className="relative aspect-[4/3]">
                  <Image
                    src={sh.path}
                    alt={`Photo taken during ${movie.title}${sh.capturedAt ? ` on ${formatDate(sh.capturedAt)}` : ""}`}
                    fill
                    sizes="(max-width: 640px) 45vw, 260px"
                    className="object-cover"
                  />
                </div>
                <figcaption className="plate border-t border-edge/60 px-2.5 py-2 text-[10px] text-faint">
                  {formatDateTime(sh.capturedAt) ?? sh.sourceName}
                  {sh.lat != null && sh.lng != null && (
                    <span className="block text-[10px] text-faint/80">
                      {sh.lat.toFixed(4)}, {sh.lng.toFixed(4)}
                    </span>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </Block>
      )}

      {/* ---- Quotes ---- */}
      {quotes.length > 0 && (
        <Block eyebrow={`${quotes.length} kept`} title="Lines">
          <ul className="space-y-6">
            {quotes.map((q) => (
              <li key={q.id}>
                <figure className="border-l-2 border-sconce-dim pl-5">
                  <blockquote className="font-display text-[19px] leading-snug text-paper sm:text-[22px]">
                    “{q.text}”
                  </blockquote>
                  {q.saidBy && <figcaption className="eyebrow mt-3">{q.saidBy}</figcaption>}
                </figure>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/* ---- Credits ---- */}
      {(cast.length > 0 || directors.length > 0) && (
        <Block
          eyebrow={[
            directors.length && `${directors.length} ${directors.length === 1 ? "director" : "directors"}`,
            cast.length && `${cast.length} cast`,
          ].filter(Boolean).join(" · ")}
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
                <PersonChip name={p.name} slug={p.slug} photoPath={p.photoPath} size={104} />
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/* ---- Rest of the series ---- */}
      {series.length > 0 && (
        <Block eyebrow={movie.seriesName ?? "Series"} title="Also in this series">
          <div className="flex flex-wrap gap-5">
            {series.map((m) => (
              <Link key={m.slug} href={`/movies/${m.slug}`} className="group w-[120px]">
                <Poster title={m.title} path={m.posterPath} url={m.posterUrl} sizes="120px"
                  className="transition-transform duration-300 group-hover:-translate-y-1" />
                <span className="mt-2 block truncate text-[13px] text-dim transition-colors group-hover:text-sconce">
                  {m.title}
                </span>
              </Link>
            ))}
          </div>
        </Block>
      )}

      {/* ---- Provenance ---- */}
      <details className="mt-16 border border-edge/60 bg-velvet/20">
        <summary className="cursor-pointer px-5 py-4 text-[13px] text-dim transition-colors hover:text-paper">
          Record details
        </summary>
        <dl className="grid gap-x-8 gap-y-3 border-t border-edge/60 px-5 py-5 sm:grid-cols-2">
          <Field label="Record id"><code className="plate text-[11px]">{movie.id}</code></Field>
          <Field label="Added">
            {movie.origin === "app" ? "Created in the app" : "Loaded by the importer"}
          </Field>
          {movie.notionPath && (
            <Field label="Source file">
              <code className="plate text-[11px] break-all">{movie.notionPath}</code>
            </Field>
          )}
          {movie.coverRaw && (
            <Field label="Original artwork reference">
              <code className="plate text-[11px] break-all">{movie.coverRaw}</code>
            </Field>
          )}
          <Field label="Artwork matched by">
            {movie.posterMatch
              ? { "content-hash": "identical bytes in your thumbnails folder",
                  "export-cover": "the artwork shipped alongside the record",
                  slug: "filename match",
                  uploaded: "uploaded here" }[movie.posterMatch] ?? movie.posterMatch
              : "not matched — no local artwork"}
          </Field>
          <Field label="Rating as stored"><code className="plate text-[11px]">{movie.ratingRaw ?? "—"}</code></Field>
          <Field label="Title as stored"><code className="plate text-[11px]">“{movie.titleRaw}”</code></Field>
        </dl>
      </details>
    </article>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow" title={hint}>{label}</dt>
      <dd className="mt-1.5 text-[14px] text-paper">{children}</dd>
    </div>
  );
}

function Missing() {
  return <span className="text-faint italic">Not recorded</span>;
}

function Block({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <div className="mb-5 border-b border-edge/60 pb-3">
        <div className="eyebrow mb-1.5">{eyebrow}</div>
        <h2 className="font-display text-2xl leading-none text-paper">{title}</h2>
      </div>
      {children}
    </section>
  );
}
