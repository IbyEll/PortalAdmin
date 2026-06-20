/**
 * Overlay discovery stack dev — JustLastOne.
 *
 * Descrizione funzionale:
 *   Perché esiste: path servizi, alias processi e extras JLO restano fuori da
 *     discovery.config.mjs generico (caricato via PRJ_NAME).
 *   A cosa serve: valori importati da discovery.config.mjs per tab Servizi/Process,
 *     match PID e avvio stack nel cruscotto dev PortalAdmin.
 *
 * Consumatori: lib/discovery.config.mjs
 *
 * Export principali:
 *   DISCOVERY_CONFIG_VALUES — ids core, extras, path runner, descrizioni UI
 *
 * Nuovo product: duplica come discovery.config.{PRJ_NAME}.mjs (es. MyApp).
 */

/** @type {import("../lib/discovery.config.mjs").DiscoveryConfigValues} */
export const DISCOVERY_CONFIG_VALUES = {
  // Servizi product — ordine tab Servizi
  coreServiceIds: ["web", "api", "auth"]
, appIdAliases: {
    auth: "authentication"
  }
, portalServiceIds: ["dashboard", "api-documentation"]
, productExtras: ["friendbot"]
, portalExtras: ["dashboard", "api-documentation"]
, stackCompleteExtras: []
, processFragments: {
    friendbot: "friend-bot.mjs"
  }
, stackStartScript: {
    rel           : "cruscotto.frontend/cruscotto.process.start.all.services.mjs"
  , processScript : "cruscotto.process.start.all.services"
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
    web         : "cruscotto.frontend/cruscotto.process.start.service.mjs web"
  , api         : "cruscotto.frontend/cruscotto.process.start.service.mjs api"
  , auth        : "cruscotto.frontend/cruscotto.process.start.service.mjs auth"
  , "api-documentation": "cruscotto.frontend/cruscotto.process.start.service.mjs portal"
  , friendbot   : "testScript/funzionali/friend-bot.mjs"
  , dashboard   : "cruscotto.frontend/cruscotto.server.mjs"
  }
, serviceDescriptionById: {
    web         : "Frontend Next.js 15 — UI prodotto IT/EN"
  , api         : "API REST NestJS — dominio applicativo"
  , auth        : "API auth NestJS — login, JWT, registrazione"
  , "api-documentation": "Navigazione OpenAPI centralizzata — config da PRODUCT_REPO_PATH"
  , dashboard   : "Cruscotto dev — test, report, process"
  , friendbot   : "Daemon dev — amicizie e risposte chat automatiche"
  }
, portalDashboardNpmScript: "admin:dashboard"
  , apiDocumentationRunnerRel : "cruscotto.frontend/cruscotto.process.start.api.documentation.mjs"
, apiDocumentationServeRel  : "cruscotto.frontend/cruscotto.api.documentation.server.mjs"
};
