# process.start.all.services — wrapper PowerShell
#   .\cruscotto.frontend\cruscotto.process.start.all.services.ps1
#   .\cruscotto.frontend\cruscotto.process.start.all.services.ps1 -CleanUp
#   .\cruscotto.frontend\cruscotto.process.start.all.services.ps1 -NoDb
#   .\cruscotto.frontend\cruscotto.process.start.all.services.ps1 -NoBuild
#   .\cruscotto.frontend\cruscotto.process.start.all.services.ps1 -PrepareOnly
#   .\cruscotto.frontend\cruscotto.process.start.all.services.ps1 -Help
#
# Avvia in finestre separate (cruscotto.process.start.service.ps1):
#   auth · api · web

param(
  [switch]$CleanUp
, [switch]$NoDb
, [switch]$NoBuild
, [switch]$PrepareOnly
, [switch]$Help
)

$ErrorActionPreference = "Stop"

$scriptArgs = @()

if ($Help) { $scriptArgs += "--help" }
if ($CleanUp) { $scriptArgs += "--cleanup" }
if ($NoDb) { $scriptArgs += "--no-db" }
if ($NoBuild) { $scriptArgs += "--no-build" }
if ($PrepareOnly) { $scriptArgs += "--prepare-only" }

node (Join-Path $PSScriptRoot "cruscotto.process.start.all.services.mjs") @scriptArgs
exit $LASTEXITCODE
