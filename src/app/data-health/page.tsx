import { getImportReport, isEmpty } from "@/lib/queries";
import { EmptyDiary } from "@/components/EmptyDiary";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Data" };

const SEVERITY = {
  error: { label: "Error", cls: "text-accent border-accent" },
  warning: { label: "Check", cls: "text-accent border-accent" },
  info: { label: "Note", cls: "text-dim border-line-strong" },
} as const;

/** Groups of counters, in the order they matter when auditing an import. */
const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: "Records",
    keys: [
      ["moviesInExport", "Records in the source"],
      ["moviesInserted", "Inserted"],
      ["moviesUpdated", "Updated"],
      ["moviesSkipped", "Skipped"],
      ["duplicateTitles", "Duplicate title collisions"],
    ],
  },
  {
    title: "Linked databases",
    keys: [
      ["genresInserted", "Genres"],
      ["actorsInserted", "Actors"],
      ["directorsInserted", "Directors"],
      ["quotesInserted", "Quotes"],
      ["shotsInserted", "Movie shots"],
    ],
  },
  {
    title: "Posters",
    keys: [
      ["postersByContentHash", "Matched by identical bytes"],
      ["postersFromExport", "Taken from the export’s cover"],
      ["postersBySlug", "Matched by filename"],
      ["postersExternalUrlOnly", "Remote cover URL only"],
      ["moviesWithoutPoster", "No poster at all"],
      ["thumbnailsUnmatched", "Thumbnails matching no record"],
    ],
  },
  {
    title: "Cinemas",
    keys: [
      ["cinemaVisits", "Cinema visits (Theatre = Yes)"],
      ["cinemaVisitsWithVenue", "Placed at a derived venue"],
      ["venuesDerived", "Distinct venues from photo GPS"],
    ],
  },
];

export default function DataHealthPage() {
  if (isEmpty()) return <EmptyDiary />;

  const { runAt, stats, issues } = getImportReport();
  const counts = { error: 0, warning: 0, info: 0 } as Record<string, number>;
  issues.forEach((i) => { counts[i.severity] = (counts[i.severity] ?? 0) + 1; });

  const byKind = issues.reduce<Record<string, typeof issues>>((acc, i) => {
    (acc[i.kind] ??= []).push(i);
    return acc;
  }, {});

  return (
    <>
      <header className="pt-10 sm:pt-14">
        <h1 className="mt-2 display text-[clamp(2rem,5vw,3.25rem)]">
          What the import found
        </h1>
        <p className="mt-5 max-w-2xl text-[14px] leading-relaxed text-dim">
          Every imported record is accounted for here, what came through cleanly, what was
          ambiguous, and what was deliberately left alone rather than guessed at. Nothing is
          discarded; anything that could not be resolved is listed below.
        </p>
        {runAt && (
          <p className="data mt-4 text-[11px] text-faint">
            Last run {formatDateTime(runAt.replace(" ", "T") + "Z") ?? runAt}
          </p>
        )}
      </header>

      {stats && (
        <div className="mt-11 space-y-10">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h2 className="label mb-3">{g.title}</h2>
              <dl className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
                {g.keys.map(([key, label]) => (
                  <div key={key} className="bg-bg px-4 py-4">
                    <dd className="display text-[26px] leading-none text-text">{stats[key] ?? 0}</dd>
                    <dt className="mt-2 text-[11px] leading-snug text-faint">{label}</dt>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}

      <section className="mt-16">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-3">
          <div>
            <h2 className="display text-[26px]">Findings</h2>
            <p className="mt-1.5 text-[13px] text-faint">
              {counts.error ?? 0} error, {counts.warning ?? 0} to check, {counts.info ?? 0} note.
            </p>
          </div>
        </div>

        {issues.length === 0 ? (
          <p className="py-10 text-sm text-dim">
            The import ran clean, every record, poster and relation resolved without ambiguity.
          </p>
        ) : (
          <div className="space-y-8">
            {Object.entries(byKind).map(([kind, list]) => (
              <div key={kind}>
                <h3 className="data mb-3 text-[11px] uppercase tracking-[0.14em] text-dim">
                  {kind.replace(/-/g, " ")} <span className="text-faint">({list.length})</span>
                </h3>
                <ul className="border border-line">
                  {list.map((i) => {
                    const sev = SEVERITY[i.severity as keyof typeof SEVERITY] ?? SEVERITY.info;
                    return (
                      <li key={i.id} className="flex flex-col gap-2 border-b border-line px-4 py-3.5 last:border-b-0 sm:flex-row sm:gap-4">
                        <span className={`data h-fit shrink-0 border px-1.5 py-0.5 text-[10px] uppercase ${sev.cls}`}>
                          {sev.label}
                        </span>
                        <div className="min-w-0">
                          {i.subject && <p className="text-[14px] text-text">{i.subject}</p>}
                          <p className="mt-0.5 text-[13px] leading-relaxed text-dim">{i.detail}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-16 border border-line bg-surface p-6">
        <h2 className="display text-xl text-text">Re-running the import</h2>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-dim">
          The importer is keyed on stable record ids and upserts every row, so it can be run as often
          as you like without duplicating anything. Entries you add here are never touched by it.
        </p>
        <pre className="mt-4 overflow-x-auto border border-line bg-bg px-4 py-3 data text-dim">npm run import</pre>
      </section>
    </>
  );
}
