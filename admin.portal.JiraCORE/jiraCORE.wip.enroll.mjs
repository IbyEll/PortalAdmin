/**
 * Iscrizione e aggiornamento coda WIP da gogo MyBacklog — jira_issue → jira_issue_wip.
 */

import { execFileSync } from "node:child_process";

import { buildWipAdvancementEntry } from "../cruscotto.frontend/cruscotto.jira.backlog.wip.mjs";
import { openCruscottoDb } from "../cruscotto.database/cruscotto.db.config.mjs";
import { getProjectConfig } from "../admin.portal.lib/project.config.mjs";
import { getProductRepoPath } from "../admin.portal.lib/portal.paths.resolver.mjs";
import { isTicketWorkflowBranch, resolvePrUrlForIssueKey } from "../admin.portal/portal.cursor.agent.workflow.mjs";
import { fetchJiraIssueDescriptionOnly } from "../cruscotto.frontend/cruscotto.jira.issue.view.mjs";
import {
  mergeWorkflowRawFields
, pickVeveGroomRawFields
, parseWorkflowRawFields
} from "./jira.issue.workflow.raw.mjs";
import { normalizeIssueKey, parseWipRawFields } from "./jiraCORE.wip.db.mjs";
import {
  areAllWipSubtasksDone
, closeParentWipForPush
, closeRemainingWipSubtasksAfterGogo
, syncWipSubtasksFromGitCommits
} from "./jiraCORE.wip.close-subtask.mjs";

/**
 * @param {import("@prisma/client").PrismaClient} db
 * @param {string} jiraKey
 */
async function findJiraIssueInLatestSync(db, jiraKey) {
  const syncRun = await db.syncRun.findFirst({
    where  : { status: "success", issueCount: { gt: 0 } }
  , orderBy: { finishedAt: "desc" }
  });

  if (!syncRun) {
    return null;
  }

  const row = await db.jiraIssue.findFirst({
    where: { jiraKey, syncRunId: syncRun.id }
  });

  return row ? { row, syncRun } : null;
}

/**
 * Se WIP non ha veveDescription, copia testo description da Jira live in raw_fields.
 *
 * @param {import("@prisma/client").PrismaClient} db
 * @param {string} jiraKey
 */
async function ensureWipVeveDescriptionFromJira(db, jiraKey) {
  const wip = await db.jiraIssueWip.findUnique({ where: { jiraKey } });

  if (!wip) {
    return;
  }

  const raw = parseWipRawFields(wip.rawFields);

  if (typeof raw.veveDescription === "string" && raw.veveDescription.trim()) {
    return;
  }

  try {
    const live = await fetchJiraIssueDescriptionOnly(jiraKey);
    const snap = live.descriptionText.trim();

    if (!snap) {
      return;
    }

    await db.jiraIssueWip.update({
      where: { jiraKey }
    , data : {
        rawFields: JSON.stringify({
          ...raw
        , veveDescription         : snap
        , jiraDescriptionSyncedAt : new Date().toISOString()
        })
      }
    });
  } catch {
    // Jira non disponibile — enroll resta valido senza description
  }
}

/**
 * @param {import("@prisma/client").JiraIssue} row
 * @param {Record<string, unknown>} rawMerge
 */
/**
 * Merge groom da cache jira_issue + stato workflow già in WIP.
 *
 * @param {string | null | undefined} cacheRawFields
 * @param {string | null | undefined} wipRawFields
 * @param {Record<string, unknown>} [extra]
 */
function mergeWipRawFromCacheRow(cacheRawFields, wipRawFields, extra = {}) {
  const wipPrev  = parseWorkflowRawFields(wipRawFields);
  const groom    = pickVeveGroomRawFields(cacheRawFields);

  return mergeWorkflowRawFields(wipPrev, { ...groom, ...extra });
}

function wipDataFromJiraIssue(row, rawMerge = {}) {
  const prev = parseWorkflowRawFields(row.rawFields);

  return {
    jiraKey          : row.jiraKey
  , issueType        : row.issueType
  , summary          : row.summary
  , status           : row.status
  , statusCategory   : row.statusCategory
  , parentJiraKey    : row.parentJiraKey
  , jiraUpdatedAt    : row.jiraUpdatedAt
  , tier             : row.tier
  , isStoryLike      : row.isStoryLike
  , isDone           : row.isDone
  , depth            : row.depth
  , hasChildren      : row.hasChildren
  , devOrder         : row.devOrder
  , devSprint        : row.devSprint
  , devSprintName    : row.devSprintName
  , devSort          : row.devSort
  , isObsolete: row.isObsolete
  , relatedKeys      : row.relatedKeys
  , syncRunId        : row.syncRunId
  , rawFields        : JSON.stringify({ ...prev, ...rawMerge })
  , syncedAt         : new Date()
  };
}

