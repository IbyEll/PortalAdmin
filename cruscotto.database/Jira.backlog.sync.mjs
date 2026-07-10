/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:05   by: IbyEll
 * modificato il: 2026-06-23 21:05   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Persiste snapshot fetchJiraBacklog nel SQLite cruscotto (cache backlog Jira).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - backlog.html e load Jira devono usare cache locale, non API Atlassian a ogni richiesta.
 *
 *   A cosa serve:
 *   - Wipe sync_run precedenti, upsert sprint, issue e plan keys da fetch live.
 *
 * Generalizzazione:
 *   Si — path DB da overlay PRJ_NAME; fetch da cruscotto.jira.backlog.mjs condiviso.
 *
 * Input:
 *   - CRUSCOTTO_DB_PATH — file SQLite cruscotto overlay
 *   - credenziali Jira — env per fetchJiraBacklog live
 *
 * Consumatori:
 *   - admin.portal.JiraCORE/jiraCORE.backlog.sync.mjs — syncJiraBacklogFromApi dopo migrate
 *
 * Export principali:
 *   - syncJiraBacklogSnapshot — scrive da oggetto backlog già fetchato
 *   - syncJiraBacklogFromApi — fetch Jira e persist in SQLite
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { fetchJiraBacklog, isJiraStatusDone, buildBacklogTree } from "../cruscotto.frontend/cruscotto.jira.backlog.mjs";
import {
  resolveRelatedTicketKeys
, adfToPlainText
} from "../admin.portal.JiraCORE/jiraCORE.backlog.related.tickets.mjs";
import { jiraLiveFetch } from "../admin.portal.JiraCORE/jiraCORE.jira.live.mjs";
import { syncMatrixRowsFromJiraDone } from "../docs.portal.lib/matrix.db.adapter.mjs";
import {
  ensureWorkingPlanLoaded
, enrichIssuesWithWorkingPlan
, buildSubtaskDevOrderPlan
} from "../cruscotto.lib/backlog.working.plan.loader.mjs";

import { openCruscottoDb, resolveCruscottoDbPath } from "./cruscotto.db.config.mjs";
import {
  mergeBacklogIssueRawFields
, pickPreservedRawFields
} from "../admin.portal.JiraCORE/jira.issue.workflow.raw.mjs";

/**
 * JSON raw_fields cache — description Jira plain text da sync API.
 *
 * @param {{ jiraDescription?: string | null }} row
 * @param {string} syncedAt ISO-8601
 * @param {Record<string, unknown>} [preserved]
 * @returns {string | null}
 */
function rawFieldsFromBacklogRow(row, syncedAt, preserved = {}) {
  return mergeBacklogIssueRawFields(row, syncedAt, preserved);
}

/**
 * Snapshot raw_fields workflow/veve prima del wipe sync_run — WIP ha priorità su veveDescription.
 *
 * @param {import("@prisma/client").PrismaClient} db
 * @param {string} nextSyncRunId
 * @returns {Promise<Map<string, Record<string, unknown>>>}
 */
async function snapshotPreservedRawFieldsByKey(db, nextSyncRunId) {
  /** @type {Map<string, Record<string, unknown>>} */
  const preservedByKey = new Map();

  const oldIssues = await db.jiraIssue.findMany({
    where: { syncRunId: { not: nextSyncRunId } }
  });

  for (const row of oldIssues) {
    const picked = pickPreservedRawFields(row.rawFields);

    if (Object.keys(picked).length) {
      preservedByKey.set(row.jiraKey, picked);
    }
  }

  const wipRows = await db.jiraIssueWip.findMany();

  for (const row of wipRows) {
    const picked = pickPreservedRawFields(row.rawFields);

    if (!Object.keys(picked).length) {
      continue;
    }

    const prev = preservedByKey.get(row.jiraKey) ?? {};
    preservedByKey.set(row.jiraKey, { ...prev, ...picked });
  }

  return preservedByKey;
}

/**
 * Unisce sprint board e sprint su singole issue (FK jira_issue_sprint → jira_sprint).
 *
 * @param {Awaited<ReturnType<typeof fetchJiraBacklog>>} backlog
 * @returns {Map<number, { id: number, name: string, state: string, startDate?: string | null, endDate?: string | null }>}
 */
