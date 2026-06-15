# init_Database_DEV — wrapper PowerShell
#   .\ellaStartScript\init_Database_DEV.ps1
#   .\ellaStartScript\init_Database_DEV.ps1 -Reset -Seed
#   .\ellaStartScript\init_Database_DEV.ps1 -Push
#   .\ellaStartScript\init_Database_DEV.ps1 -Help

param(
  [switch]$Reset
, [switch]$Seed
, [switch]$Push
, [switch]$Help
)

$ErrorActionPreference = "Stop"

if ($Help) {
  node (Join-Path $PSScriptRoot "init_Database_DEV.mjs") --help
  exit $LASTEXITCODE
}

$scriptArgs = @()

if ($Reset) { $scriptArgs += "--reset" }
if ($Seed) { $scriptArgs += "--seed" }
if ($Push) { $scriptArgs += "--push" }

node (Join-Path $PSScriptRoot "init_Database_DEV.mjs") @scriptArgs

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
