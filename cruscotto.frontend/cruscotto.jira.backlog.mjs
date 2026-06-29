/**
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-17
 *
 * Backlog Jira — fetch Cloud API, normalizzazione righe e albero Epic → Story/Bug/Todo → subtask.
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - unica fonte backlog live per cruscotto, sync DB e script JiraCORE
 *   - evita duplicare JQL, paginazione e mapping campi sprint/parent in ogni pagina
 *
 *   A cosa serve:
 *   - fetchJiraBacklog — JQL progetto overlay, albero Epic/Story/subtask, sprint board Agile
 *   - loadJiraBacklog — cache DB (cruscotto.database) con fallback API; forceApi per backlog live
 *   - helper tipo issue, tier albero e stato done condivisi tra moduli frontend
 *
 * Generalizzazione:
 *   Si — credenziali e cloudId da env;  
 *
 * Input:
 *   - JIRA_EMAIL, JIRA_API_TOKEN — auth Basic verso Jira Cloud API
 *   - JIRA_CLOUD_ID — tenant Atlassian (default cloud PortalAdmin)
 *   - JIRA_BOARD_ID — board sprint per customfield_10020
 *   - opts.forceApi — loadJiraBacklog: ignora cache DB se true
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.server.mjs — fetchJiraBacklog, loadJiraBacklog, fetchJiraIssueStatus
 *   - cruscotto.database/Jira.backlog.sync.mjs, jiraCORE.backlog.load.mjs — persistenza e lettura cache
 *   - cruscotto.jira.backlog.insights.mjs, project.tree.plan.mjs — insight e piano
 *   - admin.portal.JiraCORE/JiraCORE.sprint.create.mjs, admin.portal.JiraCORE/JiraCORE.repo.issuekey.signal.analysis.mjs — tooling batch
 *
 * Export principali:
 *   - fetchJiraBacklog, loadJiraBacklog — backlog normalizzato
 *   - buildBacklogTree, isEpicType, isStoryLikeType, isJiraStatusDone — modello e utilità
 *   - fetchJiraSprints, fetchBoardSprintKeysByName — sprint board Jira
 */

import "../admin.portal.lib/portal.load.env.mjs";
import { getProjectConfig, resolveJiraBoardId } from "../admin.portal.lib/project.config.mjs";
  
import {
  resolveRelatedTicketKeys
, adfToPlainText
} from "../admin.portal.JiraCORE/jiraCORE.backlog.related.tickets.mjs";

const JIRA_SPRINT_FIELD = "customfield_10020";

function resolveBacklogBoardId() {
  return resolveJiraBoardId(getProjectConfig());
}

const CLOUD_ID = process.env.JIRA_CLOUD_ID ?? "3caddd74-469e-4ca3-adf8-926f79c98e7c";
const API_BASE = `https://api.atlassian.com/ex/jira/${CLOUD_ID}`;

/**
 * @returns {string}
 */
