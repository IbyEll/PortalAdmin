/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TEST META ** -- commentato il: 2026-06-18 10:22
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 10:22   by: IbyEll
 * modificato il: 2026-06-18 10:22   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *      Meta test tecnici JustLastOne — discovery catalogo testScript per tab TestTecnici cruscotto
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - La pagina Test tecnici del cruscotto deve elencare script e test case reali del product
 *     senza hardcodare l'elenco nella UI o nel server generico PortalAdmin.
 *   - Prerequisiti e architettura sono specifici della suite testScript/ JustLastOne.
 *
 *   A cosa serve:
 *   - Espone TECNICI_IMPLEMENTATION e getTecniciMetaPayload() per GET /api/test/tecnici/meta
 *     (implementation statica + scenari da discovery catalogo e dipendenze test case).
 *
 * Generalizzazione:
 *   Si — caricato da lib/dashboard.project.mjs quando PRJ_NAME=JustLastOne; altri overlay
 *   possono fornire test.technical.meta.{Nome}.mjs con stessa API export.
 *
 * Input:
 *   - PRJ_NAME=JustLastOne — risolve test.technical.meta.mjs nell'overlay PROJECT_JustLastOne
 *   - test.catalog.JustLastOne.mjs — discoverTestScripts, BLOCKED_SCRIPTS
 *   - lib/test.dipendenze.mjs — discoverTestCasesForScript, discoverScriptDescription
 *
 * Consumatori:
 *   - lib/dashboard.project.mjs — re-export getTecniciMetaPayload
 *   - cruscotto.frontend/cruscotto.server.mjs — GET /api/test/tecnici/meta
 *
 * Export principali:
 *   - TECNICI_IMPLEMENTATION — title, summary, prerequisites, architecture, runOrder
 *   - getTecniciMetaPayload — oggetto API con implementation, scenarios, scriptCount, caseCount
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import {
  buildTecniciMetaPayload
} from "../lib/test.technical.meta.mjs";

// --- implementazione suite — overview per tab Test tecnici ---
export const TECNICI_IMPLEMENTATION = {
  title        : "Test tecnici backend"
, summary      : "Suite API e integrazione in testScript/ — esecuzione via run-all.mjs, catena dipendenze tra test case, report JSON in data/reports/latest.json."
, prerequisites: [
    "API :4000 e auth :4001 avviati (preflight run-all)"
  , "DATABASE_URL → packages/database/prisma/JLO_DEV.db"
  , ".env con AUTH_URL, API_URL, WEB_BASE"
  , "Per test web: Next.js su WEB_BASE (es. :3000)"
  ]
, architecture: [
    "runner/run-all.mjs — orchestratore discovery + run sequenziale"
  , "lib/JustLastOne___prj_testScript_catalog.mjs — discovery script, blocked/excluded"
  , "PROJECT_JustLastOne/test-deps.mjs — catena test case (dependencies/chain)"
  , "lib/reporter.mjs — merge report → latest.json + HTML"
  ]
, runOrder: [
    "Preflight servizi + reset host test state"
  , "Discovery cartelle: auth → chat → dashboard → match → notifications → profile → social → tournament → web"
  , "Ogni script: test case in ordine con dipendenza implicita sulla catena"
  ]
};

/**
 * Payload API tab Test tecnici — implementation JLO + discovery catalogo.
 *
 * @returns {Promise<Record<string, unknown>>}
 */
export async function getTecniciMetaPayload() {
  return buildTecniciMetaPayload({ implementation: TECNICI_IMPLEMENTATION });
}
