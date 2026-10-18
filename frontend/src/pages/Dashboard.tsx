import { useQuery } from "@tanstack/react-query";
import { Component, lazy, Suspense, type ReactNode, useState } from "react";

import { ConfigErrorScreen } from "../components/ConfigErrorScreen";
import { EmptyState } from "../components/EmptyState";
import { IncidentList } from "../components/IncidentList";
import { MetricCard } from "../components/MetricCard";
import { RepoSelect } from "../components/RepoSelect";
import { RunsTable } from "../components/RunsTable";
import { Skeletons } from "../components/LoadingState";
import { StaleBanner } from "../components/StaleBanner";
import { StatusHero } from "../components/StatusHero";
import { TokenGate } from "../components/TokenGate";
import { WindowToggle, type MetricWindow } from "../components/WindowToggle";
import { useIncidents } from "../hooks/useIncidents";
import { useMetrics } from "../hooks/useMetrics";
import { useRuns } from "../hooks/useRuns";
import { ApiError, apiFetch, clearDashboardToken, ConfigError, demoMode, getDashboardToken } from "../lib/api";
import { repositoryListSchema } from "../../../shared/contracts";

type Repo = { id: number; fullName: string; productionEnvironment: string };
const DeploymentChart = lazy(() => import("../components/DeploymentChart").then((module) => ({ default: module.DeploymentChart })));

export class DashboardErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError(): { hasError: boolean } { return { hasError: true }; }
  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return <main className="grid min-h-screen place-items-center p-6"><section className="rounded-console border border-danger/40 bg-surface p-6"><h1 className="text-xl font-semibold">Dashboard paused</h1><p role="alert" className="mt-2 text-sm text-muted">Something unexpected interrupted this view.</p><button className="mt-5 rounded border border-border px-4 py-2" onClick={() => this.setState({ hasError: false })}>Try again</button></section></main>;
  }
}

function MetricError({ onRetry }: { onRetry: () => void }) {
  return <section role="alert" className="rounded-console border border-danger/40 bg-danger/10 p-5"><h2 className="font-semibold">Unable to refresh dashboard data</h2><p className="mt-1 text-sm text-muted">The latest metrics could not be loaded.</p><button type="button" className="mt-3 rounded border border-danger/40 px-3 py-2 text-sm" onClick={onRetry}>Retry</button></section>;
}