function collectSprintsById(backlog) {
  /** @type {Map<number, { id: number, name: string, state: string, startDate?: string | null, endDate?: string | null }>} */
  const byId = new Map();

  const add = (sprint) => {
    const id = Number(sprint?.id);

    if (!Number.isFinite(id) || id <= 0) {
      return;
    }

    const existing = byId.get(id);

    if (!existing) {
      byId.set(id, {
        id
      , name     : String(sprint.name ?? `Sprint ${id}`)
      , state    : String(sprint.state ?? "closed")
      , startDate: sprint.startDate ?? null
      , endDate  : sprint.endDate ?? null
      });
      return;
    }

    if (!existing.name && sprint.name) {
      existing.name = String(sprint.name);
    }

    if (!existing.state && sprint.state) {
      existing.state = String(sprint.state);
    }
  };

  for (const sprint of backlog.jiraSprints ?? []) {
    add(sprint);
  }

  for (const row of backlog.issues) {
    for (const sprint of row.jiraSprints ?? []) {
      add(sprint);
    }
  }

  return byId;
}

/**
 * @param {Awaited<ReturnType<typeof fetchJiraBacklog>>} backlog
 */
export async function syncJiraBacklogSnapshot(backlog) {
  const db = await openCruscottoDb();

  // 1. Nuovo sync run — creato prima del wipe così la coda WIP può essere riagganciata
  const syncRun = await db.syncRun.create({
    data: {
      status    : "running"
    , source    : "jira-api"
    , issueCount: 0
    },
  });

  // 2. Preserva jira_issue_wip — FK onDelete:Cascade su sync_run altrimenti cancella tutto il WIP
  await db.jiraIssueWip.updateMany({
    data: { syncRunId: syncRun.id }
  });

  // 2b. Snapshot veve/workflow raw_fields prima del wipe (Matrix CREA, push WIP, …)
  const preservedByKey = await snapshotPreservedRawFieldsByKey(db, syncRun.id);

  // 3. Reset cache issue — elimina solo i sync run precedenti (non il corrente)
  await db.syncRun.deleteMany({
    where: { id: { not: syncRun.id } }
  });

  try {
    // 4. Upsert tutti gli sprint referenziati (board + customfield per issue)
    for (const sprint of collectSprintsById(backlog).values()) {
      await db.jiraSprint.upsert({
        where  : { id: sprint.id }
      , create : {
          id       : sprint.id
        , name     : sprint.name
        , state    : sprint.state
        , startDate: sprint.startDate ? new Date(sprint.startDate) : null
        , endDate  : sprint.endDate ? new Date(sprint.endDate) : null
        }
      , update : {
          name     : sprint.name
        , state    : sprint.state
        , startDate: sprint.startDate ? new Date(sprint.startDate) : null
        , endDate  : sprint.endDate ? new Date(sprint.endDate) : null
        },
      });
    }

    /** @type {Map<string, string>} jiraKey → issue uuid */
    const issueIds = new Map();

    // 5. Inserisce issue + link sprint per riga backlog
    const syncedAt = backlog.fetchedAt ?? new Date().toISOString();

    for (const row of backlog.issues) {
      const preserved = preservedByKey.get(row.key) ?? {};
      const created = await db.jiraIssue.create({
        data: {
          jiraKey          : row.key
        , issueType        : row.type
        , summary          : row.summary
        , status           : row.status
        , statusCategory   : null
        , parentJiraKey    : row.parentKey
        , tier             : row.tier
        , isStoryLike      : row.isStoryLike ?? false
        , isDone           : isJiraStatusDone(row.status)
        , depth            : row.depth ?? 0
        , hasChildren      : row.hasChildren ?? false
        , devOrder         : row.devOrder ?? null
        , devSprint        : row.devSprint ?? null
        , devSprintName    : row.devSprintName ?? null
        , devSort          : row.devSort ?? null
        , isObsolete: row.isObsolete ?? false
        , relatedKeys      : JSON.stringify(row.relatedKeys ?? [])
        , rawFields        : rawFieldsFromBacklogRow(row, syncedAt, preserved)
        , syncRunId        : syncRun.id
        },
      });

      issueIds.set(row.key, created.id);

      for (const sprint of row.jiraSprints ?? []) {
        const sprintId = Number(sprint.id);

        if (!Number.isFinite(sprintId) || sprintId <= 0) {
          continue;
        }

        await db.jiraIssueSprint.upsert({
          where: {
            issueId_sprintId: {
              issueId  : created.id
            , sprintId
            },
          }
        , create: {
            issueId  : created.id
          , sprintId
          }
        , update: {},
        });
      }
    }

    // 4. Working plan sprint keys (Jira Working)
    for (const [planSprintName, keys] of Object.entries(backlog.boardSprintKeysByPlanName ?? {})) {
      await db.workingPlanSprintKeys.create({
        data: {
          planSprintName
        , issueKeys      : JSON.stringify(keys)
        , syncRunId      : syncRun.id
        },
      });
    }

    // 5. Chiude sync run con conteggio issue
    await db.syncRun.update({
      where: { id: syncRun.id }
    , data : {
        status     : "success"
      , finishedAt : new Date()
      , issueCount : backlog.issues.length
      },
    });

    const matrixSync = await syncMatrixRowsFromJiraDone({ syncRunId: syncRun.id }).catch(() => ({
      updated: 0
    }));

    return {
      syncRunId  : syncRun.id
    , issueCount : backlog.issues.length
    , dbPath     : resolveCruscottoDbPath()
    , fetchedAt  : backlog.fetchedAt
    , matrixRowsResolved: matrixSync.updated ?? 0
    };
  } catch (err) {
    try {
      const failDb = await openCruscottoDb();
      await failDb.syncRun.update({
        where: { id: syncRun.id }
      , data : {
          status    : "failed"
        , finishedAt: new Date()
        },
      });
    } catch {
      // ignore — sync run resta in running se update fallisce
    }

    throw err;
  }
}

