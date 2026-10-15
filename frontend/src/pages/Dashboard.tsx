import { useQuery } from "@tanstack/react-query";
import { Component, type ReactNode } from "react";
import { useState } from "react";

import { DeploymentChart } from "../components/DeploymentChart";
import { IncidentList } from "../components/IncidentList";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { MetricCard } from "../components/MetricCard";
import { RunsTable } from "../components/RunsTable";
import { StaleBanner } from "../components/StaleBanner";
import { useIncidents } from "../hooks/useIncidents";
import { useMetrics } from "../hooks/useMetrics";
import { useRuns } from "../hooks/useRuns";
import { ApiError, apiFetch, getDashboardToken } from "../lib/api";

type Repo = { id: number; fullName: string; productionEnvironment: string };

function TokenPrompt({ onSaved }: { onSaved: () => void }) {
  const [token, setToken] = useState("");
  return <main className="mx-auto max-w-md p-6"><h1 className="text-2xl font-bold">Shipwatch dashboard</h1><p className="mt-2 text-slate-600">Enter the dashboard read token to continue.</p><form className="mt-6 space-y-3" onSubmit={(event) => { event.preventDefault(); sessionStorage.setItem("shipwatch.dashboardToken", token); onSaved(); }}><label className="block text-sm font-medium" htmlFor="token">Read token</label><input className="w-full rounded border p-2" id="token" type="password" value={token} onChange={(event) => setToken(event.target.value)} required /><button className="rounded bg-blue-600 px-4 py-2 text-white" type="submit">Open dashboard</button></form></main>;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError(): { hasError: boolean } { return { hasError: true }; }
  render(): ReactNode { return this.state.hasError ? <main className="p-6"><p role="alert">Something went wrong.</p><button onClick={() => this.setState({ hasError: false })}>Retry</button></main> : this.props.children; }
}

function DashboardContent() {
  const repos = useQuery({ queryKey: ["repos"], queryFn: () => apiFetch<Repo[]>("/api/repos"), refetchInterval: 10000, refetchIntervalInBackground: false });
  const [repoId, setRepoId] = useState<number | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<"7d" | "30d">("7d");
  const selected = repoId ?? repos.data?.[0]?.id ?? null;
  const metrics = useMetrics(selected, selectedWindow);
  const incidents = useIncidents(selected);
  const runs = useRuns(selected);
  const latest = metrics.dataUpdatedAt;
  const stale = metrics.isError || (latest > 0 && Date.now() - latest > 30000);
  if (repos.isLoading) return <main className="mx-auto max-w-6xl p-6"><LoadingState /></main>;
  if (repos.error instanceof ApiError && repos.error.status === 401) return <TokenPrompt onSaved={() => window.location.reload()} />;
  if (repos.isError) return <main className="p-6"><p role="alert">Unable to load repositories.</p><button onClick={() => repos.refetch()}>Retry</button></main>;
  if (!repos.data?.length) return <main className="mx-auto max-w-6xl p-6"><h1 className="text-3xl font-bold">Shipwatch</h1><EmptyState /></main>;
  const data = metrics.data;
  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-bold">Shipwatch</h1><div className="flex gap-2"><label className="sr-only" htmlFor="repo">Repository</label><select className="rounded border p-2" id="repo" value={selected ?? ""} onChange={(event) => setRepoId(Number(event.target.value))}>{repos.data.map((repo) => <option key={repo.id} value={repo.id}>{repo.fullName}</option>)}</select><div aria-label="Metric window" className="flex rounded border">{(["7d", "30d"] as const).map((option) => <button className={`px-3 py-2 ${selectedWindow === option ? "bg-slate-200" : ""}`} key={option} onClick={() => setSelectedWindow(option)}>{option}</button>)}</div></div></header>
    {stale && <StaleBanner onRetry={() => { void metrics.refetch(); void incidents.refetch(); void runs.refetch(); }} />}
    {metrics.isLoading && <LoadingState />}
    {metrics.error instanceof ApiError && metrics.error.status === 401 && <TokenPrompt onSaved={() => window.location.reload()} />}
    {metrics.error && !(metrics.error instanceof ApiError && metrics.error.status === 401) && <p role="alert">Unable to load metrics. <button onClick={() => metrics.refetch()}>Retry</button></p>}
    {data && <><section className="grid gap-4 md:grid-cols-3"><MetricCard title="Deployment frequency" value={data.deploymentFrequency.total === 0 ? "No data" : `${(data.deploymentFrequency.total / (selectedWindow === "7d" ? 7 : 30)).toFixed(1)} / day`} secondary={`${data.deploymentFrequency.total} successful deployments`} /><MetricCard title="Change failure rate" value={data.changeFailureRate.value === null ? "No data" : `${(data.changeFailureRate.value * 100).toFixed(1)}%`} secondary={`${data.changeFailureRate.failed} failed of ${data.changeFailureRate.total}`} /><MetricCard title="MTTR" value={data.mttr.medianSeconds === null ? "No data" : `${Math.round(data.mttr.medianSeconds)}s median`} secondary={data.mttr.p90Seconds === null ? undefined : `${Math.round(data.mttr.p90Seconds)}s p90`} /></section><IncidentList incidents={incidents.data?.data ?? data.openIncidents} /><DeploymentChart data={data.deploymentFrequency.perDay} /></>}
    {incidents.data && <RunsTable runs={runs.data?.data ?? []} />}
  </main>;
}

export function Dashboard() {
  return <ErrorBoundary>{getDashboardToken() ? <DashboardContent /> : <TokenPrompt onSaved={() => window.location.reload()} />}</ErrorBoundary>;
}
