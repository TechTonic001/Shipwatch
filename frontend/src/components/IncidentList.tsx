import type { Incident } from "../hooks/useMetrics";

export function IncidentList({ incidents }: { incidents: Incident[] }) {
  const open = incidents.filter((incident) => incident.status === "open" || incident.status === undefined);
  return <>{open.length > 0 && <section aria-live="polite" className="rounded border border-red-200 bg-red-50 p-4"><h2 className="text-lg font-semibold text-red-900">Open incidents ({open.length})</h2><ul className="mt-2 space-y-1">{open.map((incident) => <li key={incident.id}>{incident.environment}: open for {Math.floor(incident.ageSeconds / 60)}m</li>)}</ul></section>}<section className="rounded border bg-white p-4"><h2 className="text-lg font-semibold">Recent incidents</h2>{incidents.length === 0 ? <p className="mt-2 text-slate-600">No recent incidents.</p> : <ul className="mt-2 space-y-1">{incidents.map((incident) => <li key={incident.id}>{incident.environment} — {incident.status ?? "open"}</li>)}</ul>}</section></>;
}
