# start_API_Auth — wrapper PowerShell
#   .\ellaStartScript\start_API_Auth.ps1
#   .\ellaStartScript\start_API_Auth.ps1 -CleanUp
#   .\ellaStartScript\start_API_Auth.ps1 -NoBuild
#   .\ellaStartScript\start_API_Auth.ps1 -Help

param(
  [switch]$CleanUp
, [switch]$NoBuild
, [switch]$Help
)

$ErrorActionPreference = "Stop"

$scriptArgs = @()

if ($Help) { $scriptArgs += "--help" }
if ($CleanUp) { $scriptArgs += "--cleanup" }
if ($NoBuild) { $scriptArgs += "--no-build" }

node (Join-Path $PSScriptRoot "start_API_Auth.mjs") @scriptArgs
exit $LASTEXITCODE
