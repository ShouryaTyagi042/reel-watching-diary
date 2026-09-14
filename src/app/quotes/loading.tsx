/** Lines, while they load. Long bars, because quotes are long. */
export default function Loading() {
  const widths = ["92%", "68%", "84%", "55%", "78%"];
  return (
    <>
      <div className="pt-12 sm:pt-20">
        <div className="h-12 w-72 max-w-full animate-pulse bg-line-strong" />
      </div>
      <ul className="mt-12 space-y-12">
        {widths.map((w, i) => (
          <li key={i} className="border-l-2 border-line pl-5 sm:pl-8">
            <div className="h-6 animate-pulse bg-line-strong" style={{ width: w, animationDelay: `${i * 60}ms` }} />
            <div className="mt-2.5 h-6 w-1/3 animate-pulse bg-line-strong" />
            <div className="mt-4 h-3 w-40 animate-pulse bg-line" />
          </li>
        ))}
      </ul>
    </>
  );
}
