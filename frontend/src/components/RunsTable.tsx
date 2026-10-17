import type { Run } from "../hooks/useRuns";

import { StatusChip } from "./StatusChip";

function relativeTime(timestamp: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(timestamp)) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function runDuration(run: Run): string {
  const seconds = Math.max(0, Math.floor((Date.parse(run.updatedAt) - Date.parse(run.startedAt)) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function RunsTable({ runs, hasMore, onLoadMore, loadingMore }: { runs: Run[]; hasMore: boolean; onLoadMore: () => void; loadingMore: boolean }) {
  return (
    <section className="rounded-console border border-border bg-surface p-5" aria-labelledby="runs-heading">
      <div className="flex items-center justify-between"><h2 id="runs-heading" className="text-base font-semibold">Recent runs</h2><span className="text-xs text-muted">{runs.length} shown</span></div>
      {runs.length === 0 ? <p className="mt-5 text-sm text-muted">No deployment runs in this window.</p> : <>
        <div className="mt-3 hidden overflow-x-auto sm:block"><table className="w-full text-left text-sm"><caption className="sr-only">Recent deployment runs</caption><thead><tr className="border-b border-border text-xs font-medium text-muted"><th scope="col" className="py-3 pr-3">Environment</th><th scope="col" className="py-3 pr-3">SHA</th><th scope="col" className="py-3 pr-3">Status</th><th scope="col" className="py-3 pr-3">Duration</th><th scope="col" className="py-3 text-right">Started</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id} className="border-b border-border/60 last:border-0"><td className="py-3 pr-3">{run.environment}</td><td className="py-3 pr-3 font-mono text-xs">{run.sha?.slice(0, 7) ?? "—"}</td><td className="py-3 pr-3"><StatusChip status={run.state} /></td><td className="py-3 pr-3 font-mono text-xs tabular-nums">{runDuration(run)}</td><td className="py-3 text-right text-xs text-muted" title={new Date(run.startedAt).toLocaleString()}>{relativeTime(run.startedAt)}</td></tr>)}</tbody></table></div>
        <ul className="mt-3 divide-y divide-border/70 sm:hidden">{runs.map((run) => <li key={run.id} className="space-y-3 py-4 first:pt-2"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{run.environment}</span><StatusChip status={run.state} /></div><div className="flex items-center justify-between gap-2 text-xs text-muted"><span className="font-mono">{run.sha?.slice(0, 7) ?? "—"}</span><span className="font-mono tabular-nums">{runDuration(run)}</span><time title={new Date(run.startedAt).toLocaleString()}>{relativeTime(run.startedAt)}</time></div></li>)}</ul>
      </>}
      {hasMore && <button type="button" className="mt-4 w-full rounded border border-border px-3 py-2 text-sm hover:bg-raised disabled:opacity-60" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? "Loading runs…" : "Load more"}</button>}
    </section>
  );
}
