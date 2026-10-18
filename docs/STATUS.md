# Shipwatch QA/SRE Status

Audit date: 2026-10-18. This report records only checks actually run in this workspace. Phase labels follow migration names and repository docs; the initial foundation and dashboard phases are inferred where not explicitly numbered.

## Phase Status

| Feature | Implemented | Tested | Verified running | Evidence |
|---|---|---|---|---|
| Foundation / Phase 1: PostgreSQL delivery, repository, deployment, incident, and alert schema | YES in migrations; canonical `backend/db/schema.sql` remains a TODO placeholder | NOT VERIFIED against PostgreSQL | NOT VERIFIED | `backend/db/migrations/000_foundation.sql`, `001_baseline.sql`; no safe database provider available |
| Phase 2: signed webhook intake, idempotent persistence, queue processing and retry | YES in source | Unit signature tests pass; integration persistence NOT VERIFIED | Signed `ping` returned 200; event persistence NOT VERIFIED (500 without PostgreSQL) | `backend/src/middleware/verifySignature.ts`, `backend/src/services/ingestion.ts`, `backend/src/services/queue.ts`; `backend/tests/integration/webhook.test.ts` could not initialize |
| Phase 3: incident transitions and Slack alert outbox | YES in source | Unit coverage passes; PostgreSQL integration NOT VERIFIED | NOT VERIFIED | `backend/src/services/incidents.ts`, `backend/src/services/alerts.ts`; 7 integration tests blocked |
| Phase 4: case/whitespace-insensitive production environment matching | YES in source/migration | PostgreSQL integration NOT VERIFIED | NOT VERIFIED | `backend/db/migrations/004_phase4.sql`; 4 integration tests blocked |
| Phase 5: deployment frequency, change failure rate, MTTR API | YES in source; lead time is explicitly out of scope | Contract schemas/unit checks pass; real query behavior NOT VERIFIED | NOT VERIFIED | `backend/src/services/metrics.ts`, `backend/src/routes/metrics.ts`, `docs/metrics.md` |
| Phase 6: React dashboard, typed API, charts, incidents and runs | YES in source | VERIFIED: frontend Vitest 12/12 and Edge Playwright 2/2 | Frontend preview returned 200; dashboard live data NOT VERIFIED because backend database reads return 500 | `frontend/src/pages/Dashboard.tsx`, `frontend/e2e/dashboard.spec.ts`; local preview `http://127.0.0.1:5174/` |
| Phase 7: reconciliation, workflow-run storage and rate limiting | YES in source/migration | NOT VERIFIED against PostgreSQL/GitHub API | NOT VERIFIED | `backend/src/services/reconcile.ts`, `backend/src/services/rateLimit.ts`, `backend/db/migrations/005_phase7.sql` |
| Phase 8: operational stats and operator alert transitions | YES in source/migration | Unit coverage passes; PostgreSQL integration NOT VERIFIED | NOT VERIFIED | `backend/src/services/observability.ts`, `backend/src/services/operatorAlerts.ts`, `backend/db/migrations/006_phase8.sql`; 3 integration tests blocked |
| Deployment and contract checks: CORS, auth, Vercel SPA fallback, signed ping | YES in source; missing webhook delivery header in verifier was fixed during audit | Local verifier and route probes run; DB-backed checks NOT VERIFIED | CORS, SPA routes, health/version, signed ping verified locally; authenticated repository reads NOT VERIFIED | `scripts/verify-deploy.ts`, `backend/src/index.ts`, `frontend/vercel.json`; results below |

## Commands And Results

### Install, static checks, builds

- `npm ci`: FAILED with Windows `EPERM` unlinking a loaded Rollup native binary. Existing Node processes were left untouched.
- `npm install`: completed; `npm ls --depth=0` showed both workspaces installed. npm reported 20 vulnerabilities (9 moderate, 9 high, 2 critical).
- `npm run lint`: PASS for backend and frontend.
- `npm run typecheck`: PASS for backend and frontend.
- `npm run build`: PASS for backend TypeScript and frontend Vite production build.
- `npm run test --workspace frontend`: PASS, 2 files / 12 tests.
- `npm run test:e2e --workspace frontend`: PASS, 2 Playwright tests (responsive/accessibility and demo isolation).
- `npm run test:unit --workspace backend`: PASS, 12 files / 30 tests.
- `npm test --workspace backend`: NOT PASS. Unit tests passed; integration tests could not start because `TEST_DATABASE_URL` is unset and Docker's daemon is unavailable. The complete suite is NOT VERIFIED against real PostgreSQL.
- `npm audit --omit=dev`: NOT VERIFIED; npm registry DNS resolution failed (`ENOTFOUND registry.npmjs.org`). Do not infer package-level fixes from the install summary.

