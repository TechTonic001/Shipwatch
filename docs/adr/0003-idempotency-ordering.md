# ADR 0003: Idempotency keys and event-time guards

- **Status:** Accepted
- **Decision:** Deduplicate inbound events by GitHub delivery ID, domain rows by GitHub
  object IDs, status rows by status ID, and alert transitions by unique dedupe keys.
  Incident transitions compare event timestamps in guarded SQL.
- **Why:** GitHub deliveries can be retried, arrive out of order, or be recovered by
  reconciliation.
- **Trade-off:** Conflicting or incomplete external history may require reconciliation;
  keys prevent duplicate rows but do not provide a globally ordered event stream.
- **Evidence:** [`ingestion.ts`](../../backend/src/services/ingestion.ts),
  [`deploymentStatus.ts`](../../backend/src/services/processors/deploymentStatus.ts),
  [`incidents.ts`](../../backend/src/services/incidents.ts).
