/**
 * Data access layer. Everything the UI reads goes through here, so pages stay
 * free of SQL and the schema can move without touching components.
 */
import "server-only";
import { and, asc, desc, eq, isNotNull, like, or, sql } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { db } from "@/db/client";
import * as s from "@/db/schema";

/* --------------------------------------------------------------- row types */
export interface MovieCard {
  id: string;
  title: string;
  slug: string;
  year: number | null;
  format: string | null;
  status: string | null;
  ratingValue: number | null;
  ratingRaw: string | null;
  posterPath: string | null;
  posterUrl: string | null;
  createdTime: string | null;
  watchedInTheatre: boolean;
  seriesName: string | null;
  genres: string;      // comma-joined, built in SQL
  venueName: string | null;
  venueLabel: string | null;
  venueSlug: string | null;
  venueLat: number | null;
  venueLng: number | null;
  visitedAt: string | null;
}

const cardColumns = {
  id: s.movies.id,
  title: s.movies.title,
  slug: s.movies.slug,
  year: s.movies.year,
  format: s.movies.format,
  status: s.movies.status,
  ratingValue: s.movies.ratingValue,
  ratingRaw: s.movies.ratingRaw,
  posterPath: s.movies.posterPath,
  posterUrl: s.movies.posterUrl,
  createdTime: s.movies.createdTime,
  watchedInTheatre: s.movies.watchedInTheatre,
  seriesName: s.movies.seriesName,
  genres: sql<string>`(
    SELECT group_concat(g.name, ', ')
    FROM movie_genres mg JOIN genres g ON g.id = mg.genre_id
    WHERE mg.movie_id = ${s.movies.id}
  )`.as("genres"),
  venueName: s.venues.name,
  venueLabel: s.venues.label,
  venueSlug: s.venues.slug,
  venueLat: s.venues.lat,
  venueLng: s.venues.lng,
  visitedAt: s.cinemaVisits.visitedAt,
};

function cardQuery() {
  return db
    .select(cardColumns)
    .from(s.movies)
    .leftJoin(s.cinemaVisits, eq(s.cinemaVisits.movieId, s.movies.id))
    .leftJoin(s.venues, eq(s.venues.id, s.cinemaVisits.venueId));
}

/* --------------------------------------------------------------- dashboard */
export interface DashboardStats {
  total: number;
  watched: number;
  watching: number;
  toWatch: number;
  movies: number;
  tvShows: number;
  thisYear: number;
  thisMonth: number;
  currentYear: number;
  currentMonthLabel: string;
  cinemaVisits: number;
  venuesIdentified: number;
  mostVisitedVenue: { label: string; name: string | null; slug: string; visits: number } | null;
  averageRating: number | null;
  ratedCount: number;
  genresUsed: number;
  actorsCount: number;
  directorsCount: number;
  quotesCount: number;
  firstEntry: string | null;
  latestEntry: string | null;
}

