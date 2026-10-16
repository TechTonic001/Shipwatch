# ADR 0001: Use PostgreSQL as the webhook queue

- **Status:** Accepted
- **Decision:** Store delivery work in `webhook_deliveries` and claim with
  `FOR UPDATE SKIP LOCKED`.
- **Why:** The application already needs PostgreSQL for idempotency, domain rows, and
  incident/outbox transactions. A separate broker would add infrastructure and another
  consistency boundary.
- **Trade-off:** Database queue throughput and the five-minute sweep cadence are bounded;
  a dedicated broker/worker may be appropriate if measured backlog or write contention
  grows.
- **Evidence:** [`queue.ts`](../../backend/src/services/queue.ts),
  [`worker.ts`](../../backend/src/services/worker.ts).