/**
 * Fetch live Jira backlog and persist to cruscotto.db.
 *
 * @returns {Promise<{ syncRunId: string, issueCount: number, dbPath: string, fetchedAt: string }>}
 */
export async function syncJiraBacklogFromApi() {
  const backlog = await fetchJiraBacklog();

  await ensureWorkingPlanLoaded();
  await enrichIssuesWithWorkingPlan(backlog.issues, backlog.jiraSprints ?? []);

  return syncJiraBacklogSnapshot(backlog);
}

/**
 * Aggiorna catalogo sprint in SQLite — senza fetch Jira né wipe sync_run.
 * Usato dopo chiusura sprint su board quando basta allineare jira_sprint.state.
 *
 * @param {number} sprintId
 * @param {{ name?: string, state?: string, startDate?: string | null, endDate?: string | null, completeDate?: string | null }} patch
 * @returns {Promise<{ sprintId: number, state: string, patchedAt: string, created?: boolean }>}
 */
export async function patchJiraSprintInDb(sprintId, patch) {
  const id = Number(sprintId);

  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("sprintId non valido per patch DB");
  }

  const db        = await openCruscottoDb();
  const state     = String(patch.state ?? "closed");
  const endSource = patch.endDate ?? patch.completeDate ?? null;
  const endDate   = endSource ? new Date(endSource) : null;
  const startDate = patch.startDate ? new Date(patch.startDate) : null;
  const name      = String(patch.name ?? "").trim() || `Sprint ${id}`;
  const existing  = await db.jiraSprint.findUnique({ where: { id } });

  if (!existing) {
    await db.jiraSprint.create({
      data: {
        id
      , name
      , state
      , startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : null
      , endDate  : endDate && !Number.isNaN(endDate.getTime()) ? endDate : null
      }
    });

    return {
      sprintId
    , state
    , patchedAt: new Date().toISOString()
    , created  : true
    };
  }

  await db.jiraSprint.update({
    where: { id }
  , data : {
      ...(patch.name ? { name } : {})
    , state
    , ...(patch.startDate !== undefined
      ? { startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : null }
      : {})
    , ...(endSource !== undefined
      ? { endDate: endDate && !Number.isNaN(endDate.getTime()) ? endDate : null }
      : {})
    }
  });

  return {
    sprintId
  , state
  , patchedAt: new Date().toISOString()
  };
}

/**
 * Allinea cache SQLite dopo creazione/assegnazione sprint Jira — sprint future + link issue.
 *
 * @param {{
 *   sprintId: number
 * , sprintName: string
 * , state?: string
 * , issueKeys?: string[]
 * }} input
 * @returns {Promise<{ sprintId: number, linkedCount: number, patchedAt: string }>}
 */
