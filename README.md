# Shipwatch

Shipwatch turns GitHub deployment and workflow webhooks into a PostgreSQL-backed DORA-style dashboard, incident timeline, and alert outbox.

**Live service:** `[production URL to be added]` · **Demo GIF:** `[record and add demo GIF]`

## Why this exists

GitHub's deployment and Actions views are useful for inspecting individual repositories and runs. Shipwatch puts deployment frequency, change failure rate, recovery time, incident history, and workflow runs in one small dashboard across the repositories it is configured to ingest. It is not a replacement for GitHub's source-of-truth event history or a full observability platform such as Datadog: it has no traces, host metrics, log search, or broad service catalog. Metric definitions and their limits are in [docs/metrics.md](./docs/metrics.md).

## Architecture

```mermaid
flowchart LR
  GH[GitHub webhooks] -->|raw-body HMAC| API[Backend on Vercel]
  API -->|persist + acknowledge| DB[(Neon PostgreSQL)]
  GHCRON[GitHub Actions sweep, every five minutes] -->|POST| API
  VCRON[Vercel daily backstop] -->|GET| API
  API -->|claim / process / retry| DB
  API -->|at-least-once outbox| SLACK[Slack]
  DB -->|authenticated reads| API
  API -->|JSON polling every 10s| UI[React dashboard on Vercel]
  API -->|GitHub REST reconciliation| GHAPI[GitHub API]
  GHAPI --> API
```

The webhook request is acknowledged after persistence. Queue work is recovered by the
five-minute sweep; this deployment does not use background `waitUntil` processing.
The dashboard polls because the data volume and update cadence do not justify an SSE
connection and its serverless lifecycle complexity. See [docs/architecture.md](./docs/architecture.md).

## Quickstart (under 10 minutes, assuming PostgreSQL is available)

Prerequisites: Node 20+, npm, a disposable PostgreSQL database, and a shell. Do not use
production database credentials for local demo data.

1. Install packages and apply the checked-in migrations to a database whose name
   includes `test`:

   ```powershell

   $env:DATABASE_URL = "postgres://user:password@localhost:5432/shipwatch_test"
   cd backend
   npm run migrate
   ```

2. Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL`,
   `GITHUB_WEBHOOK_SECRET`, `CRON_SECRET`, `DASHBOARD_READ_TOKEN`, and a syntactically
   valid `SLACK_WEBHOOK_URL`. Keep real secrets out of git. For local development, use
   a non-delivering Slack URL unless you intentionally want notifications.
3. Start the backend on port 3000 in one terminal:

   ```powershell
   cd backend
   npm run dev
   ```

4. In a second terminal, start the dashboard:

   ```powershell
   cd frontend
   npm ci
   npm run dev
   ```

5. In a third terminal, seed the deterministic demo repository and process its events:

   ```powershell
   cd backend
   npm run seed-demo -- --url http://localhost:3000/api/webhooks/github --reset
   ```

   The script uses the configured database and GitHub webhook secret. Open
   `http://localhost:5173`, enter the dashboard read token, and select `demo/storefront`.
   The seed is muted to avoid sending Slack messages. For database setup details see
   [docs/migrations.md](./docs/migrations.md).

## State machines

The four operational state machines are summarized in [docs/state-machines.md](./docs/state-machines.md):

1. Webhook deliveries: received → processing → processed/ignored, or retry → dead.
2. Deployment status: status events are idempotently recorded and the current deployment state converges by event time.
3. Incidents: production failure opens; a newer production success resolves.
4. Alert outbox: pending/failed → sent, dead, or suppressed; operator alerts have firing and recovery transitions.

## Failure modes

| Failure | Behavior | Proving test or implementation |
| --- | --- | --- |
| Invalid webhook signature | Return 401 before persistence; invalid attempts are rate-limited. | [verifySignature.test.ts](./backend/tests/unit/verifySignature.test.ts), [webhook.test.ts](./backend/tests/integration/webhook.test.ts) |
| Duplicate delivery ID | A unique delivery key makes ingestion idempotent and returns `duplicate: true`. | [webhook.test.ts](./backend/tests/integration/webhook.test.ts), [ingestion.ts](./backend/src/services/ingestion.ts) |
| Worker dies with a claimed row | A stale lock permits a later sweep to reclaim it; exhausted stale rows are dead-lettered. | [queue.ts](./backend/src/services/queue.ts), [kill-mid-processing.ps1](./scripts/drills/kill-mid-processing.ps1) |
| Slack unavailable | Alert remains retryable with backoff; dispatch is at-least-once. | [slack.test.ts](./backend/tests/unit/slack.test.ts), [phase3.test.ts](./backend/tests/integration/phase3.test.ts) |
| Processed alert for recovered incident | Open and recovery notices are suppressed when the incident recovered before delivery. | [alerts.test.ts](./backend/tests/unit/alerts.test.ts), [state-machines.md](./docs/state-machines.md) |
| Database unavailable | Readiness or request fails; the webhook is not acknowledged as persisted. | [health.ts](./backend/src/routes/health.ts), [webhook.test.ts](./backend/tests/integration/webhook.test.ts) |
| Event gap after lost webhook | Reconciliation fetches recent GitHub records and runs the shared processors. | [reconcile.ts](./backend/src/services/reconcile.ts), [runbook.md](./docs/runbook.md) |
| Operator threshold clears | A separate recovery event is queued after a firing notification. | [operatorAlerts.ts](./backend/src/services/operatorAlerts.ts), [006_phase8.sql](./backend/db/migrations/006_phase8.sql) |

