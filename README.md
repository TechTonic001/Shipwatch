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

Neon provisioning is declared in [neon.ts](./neon.ts). The backend consumes Neon’s pooled
`DATABASE_URL` through `pg`, and validates the pulled Neon Auth and Function URLs as typed
configuration. Authentication and domain processing remain intentionally stubbed.

## Vercel cron note

The backend `vercel.json` schedules the recovery sweep every five minutes. Vercel documents
100 cron jobs per project on every plan, but Hobby projects are limited to once-daily
cron expressions with per-hour timing precision (±59 minutes). Pro and Enterprise support
once-per-minute schedules with per-minute precision, so the checked-in schedule requires
Pro or Enterprise. Cron jobs run only on production deployments.
