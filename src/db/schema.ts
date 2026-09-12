/**
 * Database schema.
 *
 * This database is the source of truth for the diary. Records can be created in
 * the app or seeded from an exported collection; once here they are equal, and
 * nothing overwrites them.
 *
 * Every property has a home here. Where a property has no exact
 * relational equivalent (star-string ratings, "Cover" which is either a file or
 * a URL, multi-file "Movie Shots"), the raw original value is preserved
 * alongside the normalised one so nothing from the export is lost.
 */
import { sql, relations } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/* ------------------------------------------------------------------ movies */
/** Movies and TV Shows. */
export const movies = sqliteTable(
  "movies",
  {
    /** Stable record id. Seeded records keep the id from their source file. */
    id: text("id").primaryKey(),
    /** Title exactly as first recorded, including any trailing whitespace. */
    titleRaw: text("title_raw").notNull(),
    /** Trimmed title used for display and search. */
    title: text("title").notNull(),
    /** URL-safe identifier derived from `title`. */
    slug: text("slug").notNull(),

    /** Release year, not the watch year. */
    year: integer("year"),
    /** "Format" select: "Movie" | "TV Show". */
    format: text("format"),
    /** "Status" select: "Watched" | "Watching" | "To Watch". */
    status: text("status"),
    /** "Series Name" (text), e.g. "James Bond - Daniel Craig". */
    seriesName: text("series_name"),

    /** "Rating" as written, e.g. "★★★½✰". Preserved verbatim. */
    ratingRaw: text("rating_raw"),
    /** `ratingRaw` parsed to a 0–5 scale (★=1, ½=0.5, ✰=0). NULL when unrated. */
    ratingValue: real("rating_value"),

    /** "Theatre" checkbox — Yes means this was watched in a cinema. */
    watchedInTheatre: integer("watched_in_theatre", { mode: "boolean" })
      .notNull()
      .default(false),

    /** "Created time" — the diary entry date (ISO 8601). */
    createdTime: text("created_time"),

    /** "Cover" cell verbatim (either a relative export path or an https URL). */
    coverRaw: text("cover_raw"),
    /** "local" when the export shipped a file, "external" for a remote URL, NULL when absent. */
    coverKind: text("cover_kind"),
    /** Web path under /public for the poster copied out of the export. */
    posterPath: text("poster_path"),
    /** Remote cover URL when the export only referenced one. */
    posterUrl: text("poster_url"),
    /** Which strategy matched the poster: "content-hash" | "export-cover" | "slug" | NULL. */
    posterMatch: text("poster_match"),
    /** Original filename of the matched asset, for traceability. */
    posterSource: text("poster_source"),

    /**
     * Where this record was first seeded from, if it was.
     * NULL for entries created in the app. Informational only: the database is
     * the source of truth and nothing re-reads this.
     */
    sourcePath: text("source_path"),
  },
  (t) => [
    uniqueIndex("movies_slug_idx").on(t.slug),
    index("movies_status_idx").on(t.status),
    index("movies_created_idx").on(t.createdTime),
  ],
);

/* ------------------------------------------------------------------ genres */
/** Genres. */
export const genres = sqliteTable(
  "genres",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    /** rollup "Total Movies" as exported. Kept for reference; the UI counts live rows. */
    sourceTotalMovies: integer("source_total_movies"),
    /** formula "Summary", e.g. "To watch: 1 | Watching: 0 | Watched: 10". */
    sourceSummary: text("source_summary"),
  },
  (t) => [uniqueIndex("genres_slug_idx").on(t.slug)],
);

export const movieGenres = sqliteTable(
  "movie_genres",
  {
    movieId: text("movie_id").notNull().references(() => movies.id, { onDelete: "cascade" }),
    genreId: text("genre_id").notNull().references(() => genres.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.movieId, t.genreId] })],
);

