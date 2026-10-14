import { pool } from "../db/pool.js";

export const MAX_ATTEMPTS = Number(process.env.SHIPWATCH_MAX_ATTEMPTS ?? 5);
export const STALE_LOCK_MS = Number(process.env.SHIPWATCH_STALE_LOCK_MS ?? 90_000);
export const BATCH_SIZE = Number(process.env.SHIPWATCH_BATCH_SIZE ?? 20);
export const BACKOFF_BASE_MS = Number(process.env.SHIPWATCH_BACKOFF_BASE_MS ?? 10_000);
export const BACKOFF_CAP_MS = Number(process.env.SHIPWATCH_BACKOFF_CAP_MS ?? 900_000);

export class PermanentProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentProcessingError";
  }
}

export type QueueDelivery = {
  deliveryId: string;
  eventType: string;
  action: string | null;
  githubRepoId: number | null;
  payload: Record<string, unknown>;
  attempts: number;
  lockedAt: Date;
  status: string;
};

export async function reapPoison(): Promise<number> {
  const result = await pool.query(
    `
      UPDATE webhook_deliveries
      SET status = 'dead',
          last_error = COALESCE(last_error, 'stale processing lock')
      WHERE status = 'processing'
        AND locked_at < now() - (($1::bigint) * interval '1 millisecond')
        AND attempts >= $2
      RETURNING delivery_id
    `,
    [STALE_LOCK_MS, MAX_ATTEMPTS]
  );

  return result.rowCount ?? 0;
}

export async function claimBatch(limit: number): Promise<QueueDelivery[]> {
  const result = await pool.query(
    `
      UPDATE webhook_deliveries AS w
      SET status = 'processing',
          attempts = w.attempts + 1,
          locked_at = now()
      WHERE w.delivery_id IN (
        SELECT candidate.delivery_id
        FROM webhook_deliveries AS candidate
        WHERE (
          (candidate.status IN ('received', 'failed') AND (candidate.next_attempt_at IS NULL OR candidate.next_attempt_at <= now()))
          OR (candidate.status = 'processing' AND candidate.locked_at < now() - (($1::bigint) * interval '1 millisecond') AND candidate.attempts < $2)
        )
        ORDER BY candidate.received_at ASC
        LIMIT $3
        FOR UPDATE SKIP LOCKED
      )
      RETURNING
        w.delivery_id AS "deliveryId",
        w.event_type AS "eventType",
        w.action,
        w.github_repo_id AS "githubRepoId",
        w.payload,
        w.status,
        w.attempts,
        w.locked_at AS "lockedAt"
    `,
    [STALE_LOCK_MS, MAX_ATTEMPTS, Math.max(1, limit)]
  );

  return result.rows.map((row) => ({
    deliveryId: row.deliveryId,
    eventType: row.eventType,
    action: row.action,
    githubRepoId: row.githubRepoId,
    payload: row.payload as Record<string, unknown>,
    attempts: row.attempts,
    lockedAt: row.lockedAt,
    status: row.status
  }));
}

export async function markProcessed(deliveryId: string, claimToken: Date): Promise<boolean> {
  const result = await pool.query(
    `
      UPDATE webhook_deliveries
      SET status = 'processed',
          processed_at = now(),
          locked_at = NULL,
          next_attempt_at = NULL,
          last_error = NULL
      WHERE delivery_id = $1
        AND status = 'processing'
        AND locked_at = $2
      RETURNING delivery_id
    `,
    [deliveryId, claimToken]
  );

  return (result.rowCount ?? 0) === 1;
}

export async function markIgnored(deliveryId: string, claimToken: Date): Promise<boolean> {
  const result = await pool.query(
    `
      UPDATE webhook_deliveries
      SET status = 'ignored',
          processed_at = now(),
          locked_at = NULL,
          next_attempt_at = NULL,
          last_error = NULL
      WHERE delivery_id = $1
        AND status = 'processing'
        AND locked_at = $2
      RETURNING delivery_id
    `,
    [deliveryId, claimToken]
  );

  return (result.rowCount ?? 0) === 1;
}

export async function markDead(deliveryId: string, claimToken: Date, error?: Error): Promise<boolean> {
  const message = error ? error.message.slice(0, 500) : "processing failed";
  const result = await pool.query(
    `
      UPDATE webhook_deliveries
      SET status = 'dead',
          last_error = $3,
          locked_at = NULL,
          next_attempt_at = NULL,
          processed_at = now()
      WHERE delivery_id = $1
        AND status = 'processing'
        AND locked_at = $2
      RETURNING delivery_id
    `,
    [deliveryId, claimToken, message]
  );

  return (result.rowCount ?? 0) === 1;
}

export async function markFailed(
  deliveryId: string,
  claimToken: Date,
  error: Error,
  attemptCount: number
): Promise<boolean> {
  const delayMs = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attemptCount - 1));
  const jitterRatio = 0.8 + Math.random() * 0.4;
  const nextAttemptMs = Math.max(1000, Math.round(delayMs * jitterRatio));
  const result = await pool.query(
    `
      UPDATE webhook_deliveries
      SET status = CASE WHEN attempts >= $3 THEN 'dead' ELSE 'failed' END,
          last_error = $4,
          next_attempt_at = CASE WHEN attempts >= $3 THEN NULL ELSE now() + (($5::bigint) * interval '1 millisecond') END,
          locked_at = NULL
      WHERE delivery_id = $1
        AND status = 'processing'
        AND locked_at = $2
      RETURNING delivery_id
    `,
    [deliveryId, claimToken, MAX_ATTEMPTS, error.message.slice(0, 500), nextAttemptMs]
  );

  return (result.rowCount ?? 0) === 1;
}