/**
 * @param {string} parentKey
 * @returns {{ branch: string, hash: string, storyBranches: string[] }}
 */
function readGitSnapshot(parentKey) {
  const repo   = getProductRepoPath();
  const num    = parentKey.split("-")[1];
  const prefix = getProjectConfig().PRJ_JIRA_PREFIX;

  try {
    const branch = execFileSync("git", ["branch", "--show-current"], {
      cwd      : repo
    , encoding : "utf8"
    }).trim();

    const hash = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd      : repo
    , encoding : "utf8"
    }).trim();

    const branchesRaw = execFileSync(
      "git"
    , ["branch", "--list", `STORY---${prefix}-${num}-*`, `BUG---${prefix}-${num}-*`, `TODO---${prefix}-${num}-*`]
    , { cwd: repo, encoding: "utf8" }
    ).trim();

    const storyBranches = branchesRaw
      ? branchesRaw.split("\n").map((line) => line.replace(/^\*?\s+/, "").trim()).filter(Boolean)
      : [];

    return { branch, hash, storyBranches };
  } catch {
    return { branch: "—", hash: "—", storyBranches: [] };
  }
}

/**
 * Iscrive parent (e subtask cache) in jira_issue_wip — chiamata all'avvio gogo.
 *
 * @param {string} issueKey
 * @returns {Promise<{ key: string, enrolled: boolean, subtasks: number }>}
 */
export async function enrollIssueInWip(issueKey) {
  const key = normalizeIssueKey(issueKey);
  const db  = await openCruscottoDb();
  const hit = await findJiraIssueInLatestSync(db, key);

  if (!hit) {
    throw new Error(`Issue ${key} assente in cache jira_issue — esegui sync MyBacklog`);
  }

  const { row, syncRun } = hit;
  const now              = new Date().toISOString();
  const existing         = await db.jiraIssueWip.findUnique({ where: { jiraKey: key } });
  const git              = readGitSnapshot(key);
  const branch           = git.storyBranches[0]
    ?? (git.branch !== "—" ? git.branch : null);

  if (existing) {
    const raw = parseWipRawFields(existing.rawFields);

    await db.jiraIssueWip.update({
      where: { jiraKey: key }
    , data : {
        ...wipDataFromJiraIssue(row, {})
      , rawFields: JSON.stringify(mergeWipRawFromCacheRow(row.rawFields, existing.rawFields, {
          gogoStartedAt : typeof raw.gogoStartedAt === "string" ? raw.gogoStartedAt : now
        , workflowSource: typeof raw.workflowSource === "string" ? raw.workflowSource : "gogo"
        , branch        : raw.branch ?? branch
        , commitHash    : raw.commitHash ?? (git.hash !== "—" ? git.hash : null)
        }))
      }
    });
  } else {
    await db.jiraIssueWip.create({
      data: wipDataFromJiraIssue(row, {
        gogoStartedAt : now
      , workflowSource: "gogo"
      , branch
      , commitHash    : git.hash !== "—" ? git.hash : null
      })
    });
  }

  const children = await db.jiraIssue.findMany({
    where  : { parentJiraKey: key, syncRunId: syncRun.id }
  , orderBy: { jiraKey: "asc" }
  });

  for (const child of children) {
    const childExisting = await db.jiraIssueWip.findUnique({
      where: { jiraKey: child.jiraKey }
    });

    if (childExisting) {
      const raw = parseWipRawFields(childExisting.rawFields);

      await db.jiraIssueWip.update({
        where: { jiraKey: child.jiraKey }
      , data : {
          ...wipDataFromJiraIssue(child, {})
        , rawFields: JSON.stringify(mergeWipRawFromCacheRow(child.rawFields, childExisting.rawFields, {
            parentGogoKey : key
          , gogoStartedAt : typeof raw.gogoStartedAt === "string" ? raw.gogoStartedAt : now
          }))
        }
      });
    } else {
      await db.jiraIssueWip.create({
        data: wipDataFromJiraIssue(child, {
          parentGogoKey: key
        , gogoStartedAt: now
        , workflowSource: "gogo-child"
        })
      });
    }
  }

  await ensureWipVeveDescriptionFromJira(db, key);

  return {
    key
  , enrolled : true
  , subtasks : children.length
  };
}

/**
 * Propaga groom veve da jira_issue → jira_issue_wip se il parent è già in coda WIP.
 * Chiamato a fine runVeveDbForIssueKey (veve scrive solo cache, non WIP diretto).
 *
 * @param {string} issueKey
 * @returns {Promise<{ synced: boolean, key: string, rows?: number, reason?: string }>}
 */
