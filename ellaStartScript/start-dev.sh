#!/usr/bin/env bash
# Setup dev product (JustLastOne) da PortalAdmin — cleanup, build, db, avvio stack.
#
# Esempi:
#   ./ellaStartScript/start-dev.sh
#   ./ellaStartScript/start-dev.sh --no-clean
#   ./ellaStartScript/start-dev.sh --build-only

set -euo pipefail

PORTAL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

node "$PORTAL_ROOT/ellaStartScript/start-dev.mjs" "$@"
