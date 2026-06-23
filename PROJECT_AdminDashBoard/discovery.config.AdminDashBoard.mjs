/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:05   by: IbyEll
 * modificato il: 2026-06-23 21:05   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Overlay discovery stack dev — AdminDashBoard (PortalAdmin come product).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Servizi PortalAdmin (cruscotto, HOME, API Documentation) restano fuori da discovery.config
 *     generico caricato via PRJ_NAME=AdminDashBoard.
 *
 *   A cosa serve:
 *   - Valori tab Servizi/Process, match PID e avvio cruscotto dev senza stack Nest JLO.
 *
 * Generalizzazione:
 *   No — DISCOVERY_CONFIG_VALUES dedicato overlay AdminDashBoard.
 *
 * Input:
 *   - —
 *
 * Consumatori:
 *   - lib/discovery.config.mjs — import dinamico PROJECT_AdminDashBoard/discovery.config
 *
 * Export principali:
 *   - DISCOVERY_CONFIG_VALUES — ids servizi, path runner, descrizioni UI
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

/** @type {import("../lib/overlay/discovery.config.mjs").DiscoveryConfigValues} */
export const DISCOVERY_CONFIG_VALUES = {
  // Servizi PortalAdmin — da product.manifest.AdminDashBoard.json
  coreServiceIds         : ["dashboard", "home", "api-documentation"]
, appIdAliases           : {}
, portalServiceIds       : ["dashboard", "home", "api-documentation"]    
, productExtras          : []
, portalExtras           : ["dashboard", "home", "api-documentation"]
, stackCompleteExtras    : []
, processFragments       : {}
, stackStartScript       : {
    rel           : "cruscotto.frontend/cruscotto.process.start.all.services.mjs"
  , processScript : "cruscotto.process.start.all.services"
  }
, stackStartServiceIds   : ["home", "api-documentation"]
, conventionExtras       : []
, servicePathById        : {
    dashboard   : "cruscotto.frontend/cruscotto.server.mjs"
  , home        : "admin.portal/portal.home.server.mjs"
  , "api-documentation": "cruscotto.frontend/cruscotto.api.documentation.server.mjs"
  }
, serviceDescriptionById : {
    dashboard   : "Cruscotto dev — testScript, backlog Jira, Process, Cursor agent"
  , home        : "Portal HOME — selezione overlay PROJECT_* e prepare istanza"
  , "api-documentation": "Navigazione OpenAPI — catalogo servizi da product.manifest"
  }
, portalDashboardNpmScript : "admin:dashboard"
, apiDocumentationRunnerRel : "cruscotto.frontend/cruscotto.process.start.api.documentation.mjs"
, apiDocumentationServeRel  : "cruscotto.frontend/cruscotto.api.documentation.server.mjs"
};
