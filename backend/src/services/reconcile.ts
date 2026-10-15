import { logger } from "../lib/logger.js";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import { processDeployment } from "./processors/deployment.js";
import { processDeploymentStatus } from "./processors/deploymentStatus.js";
import { processWorkflowRun } from "./processors/workflowRun.js";

const PAGE_SIZE = 100;
const MAX_PAGES = 3;
const OVERLAP_MS = 10 * 60_000;
const etags = new Map<string, string>();

type GithubResponse = { status: number; headers: Headers; body: unknown; remaining: number | null };
type Repository = { id: number; full_name: string; production_environment: string; reconciled_through: Date | null };

async function githubGet(path: string): Promise<GithubResponse> {
  if (!env.GITHUB_RECONCILE_TOKEN) throw new Error("GITHUB_RECONCILE_TOKEN is not configured");
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    authorization: "Bearer " + env.GITHUB_RECONCILE_TOKEN,
    "x-github-api-version": "2022-11-28"
  };
  const previous = etags.get(path);
  if (previous) headers["if-none-match"] = previous;
  const response = await fetch(path, { headers });
  const remaining = response.headers.get("x-ratelimit-remaining");
  if (remaining !== null && Number(remaining) <= 0) throw new Error("GitHub API rate limit exhausted");
  if (response.headers.has("etag")) etags.set(path, response.headers.get("etag") ?? "");
  if (response.status === 304) return { status: 304, headers: response.headers, body: [], remaining: remaining === null ? null : Number(remaining) };
  if (response.status === 401) throw new Error("GitHub reconciliation token was rejected (401)");
  if (!response.ok) throw new Error(`GitHub reconciliation request failed (${response.status})`);
  const body: unknown = await response.json();
  return { status: response.status, headers: response.headers, body, remaining: remaining === null ? null : Number(remaining) };
}

function items(body: unknown): Record<string, unknown>[] {
  return Array.isArray(body) ? body.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null) : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function apiDate(value: unknown, fallback: Date): string {
  return stringValue(value) ?? fallback.toISOString();
}

async function reconcileRepository(repo: Repository): Promise<{ changed: number; stopped: boolean }> {
  const end = new Date();
  const since = new Date((repo.reconciled_through?.getTime() ?? end.getTime() - 24 * 60 * 60_000) - OVERLAP_MS);
  let changed = 0;
  let stopped = false;
  for (const page of Array.from({ length: MAX_PAGES }, (_, index) => index + 1)) {
    const runs = await githubGet(`${env.GITHUB_API_URL}/repos/${repo.full_name}/actions/runs?created=>=${encodeURIComponent(since.toISOString())}&per_page=${PAGE_SIZE}&page=${page}`);
    if (runs.remaining !== null && runs.remaining <= 1) stopped = true;
    if (runs.status === 304) break;
    for (const run of items((runs.body as { workflow_runs?: unknown }).workflow_runs)) {
      await processWorkflowRun({ repository: { id: repo.id, full_name: repo.full_name }, workflow_run: run });
      changed += 1;
    }
    if (stopped || items((runs.body as { workflow_runs?: unknown }).workflow_runs).length < PAGE_SIZE) break;
  }
  for (const page of Array.from({ length: MAX_PAGES }, (_, index) => index + 1)) {
    const deployments = await githubGet(`${env.GITHUB_API_URL}/repos/${repo.full_name}/deployments?since=${encodeURIComponent(since.toISOString())}&per_page=${PAGE_SIZE}&page=${page}`);
    if (deployments.remaining !== null && deployments.remaining <= 1) stopped = true;
    if (deployments.status === 304) break;
    const rows = items(deployments.body);
    for (const deployment of rows) {
      const deploymentId = numberValue(deployment.id);
      if (!deploymentId) continue;
      await processDeployment({
        repository: { id: repo.id, full_name: repo.full_name, production_environment: repo.production_environment },
        deployment: { ...deployment, id: deploymentId, created_at: apiDate(deployment.created_at, end) }
      });
      for (const statusPage of Array.from({ length: MAX_PAGES }, (_, index) => index + 1)) {
        const statuses = await githubGet(`${env.GITHUB_API_URL}/repos/${repo.full_name}/deployments/${deploymentId}/statuses?per_page=${PAGE_SIZE}&page=${statusPage}`);
        if (statuses.remaining !== null && statuses.remaining <= 1) stopped = true;
        const statusRows = items(statuses.body);
        for (const status of statusRows) {
        const statusId = numberValue(status.id);
        if (!statusId) continue;
        await processDeploymentStatus({
          repository: { id: repo.id, full_name: repo.full_name, production_environment: repo.production_environment },
          deployment: { ...deployment, id: deploymentId, created_at: apiDate(deployment.created_at, end) },
          deployment_status: { ...status, id: statusId, created_at: apiDate(status.created_at, end) }
        });
        changed += 1;
        }
        if (stopped || statusRows.length < PAGE_SIZE) break;
      }
      if (stopped) break;
    }
    if (stopped || rows.length < PAGE_SIZE) break;
  }
  if (!stopped) {
    await pool.query("UPDATE repositories SET reconciled_through = $2 WHERE id = $1", [repo.id, end]);
  }
  return { changed, stopped };
}

export async function reconcileRepositories(): Promise<{ enabled: boolean; repositories: number; changed: number; stopped: boolean }> {
  if (!env.GITHUB_RECONCILE_TOKEN) {
    logger.warn("GitHub reconciliation disabled: GITHUB_RECONCILE_TOKEN is not configured");
    return { enabled: false, repositories: 0, changed: 0, stopped: false };
  }
  const repos = await pool.query<Repository>(
    `SELECT id, full_name, production_environment, reconciled_through
       FROM repositories
      WHERE reconciled_through IS NULL OR reconciled_through < now() - interval '15 minutes'
      ORDER BY reconciled_through NULLS FIRST, id
      LIMIT 25`
  );
  let changed = 0;
  let stopped = false;
  for (const repo of repos.rows) {
    try {
      const result = await reconcileRepository(repo);
      changed += result.changed;
      stopped = stopped || result.stopped;
      if (stopped) break;
    } catch (error) {
      logger.error({ repoId: repo.id, err: error instanceof Error ? error.message : "reconciliation failed" }, "GitHub reconciliation failed");
      if (error instanceof Error && (error.message.includes("401") || error.message.includes("rate limit"))) break;
    }
  }
  return { enabled: true, repositories: repos.rowCount ?? 0, changed, stopped };
}
