# State machines

## Incident state machine

```text
                         latest production failure
                         + open incident absent
                                  |
                                  v
                             +-----------+
                             |   open    |
                             +-----------+
                                  |
              newer production success, guarded by created_at >
                                  |
                                  v
                             +-----------+
                             | resolved  |
                             +-----------+
```

Only production deployments participate. A failure or error opens an incident only
when no newer production deployment exists for the same repository and environment.
The latest check is performed in the `INSERT ... SELECT ... NOT EXISTS` statement,
not by a read followed by an application-level decision.

A success resolves an open incident only when its GitHub `created_at` is strictly
greater than the incident trigger deployment timestamp. The conditional `UPDATE`
performs the race guard and makes replays idempotent. Events can arrive out of order:
the latest-production predicate and newer-success predicate make the final incident
state converge for the same set of deployment states.

Incident insertion and resolution, including their outbox alert insertion, happen
inside the deployment-status transaction. A rollback removes both domain and alert
changes.

## Alert state machine

```text
                         claim
       +---------+ ----------------------> +---------+
       | pending |                          | sending |
       +---------+                          +---------+
            ^                                  |  |
            | retryable failure                |  | CAS success
            |                                  |  v
       +---------+ <----------------------- +------+
       | failed  |                          | sent |
       +---------+                          +------+
            |
            | non-retryable or attempt >= 5
            v
        +------+
        | dead |
        +------+

  muted / no destination / resolved before opened send
                         |
                         v
                    suppressed

An opened alert is never suppressed merely because of cooldown. If another opened
alert for the same repository and environment was created or sent within the
configured cooldown, the new row remains `pending` and its `next_attempt_at` is
set to the previous alert time plus the cooldown. When the dispatcher claims it,
it checks in SQL that the incident is still open. If it has resolved first, the
opened alert and its recovery alert are both suppressed with
`resolved_before_send`, because the team never saw the problem.

A recovery alert is suppressed only when its opened alert is already `suppressed`
or `dead`. If the opened alert is `pending`, `failed`, or `sent`, recovery remains
pending and is claimable only after the opened alert is sent. This preserves
message ordering.
```

Alerts use a unique dedupe key (`incident_opened:<id>` or
`incident_resolved:<id>`). Suppressed rows remain for audit and are never claimed.
The default opened-alert cooldown is ten minutes and can be overridden through
`repositories.alert_config.cooldownMinutes`; `alert_config.muted=true` suppresses
alerts. A fast failure followed by a recovery before the opened alert is sent
produces zero Slack messages by design: the opened alert is marked
`resolved_before_send`, and the recovery is suppressed for the same reason.

Dispatch is at-least-once. A crash after Slack accepts a message but before the
compare-and-set marks the alert sent can produce a duplicate Slack message. This is
accepted because the database cannot atomically commit with an external Slack request.
