import { pool } from "../db/pool.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { formatSlackMessage, sendSlackMessage } from "./slack.js";
import { decryptSecret } from "../lib/secrets.js";

const MAX_ATTEMPTS = 5;
const STALE_LOCK_MS = 90_000;

type AlertRow = {
  id: string;
  repoId: number;
  environment: string;
  kind: string;
  payload: Record<string, unknown>;
  attempts: number;
  lockedAt: Date;
  webhookUrl: string | null;
  incidentStatus: string;
};

export type AlertDispatchSummary = {
  claimed: number;
  sent: number;
  failed: number;
  dead: number;
  suppressedSkipped: number;
};

function backoffMs(attempts: number, retryAfterMs?: number): number {
  const exponential = Math.min(
    900_000,
    10_000 * 2 ** Math.max(0, attempts - 1)
  );
  const jitter = Math.round(exponential * (0.8 + Math.random() * 0.4));
  return Math.max(retryAfterMs ?? 0, jitter);
}

export async function dispatchAlerts({
  limit = 20,
  deadlineMs = 15_000
}: {
  limit?: number;
  deadlineMs?: number;
} = {}): Promise<AlertDispatchSummary> {
  const summary: AlertDispatchSummary = {
    claimed: 0,
    sent: 0,
    failed: 0,
    dead: 0,
    suppressedSkipped: 0
  };
  const started = Date.now();
  try {
    const resolvedBeforeSend = await pool.query<{ incidentId: string }>(
      `UPDATE alerts AS a
          SET status = 'suppressed',
              locked_at = NULL,
              payload = a.payload || '{"suppressedReason":"resolved_before_send"}'::jsonb
        WHERE a.kind = 'incident_opened'
          AND a.status IN ('pending', 'failed')
          AND a.next_attempt_at <= now()
          AND EXISTS (
            SELECT 1
              FROM incidents i
              WHERE i.id = a.incident_id
              AND i.status = 'resolved'
          )
        RETURNING a.incident_id AS "incidentId"`
    );
    for (const alert of resolvedBeforeSend.rows) {
      await pool.query(
        `UPDATE alerts
            SET status = 'suppressed',
                locked_at = NULL,
                payload = payload || '{"suppressedReason":"resolved_before_send"}'::jsonb
          WHERE incident_id = $1
            AND kind = 'incident_resolved'
            AND status IN ('pending', 'failed')`,
        [alert.incidentId]
      );
    }
    summary.suppressedSkipped += resolvedBeforeSend.rowCount ?? 0;

    const claimed = await pool.query<AlertRow>(
      `UPDATE alerts AS a
          SET attempts = a.attempts + 1, locked_at = now()
        WHERE a.id IN (
          SELECT candidate.id
            FROM alerts candidate
            WHERE candidate.status IN ('pending', 'failed')
              AND candidate.next_attempt_at <= now()
              AND (candidate.locked_at IS NULL OR candidate.locked_at < now() - (($1::bigint) * interval '1 millisecond'))
              AND (
                candidate.kind = 'incident_opened'
                OR EXISTS (
                  SELECT 1
                    FROM alerts opened
                    WHERE opened.incident_id = candidate.incident_id
                    AND opened.kind = 'incident_opened'
                    AND opened.status = 'sent'
                )
              )
            ORDER BY candidate.created_at
            LIMIT $2
            FOR UPDATE SKIP LOCKED
        )
        RETURNING a.id, a.repo_id AS "repoId", a.environment, a.kind, a.payload,
                  a.attempts, a.locked_at AS "lockedAt",
                  (SELECT status::text FROM incidents i WHERE i.id = a.incident_id) AS "incidentStatus",
                  (SELECT r.slack_webhook_url FROM repositories r WHERE r.id = a.repo_id) AS "webhookUrl"`,
      [STALE_LOCK_MS, Math.max(1, limit)]
    );
    summary.claimed = claimed.rowCount ?? 0;
    const lastSentAt = new Map<string, number>();

    for (const alert of claimed.rows) {
      if (Date.now() - started >= deadlineMs) break;
      if (
        alert.kind === "incident_opened" &&
        alert.incidentStatus === "resolved"
      ) {
        const suppressed = await pool.query(
          `UPDATE alerts
              SET status = 'suppressed', locked_at = NULL,
                  payload = payload || '{"suppressedReason":"resolved_before_send"}'::jsonb
            WHERE id = $1 AND status IN ('pending', 'failed') AND locked_at = $2
          RETURNING incident_id`,
          [alert.id, alert.lockedAt]
        );
        if ((suppressed.rowCount ?? 0) === 1) {
          await pool.query(
            `UPDATE alerts
                SET status = 'suppressed', locked_at = NULL,
                    payload = payload || '{"suppressedReason":"resolved_before_send"}'::jsonb
              WHERE incident_id = $1
                AND kind = 'incident_resolved'
                AND status IN ('pending', 'failed')`,
            [suppressed.rows[0].incident_id]
          );
          summary.suppressedSkipped += 1;
        }
        continue;
      }
      if (!alert.webhookUrl) {
        await pool.query(
          `UPDATE alerts SET status = 'suppressed', last_error = 'no_destination', locked_at = NULL
          WHERE id = $1 AND status IN ('pending', 'failed') AND locked_at = $2`,
          [alert.id, alert.lockedAt]
        );
        summary.suppressedSkipped += 1;
        continue;
      }
      const lastSent = lastSentAt.get(alert.webhookUrl);
      if (lastSent !== undefined && Date.now() - lastSent < 1000) {
        await pool.query(
          "UPDATE alerts SET locked_at = NULL, attempts = attempts - 1 WHERE id = $1 AND locked_at = $2",
          [alert.id, alert.lockedAt]
        );
        continue;
      }
      const payload = alert.payload;
      let destination = env.SLACK_WEBHOOK_URL;
      if (alert.webhookUrl) {
        try {
          destination = decryptSecret(alert.webhookUrl);
        } catch (error) {
          logger.warn({ err: error instanceof Error ? error.message : "secret decrypt failed" }, "encrypted Slack destination unavailable");
          destination = "";
        }
      }
      const result = await sendSlackMessage(
        destination,
        formatSlackMessage(alert.kind, {
          repo: String(payload.repo ?? ""),
          environment: String(payload.environment ?? alert.environment),
          sha: typeof payload.sha === "string" ? payload.sha : undefined,
          deploymentUrl:
            typeof payload.deploymentUrl === "string"
              ? payload.deploymentUrl
              : undefined,
          durationSeconds:
            typeof payload.durationSeconds === "number"
              ? payload.durationSeconds
              : undefined
        })
      );
      if (result.ok) {
        const updated = await pool.query(
          `UPDATE alerts SET status = 'sent', sent_at = now(), locked_at = NULL, last_error = NULL
            WHERE id = $1 AND status IN ('pending', 'failed') AND locked_at = $2`,
          [alert.id, alert.lockedAt]
        );
        if ((updated.rowCount ?? 0) === 1) {
          summary.sent += 1;
          lastSentAt.set(alert.webhookUrl, Date.now());
        }
      } else {
        const dead = !result.retryable || alert.attempts >= MAX_ATTEMPTS;
        const updated = await pool.query(
          `UPDATE alerts
              SET status = $3::alert_status,
                  next_attempt_at = CASE WHEN $3 = 'dead' THEN next_attempt_at ELSE now() + (($4::bigint) * interval '1 millisecond') END,
                  last_error = $5, locked_at = NULL
            WHERE id = $1 AND status IN ('pending', 'failed') AND locked_at = $2`,
          [
            alert.id,
            alert.lockedAt,
            dead ? "dead" : "failed",
            backoffMs(alert.attempts, result.retryAfterMs),
            result.reason.slice(0, 500)
          ]
        );
        if ((updated.rowCount ?? 0) === 1)
          summary[dead ? "dead" : "failed"] += 1;
      }
    }
  } catch (error) {
    logger.warn({ err: error }, "alert dispatch failed");
  }
  return summary;
}