The backend integration attempt reported 15 tests skipped after setup failure: `phase3.test.ts` 7, `phase4.test.ts` 4, `phase8.test.ts` 3, and `realFixtures.test.ts` 1. `webhook.test.ts` failed suite setup before collecting cases. They are blocked, not passing. Teardown guards were added for setup failures; the rerun reports the primary missing-database errors without secondary `undefined.end()` failures.

Source scan for `describe.skip`, `it.skip`, `test.skip`, `.todo`, or `.only(` found zero checked-in matches. The focused frontend run selected one test and showed 9 filter-excluded tests as skipped; the unfiltered frontend run passed all 12. The backend's 15 setup-blocked skips above are the only test cases skipped by the full backend attempt.

### Local API status matrix

The backend ran on `127.0.0.1:4918` with synthetic credentials and an unreachable loopback `shipwatch_test` database. No Neon or production URL was used. “dashboard” means a synthetic dashboard bearer token; “cron” means a synthetic cron bearer token. A webhook's GitHub signature is its authentication, not the dashboard/cron token.

| Method | Endpoint | Credentials | Status |
|---|---|---|---:|
| GET | `/healthz` | none / dashboard | 200 / 200 |
| GET | `/api/version` | none / dashboard | 200 / 200 |
| GET | `/readyz` | none / dashboard | 500 / 500 |
| GET | `/api/repos` | none / dashboard | 401 / 500 |
| GET | `/api/repos/1/metrics?window=7d` | none / dashboard | 401 / 500 |
| GET | `/api/repos/1/runs?limit=10` | none / dashboard | 401 / 500 |
| GET | `/api/repos/1/incidents?limit=10` | none / dashboard | 401 / 500 |
| GET | `/api/internal/sweep` | none / cron | 401 / 500 |
| POST | `/api/internal/sweep` | none / cron | 401 / 500 |
| GET | `/api/internal/stats` | none / cron | 401 / 500 |
| POST | `/api/webhooks/github` | unsigned, with or without dashboard token | 400 / 400 |
| POST | `/api/webhooks/github` | valid signed ping, with or without dashboard token | 200 / 200 |

Database-dependent 500s are expected from this isolated run and do not prove a healthy database deployment. `/healthz`, CORS, Vercel-style frontend home/deep link, and a signed ping passed; readiness and authenticated data/sweep routes did not.

### Signed scenario replay

All requested scenarios were sent to the local backend after the replay CLI was fixed to fail on non-2xx responses. The database was unreachable, so no persistence/state verification was possible. Every command correctly exited 1.

| Scenario | Sent | 2xx | 4xx | 5xx | Duplicate acknowledgements | HTTP result | Database verification |
|---|---:|---:|---:|---:|---:|---|---|
| `happy-deploy` | 2 | 0 | 0 | 2 | 0 | FAIL | NOT VERIFIED |
| `failed-deploy-then-recover` | 2 | 0 | 0 | 2 | 0 | FAIL | NOT VERIFIED |
| `flapping` | 3 | 0 | 0 | 3 | 0 | FAIL | NOT VERIFIED |
| `out-of-order-run` | 2 | 0 | 0 | 2 | 0 | FAIL | NOT VERIFIED |
| `status-before-deployment` | 2 | 0 | 0 | 2 | 0 | FAIL | NOT VERIFIED |
| `duplicate-storm` | 20 | 0 | 0 | 20 | 0 | FAIL | NOT VERIFIED |

Latency samples were printed by the replayer, but are not treated as performance evidence because all responses failed before persistence. The required database verification table cannot be produced truthfully without a working PostgreSQL URL; the table above records actual HTTP outcomes and explicitly marks DB state NOT VERIFIED.

### Local deployment verifier

`npm exec -- tsx scripts/verify-deploy.ts http://127.0.0.1:4918 http://127.0.0.1:5174 qa-local-dashboard-token qa-local-fixture-secret` printed:

