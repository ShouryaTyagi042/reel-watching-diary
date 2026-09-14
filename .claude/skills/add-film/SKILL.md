---
name: add-film
description: Add a film or show to the Reel diary by name, with artwork and cast headshots. Resolves the year, director, cast and genres from Wikipedia and Wikidata rather than from memory, downloads any missing images, and reports every licence. Use when asked to add, log, or record a film in the diary.
---

# Add a film to the diary

Adds an entry to the Reel diary from nothing but a title. The supporting script
does the work; your job is to get the arguments right and to show the user what
was resolved before it is written.

## The one rule

**Never type a year, director or cast list from memory.** The script reads them
from Wikidata's structured claims. If the script cannot resolve a film, say so
and ask, rather than filling the gaps yourself. The whole point of this diary is
that its records are sourced.

Equally, never invent a rating, a watch date, or a cinema visit. Those are the
user's to give. An entry with no rating is correct; an invented one is not.

## How to run it

Always dry-run first, show the user what came back, then write.

```bash
cd cinema-tracker/web
npx tsx scripts/add-film.ts "About Time" --dry-run
```

When the resolution looks right:

```bash
npx tsx scripts/add-film.ts "About Time"
npm run import     # copies new artwork and headshots into the app
```

The import step is what attaches the downloaded files to the records. Skipping
it leaves the entry without artwork.

## Options

| Flag | Use |
|---|---|
| `--dry-run` | Resolve and report, write nothing |
| `--year N` | Override the release year |
| `--status S` | `Watched` (default), `Watching`, `To Watch` |
| `--rating N` | 0 to 5 in half steps. Omit unless the user gave one |
| `--watched-on DATE` | ISO date to log the entry under |
| `--cinema` | Record it as a cinema visit |
| `--cast N` | How many cast to take from Wikidata (default 5) |
| `--cast-names "A,B"` | Use exactly these cast, ignoring Wikidata's order |
| `--no-roles` | Skip the character lookup |
| `--genres "A,B"` | Override the genre mapping |
| `--no-images` | Skip all downloads |

## Characters

Each cast credit can carry the character played. Wikidata records *who was in* a
film but almost never *who they played*: its character qualifier is empty across
every film checked here. The Cast section of the Wikipedia article does carry it,
written as `Actor as Character`, so that is where the script reads it from.

It is prose, so it is occasionally surprising rather than wrong. Wikipedia lists
Hugh Jackman in The Prestige as "Lord Caldlow", his character's alias, not
"Robert Angier". The script reports the source faithfully; correct it by hand on
the entry if you disagree with the article.

An actor the Cast section does not name gets no character, and the script says
which. Never fill one in from memory.

Characters can also be typed directly anywhere cast is entered, in the same
shape: `Domhnall Gleeson as Tim Lake`.

## Two traps worth knowing

**Wikidata's cast order is not billing order.** A lead can sit below a bit part
and fall outside `--cast N`. On *About Time* the first five entries included a
minor role but omitted Rachel McAdams, the second lead. The script now reports
how many cast it did not take. When the user names the actors they care about,
pass `--cast-names` and honour that exactly.

**Genre mapping is deliberately conservative.** Wikidata genres are matched onto
the vocabulary already in the diary and anything unmapped is dropped and
reported, so the genre list does not sprout a near-duplicate per entry. Films
often carry four or five overlapping genres there; if the result looks
over-tagged, pass `--genres` with the two or three that actually fit.

## Licences

Cast and director headshots come from Wikimedia Commons and are only kept when
freely licensed. Film artwork is different: posters are almost always **fair
use**, not free. The script reports this and the file stays in the local assets
folder, which is excluded from version control. Say so plainly rather than
implying the artwork is free to redistribute.

## Where things land

- Artwork: `src/Movies Thumbnails/<snake_case_title>.jpg`
- Headshots: `src/Actors /<Name>.jpg`, `src/Directors/<Name>.jpg`
- The record: `data/diary.db`, marked `origin: "app"` so `npm run import`
  never overwrites or removes it

Filenames are keyed to the credited name so the importer's slug match pairs
them up. Do not rename them by hand.

## Afterwards

Report what was added, at which URL, and which images were downloaded with
their licences. If artwork or a headshot could not be found, say which and leave
it rather than substituting a different image.
