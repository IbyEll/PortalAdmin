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

import { fetchJiraBacklog, isJiraStatusDone } from "../cruscotto.frontend/cruscotto.jira.backlog.mjs";

import { openCruscottoDb, resolveCruscottoDbPath } from "./cruscotto.db.config.mjs";

/**
 * JSON raw_fields cache — description Jira plain text da sync API.
 *
 * @param {{ jiraDescription?: string | null }} row
 * @param {string} syncedAt ISO-8601
 * @returns {string | null}
 */
function rawFieldsFromBacklogRow(row, syncedAt) {
  const jiraDescription = typeof row.jiraDescription === "string"
    ? row.jiraDescription.trim()
    : "";

  if (!jiraDescription) {
    return null;
  }

  return JSON.stringify({
    jiraDescription
  , jiraDescriptionSyncedAt: syncedAt
  });
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
    // 2. Upsert tutti gli sprint referenziati (board + customfield per issue)
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

    // 3. Inserisce issue + link sprint per riga backlog
    const syncedAt = backlog.fetchedAt ?? new Date().toISOString();

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
        , rawFields        : rawFieldsFromBacklogRow(row, syncedAt)
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

    return {
      syncRunId  : syncRun.id
    , issueCount : backlog.issues.length
    , dbPath     : resolveCruscottoDbPath()
    , fetchedAt  : backlog.fetchedAt
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

  return syncJiraBacklogSnapshot(backlog);
}
