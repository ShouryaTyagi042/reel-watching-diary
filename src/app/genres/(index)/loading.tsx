/**
 * Genres, while it loads.
 *
 * Mirrors the real grid, including the two wide tiles the busiest genres get,
 * so the page settles into place rather than jumping when the content lands.
 */
export default function Loading() {
  return (
    <>
      <div className="pt-12 sm:pt-20">
        <div className="h-12 w-52 animate-pulse bg-line-strong" />
        <div className="mt-4 h-4 w-80 max-w-full animate-pulse bg-line" />
      </div>

      <ul className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 10 }, (_, i) => (
          <li key={i} className={i < 2 ? "col-span-2" : ""}>
            <div
              className="flex h-full min-h-[190px] animate-pulse flex-col justify-between border border-line p-5"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="h-9 w-14 bg-line-strong" />
              <div>
                <div className="h-5 w-28 bg-line-strong" />
                <div className="mt-2 h-3 w-36 max-w-full bg-line" />
                <div className="mt-3 h-1 w-full bg-line" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
