#!/usr/bin/env node
/**
 * start_DEV_Service — avvio singolo servizio product (generico).
 *
 * Uso:
 *   node runner/start_DEV_Service.mjs auth
 *   node runner/start_DEV_Service.mjs api --no-build
 *   node runner/start_DEV_Service.mjs web --cleanup
 *   node runner/start_DEV_Service.mjs --service auth --help
 *
 * Servizi disponibili: da runner.config.stack devStack (auth, api, web per JustLastOne).
 */

import { runDevServiceStartCli } from "./runner.stack.mjs";

runDevServiceStartCli(process.argv.slice(2));
