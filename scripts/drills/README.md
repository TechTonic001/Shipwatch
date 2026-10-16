# Failure drills

Run drills only against a disposable backend and a Neon database whose database name
contains `test`. Each PowerShell script checks that name and requires the exact backend
base URL to appear in `SHIPWATCH_DRILL_ALLOWED_URLS`.

Set these shell variables before starting:

```powershell
$env:SHIPWATCH_DRILL_DATABASE_URL = "postgres://.../shipwatch_test"
$env:SHIPWATCH_DRILL_API_BASE_URL = "http://localhost:3000"
$env:SHIPWATCH_DRILL_ALLOWED_URLS = "http://localhost:3000"
$env:SHIPWATCH_DRILL_BODY_FILE = "C:\path\to\fixture.json" # cold-start drill
$env:CRON_SECRET = "<test cron token>"
$env:GITHUB_WEBHOOK_SECRET = "<test webhook secret>"
```

The API and database must point to the same test deployment. The database URL and
tokens are never printed by the scripts. The scripts call `psql` and PowerShell's
`Invoke-WebRequest`/`Invoke-RestMethod`; set an isolated test Slack destination before
running alert-related drills.

## Kill mid-processing

Set `SHIPWATCH_DRILL_DELIVERY_ID` to a valid `received` or `failed` delivery ID that
contains a processable fixture. Run:

```powershell
.\scripts\drills\kill-mid-processing.ps1
```

The script simulates a process dying after claim by aging the lock, invokes one sweep,
and ends with a PASS/FAIL query requiring the row to reach `processed`. Choose a row with
fewer than five attempts; it refuses terminal/exhausted rows.

## Neon cold start

Wait until the disposable Neon branch has scaled to zero. Put one valid, signed
`deployment_status` JSON payload fixture in a file and set
`SHIPWATCH_DRILL_BODY_FILE` to its path:

```powershell
.\scripts\drills\neon-cold-start.ps1
```

It reports the measured webhook acknowledgement duration and ends with a query proving
the delivery was persisted. It does not claim that the number is a baseline.

## Slack down and recovery

Use a disposable test backend only. The sender accepts the `hooks.slack.com` host and
the drill uses port 1 to force a refused connection while retaining that host. This
does not change the production sender allowlist.

1. Set the test backend's `OPERATOR_SLACK_WEBHOOK_URL` to
   `https://hooks.slack.com:1/services/drill` and restart it.
2. Run `.\scripts\drills\slack-down.ps1`. It creates one outbox event, sweeps, and ends
   with a PASS/FAIL query requiring a retryable pending event.
3. Restore a disposable, working test-channel webhook and restart the backend.
4. Set the printed `SHIPWATCH_DRILL_ALERT_KEY` and `SHIPWATCH_DRILL_EVENT_ID` values in
   the same shell and rerun the script. Its final query requires the unique event to be
   sent. Confirm one message in the disposable channel.

Do not run this against a production environment or replace its operator webhook.

## Poison payload

Run:

```powershell
.\scripts\drills\poison-payload.ps1
```

The signed envelope is valid but has a permanently invalid status ID. The script runs a
sweep and finishes with a query requiring one attempt and `dead` status, demonstrating
that a permanent schema error does not create a retry storm.

## Bad deploy and recovery

Run:

```powershell
.\scripts\drills\bad-deploy.ps1
```

It sends a production failure status followed by a newer success status for a unique
test repository, sweeping after each. It ends with a PASS/FAIL query requiring a
resolved incident, positive duration, and a resolved-alert payload recording positive
`durationSeconds`.
