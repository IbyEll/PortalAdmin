#!/usr/bin/env node
/**
 * Alias retrocompatibile — entrypoint dashboard spostato in cruscotto.frontend/.
 *
 * Uso legacy:
 *   node server/dashboard-server.mjs
 *   npm run admin:dashboard  (ora punta direttamente a cruscotto.frontend/cruscotto.server.mjs)
 */

import "../cruscotto.frontend/cruscotto.server.mjs";
