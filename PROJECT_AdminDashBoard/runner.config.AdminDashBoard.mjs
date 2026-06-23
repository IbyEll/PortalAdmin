/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:05   by: IbyEll
 * modificato il: 2026-06-23 21:05   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Runner config AdminDashBoard — stack dev PortalAdmin (cruscotto, HOME, API doc).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - PortalAdmin non è monorepo turbo; runner stack deve dichiarare devStack senza workspace npm.
 *
 *   A cosa serve:
 *   - RUNNER_CONFIG_VALUES per prepare stack: envFiles, devStack dashboard, no turbo build.
 *
 * Generalizzazione:
 *   No — config runner dedicata overlay AdminDashBoard.
 *
 * Input:
 *   - —
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.runner.stack.config.overlay.mjs — merge config runner
 *
 * Export principali:
 *   - RUNNER_CONFIG_VALUES — useTurbo false, devStack dashboard, envFiles .env
 *
 * ------------------------------------------------------------------------------------------------------------------------
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
