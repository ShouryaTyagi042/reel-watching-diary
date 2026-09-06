# Reel — a watching diary

A personal movie and TV diary that builds itself from a **Notion export**. Point
it at your own exported "Movies and TV Shows" database and it imports the
records, matches your poster and headshot files to them, and works out which
cinema you were in from the GPS in the photos you took there.

This repository contains the application only. The diary data — the Notion
export, the posters, the theatre photos — is personal and is deliberately not
committed.

## Bringing your own data

The importer expects two sibling folders next to this one:

```
your-folder/
├── d/      Notion export — the "Movies and TV Shows Diary" workspace
├── src/    Your poster thumbnails, actor and director photos
│   ├── Movies Thumbnails/
│   ├── Actors/
│   └── Directors/
└── web/    This repository
```

Export your Notion workspace as **Markdown & CSV** (with subpages) into `d/`.
Both paths are configurable:

```bash
npm run import -- --export ../d --assets ../src
```

The importer only ever *reads* those folders. It copies matched images into
`public/` and writes a SQLite file at `data/diary.db` — all of which are
gitignored, so your diary never lands in version control.

---

**Requires Node 20+.**

## Setup

```bash
cd cinema-tracker/web
npm install
npm run setup          # migrate + import, in one step
npm run dev            # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run db:migrate` | Create/upgrade `data/diary.db` from `drizzle/*.sql` |
| `npm run import` | Read the Notion export and populate the database |
| `npm run setup` | `db:migrate` then `import` |
| `npm run db:reset` | Delete the database and re-migrate (then run `import`) |
| `npm run verify` | Re-read the export and assert the database matches it |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run db:generate` | Regenerate migrations after editing `src/db/schema.ts` |

The importer takes optional paths if your export lives elsewhere:

```bash
npm run import -- --export ../d --assets ../src
npm run import -- --json          # machine-readable report
```

---

## Database schema

SQLite via Drizzle ORM (`src/db/schema.ts`). Thirteen tables, keyed on Notion
page ids so re-importing updates rows rather than duplicating them.

| Table | Holds |
|---|---|
| `movies` | One row per Notion "Movies and TV Shows" record. Both the raw and the normalised form of anything Notion stores oddly. |
| `genres` + `movie_genres` | The Genres database and its relation |
| `actors` + `movie_actors` | The Casts database; `position` keeps billing order. `photo_match` / `photo_source` record which headshot was attached and how. |
| `directors` + `movie_directors` | The Director database, same headshot columns |
| `quotes` | The Quotes database, linked to its movie |
| `movie_shots` | Each "Movie Shots" photo, with its EXIF timestamp, GPS and camera |
| `venues` | Cinemas, derived from photo GPS. `name` is yours to set. |
| `cinema_visits` | One row per record with `Theatre = Yes` |
| `import_issues` + `import_runs` | The import audit, shown on the **Data** page |

Where a Notion property has no clean relational equivalent, both forms are kept:

- **Rating** — `rating_raw` keeps `★★★½✰` exactly as written; `rating_value`
  is the 0–5 number derived from it (★ = 1, ½ = 0.5, ✰ = 0). Unrated stays
  `NULL`, never `0`.
- **Cover** — Notion stores either a file path or a URL in one property, so
  `cover_raw` keeps the original cell, `cover_kind` says which it was, and
  `poster_path` / `poster_url` hold the resolved image.
- **Title** — `title_raw` preserves the string exactly as Notion stored it,
  including any trailing whitespace; `title` is the trimmed display form used
  for search, sorting and slugs.

---

## How Notion fields were mapped

**Movies and TV Shows** (39 records)

| Notion property | Type | Column(s) |
|---|---|---|
| Title | Title | `title_raw` (verbatim), `title`, `slug` |
| Year | Number | `year` — the *release* year |
| Format | Select | `format` — "Movie" / "TV Show" |
| Status | Select | `status` — "Watched" / "Watching" / "To Watch" |
| Rating | Text (stars) | `rating_raw`, `rating_value` |
| Series Name | Text | `series_name` |
| Theatre | Checkbox | `watched_in_theatre`, and a row in `cinema_visits` |
| Created time | Created time | `created_time` (ISO) |
| Cover | File or URL | `cover_raw`, `cover_kind`, `poster_path`, `poster_url` |
| Movie Shots | Files | `movie_shots` rows, one per file, with EXIF |
| Genres | Relation | `movie_genres` |
| Cast | Relation | `movie_actors` |
| Director | Relation | `movie_directors` |
| Movie Quotes | Relation | `quotes.movie_id` |

**Genres** — `Name` → `genres.name`. The Notion rollups (`Total Movies`,
`Summary`) are kept in `notion_total_movies` / `notion_summary` for reference;
the UI counts live rows instead, so the numbers stay right if the data changes.
`Display Total Movies`, `To Watch`, `Watched` and `Watching` are the same
rollups re-formatted by Notion and are not stored separately — the identical
information is available from `Summary` and from the live counts.

**Casts** → `actors`. **Director** → `directors`. Both relation columns in
those CSVs are the inverse of the movie relations, already captured by the join
tables. **Quotes** → `quotes` (`Quote`, `Said by`, `Favorite`, `Created time`).

### A note on dates

The export has no "date watched" property. The only per-record date is Notion's
**Created time**, which is when the entry was written. The app labels it
**"Logged"** rather than presenting it as a watch date. The exception is a
cinema visit with a photo attached: there the photo's own EXIF timestamp *is*
the time you were in the room, and that is what the cinema pages show.

---

## Thumbnail matching

`src/Movies Thumbnails` and the covers inside the Notion export turned out to be
the **same files**, so the mapping is established by MD5 rather than by guessing
at filenames:

| Strategy | Count | What it means |
|---|---|---|
| `content-hash` | 36 | A curated thumbnail is byte-identical to that record's cover. Exact. |
| `export-cover` | 1 | No identical curated copy; the export's own cover file was used. |
| `slug` | 0 | Filename match — only accepted on a strong, unambiguous match. |
| remote URL only | 2 | The Notion cover is an https URL and no local file matches. |

Generic download filenames (`images.jpg`, `download_(1).jpeg`, …) are excluded
from filename matching entirely — they carry no information about which film
they belong to, and a wrong poster is worse than no poster. Anything that cannot
be matched confidently is reported instead of guessed at.

### Headshots

Actor and director headshots from `src/Actors ` and `src/Directors` are matched
by name slug, then by a single near-miss within an edit distance of 2 — those
folders contain hand-typed filenames with the occasional typo. A fuzzy match is
only taken when exactly one candidate is close enough, and it is always
reported so it can be checked rather than trusted silently.

Every supplied headshot ends up in one of three states — **exact** (filename
slug equals the person's name slug), **fuzzy** (a single near-miss, reported
so it can be checked), or **unmatched** (nobody by that name is in the export;
reported, never attached to the wrong face).

`npm run verify` asserts that every file in those folders is either attached to
somebody or reported as unmatched, so a headshot can never go missing quietly.

People appear on **/people** (grouped by directors, recurring faces, single
credits, and the handful in the Casts database with no film linked), on
**/people/[slug]** with everything they are credited on and who they appear
alongside, and as a **Credits** row on every movie page.

---

## Cinemas

**The Notion tracker has no cinema names.** It records a single `Theatre`
yes/no checkbox — that is the whole of the cinema data in the export.

What it *does* have is photos. The images attached as "Movie Shots" during
theatre visits carry GPS EXIF, and that is the only evidence in the export that
tells one cinema from another. So the importer:

1. reads GPS + capture time from every Movie Shot,
2. clusters the shots belonging to `Theatre = Yes` records — anything within
   250 m is the same venue (`src/lib/geo.ts`),
3. creates one `venues` row per cluster, labelled by its coordinates,
4. creates one `cinema_visits` row per theatre-flagged record, dated from the
   photo when there is one and from Created time when there isn't.

Venues are created **without names**, because there are none to import. You can
name one on its cinema page; the name is stored on the venue row and the
importer never overwrites it on subsequent runs.

Records with `Theatre = Yes` but no geotagged photo are still counted as visits
and grouped under **"Cinema not identified"** rather than being attached to a
guessed venue.

---

## Data-quality issues found

Run `npm run import`, or open the **Data** page in the app, for the live list
against your own export. The importer classifies and reports each of these
rather than resolving them silently:

| Finding | How it is handled |
|---|---|
| Cover is a remote URL with no local asset | The Notion URL is stored and rendered. Nothing is downloaded. |
| No byte-identical curated thumbnail | The export's own cover file is used. |
| Thumbnail matching no record | Left unassigned and reported. No movie is invented for it. |
| Geotagged photos on a record whose `Theatre` box is **No** | **The Notion value wins.** No cinema visit is created. Tick Theatre in Notion and re-import if it should be one. |
| `Theatre = Yes` but no geotagged photo | Counted as a visit; venue left unknown rather than guessed. |
| Trailing whitespace in a title | Preserved in `title_raw`, trimmed for display. |
| Genres with zero movies | Imported and kept; hidden from the dashboard breakdown. |
| People in the Casts database with no film linked | Imported as-is, shown under "No film attached" on /people. |
| Headshot filename typo | Attached as a near-miss and reported for checking. |
| Headshot matching nobody | Left unassigned and reported. |
| Duplicate titles / missing page files | Kept distinct by Notion page id; reported. |

Nothing is deleted, merged, re-dated or re-rated.

---

## Architecture

```
src/
├── app/            Pages (Next.js App Router) — UI only
│   ├── page.tsx              Diary / dashboard
│   ├── library/              Grid, search, filters, sort, pagination
│   ├── movies/[slug]/        Movie detail
│   ├── cinemas/              Cinema list + [slug] detail
│   ├── people/               Cast & directors index + [slug] detail
│   ├── quotes/               Saved lines
│   ├── data-health/          The import audit
│   └── api/venues/[id]/      PATCH — name a cinema
├── components/     Presentational components
├── db/
│   ├── schema.ts             The schema, annotated against Notion
│   ├── client.ts             Connection for the app (server-only)
│   └── connect.ts            Connection for the CLI scripts
└── lib/
    ├── notion.ts             Parsing the export (CSV, relations, stars, dates)
    ├── assets.ts             Poster / headshot matching
    ├── geo.ts                Venue clustering from GPS
    ├── queries.ts            Every read the UI makes
    └── format.ts             Display helpers
