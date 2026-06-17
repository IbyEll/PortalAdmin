# start_API_Portal — wrapper PowerShell
#   .\runner\cruscotto.process.start.api.portal.ps1
#   .\runner\cruscotto.process.start.api.portal.ps1 -Help

param(
  [switch]$Help
)

$ErrorActionPreference = "Stop"

$scriptArgs = @()

if ($Help) { $scriptArgs += "--help" }

node (Join-Path $PSScriptRoot "cruscotto.process.start.api.portal.mjs") @scriptArgs
exit $LASTEXITCODE
