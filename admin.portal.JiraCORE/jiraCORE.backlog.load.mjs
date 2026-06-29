/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-18 21:32
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 21:32   by: IbyEll
 * modificato il: 2026-06-18 21:32   by: IbyEll
 * ticket refirement: ADMIN-144 cache backlog SQLite cruscotto
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                 Carica backlog Jira da cache SQLite cruscotto.database — shape fetchJiraBacklog.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - fetchJiraBacklog live su API Jira è lento — tab backlog e working plan devono leggere cache locale.
 *   - Evita chiamate Atlassian ripetute ad ogni refresh pagina cruscotto quando db:sync è recente.
 *
 *   A cosa serve:
 *   - Legge ultimo SyncRun success con issue da cruscotto.db e restituisce payload allineato a fetchJiraBacklog.
 *   - Include sprint, workingPlan keys e metadati syncRunId per UI e smoke test.
 *
 * Generalizzazione:
 *   Si — path DB da CRUSCOTTO_DB_PATH; schema Prisma condiviso tra overlay PortalAdmin.
 *
 * Input:
 *   - CRUSCOTTO_DB_PATH — override path SQLite; default da cruscotto.database/cruscotto.db.config.mjs
 *   - Ultimo syncRun status success con issueCount > 0 in cruscotto.db
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.jira.backlog.mjs — loadJiraBacklog({ forceApi: false })
 *   - scripts/smoke-cruscotto-db.mjs — verifica fallback cache
 *   - test.smoke/smoke-cruscotto-db.mjs — smoke ADMIN-99
 *
 * Export principali:
 *   - loadJiraBacklogFromDb — ultimo SyncRun + issue/sprint/plan keys o null se cache assente
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */


import { cruscottoDbFileExists, openCruscottoDb } from "../cruscotto.database/cruscotto.db.config.mjs";
import { buildBacklogTree } from "../cruscotto.frontend/cruscotto.jira.backlog.mjs";

/**
 * @param {Array<{ id: number, name: string, state: string, startDate?: Date | null, endDate?: Date | null }>} rows
 */
function indexJiraSprintsFromRows(rows) {
  /** @type {Record<string, { id: number, name: string, state: string, startDate: string | null, endDate: string | null }>} */
  const byName = {};

  for (const sprint of rows) {
    byName[ sprint.name] = {
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
 * @param {string | null | undefined} rawFields
 * @returns {string | null}
 */
function jiraDescriptionFromRawFields(rawFields) {
  if (!rawFields) {
    return null;
  }

  try {
    const parsed = typeof rawFields === "string" ? JSON.parse(rawFields) : rawFields;
    const text = typeof parsed?.jiraDescription === "string" ? parsed.jiraDescription.trim() : "";

    return text || null;
  } catch {
    return null;
  }
}

/**
 * Campi PR/WIP copiati in jira_issue.raw_fields dopo sync post-merge (stellina backlog senza WIP).
 *
 * @param {string | null | undefined} rawFields
 * @returns {{
 *   prState?: string
 *   prPollComplete?: boolean
 *   backlogStar?: boolean
 *   prAppliedAt?: string
 *   prMergedAt?: string
 *   prUrl?: string
 * }}
 */
function wipPrMetaFromRawFields(rawFields) {
  if (!rawFields) {
    return {};
  }

  try {
    const parsed = typeof rawFields === "string" ? JSON.parse(rawFields) : rawFields;

    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const prPollComplete = parsed.prPollComplete === true ? true : undefined;
    const backlogStar    = parsed.backlogStar === true ? true : undefined;
    const prState        = typeof parsed.prState === "string" ? parsed.prState : undefined;
    const prTitle        = typeof parsed.prTitle === "string" ? parsed.prTitle : undefined;
    const prAppliedAt    = typeof parsed.prAppliedAt === "string" ? parsed.prAppliedAt : undefined;
    const prMergedAt     = typeof parsed.prMergedAt === "string" ? parsed.prMergedAt : undefined;
    const prUrl          = typeof parsed.prUrl === "string" && parsed.prUrl.startsWith("http")
      ? parsed.prUrl
      : undefined;

    if (!prPollComplete && !backlogStar && !prState && !prMergedAt && !prUrl && !prTitle) {
      return {};
    }

    return {
      ...(prState ? { prState } : {})
    , ...(prPollComplete ? { prPollComplete } : {})
    , ...(backlogStar ? { backlogStar } : {})
    , ...(prAppliedAt ? { prAppliedAt } : {})
    , ...(prMergedAt ? { prMergedAt } : {})
    , ...(prTitle ? { prTitle } : {})
    , ...(prUrl ? { prUrl } : {})
    };
  } catch {
    return {};
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
  const issuesRaw = rows.map((row) => {
    const wipPrMeta = wipPrMetaFromRawFields(row.rawFields);

    return {
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
    , isObsolete: row.isObsolete
    , relatedKeys      : parseRelatedKeys(row.relatedKeys)
    , jiraDescription  : jiraDescriptionFromRawFields(row.rawFields) ?? undefined
    , ...wipPrMeta
    , jiraSprints      : row.sprints.map(({ sprint }) => ({
        id   : sprint.id
      , name : sprint.name
      , state: sprint.state
      }))
    };
  });

  // Ordine depth-first Epic → Story → Subtask (come fetchJiraBacklog live), non devSort/jiraKey SQL.
  const issues = buildBacklogTree(issuesRaw);

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
}