export function getDashboardStats(): DashboardStats {
  const now = new Date();
  const year = now.getFullYear();
  const monthPrefix = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const one = <T>(rows: T[]): T | null => rows[0] ?? null;
  const count = (where?: ReturnType<typeof eq>) => {
    const q = db.select({ n: sql<number>`count(*)` }).from(s.movies);
    return (where ? q.where(where) : q).get()?.n ?? 0;
  };

  const thisYear = db
    .select({ n: sql<number>`count(*)` })
    .from(s.movies)
    .where(sql`substr(${s.movies.createdTime}, 1, 4) = ${String(year)}`)
    .get()?.n ?? 0;

  const thisMonth = db
    .select({ n: sql<number>`count(*)` })
    .from(s.movies)
    .where(sql`substr(${s.movies.createdTime}, 1, 7) = ${monthPrefix}`)
    .get()?.n ?? 0;

  const ratingAgg = db
    .select({ avg: sql<number>`avg(${s.movies.ratingValue})`, n: sql<number>`count(${s.movies.ratingValue})` })
    .from(s.movies)
    .get();

  const topVenue = one(
    db
      .select({
        label: s.venues.label,
        name: s.venues.name,
        slug: s.venues.slug,
        visits: sql<number>`count(${s.cinemaVisits.id})`.as("visits"),
      })
      .from(s.venues)
      .leftJoin(s.cinemaVisits, eq(s.cinemaVisits.venueId, s.venues.id))
      .groupBy(s.venues.id)
      .orderBy(desc(sql`visits`))
      .limit(1)
      .all(),
  );

  const bounds = db
    .select({
      first: sql<string | null>`min(${s.movies.createdTime})`,
      last: sql<string | null>`max(${s.movies.createdTime})`,
    })
    .from(s.movies)
    .get();

  return {
    total: count(),
    watched: count(eq(s.movies.status, "Watched")),
    watching: count(eq(s.movies.status, "Watching")),
    toWatch: count(eq(s.movies.status, "To Watch")),
    movies: count(eq(s.movies.format, "Movie")),
    tvShows: count(eq(s.movies.format, "TV Show")),
    thisYear,
    thisMonth,
    currentYear: year,
    currentMonthLabel: now.toLocaleString("en-GB", { month: "long" }),
    cinemaVisits: db.select({ n: sql<number>`count(*)` }).from(s.cinemaVisits).get()?.n ?? 0,
    venuesIdentified: db.select({ n: sql<number>`count(*)` }).from(s.venues).get()?.n ?? 0,
    mostVisitedVenue: topVenue && topVenue.visits > 0 ? topVenue : null,
    averageRating: ratingAgg?.n ? Number(ratingAgg.avg) : null,
    ratedCount: ratingAgg?.n ?? 0,
    genresUsed:
      db
        .select({ n: sql<number>`count(DISTINCT ${s.movieGenres.genreId})` })
        .from(s.movieGenres)
        .get()?.n ?? 0,
    actorsCount: db.select({ n: sql<number>`count(*)` }).from(s.actors).get()?.n ?? 0,
    directorsCount: db.select({ n: sql<number>`count(*)` }).from(s.directors).get()?.n ?? 0,
    quotesCount: db.select({ n: sql<number>`count(*)` }).from(s.quotes).get()?.n ?? 0,
    firstEntry: bounds?.first ?? null,
    latestEntry: bounds?.last ?? null,
  };
}

export function getRecentlyLogged(limit = 12): MovieCard[] {
  return cardQuery()
    .where(isNotNull(s.movies.createdTime))
    .orderBy(desc(s.movies.createdTime))
    .limit(limit)
    .all() as MovieCard[];
}

export function getTopRated(limit = 8): MovieCard[] {
  return cardQuery()
    .where(isNotNull(s.movies.ratingValue))
    .orderBy(desc(s.movies.ratingValue), desc(s.movies.createdTime))
    .limit(limit)
    .all() as MovieCard[];
}

export function getWatchlist(limit = 8): MovieCard[] {
  return cardQuery()
    .where(eq(s.movies.status, "To Watch"))
    .orderBy(desc(s.movies.createdTime))
    .limit(limit)
    .all() as MovieCard[];
}

export function getInProgress(limit = 6): MovieCard[] {
  return cardQuery()
    .where(eq(s.movies.status, "Watching"))
    .orderBy(desc(s.movies.createdTime))
    .limit(limit)
    .all() as MovieCard[];
}

export function getGenreBreakdown(): { name: string; slug: string; count: number }[] {
  return db
    .select({
      name: s.genres.name,
      slug: s.genres.slug,
      count: sql<number>`count(${s.movieGenres.movieId})`.as("count"),
    })
    .from(s.genres)
    .leftJoin(s.movieGenres, eq(s.movieGenres.genreId, s.genres.id))
    .groupBy(s.genres.id)
    .orderBy(desc(sql`count`), asc(s.genres.name))
    .all();
}

/** Entries per calendar year, from the "Created time" (the diary date). */
export function getYearlyActivity(): { year: string; count: number }[] {
  return db
    .select({
      year: sql<string>`substr(${s.movies.createdTime}, 1, 4)`.as("log_year"),
      count: sql<number>`count(*)`.as("count"),
    })
    .from(s.movies)
    .where(isNotNull(s.movies.createdTime))
    // Group by the expression, not by an alias: `movies` has its own `year`
    // column (the release year), which an alias of that name would resolve to.
    .groupBy(sql`substr(${s.movies.createdTime}, 1, 4)`)
    .orderBy(asc(sql`substr(${s.movies.createdTime}, 1, 4)`))
    .all();
}

