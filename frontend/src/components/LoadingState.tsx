function Skeleton({ className }: { className: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-console border border-border/70 ${className}`} />;
}

export function Skeletons() {
  return <div aria-label="Loading dashboard" role="status" className="space-y-6">
    <Skeleton className="h-20" />
    <div className="grid gap-3 md:grid-cols-3"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
    <Skeleton className="h-80" />
    <div className="grid gap-3 lg:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
    <span className="sr-only">Loading dashboard data</span>
  </div>;
}
