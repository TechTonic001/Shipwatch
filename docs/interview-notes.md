# Shipwatch interview notes

1. **Why verify the raw webhook body?**  
   GitHub's `X-Hub-Signature-256` is an HMAC over the exact bytes. Parsing and
   re-serializing JSON can change whitespace or key ordering, so verification runs
   against the raw body before JSON parsing ([`verifySignature.ts`](../backend/src/middleware/verifySignature.ts)).

2. **How are duplicate webhook deliveries handled?**  
   `delivery_id` is a primary key; ingestion uses `ON CONFLICT DO NOTHING`. The
   acknowledgement reports the duplicate without creating another queue row
   ([`ingestion.ts`](../backend/src/services/ingestion.ts)).

3. **How does the system handle out-of-order deployment events?**  
   Domain rows are upserted by GitHub IDs and statuses are keyed by status ID.
   Incident SQL uses event timestamps and conditional updates. Incident state converges
   for the same valid event set; the denormalized deployment state currently reflects
   arrival order, so status history should be ordered by event time when that distinction
   matters
   ([`deploymentStatus.ts`](../backend/src/services/processors/deploymentStatus.ts),
   [`incidents.ts`](../backend/src/services/incidents.ts)).

4. **What happens if a worker loses its lock?**  
   Its completion update is conditional on the delivery still being `processing` with
   the same `locked_at`. A failed compare-and-set is counted as a lock loss and logged;
   a later sweep can reclaim an expired lock ([`queue.ts`](../backend/src/services/queue.ts)).

5. **Why not exactly-once alert delivery?**  
   PostgreSQL cannot atomically commit with Slack. A crash after Slack accepts a message
   but before the sent-state update can produce a duplicate. The explicit guarantee is
   at-least-once ([`alertDispatcher.ts`](../backend/src/services/alertDispatcher.ts)).

6. **Why PostgreSQL instead of BullMQ?**  
   PostgreSQL is already needed for durable idempotency and transactional incident/outbox
   work. It avoids another service, but is not the choice for unbounded throughput or
   long-running worker jobs ([ADR 0001](adr/0001-postgres-queue.md)).

7. **Why is the webhook acknowledgement separate from processing?**  
   The request stores the delivery and returns; bounded processing is done by the
   five-minute cron sweep. This avoids long webhook requests, but can add queue latency
   ([`routes/webhook.ts`](../backend/src/routes/webhook.ts),
   [`routes/internal.ts`](../backend/src/routes/internal.ts)).

8. **How are processing latency percentiles computed?**  
   A single Postgres statement applies `percentile_cont` to `processed_at - received_at`
   for rows processed during the previous hour. Empty samples return null
   ([`observability.ts`](../backend/src/services/observability.ts)).

9. **How does reconciliation avoid duplicate processing?**  
   It normalizes GitHub REST objects into the same processor shapes used for webhook
   deliveries. Those processors use the same database keys and incident guards
   ([`reconcile.ts`](../backend/src/services/reconcile.ts)).

10. **Why is the operator webhook separate?**  
    Operator threshold notifications are infrastructure health signals; keeping their
    webhook separate prevents them from depending on a repository destination and lets
    the credentials be scoped/rotated independently
    ([`operatorAlerts.ts`](../backend/src/services/operatorAlerts.ts)).

11. **What does change failure rate mean here?**  
    It is the fraction of production deployments with final `failure`/`error` state
    among final `success`/`failure`/`error` outcomes in the selected UTC window.
    It is not incident count divided by deployment count
    ([metrics definition](metrics.md)).

12. **What would be the first scaling change?**  
    Measure queue age, Postgres query latency, and Vercel execution duration with the
    load-test protocol first. If evidence shows queue contention or the five-minute
    cadence is insufficient, move processing to a dedicated worker/broker and preserve
    the same idempotency and outbox boundaries.
