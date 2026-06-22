/**
 * Regole visibilità bottone PUSH — step 8 workflow database (jira_issue_wip).
 */

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

  const prUrl = resolveWipPrUrl(wip);

  if (prUrl) {
    return "pr";
  }

  if (isAwaitingPushWip(wip)) {
    return "push";
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
