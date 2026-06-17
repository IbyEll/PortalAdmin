# start_DEV_Service — wrapper PowerShell (generico)
#   .\runner\cruscotto.process.start.service.ps1 auth
#   .\runner\cruscotto.process.start.service.ps1 api -CleanUp
#   .\runner\cruscotto.process.start.service.ps1 web -NoBuild
#   .\runner\cruscotto.process.start.service.ps1 auth -Help

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

node (Join-Path $PSScriptRoot "cruscotto.process.start.service.mjs") @scriptArgs
exit $LASTEXITCODE
