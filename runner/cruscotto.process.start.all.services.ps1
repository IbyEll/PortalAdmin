# process.start.all.services — wrapper PowerShell
#   .\runner\cruscotto.process.start.all.services.ps1
#   .\runner\cruscotto.process.start.all.services.ps1 -CleanUp
#   .\runner\cruscotto.process.start.all.services.ps1 -NoDb
#   .\runner\cruscotto.process.start.all.services.ps1 -NoBuild
#   .\runner\cruscotto.process.start.all.services.ps1 -PrepareOnly
#   .\runner\cruscotto.process.start.all.services.ps1 -Help
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
