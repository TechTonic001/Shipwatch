. "$PSScriptRoot\common.ps1"

$runNumber = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$repositoryId = 88800000000 + $runNumber
$baseId = 700000000000 + ($runNumber * 10)
$failedAt = [DateTimeOffset]::UtcNow.AddMinutes(-1).ToString("o")
$resolvedAt = [DateTimeOffset]::UtcNow.ToString("o")
$failureDelivery = [Guid]::NewGuid().ToString()
$successDelivery = [Guid]::NewGuid().ToString()
$failureBody = New-DeploymentStatusBody $repositoryId $baseId ($baseId + 1) "failure" $failedAt
$successBody = New-DeploymentStatusBody $repositoryId ($baseId + 1) ($baseId + 2) "success" $resolvedAt
$null = Send-DrillWebhook "deployment_status" $failureDelivery $failureBody
Invoke-DrillSweep
Assert-DrillQuery "bad deploy opened an incident" "SELECT EXISTS (SELECT 1 FROM incidents WHERE repo_id=$repositoryId AND status='open');"
$null = Send-DrillWebhook "deployment_status" $successDelivery $successBody
Invoke-DrillSweep
Assert-DrillQuery "fixed deploy resolved the incident and recorded positive duration" "SELECT i.status='resolved' AND i.resolved_at > i.opened_at AND EXISTS (SELECT 1 FROM alerts a WHERE a.incident_id=i.id AND a.kind='incident_resolved' AND (a.payload->>'durationSeconds')::numeric > 0) FROM incidents i WHERE i.repo_id=$repositoryId;"