scripts/
├── migrate.ts      Apply migrations
├── import-notion.ts  The import pipeline
└── verify.ts       Assert the database matches the export
```

Pages never touch SQL; `src/lib/queries.ts` is the only module that does. The
importer never imports from `queries.ts`, so the read and write paths stay
independent.

### Accessibility

The text ramp is spaced by measured contrast rather than by eye — every text
tone clears WCAG AA (4.5:1) against both surface colours, because the recessed
tones carry real content (section labels, coordinates, dates) rather than
decoration:

| Token | on `ink` | on `velvet` |
|---|---|---|
| `paper` | 15.97 | 14.54 |
| `dim` | 7.60 | 6.92 |
| `faint` | 5.04 | 4.58 |
| `sconce` | 9.56 | 8.71 |
| `rose` | 5.30 | 4.82 |
| `screen` | 10.56 | 9.62 |

Ratings are announced as text (`Rated 4.5 out of 5`) with the star glyphs marked
`aria-hidden`, so the unfilled half of the meter is a visual track rather than
information. Each page has exactly one `h1`, every image carries alt text, focus
is visible in the house-light amber, there is a skip link, and
`prefers-reduced-motion` disables the poster-grid stagger and hover transitions.

### Rendering

Everything renders on demand (`dynamic = "force-dynamic"` in the root layout) so
a re-import or a renamed cinema shows up immediately without a rebuild. There is
deliberately no root `loading.tsx`: reads are synchronous SQLite, and a root
Suspense boundary would swallow the 404 status on unknown movie and cinema URLs.
Skeletons live on `/library` and `/cinemas`, where filtering and navigation are
the only places a transition is perceptible.
