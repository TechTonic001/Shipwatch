# ADR 0004: Vercel and Neon

- **Status:** Accepted
- **Decision:** Deploy the backend and frontend as separate Vercel projects and use
  Neon PostgreSQL; use pooled connections for application queries and a direct connection
  for migrations.
- **Why:** The deployment path is small, supports preview/production separation, and
  keeps relational state, queue claims, and metrics in PostgreSQL.
- **Trade-off:** Serverless execution requires bounded work, periodic sweeps, and a
  pooled client. Cron frequency, cold starts, connection limits, and free-tier quotas
  affect latency and capacity.
- **Evidence:** [deployment runbook](../runbook.md), [`pool.ts`](../../backend/src/db/pool.ts),
  [`backend/vercel.json`](../../backend/vercel.json).
