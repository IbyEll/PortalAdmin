# Setup dev — fasi separabili: cleanup, build, database, avvio stack.
#
# Esempi:
#   .\ellaStartScript\start-dev.ps1
#   .\ellaStartScript\start-dev.ps1 -NoClean
#   .\ellaStartScript\start-dev.ps1 -CleanOnly
#   .\ellaStartScript\start-dev.ps1 -PrepareOnly
#   .\ellaStartScript\db-dev.ps1 -Reset -Seed
#   .\ellaStartScript\start-dev.ps1 -BuildOnly
#   .\ellaStartScript\start-dev.ps1 -Help

param(
  [switch]$NoClean
, [switch]$CleanOnly
, [switch]$NoDb
, [switch]$BuildOnly
, [switch]$PrepareOnly
, [switch]$NoFriendBot
, [switch]$StartBackground
, [switch]$Help
, [string]$Seed
, [int]$WaitAuth = 0
)

$ErrorActionPreference = "Stop"

if ($Help) {
  node (Join-Path $PSScriptRoot "start-dev.mjs") --help
  exit $LASTEXITCODE
}

$scriptArgs = @()

if ($NoClean) { $scriptArgs += "--no-clean" }
if ($CleanOnly) { $scriptArgs += "--clean-only" }
if ($NoDb) { $scriptArgs += "--no-db" }
if ($BuildOnly) { $scriptArgs += "--build-only" }
if ($PrepareOnly) { $scriptArgs += "--prepare-only" }
if ($NoFriendBot) { $scriptArgs += "--no-friend-bot" }
if ($StartBackground) { $scriptArgs += "--start-background" }

if ($Seed) {
  $scriptArgs += "--seed"
  $scriptArgs += $Seed
}

if ($WaitAuth -gt 0) {
  $scriptArgs += "--wait-auth"
  $scriptArgs += [string]$WaitAuth
}

node (Join-Path $PSScriptRoot "start-dev.mjs") @scriptArgs

if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