export async function syncWipGroomFromJiraIssueCache(issueKey) {
  const key = normalizeIssueKey(issueKey);
  const db  = await openCruscottoDb();
  const wipParent = await db.jiraIssueWip.findUnique({ where: { jiraKey: key } });

  if (!wipParent) {
    return { synced: false, key, reason: "not_in_wip" };
  }

  const hit = await findJiraIssueInLatestSync(db, key);

  if (!hit) {
    return { synced: false, key, reason: "cache_miss" };
  }

  /** @param {import("@prisma/client").JiraIssue} cacheRow */
  const syncOne = async (cacheRow) => {
    const wipRow = await db.jiraIssueWip.findUnique({ where: { jiraKey: cacheRow.jiraKey } });

    if (!wipRow) {
      return false;
    }

    await db.jiraIssueWip.update({
      where: { jiraKey: cacheRow.jiraKey }
    , data : {
        ...wipDataFromJiraIssue(cacheRow, {})
      , rawFields: JSON.stringify(
          mergeWipRawFromCacheRow(cacheRow.rawFields, wipRow.rawFields)
        )
      }
    });

    return true;
  };

  let rows = 0;

  if (await syncOne(hit.row)) {
    rows += 1;
  }

  const children = await db.jiraIssue.findMany({
    where  : { parentJiraKey: key, syncRunId: hit.syncRun.id }
  , orderBy: { jiraKey: "asc" }
  });

  for (const child of children) {
    if (await syncOne(child)) {
      rows += 1;
    }
  }

  return { synced: rows > 0, key, rows };
}

/**
 * Dopo gogo/agent — allinea WIP e imposta awaitingPush se sviluppo completato.
 *
 * @param {string} issueKey
 * @param {{ closeOpenSubtasks?: boolean }} [opts]
 * @returns {Promise<ReturnType<typeof buildWipAdvancementEntry> | null>}
 */
export async function finalizeWipAfterGogo(issueKey, opts = {}) {
  const key = normalizeIssueKey(issueKey);
  const db  = await openCruscottoDb();

  try {
    await enrollIssueInWip(key);
  } catch {
    // parent assente in cache — continua se riga WIP già presente
  }

  const wipRow = await db.jiraIssueWip.findUnique({ where: { jiraKey: key } });

  if (!wipRow) {
    return null;
  }

  const raw = parseWipRawFields(wipRow.rawFields);
  const git = readGitSnapshot(key);
  const pr  = resolvePrUrlForIssueKey(key);
  const now = new Date().toISOString();

  await syncWipSubtasksFromGitCommits(key);

  let wipChildrenFresh = await db.jiraIssueWip.findMany({
    where  : { parentJiraKey: key }
  , orderBy: { jiraKey: "asc" }
  });

  const gogoWorkflow = typeof raw.gogoStartedAt === "string"
    || raw.workflowSource === "gogo";

  if (
    gogoWorkflow
    && opts.closeOpenSubtasks !== false
    && !areAllWipSubtasksDone(wipChildrenFresh)
  ) {
    await closeRemainingWipSubtasksAfterGogo(key, { git, pr, now });
    wipChildrenFresh = await db.jiraIssueWip.findMany({
      where  : { parentJiraKey: key }
    , orderBy: { jiraKey: "asc" }
    });
  }

  const wipSubtasksDone = areAllWipSubtasksDone(wipChildrenFresh);

  if (wipSubtasksDone && gogoWorkflow) {
    const closed = await closeParentWipForPush(key, { git, pr, now });

    if (closed) {
      return closed;
    }
  }

  const ticketBranch = pr.branch
    ?? (git.storyBranches.find((branch) => isTicketWorkflowBranch(branch, key)) ?? null);
  const storedBranch = typeof raw.branch === "string" ? raw.branch.trim() : "";
  const branch       = isTicketWorkflowBranch(storedBranch, key)
    ? storedBranch
    : ticketBranch;

  /** @type {Record<string, unknown>} */
  const nextRaw = {
    ...raw
  , branch    : branch ?? raw.branch ?? null
  , commitHash: raw.commitHash ?? (git.hash !== "—" ? git.hash : null)
  };

  if (pr.prUrl) {
    nextRaw.prUrl        = pr.prUrl;
    nextRaw.awaitingPush = false;
    nextRaw.pushedAt     = raw.pushedAt ?? now;
    nextRaw.jiraSyncedAt = raw.jiraSyncedAt ?? now;
  }

  const updated = await db.jiraIssueWip.update({
    where: { jiraKey: key }
  , data : {
      rawFields: JSON.stringify(nextRaw)
    , syncedAt : new Date()
    }
  });

  return buildWipAdvancementEntry(updated, wipChildrenFresh);
}