/* ------------------------------------------------------------------ people */
/** Casts. */
export const actors = sqliteTable(
  "actors",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    /** Headshot copied from `src/Actors`, when one exists for this name. */
    photoPath: text("photo_path"),
    /** How the headshot was matched: "exact" (name slug) or "fuzzy" (near-miss filename). */
    photoMatch: text("photo_match"),
    /** Original filename of the matched headshot, for traceability. */
    photoSource: text("photo_source"),
  },
  (t) => [uniqueIndex("actors_slug_idx").on(t.slug)],
);

export const movieActors = sqliteTable(
  "movie_actors",
  {
    movieId: text("movie_id").notNull().references(() => movies.id, { onDelete: "cascade" }),
    actorId: text("actor_id").notNull().references(() => actors.id, { onDelete: "cascade" }),
    /** Billing order as listed in the "Cast" relation. */
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.movieId, t.actorId] })],
);

/** Director. */
export const directors = sqliteTable(
  "directors",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    photoPath: text("photo_path"),
    photoMatch: text("photo_match"),
    photoSource: text("photo_source"),
  },
  (t) => [uniqueIndex("directors_slug_idx").on(t.slug)],
);

export const movieDirectors = sqliteTable(
  "movie_directors",
  {
    movieId: text("movie_id").notNull().references(() => movies.id, { onDelete: "cascade" }),
    directorId: text("director_id").notNull().references(() => directors.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.movieId, t.directorId] })],
);

/* ------------------------------------------------------------------ quotes */
/** Quotes. */
export const quotes = sqliteTable(
  "quotes",
  {
    id: text("id").primaryKey(),
    text: text("text").notNull(),
    /** "Said by" — the character who says the line. */
    saidBy: text("said_by"),
    /** "Favorite" checkbox. */
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    createdTime: text("created_time"),
    movieId: text("movie_id").references(() => movies.id, { onDelete: "cascade" }),
  },
  (t) => [index("quotes_movie_idx").on(t.movieId)],
);

/* ------------------------------------------------------------------ venues */
/**
 * Cinemas.
 *
 * The export records only a `Theatre` yes/no checkbox — it has no cinema
 * names. Distinct venues are therefore derived from the GPS EXIF embedded in the
 * "Movie Shots" photos taken during theatre visits: shots within ~250 m of each
 * other are treated as the same venue.
 *
 * `name` is deliberately NULL on import — no cinema name exists in the source
 * data and inventing one would be fabrication. The user can name a venue in the
 * app; the importer never overwrites a name that has been set.
 */
export const venues = sqliteTable(
  "venues",
  {
    id: text("id").primaryKey(),
    /** User-supplied cinema name. NULL until named — never populated by the importer. */
    name: text("name"),
    /** Fallback display label, e.g. "Cinema at 51.5074, -0.1278". */
    label: text("label").notNull(),
    slug: text("slug").notNull(),
    /** Cluster centroid, averaged over the venue's geotagged shots. */
    lat: real("lat"),
    lng: real("lng"),
    /** How the venue was identified. Currently always "photo-gps". */
    source: text("source").notNull().default("photo-gps"),
    notes: text("notes"),
  },
  (t) => [uniqueIndex("venues_slug_idx").on(t.slug)],
);

/**
 * One row per cinema outing: a movie whose `Theatre` checkbox is Yes.
 *
 * `venueId` is NULL when the visit has no geotagged photo to place it — the
 * visit is still real and still counted, the venue is simply unknown.
 */
export const cinemaVisits = sqliteTable(
  "cinema_visits",
  {
    id: text("id").primaryKey(),
    movieId: text("movie_id").notNull().references(() => movies.id, { onDelete: "cascade" }),
    venueId: text("venue_id").references(() => venues.id, { onDelete: "set null" }),
    /** Photo capture time when available, otherwise the "Created time". */
    visitedAt: text("visited_at"),
    /** "photo-exif" when dated from a shot, "record-date" otherwise. */
    visitedAtSource: text("visited_at_source"),
  },
  (t) => [
    uniqueIndex("cinema_visits_movie_idx").on(t.movieId),
    index("cinema_visits_venue_idx").on(t.venueId),
  ],
);

