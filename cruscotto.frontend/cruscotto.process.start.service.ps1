# start_DEV_Service — wrapper PowerShell (generico)
#   .\cruscotto.frontend\cruscotto.process.start.service.ps1 auth
#   .\cruscotto.frontend\cruscotto.process.start.service.ps1 api -CleanUp
#   .\cruscotto.frontend\cruscotto.process.start.service.ps1 web -NoBuild
#   .\cruscotto.frontend\cruscotto.process.start.service.ps1 auth -Help

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