/**
 * Entries per calendar month, from the "Created time" (the diary date).
 * Months with no entries are filled in so the strip reads as a real timeline
 * rather than a list of the busy months only.
 */
export function getMonthlyActivity(): { key: string; label: string; year: string; count: number }[] {
  const rows = db
    .select({
      key: sql<string>`substr(${s.movies.createdTime}, 1, 7)`.as("log_month"),
      count: sql<number>`count(*)`.as("count"),
    })
    .from(s.movies)
    .where(isNotNull(s.movies.createdTime))
    .groupBy(sql`substr(${s.movies.createdTime}, 1, 7)`)
    .orderBy(asc(sql`substr(${s.movies.createdTime}, 1, 7)`))
    .all();

  if (!rows.length) return [];

  const counts = new Map(rows.map((r) => [r.key, r.count]));
  const [firstY, firstM] = rows[0].key.split("-").map(Number);
  const [lastY, lastM] = rows[rows.length - 1].key.split("-").map(Number);

  const out: { key: string; label: string; year: string; count: number }[] = [];
  for (let y = firstY, m = firstM; y < lastY || (y === lastY && m <= lastM); ) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push({
      key,
      label: new Date(y, m - 1, 1).toLocaleString("en-GB", { month: "short" }),
      year: String(y),
      count: counts.get(key) ?? 0,
    });
    if (m === 12) { m = 1; y++; } else m++;
  }
  return out;
}

/* ------------------------------------------------------------------ quotes */
export interface QuoteRow {
  id: string; text: string; saidBy: string | null; favorite: boolean;
  movieTitle: string | null; movieSlug: string | null;
}

export function getQuotes(limit?: number): QuoteRow[] {
  const q = db
    .select({
      id: s.quotes.id, text: s.quotes.text, saidBy: s.quotes.saidBy,
      favorite: s.quotes.favorite,
      movieTitle: s.movies.title, movieSlug: s.movies.slug,
    })
    .from(s.quotes)
    .leftJoin(s.movies, eq(s.movies.id, s.quotes.movieId))
    .orderBy(desc(s.quotes.favorite), desc(s.quotes.createdTime));
  return (limit ? q.limit(limit) : q).all();
}

/* ----------------------------------------------------------------- library */
export interface LibraryFilters {
  q?: string;
  status?: string;
  format?: string;
  genre?: string;
  logYear?: string;
  releaseFrom?: string;
  releaseTo?: string;
  minRating?: string;
  cinema?: string;   // venue slug | "any" | "none"
  director?: string;
  sort?: string;
  page?: string;
}

export const SORTS = {
  recent: "Recently logged",
  oldest: "Oldest first",
  rating_desc: "Highest rated",
  rating_asc: "Lowest rated",
  title_asc: "Title A–Z",
  title_desc: "Title Z–A",
  year_desc: "Newest release",
  year_asc: "Oldest release",
} as const;

export const PAGE_SIZE = 24;

