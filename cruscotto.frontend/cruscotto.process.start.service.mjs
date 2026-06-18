#!/usr/bin/env node
/**
 * start_DEV_Service — avvio singolo servizio product (generico).
 *
 * Uso:
 *   node cruscotto.frontend/cruscotto.process.start.service.mjs auth
 *   node cruscotto.frontend/cruscotto.process.start.service.mjs api --no-build
 *   node cruscotto.frontend/cruscotto.process.start.service.mjs web --cleanup
 *   node cruscotto.frontend/cruscotto.process.start.service.mjs --service auth --help
 *
 * Servizi disponibili: da runner.config.stack devStack (auth, api, web per JustLastOne).
 */

import { runDevServiceStartCli } from "./cruscotto.runner.stack.mjs";

runDevServiceStartCli(process.argv.slice(2));
