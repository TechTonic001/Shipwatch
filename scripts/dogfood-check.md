# Shipwatch dogfood check

1. Deploy `main` through the production workflow and note the SHA from
   `/healthz`.
2. Send a signed GitHub `ping` or deployment webhook to the production backend.
   In Postgres, confirm rows exist for that delivery in
   `webhook_deliveries`, the resulting deployment in `deployments`, and its
   status history in `deployment_statuses`.
3. To force a controlled failure, deploy a branch that changes only the
   backend smoke contract (for example, make `/healthz` return a non-200
   response) through a temporary, reviewed test commit. Do not merge it.
   Confirm the production-like test repository receives a failed production
   deployment, an open incident, and an `incident_opened` alert. Verify the
   alert worker sends the configured Slack notification.
4. Revert the test change and deploy a known-good commit. Confirm a success
   deployment resolves the incident, sets `resolved_at`, and records a
   positive duration in the resolved alert payload.

Run this only against an isolated dogfood repository/database when forcing a
failure. Never intentionally break the production endpoint.
