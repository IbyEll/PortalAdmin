/**
 * Scarica l'intero backlog JLO da Jira Cloud e ordina in albero Epic → Story/Bug/Todo → subtask.
 */

import "./load-env.mjs";
import {
  applyDevOrder
, applyEpicLegacySprintPins
, applyJiraSprintFallback
, applySprint6ObsoleteDevOrder
, applySprint6TailDevOrder
, JLO_WORKING_PLAN
, normalizeSprintLabel
} from "./jira-working-order.mjs";
import { resolveRelatedTicketKeys } from "./jira-related-tickets.mjs";

const JIRA_SPRINT_FIELD = "customfield_10020";
const JIRA_BOARD_ID     = Number(process.env.JIRA_BOARD_ID ?? 68);

const CLOUD_ID = process.env.JIRA_CLOUD_ID ?? "3caddd74-469e-4ca3-adf8-926f79c98e7c";
const API_BASE = `https://api.atlassian.com/ex/jira/${CLOUD_ID}`;

/**
 * @returns {string}
 */
function authHeader() {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

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
 *   isSprint6Obsolete?: boolean,
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
    flat.push({
      key         : node.key,
      type        : node.type,
      tier        : node.tier,
      isStoryLike : node.isStoryLike,
      summary     : node.summary,
      status      : node.status,
      parentKey   : node.parentKey,
      depth,
      hasChildren : node.hasChildren,
      jiraSprints : node.jiraSprints ?? [],
      relatedKeys : node.relatedKeys ?? [],
      isSprint6Obsolete: node.isSprint6Obsolete ?? false,
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

  if (!/^JLO-\d+$/.test(key)) {
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
      `/rest/agile/1.0/board/${JIRA_BOARD_ID}/sprint?state=active,future,closed&startAt=${startAt}&maxResults=50`
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
 * Issue attualmente sul board Agile per ogni sprint del piano Working (solo active/future).
 *
 * @param {JiraSprintInfo[]} jiraSprints
 * @returns {Promise<Record<string, string[]>>}
 */
export async function fetchWorkingPlanBoardSprintKeys(jiraSprints) {
  /** @type {Record<string, string[]>} */
  const byPlanName = {};

  for (const block of JLO_WORKING_PLAN) {
    const target = normalizeSprintLabel(block.name);
    const sprint = jiraSprints.find((row) => normalizeSprintLabel(row.name) === target);

    if (!sprint || sprint.state === "closed") {
      byPlanName[block.name] = [];
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

    byPlanName[block.name] = keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  return byPlanName;
}

/**
 * @returns {Promise<{ fetchedAt: string, total: number, epics: number, issues: JiraBacklogRow[], jiraSprints: JiraSprintInfo[], jiraSprintsByName: Record<string, JiraSprintInfo>, boardSprintKeysByPlanName: Record<string, string[]> }>}
 */
export async function fetchJiraBacklog() {
  /** @type {Omit<JiraBacklogRow, "depth" | "hasChildren" | "tier">[]} */
  const raw = [];
  const jql = "project = JLO ORDER BY rank ASC";
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
      raw.push({
        key        : issue.key,
        type       : issue.fields?.issuetype?.name ?? "—",
        summary    : issue.fields?.summary ?? "",
        status     : issue.fields?.status?.name ?? "—",
        parentKey  : issue.fields?.parent?.key ?? null,
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

  const ordered = applyDevOrder(buildBacklogTree(raw));
  const byKey   = new Map(ordered.map((row) => [row.key, row]));
  let issues    = applyEpicLegacySprintPins(applyJiraSprintFallback(ordered), byKey);
  issues        = applySprint6TailDevOrder(issues);
  issues        = applySprint6ObsoleteDevOrder(issues);
  const epics = issues.filter((row) => row.tier === "epic").length;
  const jiraSprints = await fetchJiraSprints();
  const boardSprintKeysByPlanName = await fetchWorkingPlanBoardSprintKeys(jiraSprints);

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
 * Load backlog from cruscotto.db when populated; otherwise fetch live Jira API.
 *
 * @param {{ forceApi?: boolean }} [opts]
 * @returns {Promise<Awaited<ReturnType<typeof fetchJiraBacklog>> & { source?: string, syncRunId?: string }>}
 */
export async function loadJiraBacklog(opts = {}) {
  if (!opts.forceApi) {
    const { loadJiraBacklogFromDb } = await import("./cruscotto-db/load-backlog.mjs");
    const cached = await loadJiraBacklogFromDb();

    if (cached) {
      return cached;
    }
  }

  const live = await fetchJiraBacklog();

  return { ...live, source: "jira-api" };
}
