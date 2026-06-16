/**
 * Runner stack dev — valori JustLastOne.
 *
 * Per un altro product: duplica come runner.config.{PRJ_NAME}.mjs
 * (es. PRJ_NAME=MyApp → runner.config.MyApp.mjs). Nessun import fisso in runner.config.stack.mjs.
 */

/** @type {import("./runner.config.stack.mjs").RunnerConfigValues} */
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
