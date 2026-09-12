-- The database becomes the source of truth.
--
-- `notion_path` is carried over to `source_path` rather than dropped, so the
-- provenance of seeded records survives. `origin` and `edited_fields` existed
-- only to stop the importer overwriting user changes; the importer no longer
-- overwrites anything, so both are redundant.

ALTER TABLE `movies` ADD `source_path` text;--> statement-breakpoint
UPDATE `movies` SET `source_path` = `notion_path` WHERE `notion_path` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `movies` DROP COLUMN `notion_path`;--> statement-breakpoint
ALTER TABLE `movies` DROP COLUMN `origin`;--> statement-breakpoint
ALTER TABLE `movies` DROP COLUMN `edited_fields`;
