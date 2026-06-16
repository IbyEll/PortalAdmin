#!/usr/bin/env sh
# init_Database_DEV — wrapper shell verso init_Database_DEV.mjs
#
# Scopo:
#   Passa gli argomenti CLI a init_Database_DEV.mjs (schema / reset / seed SQLite dev).
#
# Uso:
#   ./lib/cruscotto-db/script_seed/init_Database_DEV.sh --help
#   ./lib/cruscotto-db/script_seed/init_Database_DEV.sh --push
#   ./lib/cruscotto-db/script_seed/init_Database_DEV.sh --reset --seed
#
# Flag supportati (vedi --help sul .mjs):
#   --push, --reset, --seed e alias --db-push, --db-reset, --db-seed
#
# Variabili:
#   PRODUCT_REPO_PATH — ereditata dall'ambiente (vedi init_Database_DEV.mjs)

set -e

# 1. Directory del wrapper — path assoluto indipendente dalla cwd
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

# 2. Delega tutti gli argomenti al entrypoint Node
node "$SCRIPT_DIR/init_Database_DEV.mjs" "$@"
