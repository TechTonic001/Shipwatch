import { pool } from "../db/pool.js";

export type OperationalStats = {
  generatedAt: string;
  queueDepthByStatus: Record<string, number>;
  oldestPendingDeliveryAgeSeconds: number | null;
  deadDeliveries: number;
  deadAlerts: number;
  alertBacklog: number;
  processingLatencySeconds: { p50: number | null; p95: number | null; p99: number | null };
  retryRate: { retried: number; total: number; value: number | null };
  suppressedAlerts: number;
  lockLostCount: number;
};

type StatsRow = {
  generatedAt: Date;
  queueDepthByStatus: Record<string, number>;
  oldestPendingDeliveryAgeSeconds: number | null;
  deadDeliveries: number;
  deadAlerts: number;
  alertBacklog: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  retried: number;
  retryTotal: number;
  suppressedAlerts: number;
  lockLostCount: number;
};

export async function getOperationalStats(): Promise<OperationalStats> {
  const result = await pool.query<StatsRow>(`
    WITH queue_depth AS (
      SELECT status, count(*)::int AS count
        FROM webhook_deliveries
       GROUP BY status
    ),
    latency AS (
      SELECT percentile_cont(0.50) WITHIN GROUP
                 (ORDER BY EXTRACT(EPOCH FROM (processed_at - received_at))) AS p50,
             percentile_cont(0.95) WITHIN GROUP
                 (ORDER BY EXTRACT(EPOCH FROM (processed_at - received_at))) AS p95,
             percentile_cont(0.99) WITHIN GROUP
                 (ORDER BY EXTRACT(EPOCH FROM (processed_at - received_at))) AS p99
        FROM webhook_deliveries
       WHERE processed_at IS NOT NULL
         AND received_at >= now() - interval '1 hour'
    ),
    retries AS (
      SELECT count(*) FILTER (WHERE attempts > 1)::int AS retried,
             count(*)::int AS total
        FROM webhook_deliveries
    )
    SELECT now() AS "generatedAt",
           COALESCE((SELECT jsonb_object_agg(status, count) FROM queue_depth), '{}'::jsonb)
             AS "queueDepthByStatus",
           (SELECT EXTRACT(EPOCH FROM (now() - min(received_at)))::int
              FROM webhook_deliveries
             WHERE status IN ('received', 'failed')) AS "oldestPendingDeliveryAgeSeconds",
           (SELECT count(*)::int FROM webhook_deliveries WHERE status = 'dead') AS "deadDeliveries",
           (SELECT count(*)::int FROM alerts WHERE status = 'dead') AS "deadAlerts",
           (SELECT count(*)::int FROM alerts WHERE status IN ('pending', 'failed')) AS "alertBacklog",
           (SELECT p50 FROM latency) AS p50,
           (SELECT p95 FROM latency) AS p95,
           (SELECT p99 FROM latency) AS p99,
           (SELECT retried FROM retries) AS retried,
           (SELECT total FROM retries) AS "retryTotal",
           (SELECT count(*)::int FROM alerts WHERE status = 'suppressed') AS "suppressedAlerts",
           (SELECT COALESCE(sum(lock_lost_count), 0)::int FROM webhook_deliveries)
             AS "lockLostCount"
  `);
  const row = result.rows[0];
  const queueDepthByStatus = {
    received: 0,
    processing: 0,
    failed: 0,
    dead: 0,
    processed: 0,
    ignored: 0,
    ...row.queueDepthByStatus
  };
  return {
    generatedAt: row.generatedAt.toISOString(),
    queueDepthByStatus,
    oldestPendingDeliveryAgeSeconds: row.oldestPendingDeliveryAgeSeconds,
    deadDeliveries: row.deadDeliveries,
    deadAlerts: row.deadAlerts,
    alertBacklog: row.alertBacklog,
    processingLatencySeconds: { p50: row.p50, p95: row.p95, p99: row.p99 },
    retryRate: {
      retried: row.retried,
      total: row.retryTotal,
      value: row.retryTotal === 0 ? null : row.retried / row.retryTotal
    },
    suppressedAlerts: row.suppressedAlerts,
    lockLostCount: row.lockLostCount
  };
}
