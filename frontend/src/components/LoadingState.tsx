function Skeleton({ className }: { className: string }) {
  return <div aria-hidden="true" className={`skeleton rounded-console border border-border/70 ${className}`} />;
}

export function Skeletons() {
  return <div className="min-h-screen bg-background">
    <header aria-label="Loading dashboard navigation" className="border-b border-border"><div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6"><Skeleton className="h-8 w-36" /><div className="flex flex-wrap gap-3"><Skeleton className="h-10 w-48" /><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-20" /></div></div></header>
    <main aria-label="Loading dashboard" role="status" className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-12" />
      <Skeleton className="h-20" />
      <div className="grid gap-3 md:grid-cols-3"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      <Skeleton className="h-80" />
      <div className="grid gap-3 lg:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
      <span className="sr-only">Loading dashboard data</span>
    </main>
  </div>;
}
