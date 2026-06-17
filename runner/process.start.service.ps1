# start_DEV_Service — wrapper PowerShell (generico)
#   .\runner\start_DEV_Service.ps1 auth
#   .\runner\start_DEV_Service.ps1 api -CleanUp
#   .\runner\start_DEV_Service.ps1 web -NoBuild
#   .\runner\start_DEV_Service.ps1 auth -Help

param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$ServiceId
, [switch]$CleanUp
, [switch]$NoBuild
, [switch]$Help
)

$ErrorActionPreference = "Stop"

$scriptArgs = @($ServiceId)

if ($Help) { $scriptArgs += "--help" }
if ($CleanUp) { $scriptArgs += "--cleanup" }
if ($NoBuild) { $scriptArgs += "--no-build" }

node (Join-Path $PSScriptRoot "start_DEV_Service.mjs") @scriptArgs
exit $LASTEXITCODE
