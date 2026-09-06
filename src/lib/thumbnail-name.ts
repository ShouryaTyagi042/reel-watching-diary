/**
 * The diary's thumbnail naming convention, in one place.
 *
 * Files in the thumbnails folder are named after the title in lower snake_case
 * — `mirzapur_the_movie.jpg` — matching the collection's existing convention.
 * `slugify` reduces both this and the movie title to the same hyphenated form,
 * so the importer's slug matcher pairs a file with its entry without needing any
 * record of how it got there.
 *
 * Pure and dependency-free so the server (when saving an upload) and the client
 * (when previewing where it will land) can share exactly one implementation.
 */
export function thumbnailStem(title: string): string {
  return (
    title
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/['\u2019]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "untitled"
  );
}
