import { z, type ZodType } from "zod";

import type { Incident, Metrics } from "../hooks/useMetrics";
import type { Run } from "../hooks/useRuns";

const DEPLOYED_BACKEND_URL = "https://shipwatchbackend.vercel.app";
const demoChoice = new URLSearchParams(window.location.search).get("demo");
export const demoMode = import.meta.env.DEV && ["1", "incident", "empty"].includes(demoChoice ?? "")
  ? demoChoice === "1" ? "standard" : demoChoice
  : null;

const DASHBOARD_TOKEN_KEY = "shipwatch.dashboardToken";
let memoryDashboardToken: string | null = null;

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
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export class ConfigError extends Error {
  constructor(message = "Configuration error: VITE_API_URL is not set") {
    super(message);
  }
}

export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function setDashboardToken(token: string): void {
  const value = token.trim();
  memoryDashboardToken = value || null;
  if (typeof sessionStorage !== "undefined") {
    if (value) {
      sessionStorage.setItem(DASHBOARD_TOKEN_KEY, value);
      return;
    }
    sessionStorage.removeItem(DASHBOARD_TOKEN_KEY);
  }
}

export function clearDashboardToken(): void {
  memoryDashboardToken = null;
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(DASHBOARD_TOKEN_KEY);
  }
}

export function getDashboardToken(): string {
  if (typeof sessionStorage !== "undefined") {
    const value = sessionStorage.getItem(DASHBOARD_TOKEN_KEY);
    if (value) {
      memoryDashboardToken = value;
      return value;
    }
  }
  return memoryDashboardToken ?? "";
}

function getApiBaseUrl(): string {
  const rawValue = (import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? DEPLOYED_BACKEND_URL : "")).trim().replace(/\/+$/, "");
  if (!rawValue) {
    if (import.meta.env.PROD) {
      return DEPLOYED_BACKEND_URL;
    }
    return "http://localhost:3000";
  }

  try {
    const candidate = new URL(rawValue);
    if (candidate.protocol !== "http:" && candidate.protocol !== "https:") {
      throw new Error("Only HTTP and HTTPS endpoints are supported.");
    }
    return candidate.origin;
  } catch {
    throw new ConfigError("Configuration error: VITE_API_URL must be a valid HTTP or HTTPS URL.");
  }
}

export async function apiFetch<T>(path: string, schema: ZodType<T>): Promise<T> {
  if (demoMode) {
    return schema.parse(demoFetch<T>(path));
  }

  const endpoint = new URL(path, `${getApiBaseUrl()}/`);
  const token = getDashboardToken();

  let response: Response;
  try {
    response = await fetch(endpoint.toString(), {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
  } catch {
    throw new ApiError(0, "Network error: the dashboard could not reach the API.");
  }

  if (response.status === 401) {
    clearDashboardToken();
    throw new ApiError(401, "Unauthorized");
  }

  if (response.status === 429) {
    throw new ApiError(429, "Rate limit exceeded");
  }

  if (response.status >= 500) {
    throw new ApiError(response.status, `Server error: ${response.status}`);
  }

  if (!response.ok) {
    throw new ApiError(response.status, `Request failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html") || contentType.includes("application/xhtml+xml")) {
    const text = await response.text();
    throw new ApiError(response.status, `Expected JSON but received HTML: ${text.slice(0, 120)}`);
  }

  const payloadText = await response.text();
  if (!payloadText.trim()) {
    throw new ApiError(response.status, "The API response was empty.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    throw new ApiError(response.status, `Expected JSON but received ${contentType || "a non-JSON response"}: ${payloadText.slice(0, 120)}`);
  }

  try {
    return schema.parse(payload) as T;
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`).join(", ") : "Response schema validation failed.";
    throw new SchemaError(`API response mismatch: ${message}`);
  }
}

