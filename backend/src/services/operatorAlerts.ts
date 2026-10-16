import { randomUUID } from "node:crypto";

import type pg from "pg";

import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import { logger } from "../lib/logger.js";
import type { OperationalStats } from "./observability.js";
import { sendSlackMessage } from "./slack.js";

type Threshold = {
  key: string;
  active: boolean;
  firingMessage: string;
  recoveryMessage: string;
};

function thresholds(stats: OperationalStats): Threshold[] {
  const oldestAge = stats.oldestPendingDeliveryAgeSeconds;
  return [
    {
      key: "dead-deliveries",
      active: stats.deadDeliveries > 0,
      firingMessage: `Shipwatch operator alert: ${stats.deadDeliveries} dead webhook deliveries.`,
      recoveryMessage: "Shipwatch recovery: no dead webhook deliveries remain."
    },
    {
      key: "old-pending-delivery",
      active: oldestAge !== null && oldestAge > 600,
      firingMessage: `Shipwatch operator alert: oldest pending webhook delivery is ${oldestAge ?? 0} seconds old.`,
      recoveryMessage: "Shipwatch recovery: pending webhook deliveries are under the 10 minute threshold."
    },
    {
      key: "alert-backlog",
      active: stats.alertBacklog > env.OPERATOR_ALERT_BACKLOG_THRESHOLD,
      firingMessage: `Shipwatch operator alert: alert backlog is ${stats.alertBacklog}, above threshold ${env.OPERATOR_ALERT_BACKLOG_THRESHOLD}.`,
      recoveryMessage: "Shipwatch recovery: alert backlog is back within its configured threshold."
    }
  ];
}

async function persistTransitions(items: Threshold[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const item of items) {
      const existing = await client.query<{ active: boolean; generation: number }>(
        `SELECT active, generation
           FROM operator_alert_state
          WHERE alert_key = $1
          FOR UPDATE`,
        [item.key]
      );
      const current = existing.rows[0];
      if (!current) {
        await client.query(
          `INSERT INTO operator_alert_state (alert_key, active, generation)
           VALUES ($1, $2, 1)`,
          [item.key, item.active]
        );
        if (item.active) {
          await enqueue(client, item.key, 1, "firing", item.firingMessage);
        }
      } else if (current.active !== item.active) {
        const generation = current.generation + 1;
        await client.query(
          `UPDATE operator_alert_state
              SET active = $2, generation = $3, updated_at = now()
            WHERE alert_key = $1`,
          [item.key, item.active, generation]
        );
        await enqueue(
          client,
          item.key,
          generation,
          item.active ? "firing" : "recovery",
          item.active ? item.firingMessage : item.recoveryMessage
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function enqueue(
  client: pg.PoolClient,
  key: string,
  generation: number,
  kind: "firing" | "recovery",
  message: string
): Promise<void> {
  await client.query(
    `INSERT INTO operator_alert_events
       (id, alert_key, generation, event_kind, message)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (alert_key, generation, event_kind) DO NOTHING`,
    [randomUUID(), key, generation, kind, message]
  );
}

export async function evaluateOperatorAlerts(stats: OperationalStats): Promise<void> {
  await persistTransitions(thresholds(stats));
  await dispatchOperatorAlerts();
}

export async function dispatchOperatorAlerts(): Promise<void> {
  const claimed = await pool.query<{
    id: string;
    alertKey: string;
    eventKind: "firing" | "recovery";
    message: string;
    lockedAt: Date;
  }>(
    `UPDATE operator_alert_events
        SET status = 'sending', attempts = attempts + 1, locked_at = now()
      WHERE id IN (
        SELECT id
          FROM operator_alert_events
         WHERE (status = 'pending' AND next_attempt_at <= now())
            OR (status = 'sending' AND locked_at < now() - interval '90 seconds')
         ORDER BY created_at
         LIMIT 10
         FOR UPDATE SKIP LOCKED
      )
      RETURNING id, alert_key AS "alertKey", event_kind AS "eventKind",
                message, locked_at AS "lockedAt"`
  );

  for (const event of claimed.rows) {
    if (!env.OPERATOR_SLACK_WEBHOOK_URL) {
      logger.error({
        event: "operator_alert_delivery",
        outcome: "configuration_missing",
        durationMs: 0,
        requestId: null,
        deliveryId: null,
        alertKey: event.alertKey,
        eventKind: event.eventKind
      }, "operator Slack webhook is not configured");
      await pool.query(
        `UPDATE operator_alert_events
            SET status = 'pending', locked_at = NULL,
                next_attempt_at = now() + interval '1 minute'
          WHERE id = $1 AND status = 'sending' AND locked_at = $2`,
        [event.id, event.lockedAt]
      );
      continue;
    }
    const startedAt = Date.now();
    const result = await sendSlackMessage(env.OPERATOR_SLACK_WEBHOOK_URL, event.message);
    if (result.ok) {
      await pool.query(
        `UPDATE operator_alert_events
            SET status = 'sent', sent_at = now(), locked_at = NULL, last_error = NULL
          WHERE id = $1 AND status = 'sending' AND locked_at = $2`,
        [event.id, event.lockedAt]
      );
      logger.info({
        event: "operator_alert_delivery",
        outcome: "sent",
        durationMs: Date.now() - startedAt,
        requestId: null,
        deliveryId: null,
        alertKey: event.alertKey,
        eventKind: event.eventKind
      }, "operator alert delivered");
    } else {
      await pool.query(
        `UPDATE operator_alert_events
            SET status = 'pending', locked_at = NULL,
                next_attempt_at = now() + interval '30 seconds', last_error = $3
          WHERE id = $1 AND status = 'sending' AND locked_at = $2`,
        [event.id, event.lockedAt, result.reason]
      );
      logger.warn({
        event: "operator_alert_delivery",
        outcome: "retry_scheduled",
        durationMs: Date.now() - startedAt,
        requestId: null,
        deliveryId: null,
        alertKey: event.alertKey,
        eventKind: event.eventKind,
        reason: result.reason
      }, "operator alert delivery failed");
    }
  }
}
