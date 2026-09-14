export default function Loading() {
  return (
    <>
      <div className="pt-10 sm:pt-14">
        <div className="h-3 w-40 animate-pulse bg-line-strong" />
        <div className="mt-3 h-11 w-48 animate-pulse bg-line" />
      </div>
      <div className="mt-9 h-24 animate-pulse border border-line bg-surface-2" />
      <div className="mt-14 grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="h-40 animate-pulse border border-line bg-surface-2" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    </>
  );
}
