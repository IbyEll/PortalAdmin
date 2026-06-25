/**
 * Polling stato PR GitHub — merge/close → sync jira_issue_wip → jira_issue (cache backlog).
 */

import { execFileSync } from "node:child_process";

import { openCruscottoDb } from "../cruscotto.database/cruscotto.db.config.mjs";
import { hasWorkflowAdvancementData } from "./jira.issue.workflow.raw.mjs";
import { getProductRepoPath } from "../admin.portal.lib/portal.paths.resolver.mjs";
import {
  loadWipPushBundle
, normalizeIssueKey
, parseWipRawFields
, mergeJiraIssueCacheRawFields
, purgeWipBundleIfCacheAligned
, syncJiraIssueCacheFromWip
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
 * @returns {{ state: PrState, merged: boolean, mergedAt: string | null, closedAt: string | null, url: string, title: string | null }}
 */
export function fetchPullRequestState(prUrl, repoCwd = getProductRepoPath()) {
  const url = String(prUrl ?? "").trim();

  if (!url.startsWith("http")) {
    throw new Error("prUrl non valido");
  }

  const raw = execFileSync(
    "gh"
  , ["pr", "view", url, "--json", "state,mergedAt,closedAt,url,title"]
  , { cwd: repoCwd, encoding: "utf8" }
  ).trim();

  const data = JSON.parse(raw);
  const state = String(data.state ?? "OPEN").toUpperCase();

  /** @type {PrState} */
  const normalized = state === "MERGED" || state === "CLOSED" ? state : "OPEN";
  const title = typeof data.title === "string" && data.title.trim()
    ? data.title.trim()
    : null;

  return {
    state      : normalized
  , merged     : normalized === "MERGED"
  , mergedAt   : typeof data.mergedAt === "string" ? data.mergedAt : null
  , closedAt   : typeof data.closedAt === "string" ? data.closedAt : null
  , url        : typeof data.url === "string" ? data.url : url
  , title
  };
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
 * Poll PR per parent WIP — se merged/closed: aggiorna WIP, sync jira_issue, purge WIP se allineato.
 *
 * @param {string} parentKey
 * @returns {Promise<{
 *   ok: boolean
 *   key: string
 *   complete: boolean
 *   prState?: PrState
 *   prUrl?: string | null
 *   syncedKeys?: string[]
 *   wipPurged?: boolean
 *   wipDeletedKeys?: string[]
 *   wipPurgeSkipped?: string
 *   wipPurgeMismatches?: Array<{ jiraKey: string, mismatches: string[] }>
 *   cacheByKey?: Record<string, { jiraKey: string, status: string, isDone: boolean, summary: string }>
 *   skipped?: string
 *   error?: string
 * }>}
 */
export async function pollWipPullRequest(parentKey) {
  const key = normalizeIssueKey(parentKey);
  const db  = await openCruscottoDb();
  const parent = await db.jiraIssueWip.findUnique({ where: { jiraKey: key } });

  if (!parent) {
    const cacheRow = await db.jiraIssue.findUnique({ where: { jiraKey: key } });

    if (!cacheRow) {
      return { ok: false, key, complete: true, skipped: "parent_wip_assente" };
    }

    const cacheRaw = parseWipRawFields(cacheRow.rawFields);
    const prUrl    = typeof cacheRaw.prUrl === "string" && cacheRaw.prUrl.startsWith("http")
      ? cacheRaw.prUrl
      : null;

    if (cacheRaw.prPollComplete !== true && !cacheRaw.prMergedAt) {
      return { ok: false, key, complete: true, skipped: "parent_wip_assente" };
    }

    let prTitle = typeof cacheRaw.prTitle === "string" ? cacheRaw.prTitle : null;

    if (!prTitle && prUrl) {
      try {
        prTitle = fetchPullRequestState(prUrl).title;
      } catch {
        /* gh non disponibile */
      }
    }

    if (prTitle && prTitle !== cacheRaw.prTitle) {
      await mergeJiraIssueCacheRawFields(key, { prTitle });
    }

    return {
      ok        : true
    , key
    , complete  : true
    , skipped   : "cache_only"
    , prUrl
    , prState   : typeof cacheRaw.prState === "string" ? cacheRaw.prState : "MERGED"
    , prTitle   : prTitle ?? cacheRaw.prTitle ?? null
    };
  }

  const raw = parseWipRawFields(parent.rawFields);
  const prUrl = typeof raw.prUrl === "string" && raw.prUrl.startsWith("http")
    ? raw.prUrl
    : null;

  if (!prUrl) {
    return { ok: true, key, complete: true, skipped: "no_pr_url", prUrl: null };
  }

  if (raw.prPollComplete === true || raw.prMergedAt) {
    let prTitle = typeof raw.prTitle === "string" ? raw.prTitle : null;

    if (!prTitle && prUrl) {
      try {
        prTitle = fetchPullRequestState(prUrl).title;
      } catch {
        /* gh non disponibile */
      }
    }

    if (prTitle && prTitle !== raw.prTitle) {
      await db.jiraIssueWip.update({
        where: { jiraKey: key }
      , data : {
          rawFields: JSON.stringify({ ...raw, prTitle })
        , syncedAt : new Date()
        }
      }).catch(() => null);

      await syncJiraIssueCacheFromWip(key, { prTitle }, { purgeIfAligned: false });
    } else if (prTitle && !raw.prTitle) {
      await syncJiraIssueCacheFromWip(key, { prTitle }, { purgeIfAligned: false });
    }

    const purge = await purgeWipBundleIfCacheAligned(key);

    return {
      ok               : true
    , key
    , complete         : true
    , skipped          : "already_complete"
    , prUrl
    , prState          : typeof raw.prState === "string" ? raw.prState : "MERGED"
    , wipPurged        : purge.purged
    , wipDeletedKeys   : purge.deletedKeys
    , wipPurgeSkipped  : purge.skipped
    , wipPurgeMismatches: purge.mismatches
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
        , ...(pr.title ? { prTitle: pr.title } : {})
        , prMergedAt      : pr.mergedAt ?? now
        , prClosedAt      : pr.closedAt ?? (pr.state === "CLOSED" ? now : null)
        , prAppliedAt     : pr.mergedAt ?? pr.closedAt ?? now
        , wipClosedAt     : typeof rowRaw.wipClosedAt === "string"
          ? rowRaw.wipClosedAt
          : (pr.mergedAt ?? pr.closedAt ?? now)
        , prPollComplete  : true
        , prPollActive    : false
        , prLastPolledAt  : now
        , backlogStar     : row.jiraKey === key
        })
      , syncedAt: new Date()
      }
    });
  }

  const syncResult = await syncJiraIssueCacheFromWip(key, {
    prState             : pr.state
  , ...(pr.title ? { prTitle: pr.title } : {})
  , prMergedAt          : pr.mergedAt ?? now
  , prAppliedAt         : pr.mergedAt ?? pr.closedAt ?? now
  , prPollComplete      : true
  , cacheSyncedFromWipAt: now
  , backlogStar         : true
  });

  let cacheByKey = {};

  try {
    cacheByKey = await readCacheRowsForBundle(key);
  } catch {
    /* WIP purgato — leggi cache direttamente */
    const keys = syncResult.syncedKeys;

    if (keys.length > 0) {
      const rows = await db.jiraIssue.findMany({
        where  : { jiraKey: { in: keys } }
      , select : {
          jiraKey : true
        , status  : true
        , isDone  : true
        , summary : true
        }
      });

      for (const row of rows) {
        cacheByKey[row.jiraKey] = row;
      }
    }
  }

  return {
    ok                  : true
  , key
  , complete            : true
  , prState             : pr.state
  , prUrl
  , syncedKeys          : syncResult.syncedKeys
  , wipPurged           : syncResult.purge.purged
  , wipDeletedKeys      : syncResult.purge.deletedKeys
  , wipPurgeSkipped     : syncResult.purge.skipped
  , wipPurgeMismatches  : syncResult.purge.mismatches
  , cacheByKey
  };
}
