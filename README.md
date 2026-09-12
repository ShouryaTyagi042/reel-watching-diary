# Reel, a watching diary

A personal diary of the films and shows you have watched, and the cinemas you
saw them in. Standalone: the SQLite database is the source of truth, and nothing
overwrites it.

The interesting part is the cinemas. An entry records *that* you were in a
cinema, not which one, but the photos you took there carry GPS. Upload one and
the venue is placed; a later photo within 250 m counts as the same cinema. A
venue arrives unnamed, as a fix on the earth, and you name it.

## Getting data in

**Add an entry** at `/add`. Title is the only required field.

**Add one by name** with facts resolved from Wikipedia and Wikidata rather than
typed from memory:

```bash
npx tsx scripts/add-film.ts "About Time" --dry-run
npx tsx scripts/add-film.ts "About Time" && npm run import
```

**Seed from an exported collection** (Markdown and CSV, as the source tool and similar
tools produce). This is additive: anything already in the diary is left exactly
as it is, edits included.

```
your-folder/
├── d/      An exported collection, if you have one to seed from
├── src/    Your artwork, headshots and screening photos
│   ├── Movies Thumbnails/
│   ├── Actors/
│   ├── Directors/
│   └── Movie Shots/
└── web/    This repository
```

```bash
npm run seed -- --export ../d --assets ../src
```

## Editing

Every field on an entry is editable in place from its page: title, release year,
format, status, rating, genres, cast, director, series, the logged date, and
whether it was watched in a cinema. Photos from a screening are uploaded there
too, and their GPS is what places the venue.

Because the database is the source of truth, a saved edit is simply the record
now. Re-running the seed will not revert it.

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
| `npm run import` / `npm run seed` | Seed from an exported collection. Additive; never overwrites |
| `npm run setup` | `db:migrate` then `import` |
| `npm run db:reset` | Delete the database and re-migrate (then run `import`) |
| `npm run verify` | Check the database is internally consistent and every file it points at exists |
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

SQLite via Drizzle ORM (`src/db/schema.ts`). Thirteen tables. Imported records
keep their source page id so re-importing updates rows rather than duplicating
them; entries added in the app get an `app_…` id and an `origin` of `"app"`.

| Table | Holds |
|---|---|
| `movies` | One row per entry, imported or added here. Keeps both the raw and the normalised form of anything stored oddly at source, plus `origin` so the importer knows which rows are its own. |
| `genres` + `movie_genres` | The Genres database and its relation |
| `actors` + `movie_actors` | The Casts database; `position` keeps billing order. `photo_match` / `photo_source` record which headshot was attached and how. |
| `directors` + `movie_directors` | The Director database, same headshot columns |
| `quotes` | The Quotes database, linked to its movie |
| `movie_shots` | Each "Movie Shots" photo, with its EXIF timestamp, GPS and camera |
| `venues` | Cinemas, derived from photo GPS. `name` is yours to set. |
| `cinema_visits` | One row per record with `Theatre = Yes` |
| `import_issues` + `import_runs` | The import audit, shown on the **Data** page |

Where a source property has no clean relational equivalent, both forms are kept:

- **Rating** — `rating_raw` keeps `★★★½✰` exactly as written; `rating_value`
  is the 0–5 number derived from it (★ = 1, ½ = 0.5, ✰ = 0). Unrated stays
  `NULL`, never `0`.
- **Cover** — the source tool stores either a file path or a URL in one property, so
  `cover_raw` keeps the original cell, `cover_kind` says which it was, and
  `poster_path` / `poster_url` hold the resolved image.
- **Title** — `title_raw` preserves the string exactly as the source tool stored it,
  including any trailing whitespace; `title` is the trimmed display form used
  for search, sorting and slugs.

---

## How an imported collection maps to the schema

**Movies and TV Shows** (39 records)

| the source tool property | Type | Column(s) |
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

**Genres** — `Name` → `genres.name`. The the source tool rollups (`Total Movies`,
`Summary`) are kept in `notion_total_movies` / `notion_summary` for reference;
the UI counts live rows instead, so the numbers stay right if the data changes.
`Display Total Movies`, `To Watch`, `Watched` and `Watching` are the same
rollups re-formatted by the source tool and are not stored separately — the identical
information is available from `Summary` and from the live counts.

**Casts** → `actors`. **Director** → `directors`. Both relation columns in
those CSVs are the inverse of the movie relations, already captured by the join
tables. **Quotes** → `quotes` (`Quote`, `Said by`, `Favorite`, `Created time`).

### A note on dates

Seeded records carry only the date their entry was created in the source tool,
which is when it was written rather than when it was watched. The UI labels that
"Logged". The exception is a cinema visit with a photo attached: the photo's own
timestamp is when you were in the room, and that is what the cinema pages show.


## Thumbnail matching

`src/Movies Thumbnails` and the covers inside the the source tool export turned out to be
the **same files**, so the mapping is established by MD5 rather than by guessing
at filenames:

| Strategy | Count | What it means |
|---|---|---|
| `content-hash` | 36 | A curated thumbnail is byte-identical to that record's cover. Exact. |
| `export-cover` | 1 | No identical curated copy; the export's own cover file was used. |
| `slug` | 0 | Filename match — only accepted on a strong, unambiguous match. |
| remote URL only | 2 | The the source tool cover is an https URL and no local file matches. |

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

**Nothing in the data carries a cinema name.** An entry records only *that* it
was watched in a cinema — that is the whole of the cinema data.

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
| Cover is a remote URL with no local asset | The the source tool URL is stored and rendered. Nothing is downloaded. |
| No byte-identical curated thumbnail | The export's own cover file is used. |
| Thumbnail matching no record | Left unassigned and reported. No movie is invented for it. |
| Geotagged photos on a record not marked as watched in a cinema | **The recorded value wins.** No cinema visit is created; the conflict is reported instead. |
| `Theatre = Yes` but no geotagged photo | Counted as a visit; venue left unknown rather than guessed. |
| Trailing whitespace in a title | Preserved in `title_raw`, trimmed for display. |
| Genres with zero movies | Imported and kept; hidden from the dashboard breakdown. |
| People in the Casts database with no film linked | Imported as-is, shown under "No film attached" on /people. |
| Headshot filename typo | Attached as a near-miss and reported for checking. |
| Headshot matching nobody | Left unassigned and reported. |
| Duplicate titles / missing page files | Kept distinct by record id; reported. |

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
│   ├── add/                  Add an entry
│   └── api/movies/           POST create entry, POST [slug]/poster upload
│   ├── quotes/               Saved lines
│   ├── data-health/          The import audit
│   └── api/venues/[id]/      PATCH — name a cinema
├── components/     Presentational components
├── db/
│   ├── schema.ts             The schema, annotated against the source format
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

Pages never touch SQL: `queries.ts` owns every read and `mutations.ts` every
write. The importer shares neither, so the three paths stay independent.

`thumbnail-name.ts` is deliberately dependency-free — the server uses it to name
an uploaded file and the client uses it to show where that file will land, from
one implementation, so the two can never drift.

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
