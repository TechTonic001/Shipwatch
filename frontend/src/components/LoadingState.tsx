export function LoadingState() {
  return <div aria-label="Loading dashboard" className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((item) => <div className="h-28 animate-pulse rounded bg-slate-200" key={item} />)}</div>;
}
