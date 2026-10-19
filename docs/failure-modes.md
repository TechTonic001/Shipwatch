# Failure modes

| Failure | Behavior | Proving test |
| --- | --- | --- |
| Bad signature | Return 401 and write no row. | `tests/integration/webhook.test.ts` |
| Tampered body | Raw-byte HMAC fails with 401. | `tests/unit/verifySignature.test.ts` |
| Duplicate delivery | Return 200 with `duplicate: true`; keep one row. | `tests/integration/webhook.test.ts` |
| Concurrent duplicates | PostgreSQL conflict handling keeps one row without errors. | `tests/integration/webhook.test.ts` |
| DB down | Return 500 with `persist failed`; do not crash the process. | `tests/integration/webhook.test.ts` |
| Invalid JSON | Verify signature first, then return 400 without writing. | `tests/integration/webhook.test.ts` |
| Oversized payload | Raw parser rejects payloads over 1 MiB with 413. | `tests/integration/webhook.test.ts` |
| Unknown event | Return 200 with `ignored: true`; write no row. | `tests/integration/webhook.test.ts` |
| Environment case/whitespace mismatch | Compare deployment and configured production names with `lower(btrim(...))`; `Production` is production and `Preview` is not. | `tests/integration/phase4.test.ts` |
| Fixture drift | Sanitized captures are schema-validated and processed; invalid processor payloads fail the suite as permanent errors. | `tests/integration/realFixtures.test.ts` |
| Slack down | Keep the alert failed with a future retry time. | `tests/integration/phase3.test.ts` |
| Slack 429 | Retry using bounded `Retry-After` or exponential backoff. | `tests/unit/slack.test.ts` |
| Revoked webhook URL | Mark the alert dead without retrying. | `tests/unit/slack.test.ts` |
| Crash after commit before send | The pending outbox row is delivered by the dispatcher/sweep. | `tests/integration/phase3.test.ts` |
| Crash after send before mark sent | A duplicate is accepted under at-least-once delivery. | Dispatcher CAS contract |
| Flapping pipeline | Cooldown and suppression preserve every alert row for audit. | Alert outbox integration tests |
| Late failure event | A failure superseded by a newer deployment is ignored. | `tests/integration/phase3.test.ts` |
| Muted repo | Alerts are inserted as suppressed and never sent. | Alert outbox integration tests |
| Sweeper delayed or disabled | Webhook validation and inline persistence continue; stuck deliveries wait for the next successful sweep. Detect growing delay from `stats.oldestPendingDeliveryAgeSeconds` in the sweep summary. | `backend/src/routes/internal.ts`, `backend/src/services/observability.ts` |
| Missing destination | Alerts are suppressed with `no_destination`, not failed. | Dispatcher integration test |
| Malicious repo name in message | Slack markup and mentions are escaped. | `tests/unit/slack.test.ts` |
