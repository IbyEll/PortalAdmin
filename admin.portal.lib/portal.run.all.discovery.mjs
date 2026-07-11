/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-07-11 06:55
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-07-11 06:55   by: Cursor
 * ticket refirement: ADMIN-198 / ADMIN-226 Discovery run-all
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *        Discovery run-all PortalAdmin — payload GET /api/tecnici/run-all e smoke CI.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - smoke-run-all, cruscotto e test tecnici devono condividere metadata discovery run-all.
 *
 *   A cosa serve:
 *   - Espone orchestratore, npm target, elenco script discovery e path reports per API read-only.
 *
 * Generalizzazione:
 *   Si — discovery da cruscotto.lib/test.catalog.mjs sul product repo attivo.
 *
 * Input:
 *   - PRJ_NAME, PRODUCT_REPO_PATH — overlay e product per discoverTestScripts
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.server.mjs — GET /api/tecnici/run-all
 *   - admin.portal.testscript/technical/test.portal.run.all.discovery.mjs — regressione discovery
 *   - test.smoke/smoke-run-all.mjs — path orchestratore canonico
 *
 * Export principali:
 *   - RUN_ALL_ORCHESTRATOR — path alias admin.portal.lib/test.run.all.mjs
 *   - getRunAllDiscoveryPayload — payload read-only per API cruscotto
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import {
  BLOCKED_REASONS
, BLOCKED_SCRIPTS
, discoverTestScripts
} from "../cruscotto.lib/test.catalog.mjs";
import { REPORTS_DIR } from "./reporter.mjs";

/** Path alias legacy — implementazione in cruscotto.lib/test.run.all.mjs. */
export const RUN_ALL_ORCHESTRATOR = "admin.portal.lib/test.run.all.mjs";

/** Implementazione orchestratore run-all. */
export const RUN_ALL_ORCHESTRATOR_CANONICAL = "cruscotto.lib/test.run.all.mjs";

/**
 * Payload read-only discovery run-all PortalAdmin.
 *
 * @returns {Promise<Record<string, unknown>>}
 */
export async function getRunAllDiscoveryPayload() {
  const scripts = await discoverTestScripts();

  return {
    id                    : "portal-run-all-discovery"
  , title                 : "Discovery run-all"
  , orchestrator          : RUN_ALL_ORCHESTRATOR
  , orchestratorCanonical : RUN_ALL_ORCHESTRATOR_CANONICAL
  , npmScript             : "test:run-all"
  , ciSmoke               : "test.smoke/smoke-run-all.mjs"
  , reportsDir            : REPORTS_DIR
  , listFlag              : "--list"
  , readOnly              : true
  , scriptCount           : scripts.length
  , scripts               : scripts.map((entry) => ({
      rel           : entry.rel
    , suite         : entry.suite
    , file          : entry.file
    , blocked       : BLOCKED_SCRIPTS.has(entry.rel)
    , blockedReason : BLOCKED_REASONS[entry.rel] ?? null
    }))
  };
}
