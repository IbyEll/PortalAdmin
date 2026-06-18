/**
 * Runner config AdminDashBoard — stack dev PortalAdmin (cruscotto, HOME, API Portal).
 *
 * workspaceBuildOrder vuoto: PortalAdmin non è monorepo npm workspaces; DB via cruscotto.database/migrate.mjs.
 */

export const RUNNER_CONFIG_VALUES = {
  useTurbo             : false
, cleanPaths           : []
, workspaceBuildOrder  : []
, envFiles             : [
    { example: ".env.example", target: ".env" }
  ]
, webPrepareWorkspaces : []
, devStack             : [
    {
      id       : "dashboard"
    , pkg      : "dashboard"
    , label    : "Cruscotto PortalAdmin"
    , kind     : "web"
    , openFrom : "web"
    }
  ]
, optionalDaemons      : []
};
