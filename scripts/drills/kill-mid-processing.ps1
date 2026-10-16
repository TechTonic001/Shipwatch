. "$PSScriptRoot\common.ps1"

$deliveryId = $env:SHIPWATCH_DRILL_DELIVERY_ID
if (-not $deliveryId -or $deliveryId -notmatch "^[0-9a-fA-F-]{36}$") {
  throw "Set SHIPWATCH_DRILL_DELIVERY_ID to a valid, recoverable test delivery UUID."
}
$updated = Invoke-DrillSql "UPDATE webhook_deliveries SET status='processing', locked_at=now()-interval '2 minutes', attempts=1 WHERE delivery_id='$deliveryId'::uuid AND status IN ('received','failed') AND attempts < 5 RETURNING delivery_id;"
if (-not $updated) {
  throw "Delivery must exist in received/failed state; refusing to change another state."
}
Invoke-DrillSweep
Assert-DrillQuery "expired claim was reclaimed and processed" "SELECT status='processed' FROM webhook_deliveries WHERE delivery_id='$deliveryId'::uuid;"
