# process.start.all.services — wrapper PowerShell
#   .\runner\process.start.all.services.ps1
#   .\runner\process.start.all.services.ps1 -CleanUp
#   .\runner\process.start.all.services.ps1 -NoDb
#   .\runner\process.start.all.services.ps1 -NoBuild
#   .\runner\process.start.all.services.ps1 -PrepareOnly
#   .\runner\process.start.all.services.ps1 -Help
#
# Avvia in finestre separate (start_DEV_Service.ps1):
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

node (Join-Path $PSScriptRoot "process.start.all.services.mjs") @scriptArgs
exit $LASTEXITCODE
