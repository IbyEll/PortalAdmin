/**
 * Persist fetchJiraBacklog snapshot into cruscotto SQLite (ADMIN-82 / ADMIN-142).
 */

import { fetchJiraBacklog, isJiraStatusDone } from "../jira-backlog.mjs";

import { closeCruscottoDb, openCruscottoDb, resolveCruscottoDbPath } from "./index.mjs";

/**
 * @param {Awaited<ReturnType<typeof fetchJiraBacklog>>} backlog
 */
export async function syncJiraBacklogSnapshot(backlog) {
  const db = await openCruscottoDb();

  await db.syncRun.deleteMany({});

  const syncRun = await db.syncRun.create({
    data: {
      status    : "running"
    , source    : "jira-api"
    , issueCount: 0
    },
  });

  try {
    for (const sprint of backlog.jiraSprints ?? []) {
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

    for (const row of backlog.issues) {
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
        , isSprint6Obsolete: row.isSprint6Obsolete ?? false
        , relatedKeys      : JSON.stringify(row.relatedKeys ?? [])
        , syncRunId        : syncRun.id
        },
      });

      issueIds.set(row.key, created.id);

      for (const sprint of row.jiraSprints ?? []) {
        await db.jiraIssueSprint.upsert({
          where: {
            issueId_sprintId: {
              issueId  : created.id
            , sprintId : sprint.id
            },
          }
        , create: {
            issueId  : created.id
          , sprintId : sprint.id
          }
        , update: {},
        });
      }
    }

    for (const [planSprintName, keys] of Object.entries(backlog.boardSprintKeysByPlanName ?? {})) {
      await db.workingPlanSprintKeys.create({
        data: {
          planSprintName
        , issueKeys      : JSON.stringify(keys)
        , syncRunId      : syncRun.id
        },
      });
    }

    await db.syncRun.update({
      where: { id: syncRun.id }
    , data : {
        status     : "success"
      , finishedAt : new Date()
      , issueCount : backlog.issues.length
      },
    });

    return {
      syncRunId  : syncRun.id
    , issueCount : backlog.issues.length
    , dbPath     : resolveCruscottoDbPath()
    , fetchedAt  : backlog.fetchedAt
    };
  } catch (err) {
    await db.syncRun.update({
      where: { id: syncRun.id }
    , data : {
        status    : "failed"
      , finishedAt: new Date()
      },
    });

    throw err;
  } finally {
    await closeCruscottoDb();
  }
}

/**
 * Fetch live Jira backlog and persist to cruscotto.db.
 *
 * @returns {Promise<{ syncRunId: string, issueCount: number, dbPath: string, fetchedAt: string }>}
 */
export async function syncJiraBacklogFromApi() {
  const backlog = await fetchJiraBacklog();

  return syncJiraBacklogSnapshot(backlog);
}
