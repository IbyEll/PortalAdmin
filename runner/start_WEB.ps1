# start_WEB — wrapper PowerShell
#   .\ellaStartScript\start_WEB.ps1
#   .\ellaStartScript\start_WEB.ps1 -CleanUp
#   .\ellaStartScript\start_WEB.ps1 -NoBuild
#   .\ellaStartScript\start_WEB.ps1 -Help

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

node (Join-Path $PSScriptRoot "start_WEB.mjs") @scriptArgs
exit $LASTEXITCODE
