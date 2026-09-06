export default function Loading() {
  return (
    <>
      <div className="pt-10 sm:pt-14">
        <div className="h-3 w-28 animate-pulse bg-edge/70" />
        <div className="mt-3 h-12 w-56 animate-pulse bg-edge/50" />
      </div>
      <div className="mt-8 h-12 animate-pulse border border-edge bg-velvet/30" />
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i}>
            <div className="aspect-[2/3] animate-pulse bg-velvet" style={{ animationDelay: `${i * 40}ms` }} />
            <div className="mt-2.5 h-3.5 w-3/4 animate-pulse bg-edge/60" />
            <div className="mt-2 h-3 w-1/2 animate-pulse bg-edge/40" />
          </div>
        ))}
      </div>
    </>
  );
}