export function getLibrary(f: LibraryFilters): {
  rows: MovieCard[]; total: number; page: number; pageCount: number;
} {
  const where = [] as ReturnType<typeof eq>[];

  if (f.q?.trim()) {
    const needle = `%${f.q.trim().toLowerCase()}%`;
    where.push(
      or(
        like(sql`lower(${s.movies.title})`, needle),
        like(sql`lower(coalesce(${s.movies.seriesName}, ''))`, needle),
        sql`EXISTS (SELECT 1 FROM movie_actors ma JOIN actors a ON a.id = ma.actor_id
                    WHERE ma.movie_id = ${s.movies.id} AND lower(a.name) LIKE ${needle})`,
        sql`EXISTS (SELECT 1 FROM movie_directors md JOIN directors d ON d.id = md.director_id
                    WHERE md.movie_id = ${s.movies.id} AND lower(d.name) LIKE ${needle})`,
      )!,
    );
  }
  if (f.status) where.push(eq(s.movies.status, f.status));
  if (f.format) where.push(eq(s.movies.format, f.format));
  if (f.genre) {
    where.push(
      sql`EXISTS (SELECT 1 FROM movie_genres mg JOIN genres g ON g.id = mg.genre_id
                  WHERE mg.movie_id = ${s.movies.id} AND g.slug = ${f.genre})` as never,
    );
  }
  if (f.director) {
    where.push(
      sql`EXISTS (SELECT 1 FROM movie_directors md JOIN directors d ON d.id = md.director_id
                  WHERE md.movie_id = ${s.movies.id} AND d.slug = ${f.director})` as never,
    );
  }
  if (f.logYear) {
    where.push(sql`substr(${s.movies.createdTime}, 1, 4) = ${f.logYear}` as never);
  }
  if (f.releaseFrom && Number.isFinite(Number(f.releaseFrom))) {
    where.push(sql`${s.movies.year} >= ${Number(f.releaseFrom)}` as never);
  }
  if (f.releaseTo && Number.isFinite(Number(f.releaseTo))) {
    where.push(sql`${s.movies.year} <= ${Number(f.releaseTo)}` as never);
  }
  if (f.minRating && Number.isFinite(Number(f.minRating))) {
    where.push(sql`${s.movies.ratingValue} >= ${Number(f.minRating)}` as never);
  }
  if (f.cinema === "any") where.push(eq(s.movies.watchedInTheatre, true));
  else if (f.cinema === "none") where.push(eq(s.movies.watchedInTheatre, false));
  else if (f.cinema) where.push(eq(s.venues.slug, f.cinema));

  const clause = where.length ? and(...where) : undefined;

  const total =
    db
      .select({ n: sql<number>`count(*)` })
      .from(s.movies)
      .leftJoin(s.cinemaVisits, eq(s.cinemaVisits.movieId, s.movies.id))
      .leftJoin(s.venues, eq(s.venues.id, s.cinemaVisits.venueId))
      .where(clause)
      .get()?.n ?? 0;

  const order = {
    recent: [sql`${s.movies.createdTime} IS NULL`, desc(s.movies.createdTime)],
    oldest: [sql`${s.movies.createdTime} IS NULL`, asc(s.movies.createdTime)],
    rating_desc: [sql`${s.movies.ratingValue} IS NULL`, desc(s.movies.ratingValue), desc(s.movies.createdTime)],
    rating_asc: [sql`${s.movies.ratingValue} IS NULL`, asc(s.movies.ratingValue), desc(s.movies.createdTime)],
    title_asc: [asc(sql`lower(${s.movies.title})`)],
    title_desc: [desc(sql`lower(${s.movies.title})`)],
    year_desc: [sql`${s.movies.year} IS NULL`, desc(s.movies.year)],
    year_asc: [sql`${s.movies.year} IS NULL`, asc(s.movies.year)],
  }[(f.sort ?? "recent") as keyof typeof SORTS] ?? [desc(s.movies.createdTime)];

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(f.page) || 1), pageCount);

  const rows = cardQuery()
    .where(clause)
    .orderBy(...(order as never[]))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all() as MovieCard[];

  return { rows, total, page, pageCount };
}

