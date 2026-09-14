/** The entry form, while it loads. */
export default function Loading() {
  return (
    <>
      <div className="pt-8">
        <div className="h-3 w-20 animate-pulse bg-line" />
      </div>
      <div className="mt-6">
        <div className="h-12 w-80 max-w-full animate-pulse bg-line-strong" />
        <div className="mt-4 h-4 w-[34rem] max-w-full animate-pulse bg-line" />
      </div>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,220px)_1fr]">
        <div className="aspect-[2/3] w-full animate-pulse border border-dashed border-line-strong bg-surface-2" />
        <div className="grid gap-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i}>
              <div className="h-3 w-24 animate-pulse bg-line" />
              <div className="mt-2 h-11 w-full animate-pulse bg-surface-2" style={{ animationDelay: `${i * 50}ms` }} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
