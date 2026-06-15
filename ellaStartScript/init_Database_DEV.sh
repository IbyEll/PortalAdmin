#!/usr/bin/env sh
# init_Database_DEV — reset, push, seed (product JustLastOne).
#
#   ./ellaStartScript/init_Database_DEV.sh
#   ./ellaStartScript/init_Database_DEV.sh --reset --seed
#   ./ellaStartScript/init_Database_DEV.sh --help

set -e

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PORTAL_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"

node "$PORTAL_ROOT/ellaStartScript/init_Database_DEV.mjs" "$@"
