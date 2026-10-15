# Shipwatch threat model

## Assets and trust boundaries

Assets are GitHub webhook authenticity, deployment and incident history, Slack
destinations, Neon credentials, dashboard access, and alert contents. Trust
boundaries are GitHub to the public webhook, browsers to the dashboard API,
Vercel runtime to Neon/Slack, GitHub Actions to deployment credentials, and
the reconciliation worker to GitHub's REST API.

| Threat | Mitigation | Residual risk | Proving test |
| --- | --- | --- | --- |
| Spoofed webhook | HMAC-SHA256, constant-time comparison, raw-body verification | Secret compromise | invalid-signature unit tests |
| Replayed webhook | Delivery UUID unique constraint and idempotent upserts | Captured request can repeat after deletion | duplicate delivery integration test |
| SSRF via Slack URL | HTTPS and `hooks.slack.com` host allowlist | Slack destination compromise | Slack URL validation test |
| Token leak | Bearer tokens never logged; secrets are server-side; encrypted Slack values | Shared dashboard token is not per-user auth | auth failure test |
| DB credential leak | Vercel secret storage, direct URL only for migrations | Runtime compromise exposes database access | configuration review |
| Poisoned payload | Zod schemas, bounded body size, explicit columns | New GitHub fields require schema review | processor validation tests |
| Log leakage | structured logs exclude payloads, URLs, and credentials | Third-party runtime logs remain a trust boundary | log assertion test |
| Endpoint DoS | request limits, PostgreSQL-backed dashboard limiter | Valid signed webhooks are intentionally not throttled | rate-limit integration test |
| Malicious repository name | Slack escaping and no executable interpolation | Social engineering in rendered text | Slack formatting test |

The reconciliation PAT is read-only and reconciliation stops on 401 or rate
exhaustion. Preview environments use separate data and notification
configuration.
