# Observability and operator diagnostics

## Internal stats API

`GET /api/internal/stats` requires `Authorization: Bearer <CRON_SECRET>` and returns
`Cache-Control: no-store`. It is intended for operators and cron tooling, not the public
dashboard. The response includes:

- `queueDepthByStatus`: delivery rows grouped by status, with zero-filled known states.
- `oldestPendingDeliveryAgeSeconds`: age of the oldest `received` or `failed` delivery.
- `deadDeliveries`, `deadAlerts`, and `alertBacklog` (pending plus failed alerts).
- `processingLatencySeconds.p50/p95/p99`: `percentile_cont` over
  `processed_at - received_at` for deliveries processed during the preceding hour.
- `retryRate`: attempts greater than one divided by all delivery rows; `value` is null
  only when no delivery rows exist.
- `suppressedAlerts` and cumulative `lockLostCount`.

The SQL that generates the response is a single statement in
[`observability.ts`](../backend/src/services/observability.ts). Percentiles use seconds.
Dead/suppressed/retry/lock-loss counts are current lifetime counts, not one-hour rates.

## Operator alerts

The sweep checks three conditions:

| Condition | Fires when |
| --- | --- |
| Dead delivery or alert | `deadDeliveries > 0` or `deadAlerts > 0` |
| Oldest pending delivery | age is greater than 600 seconds |
| Alert backlog | pending plus failed alerts is greater than `OPERATOR_ALERT_BACKLOG_THRESHOLD` (default 10) |

Each threshold has a persistent state and generation. A false-to-true transition creates
one firing event; true-to-false creates one recovery event. The event key prevents duplicate
transition rows. Delivery is retried from a PostgreSQL outbox. As with repository alerts,
an uncertain Slack response or crash after Slack accepts the message can result in a
duplicate; the database cannot atomically commit a remote Slack request.

Set `OPERATOR_SLACK_WEBHOOK_URL` to a separate operator channel, not a repository's
notification destination. When absent, the state transition is retained and the outbox
remains pending, with an operator-visible structured error log.

## Structured log schema

Every backend pino event includes `event`, `outcome`, `durationMs`, `requestId`, and
`deliveryId`. Optional fields are low-sensitivity identifiers or counts. Payloads,
authorization values, webhook URLs, and error messages are not logged.

| Event | Example outcomes | Question it answers |
| --- | --- | --- |
| `backend_start` | `listening` | Did the backend process start and on which port? |
| `database_pool` | `error` | Did an idle PostgreSQL pool connection fail? |
| `database_connection` | `connected`, `failed` | Can this process reach PostgreSQL? |
| `http_request` | `error` | Did an HTTP request reach the global error handler? |
| `github_webhook` | `ingested`, `duplicate`, `ignored`, `bad_request`, `invalid_signature`, `persist_failed` | Was a delivery accepted, rejected, or already stored? |
| `webhook_rate_limit` | `unavailable` | Did Postgres-backed protection for invalid signatures fail open? |
| `queue_reap` | `failed` | Did stale-lock poison reaping fail? |
| `queue_claim` | `failed` | Did the worker fail to claim a batch? |
| `queue_process` | `failed` | Did processing one delivery fail? |
| `queue_lock` | `lost` | Did this worker lose ownership before its compare-and-set update? |
| `alert_dispatch` | `destination_unavailable`, `failed` | Did alert dispatch or decryption fail? |
| `operator_alert_delivery` | `configuration_missing`, `sent`, `retry_scheduled` | Did a firing or recovery message reach the operator destination? |
| `github_reconciliation` | `disabled`, `failed` | Is reconciliation disabled or did a repository pass fail? |
| `sweep` | `completed` | Did the authorized sweep finish its phases? |

## SQL cookbook: “Why is nothing arriving?”

Run these read-only queries in the Neon SQL editor for the intended branch.
This is a docs-only operator status view because queue telemetry is operationally
sensitive and `/api/internal/stats` is intentionally protected by `CRON_SECRET`;
it should not be mixed into the read-only dashboard token surface.

### Is anything being acknowledged?

```sql
SELECT status, count(*) AS deliveries,
       min(received_at) AS oldest_received,
       max(received_at) AS newest_received
FROM webhook_deliveries
WHERE received_at >= now() - interval '24 hours'
GROUP BY status
ORDER BY status;
```

No rows usually means GitHub is not reaching the configured webhook URL. Rows in
`received` or `failed` point to worker/sweep/database errors; `dead` rows need payload
or processor inspection.

### Is the sweep leaving a backlog?

```sql
SELECT delivery_id, event_type, status, attempts, next_attempt_at,
       locked_at, received_at, processed_at, last_error
FROM webhook_deliveries
WHERE status IN ('received', 'processing', 'failed', 'dead')
ORDER BY received_at
LIMIT 50;
```

Compare `locked_at` to the 90-second stale-lock interval and `next_attempt_at` to now.
Do not manually reset processing rows until confirming no worker still owns them.

### Were events converted into domain rows?

```sql
SELECT
  (SELECT count(*) FROM deployments) AS deployments,
  (SELECT count(*) FROM deployment_statuses) AS deployment_statuses,
  (SELECT count(*) FROM workflow_runs) AS workflow_runs,
  (SELECT count(*) FROM incidents WHERE status = 'open') AS open_incidents;
```

### Are Slack alerts queued or terminal?

```sql
SELECT status, kind, count(*) AS alerts,
       min(created_at) AS oldest_created
FROM alerts
GROUP BY status, kind
ORDER BY status, kind;
```

### What does the protected operational endpoint report?

```powershell
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Headers $headers -Uri "$env:BACKEND_URL/api/internal/stats"
```

Do not paste tokens, webhook URLs, raw payloads, or database connection strings into
tickets or shared logs.
