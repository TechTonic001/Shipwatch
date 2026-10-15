import { randomUUID } from "node:crypto";

import type { PoolClient } from "pg";

import { createAlert, type AlertPayload } from "./alerts.js";

export type DeploymentForIncident = {
  id: number;
  repoId: number;
  repoName: string;
  environment: string;
  isProduction: boolean;
  state: string;
  createdAt: Date;
  sha?: string | null;
  deploymentUrl?: string | null;
};

function alertPayload(
  deployment: DeploymentForIncident,
  incidentId: string,
  resolvedAt?: Date,
  durationSeconds?: number
): AlertPayload {
  return {
    repo: deployment.repoName,
    environment: deployment.environment,
    sha: deployment.sha ? deployment.sha.slice(0, 12) : undefined,
    deploymentUrl: deployment.deploymentUrl ?? undefined,
    incidentId,
    openedAt: deployment.createdAt.toISOString(),
    resolvedAt: resolvedAt?.toISOString(),
    durationSeconds
  };
}

export async function evaluateIncidentTransition(
  client: PoolClient,
  deployment: DeploymentForIncident
): Promise<void> {
  if (!deployment.isProduction) return;

  if (deployment.state === "failure" || deployment.state === "error") {
    const incidentIdResult = await client.query<{ id: string }>(
      `INSERT INTO incidents
        (id, repo_id, environment, status, trigger_deployment_id, trigger_created_at, opened_at)
        SELECT $5, $1, $2, 'open', $3, $4, $4
        FROM deployments current_deployment
        WHERE current_deployment.id = $3
          AND NOT EXISTS (
            SELECT 1 FROM deployments newer
            WHERE newer.repo_id = current_deployment.repo_id
            AND lower(btrim(newer.environment)) = lower(btrim(current_deployment.environment))
            AND newer.is_production
            AND newer.created_at > current_deployment.created_at
          )
        ON CONFLICT DO NOTHING
        RETURNING id`,
      [
        deployment.repoId,
        deployment.environment,
        deployment.id,
        deployment.createdAt,
        randomUUID()
      ]
    );
    const incident = incidentIdResult.rows[0];
    if (incident) {
      await createAlert({
        client,
        incidentId: incident.id,
        repoId: deployment.repoId,
        environment: deployment.environment,
        kind: "incident_opened",
        payload: alertPayload(deployment, incident.id)
      });
    }
    return;
  }

  if (deployment.state !== "success") return;

  const resolved = await client.query<{
    id: string;
    openedAt: Date;
    resolvedAt: Date;
  }>(
    `UPDATE incidents
        SET status = 'resolved',
            resolved_at = $4,
            resolving_deployment_id = $3
      WHERE repo_id = $1
        AND lower(btrim(environment)) = lower(btrim($2))
        AND status = 'open'
        AND $4 > trigger_created_at
      RETURNING id, opened_at AS "openedAt", resolved_at AS "resolvedAt"`,
    [
      deployment.repoId,
      deployment.environment,
      deployment.id,
      deployment.createdAt
    ]
  );
  const incident = resolved.rows[0];
  if (!incident) return;

  const durationSeconds = Math.max(
    0,
    Math.floor(
      (incident.resolvedAt.getTime() - incident.openedAt.getTime()) / 1000
    )
  );
  await createAlert({
    client,
    incidentId: incident.id,
    repoId: deployment.repoId,
    environment: deployment.environment,
    kind: "incident_resolved",
    payload: alertPayload(
      deployment,
      incident.id,
      incident.resolvedAt,
      durationSeconds
    )
  });
}

export async function openIncident(
  _key: string,
  _reason: string
): Promise<void> {
  // Compatibility stub retained for the original scaffold API.
}

export async function resolveIncident(_key: string): Promise<void> {
  // Compatibility stub retained for the original scaffold API.
}
  