## Benchmarks

No throughput or latency result is published yet. The reproducible k6 shapes,
verification procedure, and blank result template are in
[loadtest/RESULTS.md](./loadtest/RESULTS.md). Results must be measured against a
disposable Neon branch and reported with deployment and region details.

## Design decisions and trade-offs

- **PostgreSQL queue vs. BullMQ:** PostgreSQL already holds the event and domain
  transaction. `FOR UPDATE SKIP LOCKED`, bounded sweeps, retries, and an outbox avoid
  another broker, at the cost of throughput and queue isolation at high volume.
- **At-least-once alerts:** PostgreSQL and Slack cannot share a transaction. A crash
  after Slack accepts a message but before the sent-state commit can duplicate a notice.
- **Polling vs. SSE:** polling every 10 seconds is simple and works with short-lived
  serverless requests. It adds periodic read traffic and is not a real-time stream.
- **Vercel + Neon:** the app uses Vercel deploys and pooled PostgreSQL connections while
  migrations use a direct connection. It keeps the deployment footprint small, but
  cron cadence, connection behavior, free-tier quotas, and scale-to-zero affect latency.
- **Reconciliation:** it repairs missing GitHub events but depends on REST API access,
  rate limits, and the configured retention/watermark window; it is not a complete event
  archive.

## Known limitations

- No lead time for changes because commit-to-deployment linkage is not modeled.
- Single-tenant configuration; there is no user/organization authorization model.
- GitHub webhooks are configured directly; there is no GitHub App installation flow.
- Event processing is sweep-driven, so ingestion acknowledgement is faster than domain
  processing and the recovery sweep cadence is five minutes.
- The current dashboard is a polling read-only view, not an incident-management console.
- Free-tier Vercel/Neon limits may constrain cron cadence, compute, concurrency, and
  retention.

## What I would do next

1. Run the load shapes against a staging Neon branch and publish measured results.
2. Add real PostgreSQL coverage for reconciliation, encryption rotation, and operator
   alert transitions before promoting those paths.
3. Add a GitHub App and explicit tenant authorization if Shipwatch becomes multi-user.
4. Revisit worker throughput only after queue-age and latency measurements identify a
   bottleneck.

## Local development and verification

```powershell
npm run lint
npm run typecheck
npm test
```

The real PostgreSQL integration suite requires `TEST_DATABASE_URL` or Docker/Testcontainers.
It is intentionally not skipped when PostgreSQL is unavailable. See
[docs/testing-strategy.md](./docs/testing-strategy.md).

## Running tests

Run the unit suite without a database:

```powershell
npm run test:unit --workspace backend
```

Run the real PostgreSQL integration suite with a local PostgreSQL instance or an
isolated Neon test branch. The database name or URL must contain `test`; never point
`TEST_DATABASE_URL` at production:

```powershell
$env:TEST_DATABASE_URL = "postgres://shipwatch:shipwatch@localhost:5432/shipwatch_test"
npm run test:integration --workspace backend
```

If the environment does not provide `TEST_DATABASE_URL`, the integration suite starts
PostgreSQL 16 through Docker/Testcontainers:

```powershell
docker info
npm run test:integration --workspace backend
```

CI runs the same integration suite against its PostgreSQL service. A missing provider
is a hard failure; tests are never skipped because a database is unavailable. To use a
Neon branch, use its dedicated test database URL and keep it separate from `DATABASE_URL`.

## Separate development servers

Run these commands in separate terminals when developing the frontend and backend
independently:

```powershell
cd backend
npm run dev
```

The backend uses Nodemon and runs on `http://localhost:3100`.

```powershell
cd frontend
npm run dev
```

The frontend uses Vite and runs on `http://localhost:5173`.

Neon provisioning is declared in [neon.ts](./neon.ts). The backend consumes Neon’s pooled
`DATABASE_URL` through `pg`, and validates the pulled Neon Auth and Function URLs as typed
configuration. Authentication and domain processing remain intentionally stubbed.

## Scheduling

The primary recovery sweep is `.github/workflows/sweep.yml`: GitHub Actions sends an
authenticated `POST` every five minutes, with a manual `workflow_dispatch` option.
GitHub scheduled runs can be delayed during high load; schedules in public repositories
are disabled after 60 days without repository activity. Webhook validation and inline
persistence continue to work, but queued events that need processing wait until the next
successful sweep. The response's `stats.oldestPendingDeliveryAgeSeconds` indicates the
age of the oldest queued delivery.

`backend/vercel.json` retains a once-daily `03:00 UTC` Vercel Cron as a backstop, which is
compatible with Hobby's daily limit and per-hour timing precision. Vercel Cron invokes
`GET`; GitHub Actions invokes `POST`. Both require the same bearer `CRON_SECRET`.

Set `CRON_SECRET` in the backend Vercel project's production environment and as a GitHub
Actions repository secret. Set `SWEEP_URL` as a GitHub Actions repository secret to the
full backend sweep URL (`https://<backend-domain>/api/internal/sweep`). Keep both values
out of source control and logs.
