type MetricCardProps = { title: string; value: string; secondary: string; definition: string; trend?: number[] };

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  return <div aria-hidden="true" className="mt-4 flex h-8 items-end gap-1">{data.map((value, index) => <span key={index} className="min-w-1 flex-1 rounded-t-sm bg-accent/75" style={{ height: `${Math.max(10, (value / max) * 100)}%` }} />)}</div>;
}

export function MetricCard({ title, value, secondary, definition, trend }: MetricCardProps) {
  const definitionId = `${title.replaceAll(" ", "-")}-definition`;
  return (
    <article className="min-h-40 rounded-console border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-medium text-muted">{title}</h2>
        <span className="group relative inline-flex">
          <button type="button" aria-label={`${title} definition`} aria-describedby={definitionId} className="grid h-6 w-6 place-items-center rounded-full border border-border text-xs text-muted hover:text-text">i</button>
          <span id={definitionId} role="tooltip" className="pointer-events-none absolute right-0 top-8 z-10 hidden w-64 rounded border border-border bg-raised p-3 text-left text-xs leading-5 text-text shadow-none group-hover:block group-focus-within:block">{definition}</span>
        </span>
      </div>
      <p className="mt-4 font-mono text-3xl font-medium tabular-nums tracking-normal">{value}</p>
      <p className="mt-2 text-sm text-muted">{secondary}</p>
      {trend && <Sparkline data={trend} />}
    </article>
  );
}
