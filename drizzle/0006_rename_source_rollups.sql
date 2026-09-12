-- The genre rollup columns carried source-tool branding in their names. They are
-- informational only (the UI counts live rows), so this is a pure rename with
-- the values carried across.
ALTER TABLE `genres` RENAME COLUMN `notion_total_movies` TO `source_total_movies`;--> statement-breakpoint
ALTER TABLE `genres` RENAME COLUMN `notion_summary` TO `source_summary`;