export async function ensureJiraSprintIssuesInDb(input) {
  const sprintId = Number(input.sprintId);

  if (!Number.isFinite(sprintId) || sprintId <= 0) {
    throw new Error("sprintId non valido per ensure DB");
  }

  await patchJiraSprintInDb(sprintId, {
    name : input.sprintName
  , state: input.state ?? "future"
  });

  const db      = await openCruscottoDb();
  const syncRun = await db.syncRun.findFirst({
    where  : { status: "success", issueCount: { gt: 0 } }
  , orderBy: { finishedAt: "desc" }
  });

  if (!syncRun) {
    return {
      sprintId
    , linkedCount: 0
    , patchedAt  : new Date().toISOString()
    };
  }

  let linkedCount = 0;

  for (const rawKey of input.issueKeys ?? []) {
    const jiraKey = String(rawKey).trim();

    if (!jiraKey) {
      continue;
    }

    const issue = await db.jiraIssue.findFirst({
      where: { jiraKey, syncRunId: syncRun.id }
    });

    if (!issue) {
      continue;
    }

    await db.jiraIssueSprint.upsert({
      where: {
        issueId_sprintId: {
          issueId  : issue.id
        , sprintId
        }
      }
    , create: {
        issueId  : issue.id
      , sprintId
      }
    , update: {}
    });

    linkedCount += 1;
  }

  return {
    sprintId
  , linkedCount
  , patchedAt: new Date().toISOString()
  };
}

const DEV_SORT_SPRINT_SCALE = 1_000_000;
const DEV_SORT_SEQ_SCALE    = 1_000;

/**
 * @param {number} sprint
 * @param {number} seq
 */
function devOrderLabelForPatch(sprint, seq) {
  return `${sprint}.${seq}`;
}

/**
 * @param {number} sprint
 * @param {number} seq
 */
function devSortKeyForPatch(sprint, seq) {
  return sprint * DEV_SORT_SPRINT_SCALE + seq * DEV_SORT_SEQ_SCALE;
}

/**
 * Subtask sotto parent — devOrder x.x.N e ordine da suggestSubtaskOrder.
 *
 * @param {import("@prisma/client").PrismaClient} db
 * @param {string} syncRunId
 * @param {string} parentJiraKey
 * @param {string} parentDevOrder
 * @param {number} parentDevSort
 */
async function patchSubtaskDevOrderForParentInDb(db, syncRunId, parentJiraKey, parentDevOrder, parentDevSort) {
  const subtasks = await db.jiraIssue.findMany({
    where: { parentJiraKey, syncRunId, tier: "subtask" }
  });

  if (!subtasks.length) {
    return;
  }

  const plan = buildSubtaskDevOrderPlan(
    parentDevOrder
  , parentDevSort
  , subtasks.map((sub) => ({ key: sub.jiraKey, summary: String(sub.summary ?? "") }))
  );

  for (const item of plan) {
    const sub = subtasks.find((row) => row.jiraKey === item.key);

    if (!sub) {
      continue;
    }

    await db.jiraIssue.update({
      where: { id: sub.id }
    , data : {
        devOrder: item.devOrder
      , devSort : item.devSort
      }
    });
  }
}

/**
 * Persiste devOrder/devSprint su jira_issue (ultimo sync run) — sprint creato da Working Plan.
 *
 * @param {{
 *   planSprint: number
 * , sprintName: string
 * , rootKeys: string[]
 * }} input
 * @returns {Promise<{ patchedCount: number, patchedAt: string }>}
 */
export async function patchSprintDevOrderInDb(input) {
  const planSprint = Number(input.planSprint);
  const sprintName = String(input.sprintName ?? `Sprint ${planSprint}`).trim() || `Sprint ${planSprint}`;
  const rootKeys   = (input.rootKeys ?? []).map((key) => String(key).trim()).filter(Boolean);

  if (!Number.isFinite(planSprint) || planSprint <= 0 || !rootKeys.length) {
    return { patchedCount: 0, patchedAt: new Date().toISOString() };
  }

  const db      = await openCruscottoDb();
  const syncRun = await db.syncRun.findFirst({
    where  : { status: "success", issueCount: { gt: 0 } }
  , orderBy: { finishedAt: "desc" }
  });

  if (!syncRun) {
    return { patchedCount: 0, patchedAt: new Date().toISOString() };
  }

  let patchedCount = 0;

  for (let index = 0; index < rootKeys.length; index += 1) {
    const key      = rootKeys[index];
    const seq      = index + 1;
    const devOrder = devOrderLabelForPatch(planSprint, seq);
    const devSort  = devSortKeyForPatch(planSprint, seq);

    const issue = await db.jiraIssue.findFirst({
      where: { jiraKey: key, syncRunId: syncRun.id }
    });

    if (!issue) {
      continue;
    }

    await db.jiraIssue.update({
      where: { id: issue.id }
    , data : {
        devOrder
      , devSort
      , devSprint    : planSprint
      , devSprintName: sprintName
      }
    });

    patchedCount += 1;

    await patchSubtaskDevOrderForParentInDb(db, syncRun.id, key, devOrder, devSort);
  }

  return {
    patchedCount
  , patchedAt: new Date().toISOString()
  };
}

