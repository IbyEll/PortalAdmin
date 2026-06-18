/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** RUNNER CONFIG ** -- commentato il: 2026-06-18 09:44
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 09:44   by: IbyEll
 * modificato il: 2026-06-18 09:44   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *            Runner config JustLastOne — stack dev monorepo (auth, api, web, daemon friendbot)
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Path clean, ordine build turbo, file .env e definizione devStack sono specifici del monorepo
 *     JustLastOne e non devono stare hardcoded in cruscotto.runner.stack generico.
 *   - Un overlay per product permette di duplicare il pattern per altri PRJ_NAME senza toccare lib/.
 *
 *   A cosa serve:
 *   - Espone RUNNER_CONFIG_VALUES: useTurbo, cleanPaths, workspaceBuildOrder, envFiles, devStack,
 *     optionalDaemons per prepare e avvio stack dal cruscotto PortalAdmin.
 *
 * Generalizzazione:
 *   Si — caricato dinamicamente da PROJECT_{PRJ_NAME}/runner.config.{PRJ_NAME}.mjs quando
 *     PRJ_NAME=JustLastOne; schema RunnerConfigValues in cruscotto.runner.stack.config.overlay.mjs.
 *
 * Input:
 *   - PRJ_NAME=JustLastOne — seleziona questo file via import dinamico in stack.config.overlay
 *   - PRODUCT_REPO_PATH — root monorepo dove risolvono cleanPaths, envFiles e scriptRel daemon
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.runner.stack.config.overlay.mjs — getRunnerConfig, resolveDevServices
 *   - cruscotto.frontend/cruscotto.runner.stack.mjs — prepare, avvio servizi, turbo filters
 *   - cruscotto.frontend/cruscotto.runner.stack.probe.mjs — URL health tab Servizi
 *   - cruscotto.frontend/cruscotto.process.start.all.services.mjs — resolveStackRunnerEntries
 *
 * Export principali:
 *   - RUNNER_CONFIG_VALUES — oggetto overlay (useTurbo, cleanPaths, workspaceBuildOrder, envFiles,
 *     webPrepareWorkspaces, devStack, optionalDaemons)
 *
 * Note:
 *   - Nuovo product: duplicare come PROJECT_MyApp/runner.config.MyApp.mjs adattando pkg e path.
 *   - devStack: auth → api (dipende auth) → web; friendbot come optionalDaemons via testScript.
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

// --- RUNNER_CONFIG_VALUES — policy stack dev product JustLastOne ---
export const RUNNER_CONFIG_VALUES = {
  useTurbo: true
, cleanPaths: [
    "packages/shared/dist"
  , "packages/i18n/dist"
  , "packages/auth-kit/dist"
  , "packages/database/dist"
  , "apps/api/dist"
  , "apps/authentication/dist"
  , "apps/web/.next"
  ]
, workspaceBuildOrder: [
    { pkg: "shared" }
  , { pkg: "i18n" }
  , { pkg: "auth-kit" }
  , { pkg: "database", prismaGen: true, useDbWorkspace: true }
  , { pkg: "database", useDbWorkspace: true }
  ]
, envFiles: [
    { example: "packages/database/.env.example", target: "packages/database/.env" }
  , { example: "apps/api/.env.example", target: "apps/api/.env" }
  , { example: "apps/authentication/.env.example", target: "apps/authentication/.env" }
  , { example: "apps/web/.env.example", target: "apps/web/.env" }
  ]
, webPrepareWorkspaces: ["shared", "i18n"]
, devStack: [
    {
      id         : "auth"
    , pkg        : "auth"
    , label      : "API Auth"
    , kind       : "nest"
    , healthFrom : "auth"
    }
  , {
      id         : "api"
    , pkg        : "api"
    , label      : "API Project"
    , kind       : "nest"
    , healthFrom         : "api"
    , relatedServiceIds  : ["auth"]
    }
  , {
      id       : "web"
    , pkg      : "web"
    , label    : "Web"
    , kind     : "web"
    , openFrom : "web"
    }
  ]
, optionalDaemons: [
    {
      id              : "friendbot"
    , scriptRel       : "testScript/funzionali/friend-bot.mjs"
    , envDisableSuffix: "_FRIEND_BOT"
    , label           : "Friend Bot"
    }
  ]
};
