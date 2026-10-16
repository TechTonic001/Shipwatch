$ErrorActionPreference = "Stop"

function Assert-DrillSafety {
  if (-not $env:SHIPWATCH_DRILL_DATABASE_URL -or -not $env:SHIPWATCH_DRILL_API_BASE_URL -or -not $env:SHIPWATCH_DRILL_ALLOWED_URLS) {
    throw "Set SHIPWATCH_DRILL_DATABASE_URL, SHIPWATCH_DRILL_API_BASE_URL, and SHIPWATCH_DRILL_ALLOWED_URLS."
  }
  $database = [Uri]$env:SHIPWATCH_DRILL_DATABASE_URL
  $databaseName = [Uri]::UnescapeDataString($database.AbsolutePath.TrimStart("/"))
  if ($databaseName -notmatch "test") {
    throw "Refusing a drill database whose name does not contain 'test'."
  }
  $allowed = $env:SHIPWATCH_DRILL_ALLOWED_URLS.Split(",") | ForEach-Object { $_.Trim() }
  if ($allowed -notcontains $env:SHIPWATCH_DRILL_API_BASE_URL) {
    throw "Backend URL is not an exact entry in SHIPWATCH_DRILL_ALLOWED_URLS."
  }
  if (-not $env:CRON_SECRET -or -not $env:GITHUB_WEBHOOK_SECRET) {
    throw "Set CRON_SECRET and GITHUB_WEBHOOK_SECRET in the current shell."
  }
}

function Invoke-DrillSql([string]$Query) {
  $output = & psql $env:SHIPWATCH_DRILL_DATABASE_URL -X -q -t -A -v ON_ERROR_STOP=1 -c $Query
  if ($LASTEXITCODE -ne 0) {
    throw "psql failed while running the drill query."
  }
  return ($output | Out-String).Trim()
}

function Assert-DrillQuery([string]$Description, [string]$Query) {
  $result = Invoke-DrillSql $Query
  if ($result -eq "t" -or $result -eq "true") {
    Write-Output "PASS: $Description"
  } else {
    Write-Output "FAIL: $Description"
    Write-Output "Verification query: $Query"
    throw "Drill verification failed."
  }
}

function Invoke-DrillSweep {
  $headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
  $null = Invoke-RestMethod -Method Get -Uri "$($env:SHIPWATCH_DRILL_API_BASE_URL)/api/internal/sweep" -Headers $headers
}

function Send-DrillWebhook([string]$EventName, [string]$DeliveryId, [string]$Json) {
  $encoding = [System.Text.UTF8Encoding]::new($false)
  $body = $encoding.GetBytes($Json)
  $hmac = [System.Security.Cryptography.HMACSHA256]::new($encoding.GetBytes($env:GITHUB_WEBHOOK_SECRET))
  try {
    $digest = [BitConverter]::ToString($hmac.ComputeHash($body)).Replace("-", "").ToLowerInvariant()
  } finally {
    $hmac.Dispose()
  }
  $headers = @{
    "X-GitHub-Delivery" = $DeliveryId
    "X-GitHub-Event" = $EventName
    "X-Hub-Signature-256" = "sha256=$digest"
  }
  Invoke-WebRequest -Method Post -Uri "$($env:SHIPWATCH_DRILL_API_BASE_URL)/api/webhooks/github" -Headers $headers -ContentType "application/json" -Body $body
}

function New-DeploymentStatusBody([long]$RepositoryId, [long]$DeploymentId, [long]$StatusId, [string]$State, [string]$CreatedAt) {
  $value = @{
    action = "created"
    repository = @{ id = $RepositoryId; full_name = "drill/shipwatch"; production_environment = "production" }
    deployment = @{ id = $DeploymentId; environment = "production"; sha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"; created_at = $CreatedAt }
    deployment_status = @{ id = $StatusId; state = $State; environment = "production"; created_at = $CreatedAt }
  }
  return ($value | ConvertTo-Json -Depth 8 -Compress)
}

Assert-DrillSafety
