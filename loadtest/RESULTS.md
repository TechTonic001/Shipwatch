# Shipwatch load-test results

Do not fill this template with estimates. Attach the k6 summary and post-run database
verification output when recording a real run.

## Environment

- Date/time (UTC):
- Commit SHA:
- Vercel region:
- Neon region:
- Neon compute size:
- Load generator/client location:
- k6 version:
- Target (staging branch URL/name; do not include credentials):

## Test shape

- Script:
- Arrival rate / stages / duration:
- Unique delivery IDs:
- Duplicate count per ID (if applicable):
- Valid/invalid signature mix:
- Concurrent VUs / max VUs:
- Sweep cadence and time allowed for processing:

## Measured results

- p50 acknowledgement latency:
- p95 acknowledgement latency:
- p99 acknowledgement latency:
- Valid-event error rate:
- Invalid-signature HTTP 401 rate:
- Duplicate-event 5xx count:
- Dropped iterations:
- End-to-end received-to-processed p50:
- End-to-end received-to-processed p95:
- End-to-end received-to-processed p99:
- Verification result:

## Analysis

- Observed bottleneck (evidence, not guess):
- Relevant Neon/Vercel observations:
- Follow-up:

## Method

The k6 script signs the exact JSON string sent as the request body and exercises the
webhook acknowledgement path. It refuses targets not exactly present in
`ALLOWED_TARGET_URLS`; production also requires `ALLOW_PRODUCTION=true` and prints a
warning. Run the scheduled sweep after ingestion, then run
`npm run loadtest:verify -- --db-url <isolated-db-url> --run-id <8-hex> --mode <mode> --count <n>`.
The verifier checks the deterministic ID range, processed state, domain status row
count, duplicate domain keys, and reports latency percentiles from actual database
timestamps. The k6 latency thresholds express the test's acceptance targets, not
measured results.
