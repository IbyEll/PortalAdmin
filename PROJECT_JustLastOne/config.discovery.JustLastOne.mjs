/**
 * Overlay discovery stack dev — JustLastOne.
 *
 * Descrizione funzionale:
 *   Perché esiste: path servizi, alias processi e extras JLO restano fuori da
 *     config.discovery.mjs generico (caricato via PRJ_NAME).
 *   A cosa serve: valori importati da config.discovery.mjs per tab Servizi/Utility,
 *     match PID e avvio stack nel cruscotto dev PortalAdmin.
 *
 * Consumatori: lib/config.discovery.mjs
 *
 * Export principali:
 *   DISCOVERY_CONFIG_VALUES — ids core, extras, path runner, descrizioni UI
 *
 * Nuovo product: duplica come config.discovery.{PRJ_NAME}.mjs (es. MyApp).
 */

/** @type {import("../lib/config.discovery.mjs").DiscoveryConfigValues} */
export const DISCOVERY_CONFIG_VALUES = {
  // Servizi product — ordine tab Servizi
  coreServiceIds: ["web", "api", "auth"]
, appIdAliases: {
    auth: "authentication"
  }
, portalServiceIds: ["dashboard", "api-portal"]
, productExtras: ["friendbot"]
, portalExtras: ["dashboard", "api-portal"]
, stackCompleteExtras: []
, processFragments: {
    friendbot: "friend-bot.mjs"
  }
, stackStartScript: {
    rel           : "runner/process.start.all.services.mjs"
  , processScript : "process.start.all.services"
  }
, stackStartServiceIds: ["web", "api", "auth"]
, conventionExtras: [
    {
      id            : "friendbot"
    , label         : "friendBOT JLO"
    , script        : "testScript/funzionali/friend-bot.mjs"
    , processScript : "testScript/funzionali/friend-bot.mjs"
    }
  ]
, servicePathById: {
    web         : "runner/process.start.service.mjs web"
  , api         : "runner/process.start.service.mjs api"
  , auth        : "runner/process.start.service.mjs auth"
  , "api-portal": "runner/process.start.service.mjs portal"
  , friendbot   : "testScript/funzionali/friend-bot.mjs"
  , dashboard   : "server/dashboard-server.mjs"
  }
, serviceDescriptionById: {
    web         : "Frontend Next.js 15 — UI prodotto IT/EN"
  , api         : "API REST NestJS — dominio applicativo"
  , auth        : "API auth NestJS — login, JWT, registrazione"
  , "api-portal": "Navigazione OpenAPI centralizzata — config da PRODUCT_REPO_PATH"
  , dashboard   : "Cruscotto dev — test, report, utility"
  , friendbot   : "Daemon dev — amicizie e risposte chat automatiche"
  }
, portalDashboardNpmScript: "admin:dashboard"
, apiPortalRunnerRel      : "runner/start_API_Portal.mjs"
, apiPortalServeRel       : "runner/serve-api-portal.mjs"
};
