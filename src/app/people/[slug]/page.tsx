import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, PersonChip } from "@/components/Avatar";
import { MovieCard } from "@/components/MovieCard";
import { getPersonBySlug, type MovieCard as MovieCardRow } from "@/lib/queries";
import { pluralize } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPersonBySlug(slug);
  return { title: p?.name ?? "Not found" };
}

export default async function PersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const person = getPersonBySlug(slug);
  if (!person) notFound();

  const { name, photoPath, photoMatch, photoSource, acted, directed, collaborators } = person;
  const all = [...directed, ...acted.filter((a) => !directed.some((d) => d.id === a.id))];
  const rated = all.filter((m) => m.ratingValue !== null);
  const avg = rated.length ? rated.reduce((s, m) => s + (m.ratingValue ?? 0), 0) / rated.length : null;
  const roles = [person.isDirector && "Director", person.isActor && "Cast"].filter(Boolean).join(" · ");

  return (
    <article className="pb-10">
      <nav className="pt-8">
        <Link href="/people" className="eyebrow transition-colors hover:text-sconce">
          ← People
        </Link>
      </nav>

      <header className="mt-6 flex flex-wrap items-end gap-6 border-b border-edge/60 pb-9 sm:gap-9">
        <Avatar name={name} photoPath={photoPath} size={160} className="w-[120px] sm:w-[160px]" />
        <div className="min-w-0 flex-1">
          <div className="eyebrow">{roles || "Credited"}</div>
          <h1 className="mt-2.5 font-display text-[clamp(2rem,6vw,3.75rem)] font-light leading-[0.98] tracking-[-0.02em] text-paper">
            {name}
          </h1>
          <p className="mt-4 text-[14px] text-dim">
            {[
              directed.length && `${pluralize(directed.length, "film")} directed`,
              acted.length && `${pluralize(acted.length, "appearance")}`,
              avg !== null && `${avg.toFixed(1)}★ average`,
            ]
              .filter(Boolean)
              .join(" · ") ||
              "Credited in the diary, but no film is linked to them yet."}
          </p>
          {!photoPath && (
            <p className="mt-3 text-[12px] text-faint">
              No headshot in your assets folder for this name.
            </p>
          )}
          {photoMatch === "fuzzy" && (
            <p className="mt-3 text-[12px] text-sconce">
              Headshot matched from “{photoSource}” — the filename doesn’t match this name exactly.
            </p>
          )}
        </div>
      </header>

      {directed.length > 0 && (
        <Block eyebrow={pluralize(directed.length, "film")} title="Directed">
          <Grid movies={directed} />
        </Block>
      )}

      {acted.length > 0 && (
        <Block eyebrow={pluralize(acted.length, "entry", "entries")} title="Appears in">
          <Grid movies={acted} />
        </Block>
      )}

      {collaborators.length > 0 && (
        <Block eyebrow="Shares more than one entry" title="Seen alongside">
          <ul className="grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {collaborators.map((c) => (
              <li key={c.slug}>
                <PersonChip
                  name={c.name}
                  slug={c.slug}
                  photoPath={c.photoPath}
                  role={`${c.shared} together`}
                  size={96}
                />
              </li>
            ))}
          </ul>
        </Block>
      )}
    </article>
  );
}

function Grid({ movies }: { movies: MovieCardRow[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {movies.map((m, i) => (
        <MovieCard key={m.id} movie={m} index={i} priority={i < 4} />
      ))}
    </div>
  );
}

function Block({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <div className="mb-6 border-b border-edge/60 pb-3">
        <div className="eyebrow mb-1.5">{eyebrow}</div>
        <h2 className="font-display text-2xl leading-none text-paper">{title}</h2>
      </div>
      {children}
    </section>
  );
}
