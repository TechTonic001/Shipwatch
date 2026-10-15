# Shipwatch metrics

## Scope and time windows

The metrics API supports `7d` and `30d` windows. A window is evaluated in UTC
from the instant the query starts through the instant exactly one window length
before it. Events at the lower and upper boundaries are included using
`>= window_start` and `<= window_end`. Dates are UTC calendar dates. The
deployment series is produced with PostgreSQL `generate_series`, so every UTC
day in the window is represented, including days with no deployments.

## Deployment frequency

Deployment frequency is the number of successful production deployments per
day in the window. A deployment is production when `deployments.is_production`
is true and successful when its final `state` is `success`. The API returns the
window total and one count for every generated UTC day. Days without a
successful production deployment have count `0`.

## Change failure rate

Change failure rate is:

```
production deployments with final state failure or error
--------------------------------------------------------
production deployments with final state success, failure, or error
```

Only production deployments in the window are considered. Deployments whose
state is not one of `success`, `failure`, or `error` are excluded from both
the numerator and denominator. A zero denominator is returned as `null`, not
zero. The response also includes the failed and total counts used by the
calculation.

## Mean time to recovery

MTTR uses only incidents with `status = 'resolved'` and
`resolved_at` in the selected window. Each duration is the number of seconds
between `opened_at` and `resolved_at`. PostgreSQL `percentile_cont(0.5)` and
`percentile_cont(0.9)` over those durations return the median and p90 in
seconds. With no resolved incidents, both values are `null` and
`resolvedCount` is `0`.

Open incidents are never folded into MTTR. They are returned separately with
their identifier, environment, opened time, and current age in seconds.

## SQL semantics

All metric queries are single parameterized SQL statements. The window bounds,
UTC day boundaries, production filter, final-state filter, and percentile
calculation are applied in SQL. API queries use explicit public column lists;
payloads, Slack URLs, alert configuration, and other internal columns are not
selected.

## Out of scope

Lead time for changes is explicitly out of scope for Phase 5 because it
requires commit data that Shipwatch does not currently ingest.

## Dashboard token limitations

The dashboard read token is a bearer credential entered by the user and kept
in memory/session storage; it is not compiled into the frontend bundle. This
is suitable for a small read-only dashboard but is not user authentication:
anyone who obtains the token can read every repository allowed by the API,
session storage is accessible to same-origin JavaScript, and a shared token
cannot identify or revoke an individual user. Production deployments should
use HTTPS, a short-lived identity-aware proxy or OAuth, rotation, and
server-side authorization if stronger guarantees are required.
