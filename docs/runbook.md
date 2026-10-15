# Production deployment runbook

## Release path

Production uses GitHub Actions plus the Vercel CLI. Git integration must be
disabled on both Vercel projects; otherwise Vercel would independently deploy
the same `main` commit and create duplicate production activity. The GitHub
Environment is named `production`, matching the configured
`production_environment` value (`production`). Repository ingestion compares
environment names case-insensitively.

The workflow creates one GitHub Deployment, runs direct Neon migrations, deploys
the backend, verifies `/healthz` and `/readyz`, deploys the frontend, then
checks the backend-reported build SHA.

## Rollback

1. In the backend or frontend Vercel project, select the last known-good
   deployment and use **Promote to Production** / **Instant Rollback**.
2. Smoke-test the production URLs and compare `/healthz` `sha`.
3. Do not roll back database migrations. Apply a compatible forward-fix before
   redeploying if the schema change caused the incident.
4. Record the incident, deployment SHA, migration state, and follow-up issue.

Manual redeploys use **Actions → Deploy production → Run workflow** and may
provide a previously released commit SHA.

## Preview isolation

PR previews are deployed with the Vercel CLI and use a pre-created, non-
production Neon branch URL stored in the `preview` GitHub Environment. They do
not run production migrations, use a non-delivering Slack placeholder, and
must not receive production `DATABASE_URL_DIRECT`, `SLACK_WEBHOOK_URL`, or
dashboard secrets. Fork pull requests are excluded because their secrets are
not trusted.
