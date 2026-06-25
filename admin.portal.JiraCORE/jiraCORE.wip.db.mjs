/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:30
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:30   by: IbyEll
 * modificato il: 2026-06-23 21:30   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Lettura e update coda WIP jira_issue_wip — step 8 PUSH workflow database.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Push workflow deve validare e aggiornare stato WIP in SQLite prima di sync Jira live.
 *
 *   A cosa serve:
 *   - loadWipPushBundle, assertWipReadyForPush, markWipPushed su tabella jira_issue_wip.
 *
 * Generalizzazione:
 *   Si — DB da openCruscottoDb overlay; key ADMIN e JLO normalizzate.
 *
 * Input:
 *   - parentKey — ticket parent in coda WIP
 *   - CRUSCOTTO_DB_PATH — file SQLite cruscotto overlay
 *
 * Consumatori:
 *   - admin.portal.JiraCORE/jiraCORE.wip.push.mjs — CLI step 8 PUSH
 *   - cruscotto.frontend/cruscotto.jira.wip.mjs — lettura stato per UI
 *
 * Export principali:
 *   - loadWipPushBundle — parent e subtask WIP per push
 *   - assertWipReadyForPush, markWipPushed — gate e flag awaitingPush
 *   - parseWipRawFields, normalizeIssueKey — helper parsing row WIP
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { openCruscottoDb } from "../cruscotto.database/cruscotto.db.config.mjs";
import { mergeWorkflowRawFields } from "../lib/jira.issue.workflow.raw.mjs";

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
 * @param {{ prUrl?: string | null, prTitle?: string | null, dryRun?: boolean }} opts
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
  , prState      : "OPEN"
  , prPollActive : true
  , ...(opts.prUrl ? { prUrl: opts.prUrl } : {})
  , ...(opts.prTitle ? { prTitle: opts.prTitle } : {})
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

/** Colonne condivise jira_issue_wip ↔ jira_issue da confrontare dopo sync. */
const WIP_CACHE_COMPARE_FIELDS = [
  "issueType"
, "summary"
, "status"
, "statusCategory"
, "parentJiraKey"
, "tier"
, "isStoryLike"
, "isDone"
, "depth"
, "hasChildren"
, "devOrder"
, "devSprint"
, "devSprintName"
, "devSort"
, "isSprint6Obsolete"
, "relatedKeys"
];

/**
 * @param {string} field
 * @param {unknown} value
 * @returns {string | boolean | null}
 */
function normCacheCompareValue(field, value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (field === "isStoryLike" || field === "isDone" || field === "hasChildren" || field === "isSprint6Obsolete") {
    return Boolean(value);
  }

  return String(value);
}

/**
 * @param {import("@prisma/client").JiraIssueWip} wipRow
 * @param {import("@prisma/client").JiraIssue} cacheRow
 * @returns {{ aligned: boolean, mismatches: string[] }}
 */
export function compareWipRowWithCache(wipRow, cacheRow) {
  /** @type {string[]} */
  const mismatches = [];

  for (const field of WIP_CACHE_COMPARE_FIELDS) {
    const left  = normCacheCompareValue(field, wipRow[field]);
    const right = normCacheCompareValue(field, cacheRow[field]);

    if (left !== right) {
      mismatches.push(`scalar:${field}`);
    }
  }

  const wipUpdated  = normCacheCompareValue("jiraUpdatedAt", wipRow.jiraUpdatedAt);
  const cacheUpdated = normCacheCompareValue("jiraUpdatedAt", cacheRow.jiraUpdatedAt);

  if (wipUpdated !== cacheUpdated) {
    mismatches.push("scalar:jiraUpdatedAt");
  }

  const wipRaw   = parseWipRawFields(wipRow.rawFields);
  const cacheRaw = parseWipRawFields(cacheRow.rawFields);

  for (const [rawKey, rawVal] of Object.entries(wipRaw)) {
    if (JSON.stringify(cacheRaw[rawKey]) !== JSON.stringify(rawVal)) {
      mismatches.push(`raw_fields:${rawKey}`);
    }
  }

  if (cacheRaw.cacheSyncedFromWipAt == null) {
    mismatches.push("raw_fields:cacheSyncedFromWipAt");
  }

  if (cacheRaw.prPollComplete !== true) {
    mismatches.push("raw_fields:prPollComplete");
  }

  return {
    aligned    : mismatches.length === 0
  , mismatches
  };
}

/**
 * @param {string} parentKey
 * @returns {Promise<{ aligned: boolean, key: string, details: Array<{ jiraKey: string, mismatches: string[] }> }>}
 */
export async function verifyWipBundleAlignedWithCache(parentKey) {
  const key = normalizeIssueKey(parentKey);
  const db  = await openCruscottoDb();
  const { parent, subtasks } = await loadWipPushBundle(key);
  /** @type {Array<{ jiraKey: string, mismatches: string[] }>} */
  const details = [];

  for (const wipRow of [parent, ...subtasks]) {
    const cacheRow = await db.jiraIssue.findUnique({
      where: { jiraKey: wipRow.jiraKey }
    });

    if (!cacheRow) {
      details.push({ jiraKey: wipRow.jiraKey, mismatches: ["cache:assente"] });
      continue;
    }

    const cmp = compareWipRowWithCache(wipRow, cacheRow);

    if (!cmp.aligned) {
      details.push({ jiraKey: wipRow.jiraKey, mismatches: cmp.mismatches });
    }
  }

  return {
    aligned : details.length === 0
  , key
  , details
  };
}

