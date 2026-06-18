/**
 * Overlay discovery stack dev — AdminDashboard (PortalAdmin come product).
 *
 * Descrizione funzionale:
 *   Perché esiste: servizi PortalAdmin (cruscotto, HOME, API Portal) restano fuori da
 *     discovery.config.mjs generico (caricato via PRJ_NAME=AdminDashBoard).
 *   A cosa serve: tab Servizi/Process, match PID e avvio nel cruscotto dev senza stack Nest JLO.
 *
 * Consumatori: lib/discovery.config.mjs
 *
 * Export principali:
 *   DISCOVERY_CONFIG_VALUES — ids servizi, path runner, descrizioni UI
 */

/** @type {import("../lib/discovery.config.mjs").DiscoveryConfigValues} */
export const DISCOVERY_CONFIG_VALUES = {
  // Servizi PortalAdmin — da product.manifest.AdminDashBoard.json
  coreServiceIds         : ["dashboard", "home", "api-portal"]
, appIdAliases           : {}
, portalServiceIds       : ["dashboard", "home", "api-portal"]
, productExtras          : []
, portalExtras           : ["dashboard", "home", "api-portal"]
, stackCompleteExtras    : []
, processFragments       : {}
, stackStartScript       : {
    rel           : "cruscotto.frontend/cruscotto.process.start.all.services.mjs"
  , processScript : "cruscotto.process.start.all.services"
  }
, stackStartServiceIds   : []
, conventionExtras       : []
, servicePathById        : {
    dashboard   : "cruscotto.frontend/cruscotto.server.mjs"
  , home        : "admin.portal/portal.home.server.mjs"
  , "api-portal": "cruscotto.frontend/cruscotto.process.start.api.documentation.mjs"
  }
, serviceDescriptionById : {
    dashboard   : "Cruscotto dev — testScript, backlog Jira, Process, Cursor agent"
  , home        : "Portal HOME — selezione overlay PROJECT_* e prepare istanza"
  , "api-portal": "Navigazione OpenAPI — catalogo servizi da product.manifest"
  }
, portalDashboardNpmScript : "admin:dashboard"
, apiPortalRunnerRel       : "cruscotto.frontend/cruscotto.process.start.api.documentation.mjs"
, apiPortalServeRel        : "cruscotto.frontend/cruscotto.api.documentation.server.mjs"
};
