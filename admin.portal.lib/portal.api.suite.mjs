/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-07-10 21:58
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-07-10 21:58   by: Cursor
 * ticket refirement: ADMIN-197 / ADMIN-224 API read-only suite
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *        Suite API read-only PortalAdmin — elenco script run-portal-api e payload GET /api/tecnici/suite.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - run-portal-api.mjs e il cruscotto devono condividere la stessa definizione della suite read-only.
 *
 *   A cosa serve:
 *   - Espone script cruscotto/home, npm target e payload API per tab Test tecnici e smoke CI.
 *
 * Generalizzazione:
 *   Si — AdminDashBoard; altri overlay possono estendere la suite in futuro.
 *
 * Input:
 *   - —
 *
 * Consumatori:
 *   - admin.portal.testscript/run-portal-api.mjs — orchestratore sequenziale
 *   - cruscotto.frontend/cruscotto.server.mjs — GET /api/tecnici/suite
 *   - admin.portal.testscript/technical/test.portal.api.suite.mjs — regressione suite
 *
 * Export principali:
 *   - PORTAL_API_CRUSCOTTO_SCRIPTS — path relativi sotto admin.portal.testscript/
 *   - PORTAL_API_HOME_SCRIPTS — script HOME opzionali (--skip-home)
 *   - getPortalApiSuitePayload — payload read-only per API cruscotto
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

/** Script eseguiti con cruscotto attivo (path relativi a admin.portal.testscript/). */
export const PORTAL_API_CRUSCOTTO_SCRIPTS = [
  "health/test.api.health.mjs"
, "health/test.api.status.mjs"
, "portal/test.portal.projects.mjs"
, "portal/test.portal.instance.mjs"
, "cruscotto/test.cruscotto.project.mjs"
, "scripts/test.scripts.catalog.mjs"
, "meta/test.tecnici.meta.mjs"
, "meta/test.funzionali.meta.mjs"
, "dev/test.dev.requirements.mjs"
, "dev/test.dev.services.mjs"
, "repo/test.repo.services.discover.mjs"
, "repo/test.repo.services.status.mjs"
, "repo/test.repo.services.processes.mjs"
, "jira/test.jira.backlog.mjs"
, "jira/test.jira.issue.mjs"
, "cursor/test.api.cursor.agent.mjs"
, "cursor/test.cruscotto.backlog.push.mjs"
, "technical/test.portal.api.suite.mjs"
, "technical/test.portal.run.all.discovery.mjs"
];

/** Script HOME opzionali — saltati con --skip-home (smoke CI). */
export const PORTAL_API_HOME_SCRIPTS = [
  "home/test.portal.home.health.mjs"
, "home/test.portal.home.projects.mjs"
];

/**
 * Payload read-only suite API PortalAdmin.
 *
 * @returns {Record<string, unknown>}
 */
export function getPortalApiSuitePayload() {
  return {
    id           : "portal-api-read-only"
  , title        : "API read-only suite"
  , orchestrator : "admin.portal.testscript/run-portal-api.mjs"
  , npmScript    : "test:portal-api"
  , ciSmoke      : "test.smoke/smoke-portal-api.mjs"
  , cruscotto    : PORTAL_API_CRUSCOTTO_SCRIPTS
  , home         : PORTAL_API_HOME_SCRIPTS
  , scriptCount  : PORTAL_API_CRUSCOTTO_SCRIPTS.length + PORTAL_API_HOME_SCRIPTS.length
  , skipHomeFlag : "--skip-home"
  , readOnly     : true
  };
}
