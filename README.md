# Shipwatch

Shipwatch is a GitHub deployment and workflow monitor that gives engineering teams a polling-based dashboard for delivery health, deployment performance, and incidents.

## Architecture

TODO: Document the two-project Vercel deployment, Neon pooled PostgreSQL, serverless queue processing with `waitUntil`, and polling data flow.

## State Machines

TODO: Document webhook delivery and incident state machines.

## Failure Modes

| Failure mode | Detection | Recovery | Owner |
| --- | --- | --- | --- |
| TODO | TODO | TODO | TODO |

## Benchmarks

TODO: Add baseline and production benchmark results.

## Bugs I Hit

TODO: Record surprising bugs and their fixes.

## Local development

```powershell
npm install
npm run dev
```

See the package READMEs and `.env.example` files for service configuration.

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

## Vercel cron note

The backend `vercel.json` schedules the recovery sweep every five minutes. Vercel documents
100 cron jobs per project on every plan, but Hobby projects are limited to once-daily
cron expressions with per-hour timing precision (±59 minutes). Pro and Enterprise support
once-per-minute schedules with per-minute precision, so the checked-in schedule requires
Pro or Enterprise. Cron jobs run only on production deployments.
