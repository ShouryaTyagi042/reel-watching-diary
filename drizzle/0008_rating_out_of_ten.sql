-- Ratings move from 0–5 in half steps to whole numbers out of 10. Every half
-- step doubles onto a whole number, so nothing is rounded.
--
-- rating_raw is the source record and stays verbatim for imported rows (the
-- star string as exported). Rows the app wrote itself only ever held a star
-- string it generated, so those are rewritten in the new notation.
UPDATE `movies` SET `rating_value` = `rating_value` * 2 WHERE `rating_value` IS NOT NULL;
--> statement-breakpoint
UPDATE `movies` SET `rating_raw` = CAST(CAST(`rating_value` AS INTEGER) AS TEXT) || '/10'
  WHERE `rating_value` IS NOT NULL AND `id` LIKE 'app\_%' ESCAPE '\';