/**
 * @param {import("@prisma/client").JiraIssueWip} wipRow
 * @param {Record<string, unknown>} [rawMerge]
 */
export function jiraIssueDataFromWipRow(wipRow, rawMerge = {}) {
  const prev   = parseWipRawFields(wipRow.rawFields);
  const merged = mergeWorkflowRawFields(prev, rawMerge);

  return {
    issueType         : wipRow.issueType
  , summary           : wipRow.summary
  , status            : wipRow.status
  , statusCategory    : wipRow.statusCategory
  , parentJiraKey     : wipRow.parentJiraKey
  , jiraUpdatedAt     : wipRow.jiraUpdatedAt
  , tier              : wipRow.tier
  , isStoryLike       : wipRow.isStoryLike
  , isDone            : wipRow.isDone
  , depth             : wipRow.depth
  , hasChildren       : wipRow.hasChildren
  , devOrder          : wipRow.devOrder
  , devSprint         : wipRow.devSprint
  , devSprintName     : wipRow.devSprintName
  , devSort           : wipRow.devSort
  , isSprint6Obsolete : wipRow.isSprint6Obsolete
  , relatedKeys       : wipRow.relatedKeys
  , rawFields         : JSON.stringify(merged)
  , syncedAt          : new Date()
  };
}

/**
 * Copia parent + subtask WIP in jira_issue; opz. purge WIP se allineato.
 *
 * @param {string} parentKey
 * @param {Record<string, unknown>} [rawMerge]
 * @param {{ purgeIfAligned?: boolean }} [opts]
 * @returns {Promise<{
 *   syncedKeys: string[]
 *   purge: { purged: boolean, key?: string, deletedKeys?: string[], mismatches?: unknown, skipped?: string }
 * }>}
 */
export async function syncJiraIssueCacheFromWip(parentKey, rawMerge = {}, opts = {}) {
  const key = normalizeIssueKey(parentKey);
  const db  = await openCruscottoDb();
  const { parent, subtasks } = await loadWipPushBundle(key);
  const bundle = [parent, ...subtasks];
  /** @type {string[]} */
  const syncedKeys = [];

  for (const wipRow of bundle) {
    const cacheRow = await db.jiraIssue.findUnique({
      where: { jiraKey: wipRow.jiraKey }
    });

    if (!cacheRow) {
      continue;
    }

    await db.jiraIssue.update({
      where: { jiraKey: wipRow.jiraKey }
    , data : jiraIssueDataFromWipRow(wipRow, {
        ...rawMerge
      , cacheSyncedFromWipAt: rawMerge.cacheSyncedFromWipAt
      })
    });

    syncedKeys.push(wipRow.jiraKey);
  }

  const purgeIfAligned = opts.purgeIfAligned !== false;
  const purge          = purgeIfAligned
    ? await purgeWipBundleIfCacheAligned(key)
    : { purged: false, key, skipped: "purge_disabled" };

  return { syncedKeys, purge };
}

/**
 * Elimina righe WIP parent+subtask se cache jira_issue è allineata (post sync PR).
 *
 * @param {string} parentKey
 * @returns {Promise<{
 *   purged: boolean
 *   key: string
 *   deletedKeys?: string[]
 *   mismatches?: Array<{ jiraKey: string, mismatches: string[] }>
 *   skipped?: string
 * }>}
 */
export async function purgeWipBundleIfCacheAligned(parentKey) {
  const key = normalizeIssueKey(parentKey);
  const db  = await openCruscottoDb();
  const parent = await db.jiraIssueWip.findUnique({
    where: { jiraKey: key }
  });

  if (!parent) {
    return { purged: false, key, skipped: "wip_assente" };
  }

  const parentRaw = parseWipRawFields(parent.rawFields);

  if (parentRaw.prPollComplete !== true && !parentRaw.prMergedAt) {
    return { purged: false, key, skipped: "pr_non_terminal" };
  }

  const verify = await verifyWipBundleAlignedWithCache(key);

  if (!verify.aligned) {
    return {
      purged     : false
    , key
    , mismatches: verify.details
    };
  }

  const { subtasks } = await loadWipPushBundle(key);
  const keys         = [key, ...subtasks.map((row) => row.jiraKey)];

  await db.jiraIssueWip.deleteMany({
    where: { jiraKey: { in: keys } }
  });

  return {
    purged      : true
  , key
  , deletedKeys : keys
  };
}

/**
 * Merge campi workflow in jira_issue.raw_fields (es. post purge WIP).
 *
 * @param {string} issueKey
 * @param {Record<string, unknown>} merge
 * @returns {Promise<{ updated: boolean, key: string }>}
 */
export async function mergeJiraIssueCacheRawFields(issueKey, merge = {}) {
  const key = normalizeIssueKey(issueKey);
  const db  = await openCruscottoDb();
  const row = await db.jiraIssue.findUnique({ where: { jiraKey: key } });

  if (!row) {
    return { updated: false, key };
  }

  const prev = parseWipRawFields(row.rawFields);

  await db.jiraIssue.update({
    where: { jiraKey: key }
  , data : {
      rawFields: JSON.stringify(mergeWorkflowRawFields(prev, merge))
    , syncedAt : new Date()
    }
  });

  return { updated: true, key };
}
