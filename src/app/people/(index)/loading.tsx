/** People, while it loads. Circles, because that is the one rounded shape here. */
export default function Loading() {
  return (
    <>
      <div className="pt-12 sm:pt-20">
        <div className="h-12 w-44 animate-pulse bg-line-strong" />
        <div className="mt-4 h-4 w-[32rem] max-w-full animate-pulse bg-line" />
      </div>

      <div className="mt-9 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-bg px-4 py-5">
            <div className="h-8 w-12 animate-pulse bg-line-strong" />
            <div className="mt-3 h-3 w-20 animate-pulse bg-line" />
          </div>
        ))}
      </div>

      {Array.from({ length: 2 }, (_, group) => (
        <section key={group} className="mt-14">
          <div className="mb-6 border-b border-line pb-3.5">
            <div className="h-7 w-40 animate-pulse bg-line-strong" />
          </div>
          <ul className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="text-center">
                <div
                  className="mx-auto aspect-square w-full max-w-[112px] animate-pulse rounded-full bg-surface-2"
                  style={{ animationDelay: `${i * 40}ms` }}
                />
                <div className="mx-auto mt-3 h-3 w-20 animate-pulse bg-line" />
                <div className="mx-auto mt-1.5 h-2.5 w-12 animate-pulse bg-line" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
