CREATE TABLE `actors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`photo_path` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `actors_slug_idx` ON `actors` (`slug`);--> statement-breakpoint
CREATE TABLE `cinema_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`movie_id` text NOT NULL,
	`venue_id` text,
	`visited_at` text,
	`visited_at_source` text,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cinema_visits_movie_idx` ON `cinema_visits` (`movie_id`);--> statement-breakpoint
CREATE INDEX `cinema_visits_venue_idx` ON `cinema_visits` (`venue_id`);--> statement-breakpoint
CREATE TABLE `directors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`photo_path` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `directors_slug_idx` ON `directors` (`slug`);--> statement-breakpoint
CREATE TABLE `genres` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`notion_total_movies` integer,
	`notion_summary` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `genres_slug_idx` ON `genres` (`slug`);--> statement-breakpoint
CREATE TABLE `import_issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`severity` text NOT NULL,
	`kind` text NOT NULL,
	`subject` text,
	`detail` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `import_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`stats` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `movie_actors` (
	`movie_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`movie_id`, `actor_id`),
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `actors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `movie_directors` (
	`movie_id` text NOT NULL,
	`director_id` text NOT NULL,
	PRIMARY KEY(`movie_id`, `director_id`),
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`director_id`) REFERENCES `directors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `movie_genres` (
	`movie_id` text NOT NULL,
	`genre_id` text NOT NULL,
	PRIMARY KEY(`movie_id`, `genre_id`),
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`genre_id`) REFERENCES `genres`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `movie_shots` (
	`id` text PRIMARY KEY NOT NULL,
	`movie_id` text NOT NULL,
	`path` text NOT NULL,
	`source_name` text NOT NULL,
	`captured_at` text,
	`lat` real,
	`lng` real,
	`camera_make` text,
	`camera_model` text,
	`venue_id` text,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `movie_shots_movie_idx` ON `movie_shots` (`movie_id`);--> statement-breakpoint
CREATE TABLE `movies` (
	`id` text PRIMARY KEY NOT NULL,
	`title_raw` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`year` integer,
	`format` text,
	`status` text,
	`series_name` text,
	`rating_raw` text,
	`rating_value` real,
	`watched_in_theatre` integer DEFAULT false NOT NULL,
	`created_time` text,
	`cover_raw` text,
	`cover_kind` text,
	`poster_path` text,
	`poster_url` text,
	`poster_match` text,
	`poster_source` text,
	`notion_path` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `movies_slug_idx` ON `movies` (`slug`);--> statement-breakpoint
CREATE INDEX `movies_status_idx` ON `movies` (`status`);--> statement-breakpoint
CREATE INDEX `movies_created_idx` ON `movies` (`created_time`);--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`said_by` text,
	`favorite` integer DEFAULT false NOT NULL,
	`created_time` text,
	`movie_id` text,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quotes_movie_idx` ON `quotes` (`movie_id`);--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`label` text NOT NULL,
	`slug` text NOT NULL,
	`lat` real,
	`lng` real,
	`source` text DEFAULT 'photo-gps' NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `venues_slug_idx` ON `venues` (`slug`);