# start_ALL_Services — wrapper PowerShell
#   .\runner\start_ALL_Services.ps1
#   .\runner\start_ALL_Services.ps1 -CleanUp
#   .\runner\start_ALL_Services.ps1 -NoDb
#   .\runner\start_ALL_Services.ps1 -NoBuild
#   .\runner\start_ALL_Services.ps1 -PrepareOnly
#   .\runner\start_ALL_Services.ps1 -Help
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

node (Join-Path $PSScriptRoot "start_ALL_Services.mjs") @scriptArgs
exit $LASTEXITCODE
