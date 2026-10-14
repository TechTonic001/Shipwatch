import { pool } from "../db/pool.js";
import { logger } from "../lib/logger.js";
import { claimBatch, markDead, markFailed, markIgnored, markProcessed, reapPoison, type QueueDelivery } from "./queue.js";
import { processQueuedDelivery } from "./processors/index.js";

export type ProcessBatchOptions = {
  limit?: number;
  deadlineMs?: number;
};

export type ProcessBatchSummary = {
  claimed: number;
  processed: number;
  failed: number;
  dead: number;
  ignored: number;
  lockLost: number;
  released: number;
};

async function releaseClaim(row: QueueDelivery): Promise<boolean> {
  const result = await pool.query(
    `
      UPDATE webhook_deliveries
      SET status = 'received',
          attempts = GREATEST(0, attempts - 1),
          locked_at = NULL,
          next_attempt_at = COALESCE(next_attempt_at, now())
      WHERE delivery_id = $1
        AND status = 'processing'
        AND locked_at = $2
      RETURNING delivery_id
    `,
    [row.deliveryId, row.lockedAt]
  );

  return (result.rowCount ?? 0) === 1;
}

export async function processBatch({
  limit = 20,
  deadlineMs = 15_000
}: ProcessBatchOptions = {}): Promise<ProcessBatchSummary> {
  const summary: ProcessBatchSummary = {
    claimed: 0,
    processed: 0,
    failed: 0,
    dead: 0,
    ignored: 0,
    lockLost: 0,
    released: 0
  };

  const deadlineAt = Date.now() + deadlineMs;

  try {
    summary.dead += await reapPoison();
  } catch (error) {
    logger.warn({ err: error }, "reapPoison failed");
  }

  const claimedRows: QueueDelivery[] = [];
  try {
    claimedRows.push(...(await claimBatch(limit)));
    summary.claimed = claimedRows.length;
  } catch (error) {
    logger.warn({ err: error }, "claimBatch failed");
  }

  for (const row of claimedRows) {
    if (Date.now() >= deadlineAt - 200) {
      const released = await releaseClaim(row);
      if (released) {
        summary.released += 1;
      }
      continue;
    }

    try {
      const outcome = await processQueuedDelivery(row);
      if (outcome === "processed") {
        const updated = await markProcessed(row.deliveryId, row.lockedAt);
        if (updated) {
          summary.processed += 1;
        } else {
          summary.lockLost += 1;
        }
      } else if (outcome === "ignored") {
        const updated = await markIgnored(row.deliveryId, row.lockedAt);
        if (updated) {
          summary.ignored += 1;
        } else {
          summary.lockLost += 1;
        }
      } else if (outcome === "failed") {
        const updated = await markFailed(row.deliveryId, row.lockedAt, new Error("processing failed"), row.attempts);
        if (updated) {
          summary.failed += 1;
        } else {
          summary.lockLost += 1;
        }
      } else {
        const updated = await markDead(row.deliveryId, row.lockedAt, new Error("mark dead"));
        if (updated) {
          summary.dead += 1;
        } else {
          summary.lockLost += 1;
        }
      }
    } catch (error) {
      logger.warn({ deliveryId: row.deliveryId, err: error }, "processBatch row failed");
      const updated = await markFailed(row.deliveryId, row.lockedAt, error instanceof Error ? error : new Error("unknown processing error"), row.attempts);
      if (updated) {
        summary.failed += 1;
      } else {
        summary.lockLost += 1;
      }
    }
  }

  return summary;
}
