/**
 * Load Jira backlog from cruscotto SQLite cache (ADMIN-144).
 */

import { normalizeSprintLabel } from "../jira/jira.working.order.mjs";

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
 * @returns {Promise<import("../jira/jira.backlog.mjs").fetchJiraBacklog extends () => Promise<infer R> ? R : never> | null>}
 */
export async function loadJiraBacklogFromDb() {
  if (!cruscottoDbFileExists()) {
    return null;
  }

  const db = await openCruscottoDb();

  try {
    const syncRun = await db.syncRun.findFirst({
      where  : { status: "success", issueCount: { gt: 0 } }
    , orderBy: { finishedAt: "desc" }
    });

    if (!syncRun) {
      return null;
    }

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

    /** @type {import("../jira/jira.backlog.mjs").JiraBacklogRow[]} */
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
    , source                    : "cruscotto-db"
    , syncRunId                 : syncRun.id
    };
  } finally {
    await closeCruscottoDb();
  }
}
