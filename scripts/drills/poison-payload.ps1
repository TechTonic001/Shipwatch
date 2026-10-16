. "$PSScriptRoot\common.ps1"

$deliveryId = [Guid]::NewGuid().ToString()
$body = @{
  action = "created"
  repository = @{ id = 88880001; full_name = "drill/poison"; production_environment = "production" }
  deployment = @{ id = 88880002; environment = "production"; sha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }
  deployment_status = @{ id = 0; state = "failure"; environment = "production" }
} | ConvertTo-Json -Depth 8 -Compress
$null = Send-DrillWebhook "deployment_status" $deliveryId $body
Invoke-DrillSweep
Assert-DrillQuery "invalid permanent payload is dead-lettered without repeated attempts" "SELECT status='dead' AND attempts=1 FROM webhook_deliveries WHERE delivery_id='$deliveryId'::uuid;"