/* ------------------------------------------------------------- movie shots */
/** "Movie Shots" files — photos taken by the user, one row per file. */
export const movieShots = sqliteTable(
  "movie_shots",
  {
    id: text("id").primaryKey(),
    movieId: text("movie_id").notNull().references(() => movies.id, { onDelete: "cascade" }),
    /** Web path under /public for the copied image. */
    path: text("path").notNull(),
    /** Original filename inside the export. */
    sourceName: text("source_name").notNull(),
    /** EXIF DateTimeOriginal (ISO 8601). */
    capturedAt: text("captured_at"),
    lat: real("lat"),
    lng: real("lng"),
    cameraMake: text("camera_make"),
    cameraModel: text("camera_model"),
    venueId: text("venue_id").references(() => venues.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("movie_shots_movie_idx").on(t.movieId)],
);

/* ------------------------------------------------------------ import audit */
/**
 * Findings recorded by the importer: unmatched thumbnails, missing posters,
 * malformed rows, source inconsistencies. Surfaced in the app's Data Health page
 * so nothing is silently dropped.
 */
export const importIssues = sqliteTable("import_issues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runAt: text("run_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  /** "error" | "warning" | "info" */
  severity: text("severity").notNull(),
  /** Machine-readable grouping, e.g. "poster-missing", "theatre-flag-conflict". */
  kind: text("kind").notNull(),
  subject: text("subject"),
  detail: text("detail").notNull(),
});

/** Counters from the most recent import run, for the Data Health page. */
export const importRuns = sqliteTable("import_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runAt: text("run_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  stats: text("stats").notNull(), // JSON blob
});

/* --------------------------------------------------------------- relations */
export const moviesRelations = relations(movies, ({ many, one }) => ({
  genres: many(movieGenres),
  actors: many(movieActors),
  directors: many(movieDirectors),
  quotes: many(quotes),
  shots: many(movieShots),
  visit: one(cinemaVisits),
}));

export const genresRelations = relations(genres, ({ many }) => ({ movies: many(movieGenres) }));
export const actorsRelations = relations(actors, ({ many }) => ({ movies: many(movieActors) }));
export const directorsRelations = relations(directors, ({ many }) => ({ movies: many(movieDirectors) }));

export const movieGenresRelations = relations(movieGenres, ({ one }) => ({
  movie: one(movies, { fields: [movieGenres.movieId], references: [movies.id] }),
  genre: one(genres, { fields: [movieGenres.genreId], references: [genres.id] }),
}));

export const movieActorsRelations = relations(movieActors, ({ one }) => ({
  movie: one(movies, { fields: [movieActors.movieId], references: [movies.id] }),
  actor: one(actors, { fields: [movieActors.actorId], references: [actors.id] }),
}));

export const movieDirectorsRelations = relations(movieDirectors, ({ one }) => ({
  movie: one(movies, { fields: [movieDirectors.movieId], references: [movies.id] }),
  director: one(directors, { fields: [movieDirectors.directorId], references: [directors.id] }),
}));

export const quotesRelations = relations(quotes, ({ one }) => ({
  movie: one(movies, { fields: [quotes.movieId], references: [movies.id] }),
}));

export const venuesRelations = relations(venues, ({ many }) => ({
  visits: many(cinemaVisits),
  shots: many(movieShots),
}));

export const cinemaVisitsRelations = relations(cinemaVisits, ({ one }) => ({
  movie: one(movies, { fields: [cinemaVisits.movieId], references: [movies.id] }),
  venue: one(venues, { fields: [cinemaVisits.venueId], references: [venues.id] }),
}));

export const movieShotsRelations = relations(movieShots, ({ one }) => ({
  movie: one(movies, { fields: [movieShots.movieId], references: [movies.id] }),
  venue: one(venues, { fields: [movieShots.venueId], references: [venues.id] }),
}));
