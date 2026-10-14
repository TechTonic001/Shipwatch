# Testing strategy

Shipwatch uses layers with deliberately different guarantees:

| Layer | Proves | Does not prove |
| --- | --- | --- |
| Unit tests | Signature rules, retry decisions, formatting, and pure scenario helpers | PostgreSQL locking, migrations, or network behavior |
| Webhook integration tests | Raw-body handling, persistence, duplicate races, and HTTP responses against real PostgreSQL | GitHub's delivery service or a real Slack endpoint |
| Phase 3/4 integration tests | Transactional incident transitions, alert ordering, and environment matching | Production traffic volume and Neon compute autoscaling |
| Sanitized real-fixture tests | Current payloads still satisfy processor schemas and do not become permanent failures | Authenticity of the captured delivery or external API availability |
| Replay/scenario tests | Signed end-to-end ingestion sequences and database verification when `--db-url` is supplied | A successful response alone does not prove queue processing unless the worker is run |
| CI | Reproducible lint, typecheck, unit, and PostgreSQL-backed integration execution with zero skips | Docker/Testcontainers performance outside the CI runner |

Integration tests intentionally fail when no safe `TEST_DATABASE_URL`, Docker
Testcontainers provider, or CI PostgreSQL service is available. They never skip
database coverage.