/** Every value the library's filter controls can offer, derived from the data. */
export function getFilterOptions() {
  const distinct = (col: AnySQLiteColumn) =>
    db
      .selectDistinct({ v: col })
      .from(s.movies)
      .where(isNotNull(col))
      .orderBy(asc(col))
      .all()
      .map((r) => r.v as string);

  const logYears = db
    .select({ v: sql<string>`substr(${s.movies.createdTime}, 1, 4)`.as("log_year") })
    .from(s.movies)
    .where(isNotNull(s.movies.createdTime))
    .groupBy(sql`substr(${s.movies.createdTime}, 1, 4)`)
    .orderBy(desc(sql`substr(${s.movies.createdTime}, 1, 4)`))
    .all()
    .map((r) => r.v);

  const years = db
    .select({ min: sql<number>`min(${s.movies.year})`, max: sql<number>`max(${s.movies.year})` })
    .from(s.movies)
    .get();

  const genres = db
    .select({
      name: s.genres.name,
      slug: s.genres.slug,
      count: sql<number>`count(${s.movieGenres.movieId})`.as("count"),
    })
    .from(s.genres)
    .innerJoin(s.movieGenres, eq(s.movieGenres.genreId, s.genres.id))
    .groupBy(s.genres.id)
    .orderBy(asc(s.genres.name))
    .all();

  const directors = db
    .select({
      name: s.directors.name,
      slug: s.directors.slug,
      count: sql<number>`count(${s.movieDirectors.movieId})`.as("count"),
    })
    .from(s.directors)
    .innerJoin(s.movieDirectors, eq(s.movieDirectors.directorId, s.directors.id))
    .groupBy(s.directors.id)
    .orderBy(asc(s.directors.name))
    .all();

  const venues = db
    .select({
      slug: s.venues.slug, label: s.venues.label, name: s.venues.name,
      count: sql<number>`count(${s.cinemaVisits.id})`.as("count"),
    })
    .from(s.venues)
    .leftJoin(s.cinemaVisits, eq(s.cinemaVisits.venueId, s.venues.id))
    .groupBy(s.venues.id)
    .orderBy(desc(sql`count`))
    .all();

  return {
    statuses: distinct(s.movies.status),
    formats: distinct(s.movies.format),
    genres, directors, venues, logYears,
    releaseMin: years?.min ?? null,
    releaseMax: years?.max ?? null,
  };
}

/* ------------------------------------------------------------------ genres */
export interface GenreSummary {
  name: string;
  slug: string;
  total: number;
  watched: number;
  watching: number;
  toWatch: number;
  averageRating: number | null;
  /** Artwork of the most recently logged entry in this genre, for the index tiles. */
  posterPath: string | null;
  posterUrl: string | null;
}

/**
 * Every genre, with live counts.
 *
 * The source carries its own rollup totals, but those are a snapshot from
 * whenever it was last exported. Counting live rows keeps the numbers true as
 * entries are added here.
 */
export function getGenres(): GenreSummary[] {
  return db.all<GenreSummary>(sql`
    SELECT
      g.name  AS name,
      g.slug  AS slug,
      (SELECT count(*) FROM movie_genres mg WHERE mg.genre_id = g.id) AS total,
      (SELECT count(*) FROM movie_genres mg JOIN movies m ON m.id = mg.movie_id
        WHERE mg.genre_id = g.id AND m.status = 'Watched')  AS watched,
      (SELECT count(*) FROM movie_genres mg JOIN movies m ON m.id = mg.movie_id
        WHERE mg.genre_id = g.id AND m.status = 'Watching') AS watching,
      (SELECT count(*) FROM movie_genres mg JOIN movies m ON m.id = mg.movie_id
        WHERE mg.genre_id = g.id AND m.status = 'To Watch') AS toWatch,
      (SELECT avg(m.rating_value) FROM movie_genres mg JOIN movies m ON m.id = mg.movie_id
        WHERE mg.genre_id = g.id) AS averageRating,
      (SELECT m.poster_path FROM movie_genres mg JOIN movies m ON m.id = mg.movie_id
        WHERE mg.genre_id = g.id ORDER BY m.created_time DESC LIMIT 1) AS posterPath,
      (SELECT m.poster_url FROM movie_genres mg JOIN movies m ON m.id = mg.movie_id
        WHERE mg.genre_id = g.id ORDER BY m.created_time DESC LIMIT 1) AS posterUrl
    FROM genres g
    ORDER BY total DESC, g.name ASC
  `);
}

export function getGenreBySlug(slug: string) {
  const genre = db.select().from(s.genres).where(eq(s.genres.slug, slug)).get();
  if (!genre) return null;

  const movies = cardQuery()
    .where(sql`EXISTS (SELECT 1 FROM movie_genres WHERE movie_id = ${s.movies.id} AND genre_id = ${genre.id})`)
    .orderBy(desc(s.movies.createdTime))
    .all() as MovieCard[];

  const rated = movies.filter((m) => m.ratingValue !== null);
  return {
    genre,
    movies,
    averageRating: rated.length
      ? rated.reduce((sum, m) => sum + (m.ratingValue ?? 0), 0) / rated.length
      : null,
  };
}

export function getAllGenreSlugs(): string[] {
  return db.select({ slug: s.genres.slug }).from(s.genres).all().map((r) => r.slug);
}