```text
PASS: backend /healthz 200 (status=200)
FAIL: backend /readyz 200 (status=500)
PASS: unauthenticated /api/repos -> 401 JSON (status=401; content-type=application/json; charset=utf-8)
FAIL: authenticated /api/repos -> 200 JSON (status=500; content-type=application/json; charset=utf-8)
PASS: CORS preflight from FRONTEND_URL -> allowed (status=204; ACAO=http://127.0.0.1:5174)
PASS: CORS preflight from evil.example -> blocked (status=403; ACAO=none)
PASS: frontend returns 200 HTML (status=200; content-type=text/html)
PASS: deep link /anything -> 200 (status=200; content-type=text/html)
PASS: frontend bundle excludes localhost and token (assets=2)
PASS: signed ping to /api/webhooks/github returns 200 (status=200)
```

The verifier exits non-zero due readiness and authenticated database-backed reads, as expected for the isolated setup. A Node libuv assertion was printed during shutdown after the checks; the individual HTTP results above were already collected.

## TODOs And Stubs

The source grep for `TODO` and `not implemented` found:

- `backend/db/schema.sql:1` — `TODO: I will paste the SQL.` The file is not a canonical schema snapshot.
- `backend/src/routes/webhook.ts:64` — `TODO(phase-2): waitUntil(processBatch()) after persistence is complete.` Current architecture documents sweep-driven processing instead; this TODO is stale and misleading.

No `not implemented` text was found. Additional no-op compatibility stubs (found by searching `stub`) are:

- `backend/src/services/alerts.ts` — `sendSlackAlert`.
- `backend/src/services/incidents.ts` — `openIncident` and `resolveIncident`.

They have no current callers in `backend/src`; removal was not attempted because they are exported compatibility APIs. Test `vi.stubGlobal`/`vi.stubEnv` uses are test utilities, not product stubs.

## Top Problems By Severity

1. **Critical blocker: no real PostgreSQL verification.** No `TEST_DATABASE_URL` was provided and Docker daemon access failed. Readiness, authenticated reads, sweeps, persistence, six replay states, and the full backend integration suite remain NOT VERIFIED. No database credentials were changed or used; provide a disposable test database or start Docker to close this.
2. **High, fixed: webhook requests previously hung.** `startWebhookRequest` recorded request metadata but did not call `next()`. A regression test reproduced a 60-second timeout; middleware now calls `next()`, the focused test passes, and a live malformed request returns 400.
3. **High blocker: all six event replay scenarios failed at persistence.** Actual results were all `5xx`, zero duplicate acknowledgements, and no SQL state check. They exit nonzero now; scenario correctness remains NOT VERIFIED until rerun against PostgreSQL.
4. **High, fixed: integration setup failures caused teardown exceptions.** Three `afterAll` hooks unconditionally dereferenced resources whose setup had failed. Teardown is guarded; the rerun now exposes only the real database-provider failure. Integration behavior is still NOT VERIFIED.
5. **High, fixed: deploy verifier sent an invalid signed ping.** It omitted `X-GitHub-Delivery`; a UUID is now included. The local signed ping check passes with status 200.
6. **High, unresolved: security advisory details unavailable.** `npm install` reported 20 vulnerabilities (9 moderate, 9 high, 2 critical); `npm audit --omit=dev` could not reach the registry. No blind dependency upgrades were made. Re-run audit with registry access and triage affected production packages.
7. **Medium, unresolved: `backend/db/schema.sql` is still a TODO placeholder.** The test helper falls back to migrations, but docs refer to schema application/snapshot behavior. No canonical schema replacement was attempted without PostgreSQL to validate migration equivalence.
8. **Medium, unresolved: replay database verification is optional.** The replayer only queries actual delivery/alert state when `--db-url` is supplied. The HTTP result is now fail-closed, but do not treat 2xx responses alone as scenario verification; use a disposable DB and pass `--db-url`.
9. **Medium, unresolved: three exported compatibility stubs are no-ops.** They have no current callers in backend source; they were left in place to avoid changing exported API behavior without a request to remove them.
10. **Low, unresolved: stale webhook `waitUntil` TODO contradicts sweep-driven architecture.** No feature was added; update or remove this comment when cleaning documentation so it does not imply background processing is missing from the current design.

## Fixes Applied During Audit

- Advanced webhook middleware with Express `next()` and added a regression test.
- Guarded integration suite cleanup when PostgreSQL setup fails.
- Made replay script importable in tests and nonzero on any non-2xx response; added classifier tests.
- Added the required GitHub delivery UUID to the deployment verifier's signed ping.
