import { pool } from "../db/pool.js";

export type MetricsWindow = "7d" | "30d";
type WindowDays = 7 | 30;

function days(window: MetricsWindow): WindowDays {
  return window === "7d" ? 7 : 30;
}

export type Repository = {
  id: number;
  fullName: string;
  productionEnvironment: string;
};

export type MetricsResponse = {
  window: MetricsWindow;
  generatedAt: string;
  deploymentFrequency: { total: number; perDay: { date: string; count: number }[] };
  changeFailureRate: { value: number | null; failed: number; total: number };
  mttr: { medianSeconds: number | null; p90Seconds: number | null; resolvedCount: number };
  openIncidents: { id: string; environment: string; openedAt: string; ageSeconds: number }[];
};

export async function listRepositories(): Promise<Repository[]> {
  const result = await pool.query<{
    id: string;
    fullName: string;
    productionEnvironment: string;
  }>(
    `SELECT id, full_name AS "fullName", production_environment AS "productionEnvironment"
        FROM repositories
      ORDER BY full_name, id`
  );
  return result.rows.map((row) => ({ ...row, id: Number(row.id) }));
}

export async function repositoryExists(repoId: number): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM repositories WHERE id = $1) AS exists",
    [repoId]
  );
  return result.rows[0]?.exists === true;
}