/**
 * Allinea devOrder cache SQLite dal report Working Plan (sprint Jira + coda proposta).
 *
 * @param {Parameters<import("../cruscotto.lib/backlog.working.plan.loader.mjs").buildDevOrderEntriesFromReport>[0]} report
 * @returns {Promise<{ patchedCount: number, patchedAt: string }>}
 */
export async function syncReportDevOrderToDb(report) {
  const { buildDevOrderEntriesFromReport } = await import("../cruscotto.lib/backlog.working.plan.loader.mjs");
  const entries = buildDevOrderEntriesFromReport(report);

  if (!entries.size) {
    return { patchedCount: 0, patchedAt: new Date().toISOString() };
  }

  const db      = await openCruscottoDb();
  const syncRun = await db.syncRun.findFirst({
    where  : { status: "success", issueCount: { gt: 0 } }
  , orderBy: { finishedAt: "desc" }
  });

  if (!syncRun) {
    return { patchedCount: 0, patchedAt: new Date().toISOString() };
  }

  let patchedCount = 0;

  for (const [key, hit] of entries) {
    const issue = await db.jiraIssue.findFirst({
      where: { jiraKey: key, syncRunId: syncRun.id }
    });

    if (!issue) {
      continue;
    }

    await db.jiraIssue.update({
      where: { id: issue.id }
    , data : {
        devOrder      : hit.devOrder
      , devSort       : hit.devSort
      , devSprint     : hit.devSprint
      , devSprintName : hit.devSprintName
      }
    });

    patchedCount += 1;

    await patchSubtaskDevOrderForParentInDb(
      db
    , syncRun.id
    , key
    , hit.devOrder
    , hit.devSort
    );
  }

  return {
    patchedCount
  , patchedAt: new Date().toISOString()
  };
}

/**
 * Aggiorna parent_jira_key su jira_issue nell'ultimo sync run (post push epic Working Plan).
 *
 * @param {string} issueKey
 * @param {string | null} parentJiraKey
 * @returns {Promise<{ patchedCount: number, patchedAt: string }>}
 */
export async function patchIssueParentInDb(issueKey, parentJiraKey) {
  const db      = await openCruscottoDb();
  const syncRun = await db.syncRun.findFirst({
    where  : { status: "success", issueCount: { gt: 0 } }
  , orderBy: { finishedAt: "desc" }
  });

  if (!syncRun) {
    return { patchedCount: 0, patchedAt: new Date().toISOString() };
  }

  const normalizedKey    = String(issueKey).trim().toUpperCase();
  const normalizedParent = parentJiraKey == null || String(parentJiraKey).trim() === ""
    ? null
    : String(parentJiraKey).trim().toUpperCase();

  const result = await db.jiraIssue.updateMany({
    where: { jiraKey: normalizedKey, syncRunId: syncRun.id }
  , data : { parentJiraKey: normalizedParent }
  });

  return {
    patchedCount: result.count
  , patchedAt   : new Date().toISOString()
  };
}

const ENSURE_ISSUE_FIELDS = ["summary", "issuetype", "status", "parent", "description", "issuelinks", "customfield_10020"];

/**
 * Inserisce in jira_issue (ultimo sync) le key assenti — fetch live singola issue.
 *
 * @param {string[]} issueKeys
 * @returns {Promise<{ inserted: string[], syncRunId: string }>}
 */