/* ------------------------------------------------------------ movie detail */
export function getMovieBySlug(slug: string) {
  const movie = db.select().from(s.movies).where(eq(s.movies.slug, slug)).get();
  if (!movie) return null;

  const genres = db
    .select({ name: s.genres.name, slug: s.genres.slug })
    .from(s.movieGenres)
    .innerJoin(s.genres, eq(s.genres.id, s.movieGenres.genreId))
    .where(eq(s.movieGenres.movieId, movie.id))
    .all();

  const cast = db
    .select({
      name: s.actors.name,
      slug: s.actors.slug,
      photoPath: s.actors.photoPath,
      role: s.movieActors.role,
    })
    .from(s.movieActors)
    .innerJoin(s.actors, eq(s.actors.id, s.movieActors.actorId))
    .where(eq(s.movieActors.movieId, movie.id))
    .orderBy(asc(s.movieActors.position))
    .all();

  const directors = db
    .select({ name: s.directors.name, slug: s.directors.slug, photoPath: s.directors.photoPath })
    .from(s.movieDirectors)
    .innerJoin(s.directors, eq(s.directors.id, s.movieDirectors.directorId))
    .where(eq(s.movieDirectors.movieId, movie.id))
    .all();

  const quotes = db
    .select()
    .from(s.quotes)
    .where(eq(s.quotes.movieId, movie.id))
    .orderBy(desc(s.quotes.favorite), asc(s.quotes.createdTime))
    .all();

  const shots = db
    .select()
    .from(s.movieShots)
    .where(eq(s.movieShots.movieId, movie.id))
    .orderBy(asc(s.movieShots.position))
    .all();

  const visit = db
    .select({
      visitedAt: s.cinemaVisits.visitedAt,
      visitedAtSource: s.cinemaVisits.visitedAtSource,
      venueId: s.cinemaVisits.venueId,
      venueSlug: s.venues.slug,
      venueLabel: s.venues.label,
      venueName: s.venues.name,
      lat: s.venues.lat,
      lng: s.venues.lng,
    })
    .from(s.cinemaVisits)
    .leftJoin(s.venues, eq(s.venues.id, s.cinemaVisits.venueId))
    .where(eq(s.cinemaVisits.movieId, movie.id))
    .get();

  const series = movie.seriesName
    ? db
        .select({ title: s.movies.title, slug: s.movies.slug, year: s.movies.year, posterPath: s.movies.posterPath, posterUrl: s.movies.posterUrl })
        .from(s.movies)
        .where(and(eq(s.movies.seriesName, movie.seriesName), sql`${s.movies.id} <> ${movie.id}`))
        .orderBy(asc(s.movies.year))
        .all()
    : [];

  return { movie, genres, cast, directors, quotes, shots, visit: visit ?? null, series };
}

export function getAllMovieSlugs(): string[] {
  return db.select({ slug: s.movies.slug }).from(s.movies).all().map((r) => r.slug);
}

/* ------------------------------------------------------------------ people */
export interface PersonSummary {
  slug: string;
  name: string;
  photoPath: string | null;
  photoMatch: string | null;
  actedIn: number;
  directed: number;
}

/**
 * Everyone credited in the diary, actors and directors merged into one list.
 *
 * A person can hold both roles, so the two tables are unioned on name slug and
 * the credit counts summed per role. Done as a single aggregate rather than a
 * query per person — the naive version issued 160 round-trips for 80 people.
 */
export function getPeople(): PersonSummary[] {
  const rows = db.all<{
    slug: string;
    name: string;
    photoPath: string | null;
    photoMatch: string | null;
    actedIn: number;
    directed: number;
  }>(sql`
    WITH base AS (
      SELECT slug, name, photo_path, photo_match FROM actors
      UNION ALL
      SELECT slug, name, photo_path, photo_match FROM directors
    )
    SELECT
      b.slug                                        AS slug,
      MIN(b.name)                                   AS name,
      MAX(b.photo_path)                             AS photoPath,
      MAX(b.photo_match)                            AS photoMatch,
      (SELECT count(*) FROM movie_actors ma
         JOIN actors a ON a.id = ma.actor_id
        WHERE a.slug = b.slug)                      AS actedIn,
      (SELECT count(*) FROM movie_directors md
         JOIN directors d ON d.id = md.director_id
        WHERE d.slug = b.slug)                      AS directed
    FROM base b
    GROUP BY b.slug
    ORDER BY (actedIn + directed) DESC, name ASC
  `);
  return rows;
}

