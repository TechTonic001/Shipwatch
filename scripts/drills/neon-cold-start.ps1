. "$PSScriptRoot\common.ps1"

if (-not $env:SHIPWATCH_DRILL_BODY_FILE) {
  throw "Set SHIPWATCH_DRILL_BODY_FILE to a valid deployment_status JSON fixture."
}
$deliveryId = [Guid]::NewGuid().ToString()
$json = Get-Content -Raw -Encoding utf8 $env:SHIPWATCH_DRILL_BODY_FILE
$timer = [System.Diagnostics.Stopwatch]::StartNew()
$response = Send-DrillWebhook "deployment_status" $deliveryId $json
$timer.Stop()
Write-Output "Webhook acknowledgement status: $([int]$response.StatusCode)"
Write-Output "Webhook acknowledgement latency: $($timer.Elapsed.TotalMilliseconds) ms"
Assert-DrillQuery "cold-start event was durably acknowledged" "SELECT EXISTS (SELECT 1 FROM webhook_deliveries WHERE delivery_id='$deliveryId'::uuid AND status IN ('received','processing','processed','failed','dead'));"
