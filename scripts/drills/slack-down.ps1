. "$PSScriptRoot\common.ps1"

$key = $env:SHIPWATCH_DRILL_ALERT_KEY
$eventId = $env:SHIPWATCH_DRILL_EVENT_ID
if (-not $key -or -not $eventId) {
  $key = "drill-" + [Guid]::NewGuid().ToString("N")
  $eventId = [Guid]::NewGuid().ToString()
  $message = "Shipwatch Slack recovery drill $key"
  Invoke-DrillSql "INSERT INTO operator_alert_state(alert_key,active,generation) VALUES ('$key',true,1); INSERT INTO operator_alert_events(id,alert_key,generation,event_kind,message) VALUES ('$eventId'::uuid,'$key',1,'firing','$message');" | Out-Null
  Write-Output "In the disposable backend environment set OPERATOR_SLACK_WEBHOOK_URL=https://hooks.slack.com:1/services/drill and restart the backend."
  Invoke-DrillSweep
  Assert-DrillQuery "refused Slack connection remains retryable" "SELECT status='pending' AND attempts >= 1 FROM operator_alert_events WHERE id='$eventId'::uuid;"
  Write-Output "Restore a disposable test Slack webhook and restart the backend."
  Write-Output "For the recovery pass, set SHIPWATCH_DRILL_ALERT_KEY=$key and SHIPWATCH_DRILL_EVENT_ID=$eventId, then rerun this script."
  exit 0
}
Invoke-DrillSweep
Assert-DrillQuery "the operator event was delivered once after recovery" "SELECT count(*)=1 AND bool_and(status='sent') FROM operator_alert_events WHERE id='$eventId'::uuid;"
