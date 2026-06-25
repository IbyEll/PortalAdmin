/**
 * Polling stato PR GitHub — merge/close → sync jira_issue_wip → jira_issue (cache backlog).
 */

import { execFileSync } from "node:child_process";

import { openCruscottoDb } from "../cruscotto.database/cruscotto.db.config.mjs";
import { getProductRepoPath } from "../lib/portal.paths.resolver.mjs";
import {
  loadWipPushBundle
, normalizeIssueKey
, parseWipRawFields
} from "./jiraCORE.wip.db.mjs";

/** @typedef {'OPEN' | 'MERGED' | 'CLOSED'} PrState */

/**
 * @param {string} prUrl
 * @returns {{ owner: string, repo: string, number: string } | null}
 */
export function parseGithubPullRequestUrl(prUrl) {
  const match = String(prUrl ?? "").trim().match(
    /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i
  );

  if (!match) {
    return null;
  }

  return {
    owner : match[1]
  , repo  : match[2]
  , number: match[3]
  };
}

/**
 * @param {string} prUrl
 * @param {string} [repoCwd]
 * @returns {{ state: PrState, merged: boolean, mergedAt: string | null, closedAt: string | null, url: string }}
 */
export function fetchPullRequestState(prUrl, repoCwd = getProductRepoPath()) {
  const url = String(prUrl ?? "").trim();

  if (!url.startsWith("http")) {
    throw new Error("prUrl non valido");
  }

  const raw = execFileSync(
    "gh"
  , ["pr", "view", url, "--json", "state,mergedAt,closedAt,url"]
  , { cwd: repoCwd, encoding: "utf8" }
  ).trim();

  const data = JSON.parse(raw);
  const state = String(data.state ?? "OPEN").toUpperCase();

  /** @type {PrState} */
  const normalized = state === "MERGED" || state === "CLOSED" ? state : "OPEN";

  return {
    state      : normalized
  , merged     : normalized === "MERGED"
  , mergedAt   : typeof data.mergedAt === "string" ? data.mergedAt : null
  , closedAt   : typeof data.closedAt === "string" ? data.closedAt : null
  , url        : typeof data.url === "string" ? data.url : url
  };
}

/**
 * @param {import("@prisma/client").JiraIssueWip} wipRow
 * @param {Record<string, unknown>} rawMerge
 */
function jiraIssueDataFromWipRow(wipRow, rawMerge = {}) {
  const prev = parseWipRawFields(wipRow.rawFields);

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
  , rawFields         : JSON.stringify({ ...prev, ...rawMerge })
  , syncedAt          : new Date()
  };
}

/**
 * Copia parent + subtask WIP nella cache jira_issue (stesso sync_run se la riga esiste).
 *
 * @param {string} parentKey
 * @param {Record<string, unknown>} rawMerge
 * @returns {Promise<string[]>}
 */
export async function syncJiraIssueCacheFromWip(parentKey, rawMerge = {}) {
  const key = normalizeIssueKey(parentKey);
  const db  = await openCruscottoDb();
  const { parent, subtasks } = await loadWipPushBundle(key);
  const bundle = [parent, ...subtasks];
  /** @type {string[]} */
  const synced = [];

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

    synced.push(wipRow.jiraKey);
  }

  return synced;
}

/**
 * @param {string} parentKey
 * @returns {Promise<Record<string, { jiraKey: string, status: string, isDone: boolean, summary: string }>>}
 */
async function readCacheRowsForBundle(parentKey) {
  const key = normalizeIssueKey(parentKey);
  const db  = await openCruscottoDb();
  const { parent, subtasks } = await loadWipPushBundle(key);
  const keys = [parent.jiraKey, ...subtasks.map((row) => row.jiraKey)];
  const rows = await db.jiraIssue.findMany({
    where  : { jiraKey: { in: keys } }
  , select : {
      jiraKey : true
    , status  : true
    , isDone  : true
    , summary : true
    }
  });

  /** @type {Record<string, { jiraKey: string, status: string, isDone: boolean, summary: string }>} */
  const byKey = {};

  for (const row of rows) {
    byKey[row.jiraKey] = row;
  }

  return byKey;
}

