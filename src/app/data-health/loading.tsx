/** The import report, while it loads. */
export default function Loading() {
  return (
    <>
      <div className="pt-12 sm:pt-20">
        <div className="h-12 w-[26rem] max-w-full animate-pulse bg-line-strong" />
        <div className="mt-4 h-4 w-[34rem] max-w-full animate-pulse bg-line" />
      </div>
      {Array.from({ length: 3 }, (_, g) => (
        <section key={g} className="mt-10">
          <div className="mb-3 h-3 w-28 animate-pulse bg-line" />
          <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="bg-bg px-4 py-4">
                <div className="h-7 w-10 animate-pulse bg-line-strong" style={{ animationDelay: `${i * 40}ms` }} />
                <div className="mt-2 h-2.5 w-20 animate-pulse bg-line" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