export async function ensureJiraIssuesInCache(issueKeys) {
  const keys = [...new Set(
    (issueKeys ?? []).map((key) => String(key).trim().toUpperCase()).filter(Boolean)
  )];

  if (!keys.length) {
    throw new Error("Nessuna issue key da allineare in cache");
  }

  const db      = await openCruscottoDb();
  const syncRun = await db.syncRun.findFirst({
    where  : { status: "success", issueCount: { gt: 0 } }
  , orderBy: { finishedAt: "desc" }
  });

  if (!syncRun) {
    throw new Error("Cache jira_issue assente — esegui npm run db:sync");
  }

  /** @type {string[]} */
  const inserted  = [];
  const syncedAt  = new Date().toISOString();

  for (const jiraKey of keys) {
    const existing = await db.jiraIssue.findFirst({
      where: { jiraKey, syncRunId: syncRun.id }
    });

    if (existing) {
      continue;
    }

    const issue = /** @type {{ key: string, fields?: Record<string, unknown> }} */ (
      await jiraLiveFetch(
        `/rest/api/3/issue/${encodeURIComponent(jiraKey)}?fields=${encodeURIComponent(ENSURE_ISSUE_FIELDS.join(","))}`
      )
    );
    const fields          = issue.fields ?? {};
    const jiraDescription = adfToPlainText(fields.description).trim() || null;
    const raw             = [{
      key        : issue.key
    , type       : /** @type {{ name?: string }} */ (fields.issuetype ?? {}).name ?? "—"
    , summary    : String(fields.summary ?? issue.key)
    , status     : /** @type {{ name?: string }} */ (fields.status ?? {}).name ?? "—"
    , parentKey  : /** @type {{ key?: string }} */ (fields.parent ?? {}).key ?? null
    , jiraDescription
    , relatedKeys: resolveRelatedTicketKeys(
        issue.key
      , fields.description
      , /** @type {unknown[]} */ (fields.issuelinks ?? [])
      )
    , jiraSprints: (/** @type {Array<{ id: number, name: string, state: string }>} */ (
        fields.customfield_10020 ?? []
      )).map((sprint) => ({
        id   : Number(sprint.id)
      , name : String(sprint.name ?? "")
      , state: String(sprint.state ?? "")
      }))
    }];
    const [treeRow]       = buildBacklogTree(raw);

    if (!treeRow) {
      throw new Error(`Impossibile normalizzare issue ${jiraKey} per cache`);
    }

    const created = await db.jiraIssue.create({
      data: {
        jiraKey        : treeRow.key
      , issueType      : treeRow.type
      , summary        : treeRow.summary
      , status         : treeRow.status
      , statusCategory : null
      , parentJiraKey  : treeRow.parentKey
      , tier           : treeRow.tier
      , isStoryLike    : treeRow.isStoryLike ?? false
      , isDone         : isJiraStatusDone(treeRow.status)
      , depth          : treeRow.depth ?? 0
      , hasChildren    : treeRow.hasChildren ?? false
      , devOrder       : treeRow.devOrder ?? null
      , devSprint      : treeRow.devSprint ?? null
      , devSprintName  : treeRow.devSprintName ?? null
      , devSort        : treeRow.devSort ?? null
      , isObsolete     : treeRow.isObsolete ?? false
      , relatedKeys    : JSON.stringify(treeRow.relatedKeys ?? [])
      , rawFields      : rawFieldsFromBacklogRow(treeRow, syncedAt)
      , syncRunId      : syncRun.id
      }
    });

    for (const sprint of treeRow.jiraSprints ?? []) {
      const sprintId = Number(sprint.id);

      if (!Number.isFinite(sprintId) || sprintId <= 0) {
        continue;
      }

      await db.jiraSprint.upsert({
        where : { id: sprintId }
      , create: {
          id       : sprintId
        , name     : String(sprint.name ?? `Sprint ${sprintId}`)
        , state    : String(sprint.state ?? "future")
        , startDate: null
        , endDate  : null
        }
      , update: {
          name : String(sprint.name ?? `Sprint ${sprintId}`)
        , state: String(sprint.state ?? "future")
        }
      });

      await db.jiraIssueSprint.upsert({
        where: {
          issueId_sprintId: {
            issueId  : created.id
          , sprintId
          }
        }
      , create: {
          issueId  : created.id
        , sprintId
        }
      , update: {}
      });
    }

    inserted.push(jiraKey);
  }

  if (inserted.length > 0) {
    await db.syncRun.update({
      where: { id: syncRun.id }
    , data : {
        issueCount: { increment: inserted.length }
      }
    });
  }

  return {
    inserted
  , syncRunId: syncRun.id
  };
}
