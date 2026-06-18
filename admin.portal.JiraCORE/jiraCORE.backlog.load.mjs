/**
 * Carica backlog Jira dalla cache SQLite cruscotto (ADMIN-144).
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - fetchJiraBacklog su API è lento — lettura ultimo sync senza chiamate Jira
 *
 *   A cosa serve:
 *   - restituisce lo stesso shape di fetchJiraBacklog o null se cache assente
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.jira.backlog.mjs — loadJiraBacklog({ forceApi: false })
 *   - scripts/smoke-cruscotto-db.mjs
 *
 * Export principali:
 *   - loadJiraBacklogFromDb — ultimo SyncRun success + issue/sprint/plan keys
 */

import { normalizeSprintLabel } from "../cruscotto.frontend/cruscotto.jira.working.order.mjs";

import { cruscottoDbFileExists, closeCruscottoDb, openCruscottoDb } from "./index.mjs";

/**
 * @param {Array<{ id: number, name: string, state: string, startDate?: Date | null, endDate?: Date | null }>} rows
 */
function indexJiraSprintsFromRows(rows) {
  /** @type {Record<string, { id: number, name: string, state: string, startDate: string | null, endDate: string | null }>} */
  const byName = {};

  for (const sprint of rows) {
    byName[normalizeSprintLabel(sprint.name)] = {
      id       : sprint.id
    , name     : sprint.name
    , state    : sprint.state
    , startDate: sprint.startDate?.toISOString() ?? null
    , endDate  : sprint.endDate?.toISOString() ?? null
    };
  }

  return byName;
}

/**
 * @param {string | null | undefined} raw
 * @returns {string[]}
 */
function parseRelatedKeys(raw) {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * @returns {Promise<import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").fetchJiraBacklog extends () => Promise<infer R> ? R : never> | null>}
 */
export async function loadJiraBacklogFromDb() {
  if (!cruscottoDbFileExists()) {
    return null;
  }

  const db = await openCruscottoDb();

  try {
    // 1. Ultimo sync run completato con almeno una issue
    const syncRun = await db.syncRun.findFirst({
      where  : { status: "success", issueCount: { gt: 0 } }
    , orderBy: { finishedAt: "desc" }
    });

    if (!syncRun) {
      return null;
    }

    // 2. Issue + sprint join per il sync run
    const rows = await db.jiraIssue.findMany({
      where  : { syncRunId: syncRun.id }
    , orderBy: [{ devSort: "asc" }, { jiraKey: "asc" }]
    , include: {
        sprints: {
          include: { sprint: true }
        },
      }
    });

    if (!rows.length) {
      return null;
    }

    const jiraSprints = await db.jiraSprint.findMany({ orderBy: { id: "asc" } });
    const planRows    = await db.workingPlanSprintKeys.findMany({
      where: { syncRunId: syncRun.id }
    });

    /** @type {Record<string, string[]>} */
    const boardSprintKeysByPlanName = {};

    for (const row of planRows) {
      try {
        boardSprintKeysByPlanName[row.planSprintName] = JSON.parse(row.issueKeys);
      } catch {
        boardSprintKeysByPlanName[row.planSprintName] = [];
      }
    }

    // 3. Normalizza righe al tipo JiraBacklogRow + metadati sync
    /** @type {import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow[]} */
    const issues = rows.map((row) => ({
      key              : row.jiraKey
    , type             : row.issueType
    , tier             : /** @type {"epic"|"task"|"subtask"} */ (row.tier)
    , isStoryLike      : row.isStoryLike
    , summary          : row.summary
    , status           : row.status
    , parentKey        : row.parentJiraKey
    , depth            : row.depth
    , hasChildren      : row.hasChildren
    , devOrder         : row.devOrder ?? undefined
    , devSprint        : row.devSprint ?? undefined
    , devSprintName    : row.devSprintName ?? undefined
    , devSort          : row.devSort ?? undefined
    , isSprint6Obsolete: row.isSprint6Obsolete
    , relatedKeys      : parseRelatedKeys(row.relatedKeys)
    , jiraSprints      : row.sprints.map(({ sprint }) => ({
        id   : sprint.id
      , name : sprint.name
      , state: sprint.state
      })),
    }));

    return {
      fetchedAt                 : syncRun.finishedAt?.toISOString() ?? syncRun.startedAt.toISOString()
    , total                     : issues.length
    , epics                     : issues.filter((row) => row.tier === "epic").length
    , issues
    , jiraSprints               : jiraSprints.map((sprint) => ({
        id       : sprint.id
      , name     : sprint.name
      , state    : sprint.state
      , startDate: sprint.startDate?.toISOString() ?? null
      , endDate  : sprint.endDate?.toISOString() ?? null
      }))
    , jiraSprintsByName         : indexJiraSprintsFromRows(jiraSprints)
    , boardSprintKeysByPlanName
    , source                    : "cruscotto.database"
    , syncRunId                 : syncRun.id
    };
  } finally {
    await closeCruscottoDb();
  }
}
