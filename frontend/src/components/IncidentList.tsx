import type { Incident } from "../hooks/useMetrics";
import { StatusChip } from "./StatusChip";

function duration(seconds: number | null): string {
  if (seconds === null) return "Resolved";
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function IncidentList({ incidents }: { incidents: Incident[] }) {
  return (
    <section id="recent-incidents" className="rounded-console border border-border bg-surface p-5" aria-labelledby="incidents-heading">
      <div className="flex items-center justify-between"><h2 id="incidents-heading" className="text-base font-semibold">Recent incidents</h2><span className="text-xs text-muted">{incidents.length} total</span></div>
      {incidents.length === 0 ? <p className="mt-5 text-sm text-muted">No incidents recorded in this feed.</p> : <ul className="mt-3 divide-y divide-border/70">{incidents.map((incident) => {
        const open = incident.status === "open" || incident.status === undefined;
        const age = open ? incident.ageSeconds : incident.resolvedAt ? Math.max(0, Math.floor((Date.parse(incident.resolvedAt) - Date.parse(incident.openedAt)) / 1000)) : null;
        return <li key={incident.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-2 last:pb-0"><div className="min-w-0"><p className="truncate text-sm font-medium">{incident.environment}</p><p className="mt-1 font-mono text-xs text-muted">{incident.id}</p></div><div className="flex items-center gap-3"><span className="font-mono text-xs tabular-nums text-muted">{duration(age)}</span><StatusChip status={open ? "open" : "resolved"} /></div></li>;
      })}</ul>}
    </section>
  );
}
