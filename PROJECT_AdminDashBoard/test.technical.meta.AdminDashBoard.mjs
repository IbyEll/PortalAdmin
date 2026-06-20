/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TEST META ** -- commentato il: 2026-06-18 18:45
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 18:45   by: IbyEll
 * modificato il: 2026-06-18 18:45   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *      Meta test tecnici AdminDashboard — discovery catalogo admin.portal.testscript
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - La pagina Test tecnici del cruscotto deve elencare script e test case reali del product
 *     senza hardcodare l'elenco nella UI o nel server generico PortalAdmin.
 *   - Prerequisiti e architettura sono specifici della suite admin.portal.testscript/.
 *
 *   A cosa serve:
 *   - Espone TECNICI_IMPLEMENTATION e getTecniciMetaPayload() per GET /api/test/tecnici/meta
 *     (implementation statica + scenari da discovery catalogo e dipendenze test case).
 *
 * Generalizzazione:
 *   Si — caricato da lib/dashboard.project.mjs quando PRJ_NAME=AdminDashBoard; altri overlay
 *   possono fornire test.technical.meta.{Nome}.mjs con stessa API export.
 *
 * Input:
 *   - PRJ_NAME=AdminDashBoard — risolve test.technical.meta.mjs nell'overlay PROJECT_AdminDashBoard
 *   - test.catalog.AdminDashBoard.mjs — discoverTestScripts, BLOCKED_SCRIPTS, EXCLUDED_SCRIPTS
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
  title         : "Test tecnici PortalAdmin"
, summary       : "Suite API read-only in admin.portal.testscript/ — health cruscotto, portal, dev, repo, Jira; esecuzione via run-portal-api.mjs; suite funzionali in tab dedicata."
, prerequisites : [
    "Cruscotto su PRJ_DASHBOARD_PORT (default :3998) — health /api/health"
  , "PRJ_NAME=AdminDashBoard e PRODUCT_REPO_PATH nel .env"
  , "Per test Jira: credenziali Atlassian in .env"
  , "Per script HOME: api-documentation su :3990 (--skip-home per saltare)"
  , "Cursor API: blocked in catalogo — usare npm run test:cursor-api da CLI"
  ]
, architecture  : [
    "admin.portal.testscript/run-portal-api.mjs — orchestratore sequenziale suite tecnica"
  , "lib/test.catalog.mjs + PROJECT_AdminDashBoard/test.catalog.AdminDashBoard.mjs — discovery, blocked/excluded"
  , "lib/test.dipendenze.mjs — test case per script"
  , "lib/reporter.mjs — merge report → cruscotto.frontend/reports/latest.json"
  ]
, runOrder      : [
    "Preflight cruscotto (health, status)"
  , "portal → cruscotto → scripts → meta → dev → repo → jira"
  , "HOME opzionale: home/health, home/projects"
  , "Suite funzionali esclusa da questa tab (vedi Test funzionali)"
  ]
};

/**
 * Payload API tab Test tecnici — implementation AdminDashboard + discovery catalogo.
 *
 * @returns {Promise<Record<string, unknown>>}
 */
export async function getTecniciMetaPayload() {
  return buildTecniciMetaPayload({ implementation: TECNICI_IMPLEMENTATION });
}