/**
 * Poll PR per parent WIP — se merged/closed: aggiorna WIP, sync jira_issue, stop polling lato client.
 *
 * @param {string} parentKey
 * @returns {Promise<{
 *   ok: boolean
 *   key: string
 *   complete: boolean
 *   prState?: PrState
 *   prUrl?: string | null
 *   syncedKeys?: string[]
 *   cacheByKey?: Record<string, { jiraKey: string, status: string, isDone: boolean, summary: string }>
 *   skipped?: string
 * }>}
 */
export async function pollWipPullRequest(parentKey) {
  const key = normalizeIssueKey(parentKey);
  const db  = await openCruscottoDb();
  const parent = await db.jiraIssueWip.findUnique({ where: { jiraKey: key } });

  if (!parent) {
    return { ok: false, key, complete: true, skipped: "parent_wip_assente" };
  }

  const raw = parseWipRawFields(parent.rawFields);
  const prUrl = typeof raw.prUrl === "string" && raw.prUrl.startsWith("http")
    ? raw.prUrl
    : null;

  if (!prUrl) {
    return { ok: true, key, complete: true, skipped: "no_pr_url", prUrl: null };
  }

  if (raw.prPollComplete === true || raw.prMergedAt) {
    return {
      ok        : true
    , key
    , complete  : true
    , skipped   : "already_complete"
    , prUrl
    , prState   : typeof raw.prState === "string" ? raw.prState : "MERGED"
    };
  }

  /** @type {ReturnType<typeof fetchPullRequestState>} */
  let pr;

  try {
    pr = fetchPullRequestState(prUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    return {
      ok       : false
    , key
    , complete : false
    , prUrl
    , error    : message
    };
  }

  if (pr.state === "OPEN") {
    const nextRaw = {
      ...raw
    , prState       : "OPEN"
    , prPollActive  : true
    , prLastPolledAt: new Date().toISOString()
    };

    await db.jiraIssueWip.update({
      where: { jiraKey: key }
    , data : {
        rawFields: JSON.stringify(nextRaw)
      , syncedAt : new Date()
      }
    });

    return {
      ok       : true
    , key
    , complete : false
    , prState  : "OPEN"
    , prUrl
    };
  }

  const now = new Date().toISOString();
  const { parent: wipParent, subtasks } = await loadWipPushBundle(key);
  const doneStatus = "Fatto";

  for (const row of [wipParent, ...subtasks]) {
    const rowRaw = parseWipRawFields(row.rawFields);

    await db.jiraIssueWip.update({
      where: { jiraKey: row.jiraKey }
    , data : {
        status   : doneStatus
      , isDone   : true
      , rawFields: JSON.stringify({
          ...rowRaw
        , prState         : pr.state
        , prMergedAt      : pr.mergedAt ?? now
        , prClosedAt      : pr.closedAt ?? (pr.state === "CLOSED" ? now : null)
        , prAppliedAt     : pr.mergedAt ?? pr.closedAt ?? now
        , prPollComplete  : true
        , prPollActive    : false
        , prLastPolledAt  : now
        , backlogStar     : row.jiraKey === key
        })
      , syncedAt: new Date()
      }
    });
  }

  const syncedKeys = await syncJiraIssueCacheFromWip(key, {
    prState             : pr.state
  , prMergedAt          : pr.mergedAt ?? now
  , prAppliedAt         : pr.mergedAt ?? pr.closedAt ?? now
  , prPollComplete      : true
  , cacheSyncedFromWipAt: now
  , backlogStar         : true
  });

  const cacheByKey = await readCacheRowsForBundle(key);

  return {
    ok         : true
  , key
  , complete   : true
  , prState    : pr.state
  , prUrl
  , syncedKeys
  , cacheByKey
  };
}
