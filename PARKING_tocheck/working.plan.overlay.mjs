/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 20:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 20:42   by: IbyEll
 * modificato il: 2026-06-20 12:00   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Resolver piano sprint per overlay attivo (PRJ_NAME).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - La pagina working e l'ordinamento sprint usano piani diversi per overlay; non vanno
 *     hardcoded nel frontend né default su JustLastOne.
 *
 *   A cosa serve:
 *   - Seleziona modulo plan overlay e costruisce URL/titoli board Jira per la UI working.
 *
 * Generalizzazione:
 *   Si — dispatch su PRJ_NAME (AdminDashBoard, JustLastOne, …) e env JIRA_SITE, JIRA_BOARD_ID.
 *
 * Input:
 *   - PRJ_NAME — overlay attivo (project.config)
 *   - PRJ_JIRA_PREFIX — prefisso issue da project.config
 *   - JIRA_SITE — host Atlassian (env, default myfuturejobsearch.atlassian.net)
 *   - JIRA_BOARD_ID / PRJ_JIRA_BOARD_ID — id board sprint
 *
 * Consumatori:
 *   - PARKING_tocheck\cruscotto.jira.working.order.mjs — WORKING_PLAN e meta sprint
 *   - cruscotto.frontend/cruscotto.jira.working.html — titolo board e link Jira
 *
 * Export principali:
 *   - getWorkingPlanOverlayMeta — plan blocks e flag sprint6Enabled
 *   - getWorkingSprintBoardTitle — etichetta board in pagina
 *   - getWorkingJiraBoardUrl — URL board software Jira
 *   - getWorkingJiraBrowseBase — base URL browse issue
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { getProjectConfig, resolveJiraBoardId, resolveProjectOverlayName } from "../project.config.mjs";
import * as adminOverlay from "../PARKING_tocheck/plans/working.plan.AdminDashBoard.mjs";
import * as jloOverlay from "../PARKING_tocheck/plans/working.plan.JLO.overlay.mjs";
import {
  JLO_SPRINT_6_BOARD_NOISE
, JLO_SPRINT_6_PHASES
, JLO_WORKING_PLAN
} from "./cruscotto.jira.working.order.mjs";
 

/**
 * @typedef {import("../PARKING_tocheck/cruscotto.jira.working.order.mjs").WorkingSprintBlock} WorkingSprintBlock
 */

/** @type {Record<string, object>} */
const OVERLAY_PLAN_LOADERS = {
  AdminDashBoard: adminOverlay,
  JustLastOne   : jloOverlay,
};

/**
 * @returns {typeof adminOverlay & {
 *   WORKING_PLAN: WorkingSprintBlock[],
 *   SPRINT_6_PHASES?: import("../PARKING_tocheck/cruscotto.jira.working.order.mjs").SprintExecutionPhase[],
 *   SPRINT_6_BOARD_NOISE?: string[],
 * }}
 */
export function getWorkingPlanOverlayMeta() {
  const overlayName = resolveProjectOverlayName();
  const base        = OVERLAY_PLAN_LOADERS[overlayName];

  if (!base) {
    throw new Error(
      [
        `working.plan.overlay — overlay "${overlayName}" senza piano working.`
      , "Aggiungi cruscotto.frontend/plans/working.plan.{overlay}.mjs e registra in OVERLAY_PLAN_LOADERS."
      ].join(" ")
    );
  }

  if (overlayName === "JustLastOne") {
    return {
      ...jloOverlay,
      WORKING_PLAN         : JLO_WORKING_PLAN,
      SPRINT_6_PHASES      : JLO_SPRINT_6_PHASES,
      SPRINT_6_BOARD_NOISE : JLO_SPRINT_6_BOARD_NOISE,
    };
  }

  return {
    ...base,
    WORKING_PLAN: /** @type {typeof adminOverlay} */ (base).WORKING_PLAN ?? [],
  };
}

/**
 * Board title per sezione sprint nella pagina working.
 *
 * @returns {string}
 */
export function getWorkingSprintBoardTitle() {
  const cfg     = getProjectConfig();
  const boardId = resolveJiraBoardId(cfg);

  return `Sprint board ${boardId} (${cfg.PRJ_JIRA_PREFIX})`;
}

/**
 * URL board Jira per header working.
 *
 * @returns {string}
 */
export function getWorkingJiraBoardUrl() {
  const cfg     = getProjectConfig();
  const site    = String(process.env.JIRA_SITE ?? "myfuturejobsearch.atlassian.net").replace(/^https?:\/\//, "");
  const boardId = resolveJiraBoardId(cfg);

  return `https://${site}/jira/software/projects/${cfg.PRJ_JIRA_PREFIX}/boards/${boardId}`;
}

/**
 * Base URL issue Jira browse.
 *
 * @returns {string}
 */
export function getWorkingJiraBrowseBase() {
  const site = String(process.env.JIRA_SITE ?? "myfuturejobsearch.atlassian.net").replace(/^https?:\/\//, "");

  return `https://${site}/browse/`;
}
