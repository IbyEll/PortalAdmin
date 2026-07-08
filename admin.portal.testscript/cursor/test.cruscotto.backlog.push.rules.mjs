/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:30
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:30   by: IbyEll
 * modificato il: 2026-07-08 22:35   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Regole visibilità bottone PUSH — step 8 workflow database (jira_issue_wip).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - UI backlog e test condividono logica quando mostrare PUSH e come parsare comando utente.
 *
 *   A cosa serve:
 *   - isAwaitingPushWip, buildPushCommand, parsePushApiRequest per markup HTML e API.
 *
 * Generalizzazione:
 *   Si — key ADMIN e JLO; stato wip da fetchWipStatusByKeys generico.
 *
 * Input:
 *   - wip object — WipStatusEntry da API o mock test
 *   - issueKey — ticket parent o subtask
 *
 * Consumatori:
 *   - admin.portal.testscript/cursor/test.cruscotto.backlog.push.mjs — assert regole
 *   - cruscotto.frontend/cruscotto.jira.backlog.html — render bottone PUSH
 *
 * Export principali:
 *   - buildPushCommand, isValidPushIssueKey — comando e validazione key
 *   - isAwaitingPushWip, resolveWipPrUrl — visibilità PUSH e link PR
 *   - parsePushApiRequest — body POST push workflow
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import {
  isRowWorkflowClosed
, wipStatusFromBacklogRow
} from "../../cruscotto.frontend/cruscotto.jira.backlog.wip.mjs";

export { isRowWorkflowClosed };

/**
 * @param {string} issueKey
 * @returns {string}
 */
export function buildPushCommand(issueKey) {
  return `PUSH ${String(issueKey).trim()}`;
}

/**
 * @param {{ awaitingPush?: boolean } | null | undefined} wip
 * @returns {boolean}
 */
export function isAwaitingPushWip(wip) {
  return wip?.awaitingPush === true;
}

/**
 * @param {{ prUrl?: string | null } | null | undefined} wip
 * @returns {string | null}
 */
export function resolveWipPrUrl(wip) {
  if (wip?.prPollComplete === true || wip?.prMergedAt) {
    return null;
  }

  if (wip?.prState === "MERGED" || wip?.prState === "CLOSED") {
    return null;
  }

  const url = wip?.prUrl;

  return typeof url === "string" && url.startsWith("http") ? url : null;
}

/**
 * @param {"epic" | "sprint" | "pillar" | string} viewMode
 * @param {{ tier?: string, type?: string, isStoryLike?: boolean, key?: string }} row
 * @param {{ awaitingPush?: boolean, prUrl?: string | null } | null | undefined} wip
 * @returns {"pr" | "push" | "gogo" | "none"}
 */
export function resolveRowWorkflowControl(viewMode, row, wip) {
  if (row.tier !== "task" || !row.key) {
    return "none";
  }

  const storyLike = row.isStoryLike != null
    ? row.isStoryLike
    : row.tier === "task";

  if (!storyLike) {
    return "none";
  }

  if (viewMode !== "sprint" && viewMode !== "epic" && viewMode !== "pillar") {
    return "none";
  }

  const resolved = wip ?? wipStatusFromBacklogRow(row);
  const prUrl    = resolveWipPrUrl(resolved);

  if (prUrl) {
    return "pr";
  }

  if (isAwaitingPushWip(resolved)) {
    return "push";
  }

  if (isRowWorkflowClosed(row, resolved)) {
    return "none";
  }

  return "gogo";
}

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isValidPushIssueKey(key) {
  return /^(ADMIN|JLO)-\d+$/.test(String(key ?? "").trim().toUpperCase());
}

/**
 * @param {Record<string, unknown>} body
 * @returns {{ ok: true, key: string } | { ok: false, error: string }}
 */
export function parsePushApiRequest(body) {
  const key = String(body?.key ?? "").trim().toUpperCase();

  if (!key) {
    return { ok: false, error: "key mancante" };
  }

  if (!isValidPushIssueKey(key)) {
    return { ok: false, error: "key non valida (ADMIN-xxx o JLO-xxx)" };
  }

  return { ok: true, key };
}