function formatRefreshTime(timestamp: string | undefined): string {
  if (!timestamp) return "Waiting for refresh";
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(timestamp)) / 1000));
  return seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`;
}

function DashboardContent() {
  const repos = useQuery({ queryKey: ["repos"], queryFn: () => apiFetch<Repo[]>("/api/repos", repositoryListSchema), refetchInterval: 10000, refetchIntervalInBackground: false });
  const [repoId, setRepoId] = useState<number | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<MetricWindow>("7d");
  const selected = repoId ?? repos.data?.[0]?.id ?? null;
  const metrics = useMetrics(selected, selectedWindow);
  const incidents = useIncidents(selected);
  const runs = useRuns(selected);
  const runList = runs.data?.pages.flatMap((page) => page.data) ?? [];
  const incidentList = incidents.data?.data ?? metrics.data?.openIncidents ?? [];
  const hasCachedData = Boolean(metrics.data || incidents.data || runs.data);
  const stale = hasCachedData && (repos.isError || metrics.isError || incidents.isError || runs.isError);
  const retry = () => { void repos.refetch(); void metrics.refetch(); void incidents.refetch(); void runs.refetch(); };

  if (repos.isLoading) return <Skeletons />;
  if (repos.error instanceof ApiError && repos.error.status === 401) return <TokenGate unauthorized={Boolean(getDashboardToken())} onSaved={() => window.location.reload()} />;
  if (repos.error instanceof ConfigError) return <ConfigErrorScreen onRetry={retry} errorMessage={repos.error.message} />;
  if (repos.isError) return <main className="grid min-h-screen place-items-center p-6"><MetricError onRetry={retry} /></main>;
  if (!repos.data?.length) return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6"><header><p className="font-mono text-xs uppercase text-accent">Delivery health</p><h1 className="mt-2 text-2xl font-semibold">Shipwatch</h1></header><EmptyState /></main>;

  const data = metrics.data;
  if (!data && metrics.isLoading) return <Skeletons />;
  if (!data && metrics.error instanceof ApiError && metrics.error.status === 401) return <TokenGate unauthorized onSaved={() => window.location.reload()} />;
  if (!data && metrics.error instanceof ConfigError) return <ConfigErrorScreen onRetry={retry} errorMessage={metrics.error.message} />;
  if (!data && metrics.isError) return <main className="mx-auto max-w-7xl p-4 sm:p-6"><MetricError onRetry={retry} /></main>;
  if (!data) return null;

  const frequencyHasData = data.deploymentFrequency.total > 0;
  const failureHasData = data.changeFailureRate.value !== null;
  const mttrHasData = data.mttr.medianSeconds !== null;
  const median = data.mttr.medianSeconds === null ? "—" : data.mttr.medianSeconds >= 3600 ? `${(data.mttr.medianSeconds / 3600).toFixed(1)}h` : `${Math.round(data.mttr.medianSeconds / 60)}m`;

  return <div className="min-h-screen bg-background">
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3"><a href="#dashboard" className="flex items-center gap-2 rounded text-text no-underline"><span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded border border-accent/40 bg-accent/10 font-mono text-sm text-accent">S</span><span className="text-base font-semibold">shipwatch</span></a>{demoMode && <span className="rounded border border-warning/40 bg-warning/10 px-2 py-1 text-xs font-medium text-warning">Demo data</span>}</div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3"><RepoSelect repos={repos.data} value={selected ?? repos.data[0].id} onChange={setRepoId} /><WindowToggle value={selectedWindow} onChange={setSelectedWindow} /><div className="flex items-center gap-2 px-1 text-xs text-muted" aria-label={`Live, refreshed ${formatRefreshTime(data.generatedAt)}`}><span aria-hidden="true" className="h-2 w-2 rounded-full bg-success" /><span className="font-medium text-success">Live</span><span className="hidden sm:inline">· {formatRefreshTime(data.generatedAt)}</span></div><button type="button" className="rounded border border-border px-3 py-2 text-sm text-muted hover:bg-raised hover:text-text" onClick={() => { clearDashboardToken(); window.location.href = window.location.pathname; }}>Sign out</button></div>
      </div>
    </header>
    <main id="dashboard" className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-end justify-between gap-4"><div><p className="font-mono text-xs uppercase text-accent">Delivery health</p><h1 className="mt-1 text-2xl font-semibold">Production overview</h1></div><p className="hidden text-xs text-muted sm:block">Updated {formatRefreshTime(data.generatedAt)}</p></div>
      {stale && <StaleBanner onRetry={retry} updatedAt={metrics.dataUpdatedAt} />}
      <StatusHero incidents={incidentList} runs={runList} productionEnvironment={repos.data.find((repo) => repo.id === selected)?.productionEnvironment ?? "production"} />
      {metrics.isError && !stale && <MetricError onRetry={retry} />}
      {data.deploymentFrequency.total === 0 && runList.length === 0 && incidentList.length === 0 && <EmptyState />}
      <section aria-label="Delivery metrics" className="grid gap-3 md:grid-cols-3">
        <MetricCard title="Deployment frequency" value={frequencyHasData ? `${(data.deploymentFrequency.total / (selectedWindow === "7d" ? 7 : 30)).toFixed(1)} / day` : "—"} secondary={frequencyHasData ? `${data.deploymentFrequency.total} successful deployments` : "No data in this window"} definition="Successful production deployments per day in the selected UTC window." trend={data.deploymentFrequency.perDay.map((day) => day.count)} />
        <MetricCard title="Change failure rate" value={failureHasData ? `${(data.changeFailureRate.value! * 100).toFixed(1)}%` : "—"} secondary={failureHasData ? `${data.changeFailureRate.failed} failed / ${data.changeFailureRate.total} total` : "No data in this window"} definition="Production deployments ending in failure or error divided by successful, failed, or errored production deployments." />
        <MetricCard title="MTTR" value={mttrHasData ? median : "—"} secondary={mttrHasData ? `p90 ${data.mttr.p90Seconds === null ? "—" : `${Math.round(data.mttr.p90Seconds / 60)}m`} · ${data.mttr.resolvedCount} resolved` : "No data in this window"} definition="Median time from incident opened to resolved, using incidents resolved within this window. Secondary value is the 90th percentile." />
      </section>
      <Suspense fallback={<div aria-label="Loading deployment chart" className="skeleton h-80 rounded-console border border-border/70" />}><DeploymentChart data={data.deploymentFrequency.perDay} /></Suspense>
      <div className="grid items-start gap-5 lg:grid-cols-2"><IncidentList incidents={incidentList} /><div id="recent-runs"><RunsTable runs={runList} hasMore={Boolean(runs.hasNextPage)} onLoadMore={() => { void runs.fetchNextPage(); }} loadingMore={runs.isFetchingNextPage} /></div></div>
    </main>
    <footer className="border-t border-border"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-muted sm:px-6"><div className="flex flex-wrap gap-x-5 gap-y-2"><span>Backend <code className="font-mono text-text">{import.meta.env.VITE_BACKEND_BUILD_SHA || "local"}</code></span><span>Frontend <code className="font-mono text-text">{import.meta.env.VITE_BUILD_SHA || "local"}</code></span></div><a className="text-accent underline underline-offset-4" href="/docs/metrics.md">Metric definitions</a></div></footer>
  </div>;
}

export function Dashboard() {
  if (demoMode) return <DashboardErrorBoundary><DashboardContent /></DashboardErrorBoundary>;
  return <DashboardErrorBoundary>{getDashboardToken() ? <DashboardContent /> : <TokenGate unauthorized={false} onSaved={() => window.location.reload()} />}</DashboardErrorBoundary>;
}