export async function getMetrics(repoId: number, window: MetricsWindow): Promise<MetricsResponse> {
  const windowDays = days(window);
  const [frequency, failure, mttr, open] = await Promise.all([
    pool.query<{ date: string; count: string; total: string }>(
      `WITH bounds AS (
          SELECT now() AS window_end, now() - make_interval(days => $2::int) AS window_start
          ), days AS (
            SELECT generate_series(
            date_trunc('day', window_end AT TIME ZONE 'UTC') - (($2::int - 1) * interval '1 day'),
            date_trunc('day', window_end AT TIME ZONE 'UTC'),
            interval '1 day'
          ) AS day
          FROM bounds
        ), counts AS (
          SELECT date_trunc('day', created_at AT TIME ZONE 'UTC') AS day, count(*) AS count
            FROM deployments, bounds
          WHERE repo_id = $1 AND is_production AND state = 'success'
            AND created_at >= window_start AND created_at <= window_end
          GROUP BY 1
        )
        SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
                COALESCE(counts.count, 0)::text AS count,
                SUM(COALESCE(counts.count, 0)) OVER ()::text AS total
          FROM days LEFT JOIN counts ON counts.day = days.day
          ORDER BY days.day`,
        [repoId, windowDays]
      ),
      pool.query<{ failed: string; total: string }>(
        `SELECT count(*) FILTER (WHERE state IN ('failure', 'error'))::text AS failed,
                count(*)::text AS total
          FROM deployments
          WHERE repo_id = $1 AND is_production
            AND state IN ('success', 'failure', 'error')
            AND created_at >= now() - make_interval(days => $2::int)
            AND created_at <= now()`,
        [repoId, windowDays]
      ),
      pool.query<{ medianSeconds: number | null; p90Seconds: number | null; resolvedCount: string }>(
        `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (resolved_at - opened_at))) AS "medianSeconds",
                percentile_cont(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (resolved_at - opened_at))) AS "p90Seconds",
                count(*)::text AS "resolvedCount"
          FROM incidents
          WHERE repo_id = $1 AND status = 'resolved'
            AND resolved_at >= now() - make_interval(days => $2::int)
            AND resolved_at <= now()`,
        [repoId, windowDays]
      ),
      pool.query<{ id: string; environment: string; openedAt: string; ageSeconds: number }>(
        `SELECT id, environment, opened_at AS "openedAt",
                EXTRACT(EPOCH FROM (now() - opened_at))::double precision AS "ageSeconds"
          FROM incidents
          WHERE repo_id = $1 AND status = 'open'
          ORDER BY opened_at DESC, id DESC`,
        [repoId]
      )
    ]);
    const failureRow = failure.rows[0] ?? { failed: "0", total: "0" };
    const mttrRow = mttr.rows[0] ?? { medianSeconds: null, p90Seconds: null, resolvedCount: "0" };
    return {
      window,
      generatedAt: new Date().toISOString(),
      deploymentFrequency: {
        total: Number(frequency.rows[0]?.total ?? 0),
        perDay: frequency.rows.map((row) => ({ date: row.date, count: Number(row.count) }))
      },
      changeFailureRate: {
        value: Number(failureRow.total) === 0 ? null : Number(failureRow.failed) / Number(failureRow.total),
        failed: Number(failureRow.failed),
        total: Number(failureRow.total)
      },
      mttr: {
        medianSeconds: mttrRow.medianSeconds === null ? null : Number(mttrRow.medianSeconds),
        p90Seconds: mttrRow.p90Seconds === null ? null : Number(mttrRow.p90Seconds),
        resolvedCount: Number(mttrRow.resolvedCount)
      },
      openIncidents: open.rows.map((row) => ({
        id: row.id,
        environment: row.environment,
        openedAt: new Date(row.openedAt).toISOString(),
        ageSeconds: Math.max(0, Math.floor(Number(row.ageSeconds)))
      }))
    };
  }

  export type Run = {
    id: number;
    environment: string;
    state: string;
    startedAt: string;
    updatedAt: string;
    sha: string | null;
    deploymentUrl: string | null;
  };

  export async function listRuns(repoId: number, limit: number, cursor?: { startedAt: string; id: number }): Promise<{ data: Run[]; nextCursor: string | null }> {
    const result = await pool.query<Run>(
      `SELECT id, environment, state, created_at AS "startedAt", updated_at AS "updatedAt", sha, deployment_url AS "deploymentUrl"
        FROM deployments
        WHERE repo_id = $1
          AND ($3::timestamptz IS NULL OR (created_at, id) < ($3::timestamptz, $4::bigint))
        ORDER BY created_at DESC, id DESC
        LIMIT $2`,
      [repoId, limit + 1, cursor?.startedAt ?? null, cursor?.id ?? null]
    );
    const rows = result.rows.slice(0, limit).map((row) => ({
      ...row,
      id: Number(row.id),
      startedAt: new Date(row.startedAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString()
    }));
    const last = rows.at(-1);
    return { data: rows, nextCursor: result.rows.length > limit && last ? encodeCursor({ startedAt: last.startedAt, id: last.id }) : null };
  }

  export type Incident = { id: string; environment: string; status: "open" | "resolved"; openedAt: string; resolvedAt: string | null; ageSeconds: number | null };

  export async function listIncidents(repoId: number, status: "open" | "resolved" | undefined, limit: number, cursor?: { openedAt: string; id: string }): Promise<{ data: Incident[]; nextCursor: string | null }> {
    const result = await pool.query<Incident>(
      `SELECT id, environment, status, opened_at AS "openedAt", resolved_at AS "resolvedAt",
              CASE WHEN status = 'open' THEN EXTRACT(EPOCH FROM (now() - opened_at))::double precision ELSE NULL END AS "ageSeconds"
        FROM incidents
        WHERE repo_id = $1 AND ($2::incident_status IS NULL OR status = $2::incident_status)
          AND ($4::timestamptz IS NULL OR (opened_at, id) < ($4::timestamptz, $5::uuid))
        ORDER BY opened_at DESC, id DESC
        LIMIT $3`,
      [repoId, status ?? null, limit + 1, cursor?.openedAt ?? null, cursor?.id ?? null]
    );
    const rows = result.rows.slice(0, limit).map((row) => ({
      ...row,
      openedAt: new Date(row.openedAt).toISOString(),
      resolvedAt: row.resolvedAt ? new Date(row.resolvedAt).toISOString() : null,
      ageSeconds: row.ageSeconds === null ? null : Math.max(0, Math.floor(Number(row.ageSeconds)))
    }));
    const last = rows.at(-1);
    return { data: rows, nextCursor: result.rows.length > limit && last ? encodeCursor({ openedAt: last.openedAt, id: last.id }) : null };
  }

  export function encodeCursor(value: object): string {
    return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  }

  export function decodeCursor<T>(value: string): T {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  }
