import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { EmptyDiary } from "@/components/EmptyDiary";
import { getPeople, isEmpty, type PersonSummary } from "@/lib/queries";
import { pluralize } from "@/lib/format";

export const metadata = { title: "People" };

export default function PeoplePage() {
  if (isEmpty()) return <EmptyDiary />;

  const people = getPeople();
  const directors = people.filter((p) => p.directed > 0);
  const withPhoto = people.filter((p) => p.photoPath).length;
  const recurringActors = people.filter((p) => p.directed === 0 && p.actedIn > 1);
  const singles = people
    .filter((p) => p.directed === 0 && p.actedIn === 1)
    .sort((a, b) => a.name.localeCompare(b.name));
  // The Casts database holds a few people with no film linked to them. They are
  // real rows in the export, so they are shown rather than quietly dropped.
  const uncredited = people
    .filter((p) => p.directed === 0 && p.actedIn === 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <header className="pt-10 sm:pt-14">
        <h1 className="mt-2 display text-[clamp(2rem,5vw,3.25rem)]">
          People
        </h1>
        <p className="mt-5 max-w-2xl text-[14px] leading-relaxed text-dim">
          Everyone credited across the diary. Headshots are matched to people by name from your
          assets folder, anyone without one is drawn with their initials rather than a stand-in face.
        </p>
      </header>

      <dl className="mt-9 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        <Stat label="Credited" value={people.length} />
        <Stat label="Directors" value={directors.length} />
        <Stat label="Seen more than once" value={recurringActors.length} />
        <Stat label="With a headshot" value={withPhoto} />
      </dl>

      {directors.length > 0 && (
        <Group title="Directors" label={pluralize(directors.length, "director")}>
          {directors.map((p) => <PersonTile key={p.slug} person={p} />)}
        </Group>
      )}

      {recurringActors.length > 0 && (
        <Group title="Recurring faces" label="In more than one entry">
          {recurringActors.map((p) => <PersonTile key={p.slug} person={p} />)}
        </Group>
      )}

      {singles.length > 0 && (
        <Group title="Everyone else" label={`${singles.length} with a single credit`}>
          {singles.map((p) => <PersonTile key={p.slug} person={p} />)}
        </Group>
      )}

      {uncredited.length > 0 && (
        <Group
          title="No film attached"
          label={`${uncredited.length} in the Casts database`}
        >
          {uncredited.map((p) => <PersonTile key={p.slug} person={p} />)}
        </Group>
      )}
    </>
  );
}

function PersonTile({ person }: { person: PersonSummary }) {
  const credits =
    person.directed > 0 && person.actedIn > 0
      ? `${person.directed} directed, ${person.actedIn} acted`
      : person.directed > 0
        ? pluralize(person.directed, "film")
        : person.actedIn > 0
          ? pluralize(person.actedIn, "film")
          : "no film linked";

  return (
    <li>
      <Link href={`/people/${person.slug}`} className="group block text-center">
        <Avatar name={person.name} photoPath={person.photoPath} size={112} className="mx-auto w-full" />
        <span className="mt-3 block text-[13px] leading-snug text-text transition-colors group-hover:text-accent">
          {person.name}
        </span>
        <span className="data mt-1 block text-[10px] text-faint">{credits}</span>
      </Link>
    </li>
  );
}

function Group({ title, label, children }: { title: string; label: string; children: React.ReactNode }) {
  return (
    <section className="mt-14">
      <div className="mb-6 border-b border-line pb-3">
        <h2 className="display text-[26px]">{title}</h2>
      </div>
      <ul className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {children}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-bg px-4 py-5">
      <dd className="display text-[30px] leading-none text-text">{value}</dd>
      <dt className="label mt-2.5">{label}</dt>
    </div>
  );
}
