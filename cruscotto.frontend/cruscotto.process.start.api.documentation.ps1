# start_API_Portal — wrapper PowerShell
#   .\cruscotto.frontend\cruscotto.process.start.api.portal.ps1
#   .\cruscotto.frontend\cruscotto.process.start.api.portal.ps1 -Help

param(
  [switch]$Help
)

$ErrorActionPreference = "Stop"

$scriptArgs = @()

if ($Help) { $scriptArgs += "--help" }

node (Join-Path $PSScriptRoot "cruscotto.process.start.api.portal.mjs") @scriptArgs
exit $LASTEXITCODE
