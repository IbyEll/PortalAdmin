# init_Database_DEV — wrapper PowerShell verso init_Database_DEV.mjs
#
# Scopo:
#   Espone switch PowerShell per schema / reset / seed del DB dev JustLastOne.
#   Tutta la logica resta in init_Database_DEV.mjs + lib.mjs.
#
# Uso:
#   .\lib\cruscotto-db\script_seed\init_Database_DEV.ps1 -Help
#   .\lib\cruscotto-db\script_seed\init_Database_DEV.ps1 -Push
#   .\lib\cruscotto-db\script_seed\init_Database_DEV.ps1 -Reset
#   .\lib\cruscotto-db\script_seed\init_Database_DEV.ps1 -Seed
#   .\lib\cruscotto-db\script_seed\init_Database_DEV.ps1 -Reset -Seed
#
# Switch → flag Node:
#   -Push   → --push
#   -Reset  → --reset
#   -Seed   → --seed
#
# Variabili:
#   PRODUCT_REPO_PATH — ereditata dall'ambiente (vedi init_Database_DEV.mjs)

param(
  [switch]$Reset
, [switch]$Seed
, [switch]$Push
, [switch]$Help
)

$ErrorActionPreference = "Stop"

# 1. Help — delega a Node senza modificare il database
if ($Help) {
  node (Join-Path $PSScriptRoot "init_Database_DEV.mjs") --help
  exit $LASTEXITCODE
}

# 2. Mappa switch PowerShell → argv Node
$scriptArgs = @()

if ($Reset) { $scriptArgs += "--reset" }
if ($Seed) { $scriptArgs += "--seed" }
if ($Push) { $scriptArgs += "--push" }

# 3. Esecuzione script Node nella stessa cartella del wrapper
node (Join-Path $PSScriptRoot "init_Database_DEV.mjs") @scriptArgs

# 4. Propaga exit code al chiamante (CI / script batch)
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
