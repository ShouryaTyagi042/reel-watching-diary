-- The character an actor played, on the relationship rather than on the actor:
-- the same person plays someone different in every film. Nullable, because a
-- minor credit often has no character recorded anywhere.
ALTER TABLE `movie_actors` ADD `role` text;
