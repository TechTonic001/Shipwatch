# ADR 0002: Deliver Slack alerts at least once

- **Status:** Accepted
- **Decision:** Persist alert intent in PostgreSQL before sending it, and mark it sent
  only after the remote Slack call succeeds.
- **Why:** The alert can be retried after a process failure, and incident/domain changes
  are committed with the outbox row.
- **Trade-off:** PostgreSQL and Slack do not share a transaction. A crash after Slack
  accepts a message but before the sent update can cause a duplicate. Exactly-once
  delivery is not claimed.
- **Evidence:** [`alertDispatcher.ts`](../../backend/src/services/alertDispatcher.ts),
  [`state-machines.md`](../state-machines.md).
