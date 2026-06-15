# start_API_Portal — wrapper PowerShell
#   .\ellaStartScript\start_API_Portal.ps1
#   .\ellaStartScript\start_API_Portal.ps1 -Help

param(
  [switch]$Help
)

$ErrorActionPreference = "Stop"

$scriptArgs = @()

if ($Help) { $scriptArgs += "--help" }

node (Join-Path $PSScriptRoot "start_API_Portal.mjs") @scriptArgs
exit $LASTEXITCODE
