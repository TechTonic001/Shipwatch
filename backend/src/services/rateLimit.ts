import { pool } from "../db/pool.js";

export async function allowRateLimit(bucket: string, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const result = await pool.query<{ requests: number }>(
    `INSERT INTO rate_limits (bucket, key, window_started_at, requests)
     VALUES ($1, $2, date_bin(make_interval(secs => $4::int), now(), '1970-01-01'::timestamptz), 1)
     ON CONFLICT (bucket, key, window_started_at)
     DO UPDATE SET requests = rate_limits.requests + 1
     RETURNING requests`,
    [bucket, key, limit, windowSeconds]
  );
  return Number(result.rows[0]?.requests ?? limit + 1) <= limit;
}

export async function pruneRateLimits(): Promise<void> {
  await pool.query("DELETE FROM rate_limits WHERE window_started_at < now() - interval '2 hours'");
}