function authHeader() {
  const email = process.env.JIRA_EMAIL?.trim();
  const token = process.env.JIRA_API_TOKEN?.trim();

  if (!email || !token) {
    throw new Error("Mancano JIRA_EMAIL e/o JIRA_API_TOKEN in .env");
  }

  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function jiraFetch(path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept        : "application/json",
      "Content-Type": "application/json",
      Authorization : authHeader(),
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const msg = typeof body === "object" && body?.errorMessages?.length
      ? body.errorMessages.join("; ")
      : typeof body === "object" && body?.message
        ? body.message
        : text || res.statusText;

    if (res.status === 401) {
      throw new Error(
        `${init.method ?? "GET"} ${path} → 401: credenziali Jira non valide. `
        + "Verifica JIRA_EMAIL (account Atlassian) e JIRA_API_TOKEN in .env "
        + "(nuovo token: https://id.atlassian.com/manage-profile/security/api-tokens), "
        + "poi riavvia la dashboard."
      );
    }

    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${msg}`);
  }

  return body;
}

/**
 * @param {string} type
 * @returns {boolean}
 */
export function isEpicType(type) {
  return type.toLowerCase().includes("epic");
}

/**
 * Sub-task / Subtask — not Story/Bug/Todo parent issues.
 *
 * @param {string} type
 * @returns {boolean}
 */
export function isSubtaskType(type) {
  const t = type.toLowerCase().trim();

  if (t.includes("sub-task") || t.includes("subtask")) {
    return true;
  }

  if (!t.includes("sub")) {
    return false;
  }

  return !(t.includes("story") || t.includes("bug") || t.includes("todo") || t.includes("to do"));
}

/**
 * Story, Bug, Todo (incl. "To Do") — same tier and UI treatment as Story.
 *
 * @param {string} type
 * @returns {boolean}
 */
export function isStoryLikeType(type) {
  const t = type.toLowerCase().trim();

  if (isEpicType(type) || isSubtaskType(type)) {
    return false;
  }

  return t.includes("story")
    || t.includes("bug")
    || t.includes("todo")
    || t.includes("to do");
}

/**
 * @param {string} type
 * @returns {"epic" | "task" | "subtask"}
 */
export function backlogTier(type) {
  if (isEpicType(type)) {
    return "epic";
  }

  if (isSubtaskType(type)) {
    return "subtask";
  }

  return "task";
}

/**
 * @typedef {{
 *   key: string,
 *   type: string,
 *   tier: "epic" | "task" | "subtask",
 *   isStoryLike: boolean,
 *   summary: string,
 *   status: string,
 *   parentKey: string | null,
 *   depth: number,
 *   hasChildren: boolean,
 *   devOrder?: string | null,
 *   devSprint?: number | null,
 *   devSprintName?: string | null,
 *   devSort?: number | null,
 *   jiraSprints?: Array<{ id: number, name: string, state: string }>,
 *   relatedKeys?: string[],
 *   jiraDescription?: string | null,
 *   isObsolete?: boolean,
 *   prState?: string,
 *   prPollComplete?: boolean,
 *   backlogStar?: boolean,
 *   prAppliedAt?: string,
 *   prMergedAt?: string,
 *   prTitle?: string,
 *   prUrl?: string,
 * }} JiraBacklogRow
 */

/**
 * @typedef {JiraBacklogRow & { children: Array<JiraBacklogRow & { children: unknown[] }> }} BacklogNode
 */

/**
 * @param {Omit<JiraBacklogRow, "depth" | "hasChildren" | "tier">[]} issues
 * @returns {JiraBacklogRow[]}
 */
export function buildBacklogTree(issues) {
  /** @type {Map<string, BacklogNode>} */
  const byKey = new Map();

  for (const row of issues) {
    byKey.set(row.key, {
      ...row,
      tier        : backlogTier(row.type),
      isStoryLike : isStoryLikeType(row.type),
      depth       : 0,
      hasChildren : false,
      children    : [],
    });
  }

  /** @type {Set<string>} */
  const attached = new Set();

  for (const node of byKey.values()) {
    if (node.parentKey && byKey.has(node.parentKey)) {
      byKey.get(node.parentKey).children.push(node);
      attached.add(node.key);
    }
  }

  /**
   * @param {BacklogNode[]} list
   */
  const sortNodes = (list) => {
    list.sort((a, b) => {
      const tierOrder = { epic: 0, task: 1, subtask: 2 };
      const ta = tierOrder[a.tier];
      const tb = tierOrder[b.tier];

      if (ta !== tb) {
        return ta - tb;
      }

      return a.key.localeCompare(b.key, undefined, { numeric: true });
    });
  };

  for (const node of byKey.values()) {
    if (node.children.length > 0) {
      node.hasChildren = true;
      sortNodes(node.children);
    }
  }

  const roots = [...byKey.values()].filter((node) => node.tier === "epic");
  sortNodes(roots);

  const orphans = [...byKey.values()].filter((node) => node.tier !== "epic" && !attached.has(node.key));
  sortNodes(orphans);

  /** @type {JiraBacklogRow[]} */
  const flat = [];

  /**
   * @param {BacklogNode} node
   * @param {number} depth
   */
  function walk(node, depth) {
    const { children: _children, ...rest } = node;

    flat.push({
      ...rest,
      depth,
      hasChildren: node.hasChildren,
    });

    for (const child of node.children) {
      walk(child, depth + 1);
    }
  }

  for (const root of roots) {
    walk(root, 0);
  }

  if (orphans.length > 0) {
    for (const orphan of orphans) {
      walk(orphan, 0);
    }
  }

  return flat;
}

/**
 * @param {string} statusName
 * @param {string} [statusCategoryKey]
 * @returns {boolean}
 */
export function isJiraStatusDone(statusName, statusCategoryKey) {
  if (statusCategoryKey === "done") {
    return true;
  }

  return /^(fatto|completato|done|closed|resolved)$/i.test(String(statusName).trim());
}

/**
 * @param {string} issueKey
 * @returns {Promise<{ key: string, summary: string, status: string, done: boolean }>}
 */
export async function fetchJiraIssueStatus(issueKey) {
  const key = String(issueKey).trim().toUpperCase();

  if (!/^(ADMIN|JLO)-\d+$/.test(key)) {
    throw new Error(`Issue key non valida: ${issueKey}`);
  }

  const issue = await jiraFetch(
    `/rest/api/3/issue/${key}?fields=${encodeURIComponent("summary,status")}`
  );
  const statusName = issue.fields?.status?.name ?? "—";
  const categoryKey = issue.fields?.status?.statusCategory?.key ?? "";

  return {
    key,
    summary: issue.fields?.summary ?? "",
    status : statusName,
    done   : isJiraStatusDone(statusName, categoryKey),
  };
}

/**
 * @typedef {{
 *   id: number,
 *   name: string,
 *   state: string,
 *   startDate?: string | null,
 *   endDate?: string | null,
 * }} JiraSprintInfo
 */

/**
 * Sprint board Jira (active, future, closed) — API Agile.
 *
 * @returns {Promise<JiraSprintInfo[]>}
 */
export async function fetchJiraSprints() {
  /** @type {JiraSprintInfo[]} */
  const all = [];
  let startAt = 0;

  for (;;) {
    const page = await jiraFetch(
      `/rest/agile/1.0/board/${resolveBacklogBoardId()}/sprint?state=active,future,closed&startAt=${startAt}&maxResults=50`
    );

    for (const sprint of page.values ?? []) {
      all.push({
        id       : Number(sprint.id)
      , name     : String(sprint.name ?? "")
      , state    : String(sprint.state ?? "")
      , startDate: sprint.startDate ?? null
      , endDate  : sprint.endDate ?? null
      });
    }

    if (page.isLast === true || !page.values?.length) {
      break;
    }

    startAt += page.values.length;
  }

  return all;
}

/**
 * @param {string} name
 * @returns {string}
 */
function normalizeSprintLabel(name) {
  return String(name)
    .toLowerCase()
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {JiraSprintInfo[]} sprints
 */
export function indexJiraSprintsByName(sprints) {
  /** @type {Record<string, JiraSprintInfo>} */
  const byName = {};

  for (const sprint of sprints) {
    byName[normalizeSprintLabel(sprint.name)] = sprint;
  }

  return byName;
}

/**
 * Issue sul board Agile per ogni sprint Jira (active/future; closed → elenco vuoto).
 *
 * @param {JiraSprintInfo[]} jiraSprints
 * @returns {Promise<Record<string, string[]>>}
 */
export async function fetchBoardSprintKeysByName(jiraSprints) {
  /** @type {Record<string, string[]>} */
  const byName = {};

  for (const sprint of jiraSprints) {
    if (sprint.state === "closed") {
      byName[sprint.name] = [];
      continue;
    }

    /** @type {string[]} */
    const keys  = [];
    let startAt = 0;

    for (;;) {
      const page = await jiraFetch(
        `/rest/agile/1.0/sprint/${sprint.id}/issue?startAt=${startAt}&maxResults=50`
      );

      for (const issue of page.issues ?? []) {
        keys.push(String(issue.key));
      }

      if (page.isLast === true || !page.issues?.length) {
        break;
      }

      startAt += page.issues.length;
    }

    byName[sprint.name] = keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  return byName;
}

/**
 * @returns {Promise<{ fetchedAt: string, total: number, epics: number, issues: JiraBacklogRow[], jiraSprints: JiraSprintInfo[], jiraSprintsByName: Record<string, JiraSprintInfo>, boardSprintKeysByPlanName: Record<string, string[]> }>}
 */
export async function fetchJiraBacklog() {
  /** @type {Omit<JiraBacklogRow, "depth" | "hasChildren" | "tier">[]} */
  const raw = [];
  const jiraProject = getProjectConfig().PRJ_JIRA_PREFIX;
  const jql = `project = ${jiraProject} ORDER BY rank ASC`;
  const fields = ["summary", "issuetype", "status", "parent", "description", "issuelinks", JIRA_SPRINT_FIELD];
  let nextPageToken = null;

  do {
    /** @type {Record<string, unknown>} */
    const payload = {
      jql,
      maxResults: 100,
      fields,
    };

    if (nextPageToken) {
      payload.nextPageToken = nextPageToken;
    }

    const page = await jiraFetch("/rest/api/3/search/jql", {
      method: "POST",
      body  : JSON.stringify(payload),
    });

    for (const issue of page.issues ?? []) {
      const jiraDescription = adfToPlainText(issue.fields?.description).trim() || null;

      raw.push({
        key        : issue.key,
        type       : issue.fields?.issuetype?.name ?? "—",
        summary    : issue.fields?.summary ?? "",
        status     : issue.fields?.status?.name ?? "—",
        parentKey  : issue.fields?.parent?.key ?? null,
        jiraDescription,
        relatedKeys: resolveRelatedTicketKeys(
          issue.key
        , issue.fields?.description
        , issue.fields?.issuelinks
        ),
        jiraSprints: (issue.fields?.[JIRA_SPRINT_FIELD] ?? []).map((sprint) => ({
          id   : Number(sprint.id)
        , name : String(sprint.name ?? "")
        , state: String(sprint.state ?? "")
        })),
      });
    }

    nextPageToken = page.nextPageToken ?? null;

    if (!page.issues?.length && !nextPageToken) {
      break;
    }
  } while (nextPageToken);

  const issues              = buildBacklogTree(raw);
  const epics               = issues.filter((row) => row.tier === "epic").length;
  const jiraSprints         = await fetchJiraSprints();
  const boardSprintKeysByPlanName = await fetchBoardSprintKeysByName(jiraSprints);

  return {
    fetchedAt         : new Date().toISOString(),
    total             : issues.length,
    epics,
    issues,
    jiraSprints,
    jiraSprintsByName : indexJiraSprintsByName(jiraSprints),
    boardSprintKeysByPlanName,
  };
}

/**
 * Load backlog — due pipeline in parallelo (vedi cruscotto.server route API):
 * - forceApi: true  → GET /api/jira/backlog (app #backlog) — Jira live; cache ignorata
 * - dbOnly: true    → GET /api/jira/my-backlog (app #mybacklog) — solo cruscotto DB
 * - default         → cache DB se presente, altrimenti API (script/sync interni)
 *
 * @param {{ forceApi?: boolean, dbOnly?: boolean }} [opts]
 * @returns {Promise<Awaited<ReturnType<typeof fetchJiraBacklog>> & { source?: string, syncRunId?: string }>}
 */
export async function loadJiraBacklog(opts = {}) {
  const { loadJiraBacklogFromDb } = await import("../admin.portal.JiraCORE/jiraCORE.backlog.load.mjs");

  if (!opts.forceApi) {
    const cached = await loadJiraBacklogFromDb();

    if (cached) {
      return cached;
    }

    if (opts.dbOnly) {
      throw new Error(
        "Cache backlog assente nel cruscotto DB — usa Sync Jira Backlog per scaricare da Atlassian."
      );
    }
  }

  const live = await fetchJiraBacklog();

  return { ...live, source: "jira-api" };
}
