import { randomUUID } from "node:crypto";

import type { PoolClient } from "pg";

export type AlertKind = "incident_opened" | "incident_resolved";
export type AlertPayload = {
  repo: string;
  environment: string;
  sha?: string;
  deploymentUrl?: string;
  incidentId: string;
  openedAt: string;
  resolvedAt?: string;
  durationSeconds?: number;
};

export type CreateAlertInput = {
  client: PoolClient;
  incidentId: string;
  repoId: number;
  environment: string;
  kind: AlertKind;
  payload: AlertPayload;
};

export async function createAlert(input: CreateAlertInput): Promise<boolean> {
  const configResult = await input.client.query<{
    muted: boolean;
    cooldownMinutes: number;
  }>(
    `SELECT COALESCE((alert_config->>'muted')::boolean, false) AS muted,
            COALESCE((alert_config->>'cooldownMinutes')::numeric, 10) AS "cooldownMinutes"
       FROM repositories
      WHERE id = $1`,
    [input.repoId]
  );
  const config = configResult.rows[0] ?? { muted: false, cooldownMinutes: 10 };
  let status = "pending";
  let suppressedReason: string | undefined;
  let nextAttemptAt: Date | undefined;

  if (config.muted) {
    status = "suppressed";
    suppressedReason = "muted";
  } else if (input.kind === "incident_resolved") {
    const opened = await input.client.query<{ status: string }>(
      `SELECT status::text
         FROM alerts
        WHERE incident_id = $1
          AND kind = 'incident_opened'
        ORDER BY created_at
        LIMIT 1`,
      [input.incidentId]
    );
    if (opened.rows[0]?.status === "suppressed" || opened.rows[0]?.status === "dead") {
      status = "suppressed";
      suppressedReason = "opened_alert_terminal";
    }
  } else {
    const recent = await input.client.query<{ previousTime: Date | null }>(
      `SELECT GREATEST(max(created_at), max(sent_at)) AS "previousTime"
         FROM alerts
        WHERE repo_id = $1
          AND environment = $2
          AND kind = 'incident_opened'
          AND status IN ('pending', 'failed', 'sent')
          AND GREATEST(created_at, COALESCE(sent_at, created_at))
              >= now() - (($3::numeric) * interval '1 minute')`,
      [input.repoId, input.environment, config.cooldownMinutes]
    );
    const previousTime = recent.rows[0]?.previousTime;
    if (previousTime) {
      nextAttemptAt = new Date(previousTime.getTime() + Number(config.cooldownMinutes) * 60_000);
    }
  }

  const payload = suppressedReason
    ? { ...input.payload, suppressedReason }
    : input.payload;
  const result = await input.client.query(
    `INSERT INTO alerts
      (id, incident_id, repo_id, environment, kind, dedupe_key, status, payload, next_attempt_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::alert_status, $8::jsonb, COALESCE($9, now()))
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING id`,
    [
      randomUUID(),
      input.incidentId,
      input.repoId,
      input.environment,
      input.kind,
      `${input.kind}:${input.incidentId}`,
      status,
      JSON.stringify(payload),
      nextAttemptAt
    ]
  );
  return (result.rowCount ?? 0) === 1;
}

export async function sendSlackAlert(_message: string): Promise<void> {
  // Compatibility stub retained for callers from the scaffold; Phase 3 uses sendSlackMessage.
}
