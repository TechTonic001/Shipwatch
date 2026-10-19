# Security configuration

| Variable | Purpose | Secret | Where set | Rotation |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Pooled runtime Neon connection | yes | Vercel backend | Rotate Neon credential, redeploy |
| `DATABASE_URL_DIRECT` | Direct migration connection | yes | GitHub production environment | Rotate Neon credential, update environment secret |
| `GITHUB_WEBHOOK_SECRET` | HMAC verification | yes | Vercel backend | Rotate GitHub webhook and Vercel together |
| `GITHUB_RECONCILE_TOKEN` | Read-only GitHub reconciliation | yes | Vercel backend | Replace fine-grained PAT; Actions/Deployments/Metadata read only |
| `DASHBOARD_READ_TOKEN` | Read-only dashboard bearer token | yes | Vercel backend and user session entry | Replace server value and distribute through the secure prompt |
| `CRON_SECRET` | Bearer authorization for Vercel and GitHub Actions sweep calls | yes | Vercel backend and GitHub Actions repository secrets | Rotate both stores together |
| `ENCRYPTION_KEY` | AES-256-GCM active key, base64 32 bytes | yes | Vercel backend and migration job | Set `ENCRYPTION_KEY_OLD`, deploy, run `encrypt-secrets`, then remove old key |
| `ENCRYPTION_KEY_OLD` | Temporary decryption key during rotation | yes | Vercel backend during rotation | Remove after all rows are re-encrypted |
| `SLACK_WEBHOOK_URL` | Default Slack destination | yes | Vercel backend | Rotate Slack webhook and redeploy |
| `OPERATOR_SLACK_WEBHOOK_URL` | Separate operator health-alert destination | yes | Vercel backend / production environment | Rotate the dedicated operator Slack webhook; do not reuse a repository webhook |
| `OPERATOR_ALERT_BACKLOG_THRESHOLD` | Number of pending/failed alerts that triggers an operator notice | no | Vercel backend | Adjust based on observed backlog; default is 10 |
| `NEON_AUTH_BASE_URL` | Optional auth service URL | no | Vercel backend | Change with provider configuration |
| `NEON_AUTH_JWKS_URL` | Optional JWKS URL | no | Vercel backend | Change with provider configuration |
| `FRONTEND_ORIGIN` | Strict CORS origin | no | Vercel backend | Change with frontend domain |

The encryption migration is resumable and idempotent. Plaintext Slack URLs are
never logged. GitHub reconciliation is disabled with an operator-visible warning
when its token is absent.

GitHub webhook replay protection relies on delivery-id uniqueness because GitHub
does not send a signed timestamp header. A captured valid request can be replayed
but cannot create a second delivery or duplicate alert; it can still repeat the
same accepted event if the original row is deleted.
