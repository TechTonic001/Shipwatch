import type { Incident } from "../hooks/useMetrics";
import type { Run } from "../hooks/useRuns";

function ageLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function StatusHero({ incidents, runs, productionEnvironment }: { incidents: Incident[]; runs: Run[]; productionEnvironment: string }) {
  const openIncident = incidents.find((incident) => incident.environment === productionEnvironment && (incident.status === "open" || incident.status === undefined));
  const failedRun = runs.find((run) => run.environment === productionEnvironment && (run.state === "failure" || run.state === "error"));
  const successfulRun = runs.find((run) => run.environment === productionEnvironment && run.state === "success");
  return openIncident ? (
    <section aria-live="polite" className="flex flex-wrap items-center justify-between gap-3 rounded-console border border-danger/40 bg-danger/10 px-5 py-4">
      <div className="flex items-center gap-3"><span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full border border-danger/50 text-danger">!</span><div><p className="font-semibold text-danger">Production incident open for {ageLabel(openIncident.ageSeconds)}</p><p className="mt-1 text-sm text-muted">{openIncident.environment} is affected{failedRun?.sha ? ` · latest failed SHA: ${failedRun.sha.slice(0, 7)}` : " · failed SHA unavailable"}</p></div></div>
      <a className="text-sm font-medium text-danger underline underline-offset-4" href="#recent-incidents">View incident <span aria-hidden="true">↗</span></a>
    </section>
  ) : (
    <section aria-live="polite" className="flex flex-wrap items-center justify-between gap-3 rounded-console border border-success/30 bg-success/5 px-5 py-4">
      <div className="flex items-center gap-3"><span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full border border-success/40 text-success">✓</span><div><p className="font-semibold">All clear</p><p className="mt-1 text-sm text-muted">{successfulRun ? `Last deploy ${ageLabel(Math.max(0, Math.floor((Date.now() - Date.parse(successfulRun.startedAt)) / 1000)))} ago · ${successfulRun.sha?.slice(0, 7) ?? "SHA unavailable"}` : "No successful production deploy in this feed"}</p></div></div>
      <span className="inline-flex items-center gap-2 text-sm text-success"><span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-success" />Healthy</span>
    </section>
  );
}
