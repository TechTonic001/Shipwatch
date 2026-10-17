import type { Incident, Metrics } from "../hooks/useMetrics";
import type { Run } from "../hooks/useRuns";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3100";
const demoChoice = new URLSearchParams(window.location.search).get("demo");
export const demoMode = import.meta.env.DEV && ["1", "incident", "empty"].includes(demoChoice ?? "")
  ? demoChoice === "1" ? "standard" : demoChoice
  : null;

type Repo = { id: number; fullName: string; productionEnvironment: string };

const demoRepos: Repo[] = [{ id: 1, fullName: "acme/shipwatch-api", productionEnvironment: "production" }];
const demoRunSamples: Run[] = [
  { id: 8421, environment: "production", state: "success", startedAt: new Date(Date.now() - 12 * 60000).toISOString(), updatedAt: new Date(Date.now() - 11 * 60000).toISOString(), sha: "abc1234a8d2e" },
  { id: 8420, environment: "production", state: "failure", startedAt: new Date(Date.now() - 84 * 60000).toISOString(), updatedAt: new Date(Date.now() - 80 * 60000).toISOString(), sha: "f09e81c73a20" },
  { id: 8419, environment: "staging", state: "success", startedAt: new Date(Date.now() - 5 * 3600000).toISOString(), updatedAt: new Date(Date.now() - 4.9 * 3600000).toISOString(), sha: "4b6c0e2f91aa" },
  { id: 8418, environment: "production", state: "success", startedAt: new Date(Date.now() - 26 * 3600000).toISOString(), updatedAt: new Date(Date.now() - 25.8 * 3600000).toISOString(), sha: "d8a214f3c6b9" }
];
const demoRuns = Array.from({ length: 12 }, (_, index) => {
  const sample = demoRunSamples[index % demoRunSamples.length];
  return { ...sample, id: 8421 - index, startedAt: new Date(Date.now() - (index * 37 + 12) * 60000).toISOString(), updatedAt: new Date(Date.now() - (index * 37 + 11) * 60000).toISOString() };
});
const demoIncidents: Incident[] = [{ id: "inc-42", environment: "production", openedAt: new Date(Date.now() - 23 * 60000).toISOString(), ageSeconds: 23 * 60, status: "open" }];

function demoFetch<T>(path: string): T {
  if (demoChoice === "empty") {
    if (path === "/api/repos") return demoRepos as T;
    if (path.includes("/metrics")) return ({
      window: "7d", generatedAt: new Date().toISOString(),
      deploymentFrequency: { total: 0, perDay: Array.from({ length: 7 }, (_, index) => ({ date: new Date(Date.now() - (6 - index) * 86400000).toISOString().slice(0, 10), count: 0 })) },
      changeFailureRate: { value: null, failed: 0, total: 0 }, mttr: { medianSeconds: null, p90Seconds: null, resolvedCount: 0 }, openIncidents: []
    } as Metrics) as T;
    return { data: [], nextCursor: null } as T;
  }
  if (path === "/api/repos") return demoRepos as T;
  if (path.includes("/metrics")) {
    const openIncidents = demoChoice === "incident" ? demoIncidents.map(({ id, environment, openedAt, ageSeconds }) => ({ id, environment, openedAt, ageSeconds })) : [];
    const dayCount = path.includes("30d") ? 30 : 7;
    const perDay = Array.from({ length: dayCount }, (_, index) => ({ date: new Date(Date.now() - (dayCount - index - 1) * 86400000).toISOString().slice(0, 10), count: [1, 0, 2, 1, 0, 3, 1][index % 7] ?? 0 }));
    return ({ window: dayCount === 30 ? "30d" : "7d", generatedAt: new Date().toISOString(), deploymentFrequency: { total: perDay.reduce((total, day) => total + day.count, 0), perDay }, changeFailureRate: { value: 1 / 12, failed: 1, total: 12 }, mttr: { medianSeconds: 1860, p90Seconds: 4320, resolvedCount: 4 }, openIncidents } as Metrics) as T;
  }
  if (path.includes("/runs")) {
    const cursor = new URL(path, "http://demo.local").searchParams.get("cursor");
    const start = cursor ? 10 : 0;
    return { data: demoRuns.slice(start, start + 10), nextCursor: start === 0 ? "demo-page-2" : null } as T;
  }
  return { data: demoChoice === "incident" ? demoIncidents : [], nextCursor: null } as T;
}

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(`API request failed: ${status}`);
  }
}

export class ConfigError extends Error {
  constructor() { super("VITE_API_URL must be a valid HTTP or HTTPS URL."); }
}

export function getDashboardToken(): string {
  return typeof sessionStorage === "undefined" ? "" : sessionStorage.getItem("shipwatch.dashboardToken") ?? "";
}

export async function apiFetch<T>(path: string): Promise<T> {
  if (demoMode) return demoFetch<T>(path);
  let endpoint: URL;
  try { endpoint = new URL(apiUrl); } catch { throw new ConfigError(); }
  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") throw new ConfigError();
  const response = await fetch(new URL(path, endpoint).toString(), {
    headers: { Authorization: `Bearer ${getDashboardToken()}` }
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}
