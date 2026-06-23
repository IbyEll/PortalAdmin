/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:05   by: IbyEll
 * modificato il: 2026-06-23 21:05   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Overlay discovery stack dev — JustLastOne (web, api, auth, friendbot).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Path servizi, alias processi e extras JLO restano fuori da discovery.config.mjs generico.
 *
 *   A cosa serve:
 *   - Valori per tab Servizi/Process, match PID e avvio stack nel cruscotto dev PortalAdmin.
 *
 * Generalizzazione:
 *   No — DISCOVERY_CONFIG_VALUES dedicato overlay JustLastOne; duplicare per altri product.
 *
 * Input:
 *   - —
 *
 * Consumatori:
 *   - lib/discovery.config.mjs — import dinamico PROJECT_JustLastOne/discovery.config
 *
 * Export principali:
 *   - DISCOVERY_CONFIG_VALUES — coreServiceIds, extras, stackStartScript, descrizioni UI
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

/** @type {import("../lib/overlay/discovery.config.mjs").DiscoveryConfigValues} */
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