/** Subquery: every movie id this person is credited on, in either role. */
function creditedMovieIds(slug: string) {
  return sql`
    SELECT ma.movie_id FROM movie_actors ma JOIN actors a ON a.id = ma.actor_id WHERE a.slug = ${slug}
    UNION
    SELECT md.movie_id FROM movie_directors md JOIN directors d ON d.id = md.director_id WHERE d.slug = ${slug}
  `;
}

export function getPersonBySlug(slug: string) {
  const actor = db.select().from(s.actors).where(eq(s.actors.slug, slug)).get();
  const director = db.select().from(s.directors).where(eq(s.directors.slug, slug)).get();
  if (!actor && !director) return null;

  const acted = actor
    ? (cardQuery()
        .where(sql`EXISTS (SELECT 1 FROM movie_actors WHERE movie_id = ${s.movies.id} AND actor_id = ${actor.id})`)
        .orderBy(desc(s.movies.createdTime))
        .all() as MovieCard[])
    : [];

  const directed = director
    ? (cardQuery()
        .where(sql`EXISTS (SELECT 1 FROM movie_directors WHERE movie_id = ${s.movies.id} AND director_id = ${director.id})`)
        .orderBy(desc(s.movies.createdTime))
        .all() as MovieCard[])
    : [];

  /** Actors who appear alongside this person most often. */
  const collaborators = db
    .select({
      name: s.actors.name,
      slug: s.actors.slug,
      photoPath: s.actors.photoPath,
      shared: sql<number>`count(*)`.as("shared"),
    })
    .from(s.movieActors)
    .innerJoin(s.actors, eq(s.actors.id, s.movieActors.actorId))
    .where(
      and(
        sql`${s.movieActors.movieId} IN (${creditedMovieIds(slug)})`,
        sql`${s.actors.slug} <> ${slug}`,
      ),
    )
    .groupBy(s.actors.id)
    .having(sql`count(*) > 1`)
    .orderBy(desc(sql`shared`), asc(s.actors.name))
    .limit(8)
    .all();

  const person = actor ?? director!;
  return {
    slug,
    name: person.name,
    photoPath: actor?.photoPath ?? director?.photoPath ?? null,
    photoMatch: actor?.photoMatch ?? director?.photoMatch ?? null,
    photoSource: actor?.photoSource ?? director?.photoSource ?? null,
    isActor: !!actor,
    isDirector: !!director,
    acted,
    directed,
    collaborators,
  };
}

export function getAllPersonSlugs(): string[] {
  const a = db.select({ slug: s.actors.slug }).from(s.actors).all().map((r) => r.slug);
  const d = db.select({ slug: s.directors.slug }).from(s.directors).all().map((r) => r.slug);
  return [...new Set([...a, ...d])];
}

/** People with the most credits, for the diary page. */
export function getTopPeople(limit = 12): PersonSummary[] {
  return getPeople()
    .filter((p) => p.actedIn + p.directed > 1)
    .slice(0, limit);
}

/* ----------------------------------------------------------------- cinemas */
export interface VenueSummary {
  id: string; slug: string; label: string; name: string | null;
  lat: number | null; lng: number | null; notes: string | null;
  visits: number; lastVisitAt: string | null; firstVisitAt: string | null;
  lastMovieTitle: string | null; lastMovieSlug: string | null;
  lastMoviePoster: string | null;
  averageRating: number | null;
}

