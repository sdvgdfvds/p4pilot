param(
  [int]$Port = 4715,
  [string]$NodePath = "node",
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\.."))
)

$ErrorActionPreference = "Stop"
$entry = Join-Path $RepoRoot "packages\mcp-server\dist\http.js"
$webRoot = Join-Path $RepoRoot "packages\web\dist"
$url = "http://127.0.0.1:$Port/p4pilot/?backend=local"
$health = "http://127.0.0.1:$Port/api/health"

try {
  $response = Invoke-RestMethod -Uri $health -TimeoutSec 1
  if ($response.ok) {
    Write-Output $url
    exit 0
  }
} catch {
  # No running host on this port; start one below.
}

if (-not (Test-Path -LiteralPath $entry)) {
  throw "Missing $entry. Run npm run build from $RepoRoot first."
}
if (-not (Test-Path -LiteralPath (Join-Path $webRoot "index.html"))) {
  throw "Missing web build at $webRoot. Run npm run build from $RepoRoot first."
}

$arguments = @(
  "`"$entry`"",
  "--host", "127.0.0.1",
  "--port", "$Port",
  "--web-root", "`"$webRoot`""
)
Start-Process `
  -FilePath $NodePath `
  -ArgumentList $arguments `
  -WorkingDirectory $RepoRoot `
  -WindowStyle Hidden | Out-Null

$deadline = (Get-Date).AddSeconds(15)
do {
  Start-Sleep -Milliseconds 250
  try {
    $response = Invoke-RestMethod -Uri $health -TimeoutSec 1
    if ($response.ok) {
      Write-Output $url
      exit 0
    }
  } catch {
    # Process may still be starting.
  }
} while ((Get-Date) -lt $deadline)

throw "p4pilot-host did not become ready at $health"
