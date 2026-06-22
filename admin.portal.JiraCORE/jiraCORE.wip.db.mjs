/**
 * Lettura e update coda WIP jira_issue_wip — step 8 PUSH workflow database.
 */

import { openCruscottoDb } from "../cruscotto.database/cruscotto.db.config.mjs";

const ISSUE_KEY_RE = /^(ADMIN|JLO)-\d+$/;

/**
 * @param {string | null | undefined} rawFields
 * @returns {Record<string, unknown>}
 */
export function parseWipRawFields(rawFields) {
  if (!rawFields) {
    return {};
  }

  try {
    const parsed = typeof rawFields === "string" ? JSON.parse(rawFields) : rawFields;

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * @param {string} parentKey
 * @returns {Promise<string>}
 */
export function normalizeIssueKey(parentKey) {
  const key = String(parentKey ?? "").trim().toUpperCase();

  if (!ISSUE_KEY_RE.test(key)) {
    throw new Error(`Key ticket non valida: ${parentKey} (attese ADMIN-xxx o JLO-xxx)`);
  }

  return key;
}

/**
 * @param {string} parentKey
 */
export async function loadWipPushBundle(parentKey) {
  const key = normalizeIssueKey(parentKey);
  const db = await openCruscottoDb();

  const parent = await db.jiraIssueWip.findUnique({
    where: { jiraKey: key }
  });

  if (!parent) {
    throw new Error(`Parent assente in jira_issue_wip: ${key}`);
  }

  const subtasks = await db.jiraIssueWip.findMany({
    where  : { parentJiraKey: key }
  , orderBy: [{ devSort: "asc" }, { jiraKey: "asc" }]
  });

  return { parent, subtasks };
}

/**
 * @param {{ isDone?: boolean, rawFields?: string | null }} parent
 * @param {Record<string, unknown>} raw
 */
export function assertWipReadyForPush(parent, raw) {
  if (parent.isDone !== true) {
    throw new Error("Parent WIP non chiuso (is_done=false) — completa step 7 chiudi");
  }

  if (raw.awaitingPush !== true) {
    throw new Error("Parent WIP non in attesa PUSH (awaitingPush≠true)");
  }
}

/**
 * @param {string} parentKey
 * @param {{ prUrl?: string | null, dryRun?: boolean }} opts
 */
export async function markWipPushed(parentKey, opts = {}) {
  const key = normalizeIssueKey(parentKey);
  const db = await openCruscottoDb();
  const row = await db.jiraIssueWip.findUnique({ where: { jiraKey: key } });

  if (!row) {
    throw new Error(`Parent WIP assente: ${key}`);
  }

  const raw = parseWipRawFields(row.rawFields);
  const now = new Date().toISOString();
  const nextRaw = {
    ...raw
  , awaitingPush : false
  , jiraSyncedAt : now
  , pushedAt     : now
  , ...(opts.prUrl ? { prUrl: opts.prUrl } : {})
  };

  if (opts.dryRun) {
    return { key, dryRun: true, rawFields: nextRaw };
  }

  await db.jiraIssueWip.update({
    where: { jiraKey: key }
  , data : {
      rawFields: JSON.stringify(nextRaw)
    , syncedAt : new Date()
    }
  });

  return { key, updated: true, rawFields: nextRaw };
}
