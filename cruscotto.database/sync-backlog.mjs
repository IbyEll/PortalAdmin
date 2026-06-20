/**
 * Persiste snapshot fetchJiraBacklog nel SQLite cruscotto (ADMIN-82 / ADMIN-142).
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - backlog.html e load Jira devono usare cache locale, non API a ogni richiesta
 *
 *   A cosa serve:
 *   - wipe sync_run precedenti, upsert sprint/issue/plan keys da fetch live
 *
 * Consumatori:
 *   - admin.portal.JiraCORE/jiraCORE.backlog.sync.mjs — syncJiraBacklogFromApi dopo migrate
 *
 * Export principali:
 *   - syncJiraBacklogSnapshot — scrive da oggetto backlog già fetchato
 *   - syncJiraBacklogFromApi — fetch Jira + persist
 */

import { fetchJiraBacklog, isJiraStatusDone } from "../cruscotto.frontend/cruscotto.jira.backlog.mjs";

import { closeCruscottoDb, openCruscottoDb, resolveCruscottoDbPath } from "./index.mjs";

/**
 * @param {Awaited<ReturnType<typeof fetchJiraBacklog>>} backlog
 */
export async function syncJiraBacklogSnapshot(backlog) {
  const db = await openCruscottoDb();

  // 1. Reset cache — un solo sync run attivo per volta
  await db.syncRun.deleteMany({});

  const syncRun = await db.syncRun.create({
    data: {
      status    : "running"
    , source    : "jira-api"
    , issueCount: 0
    },
  });

  try {
    // 2. Upsert sprint globali
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

    // 3. Inserisce issue + link sprint per riga backlog
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