export function getVenues(): VenueSummary[] {
  const venues = db.select().from(s.venues).all();
  return venues
    .map((v) => {
      const agg = db
        .select({
          visits: sql<number>`count(*)`,
          last: sql<string | null>`max(${s.cinemaVisits.visitedAt})`,
          first: sql<string | null>`min(${s.cinemaVisits.visitedAt})`,
          avg: sql<number | null>`avg(${s.movies.ratingValue})`,
        })
        .from(s.cinemaVisits)
        .innerJoin(s.movies, eq(s.movies.id, s.cinemaVisits.movieId))
        .where(eq(s.cinemaVisits.venueId, v.id))
        .get();

      const last = db
        .select({ title: s.movies.title, slug: s.movies.slug, posterPath: s.movies.posterPath })
        .from(s.cinemaVisits)
        .innerJoin(s.movies, eq(s.movies.id, s.cinemaVisits.movieId))
        .where(eq(s.cinemaVisits.venueId, v.id))
        .orderBy(desc(s.cinemaVisits.visitedAt))
        .limit(1)
        .get();

      return {
        id: v.id, slug: v.slug, label: v.label, name: v.name,
        lat: v.lat, lng: v.lng, notes: v.notes,
        visits: agg?.visits ?? 0,
        lastVisitAt: agg?.last ?? null,
        firstVisitAt: agg?.first ?? null,
        lastMovieTitle: last?.title ?? null,
        lastMovieSlug: last?.slug ?? null,
        lastMoviePoster: last?.posterPath ?? null,
        averageRating: agg?.avg ?? null,
      };
    })
    .sort((a, b) => b.visits - a.visits || (b.lastVisitAt ?? "").localeCompare(a.lastVisitAt ?? ""));
}

export function getVenueBySlug(slug: string) {
  const venue = db.select().from(s.venues).where(eq(s.venues.slug, slug)).get();
  if (!venue) return null;

  const movies = cardQuery()
    .where(eq(s.venues.id, venue.id))
    .orderBy(desc(s.cinemaVisits.visitedAt))
    .all() as MovieCard[];

  const shots = db
    .select({
      id: s.movieShots.id, path: s.movieShots.path, capturedAt: s.movieShots.capturedAt,
      movieTitle: s.movies.title, movieSlug: s.movies.slug,
    })
    .from(s.movieShots)
    .innerJoin(s.movies, eq(s.movies.id, s.movieShots.movieId))
    .where(eq(s.movieShots.venueId, venue.id))
    .orderBy(asc(s.movieShots.capturedAt))
    .all();

  return { venue, movies, shots };
}

/** Every cinema on record, for choosing one on an entry. */
export function getKnownVenues() {
  return db
    .select({
      id: s.venues.id,
      name: s.venues.name,
      label: s.venues.label,
      lat: s.venues.lat,
      visits: sql<number>`(SELECT count(*) FROM cinema_visits WHERE venue_id = ${s.venues.id})`.as("visits"),
    })
    .from(s.venues)
    // Order by the expression, not the alias: SQLite resolves a bare name to a
    // real column first, and there is no `visits` column on venues.
    .orderBy(
      desc(sql`(SELECT count(*) FROM cinema_visits WHERE venue_id = ${s.venues.id})`),
      asc(s.venues.label),
    )
    .all()
    .map((v) => ({
      id: v.id,
      name: v.name,
      label: v.label,
      visits: v.visits,
      hasPosition: v.lat !== null,
    }));
}

export function getAllVenueSlugs(): string[] {
  return db.select({ slug: s.venues.slug }).from(s.venues).all().map((r) => r.slug);
}

/** Cinema outings that have no venue — the Theatre box was ticked but no photo placed it. */
export function getUnplacedVisits(): MovieCard[] {
  return cardQuery()
    .where(and(isNotNull(s.cinemaVisits.id), sql`${s.cinemaVisits.venueId} IS NULL`))
    .orderBy(desc(s.cinemaVisits.visitedAt))
    .all() as MovieCard[];
}

/* ------------------------------------------------------------ data health */
export function getImportReport() {
  const run = db.select().from(s.importRuns).orderBy(desc(s.importRuns.id)).limit(1).get();
  const issues = db
    .select()
    .from(s.importIssues)
    .orderBy(
      sql`CASE ${s.importIssues.severity} WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END`,
      asc(s.importIssues.kind),
    )
    .all();
  return {
    runAt: run?.runAt ?? null,
    stats: run ? (JSON.parse(run.stats) as Record<string, number>) : null,
    issues,
  };
}

/** True when the database has been created but never imported into. */
export function isEmpty(): boolean {
  try {
    return (db.select({ n: sql<number>`count(*)` }).from(s.movies).get()?.n ?? 0) === 0;
  } catch {
    return true;
  }
}
