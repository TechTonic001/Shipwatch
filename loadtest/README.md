# k6 load testing

Use an isolated deployment and Neon branch. `RUN_ID` must be a fresh eight-character
hexadecimal value for each run. `PRODUCTION_URL` is required so the pre-flight can warn
and refuse accidental production traffic. Production requires the explicit
`ALLOW_PRODUCTION=true` override; prefer not to set it.

Example PowerShell setup:

```powershell
$env:TARGET_URL = "https://shipwatch-backend-preview.example/api/webhooks/github"
$env:ALLOWED_TARGET_URLS = $env:TARGET_URL
$env:PRODUCTION_URL = "https://shipwatch-backend.example/api/webhooks/github"
$env:GITHUB_WEBHOOK_SECRET = "<test webhook secret>"
$env:RUN_ID = "a1b2c3d4"
```

The GitHub secret is read by k6 for HMAC signing and is never printed by the script.
The pre-flight compares the entire target URL to an explicit comma-separated allowlist.
Do not put production in the allowlist for routine runs.

Install k6 from its official distribution, verify `k6 version`, then run one shape:

```powershell
k6 run .\loadtest\ingest-steady.js
k6 run .\loadtest\ingest-burst.js
$env:UNIQUE_IDS = "100"
$env:REPEATS = "5"
k6 run .\loadtest\duplicate-storm.js
k6 run .\loadtest\mixed-invalid.js
```

The steady and mixed-invalid scripts default to 10 arrivals/second for 60 seconds.
The burst profile ramps from 10 to 50 and then 100 arrivals/second. Duplicate storm
reuses a bounded set of delivery IDs and sends each ID `REPEATS` times. For that shape,
set verifier count to `UNIQUE_IDS`; for other shapes use the actual k6 `iterations`
reported in the summary. The `dropped_iterations` threshold must be zero.

After ingestion, wait for a sweep and run the SQL verifier from the repository root:

```powershell
npm run loadtest:verify -- --db-url "postgres://.../shipwatch_test" --run-id $env:RUN_ID --mode steady --count 600
```

The verifier refuses DB names without `test` and rejects the configured runtime/direct
database URLs. It prints only pass/fail counts and latency percentiles, not the connection URL. Record actual
results, environment details, and bottleneck evidence in [RESULTS.md](./RESULTS.md);
leave unmeasured values blank.
