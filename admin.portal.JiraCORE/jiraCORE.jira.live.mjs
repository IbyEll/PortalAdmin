/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:30
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:30   by: IbyEll
 * modificato il: 2026-06-23 21:30   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Jira Cloud REST live — fetch, ADF markdown, update description e transizione Fatto.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Workflow database step 8 PUSH e veve devono scrivere su Jira senza MCP Cursor in CI/script.
 *
 *   A cosa serve:
 *   - jiraLiveFetch, syncIssueFromWipMarkdown e transitionIssueToDone via REST Atlassian.
 *
 * Generalizzazione:
 *   Si — JIRA_CLOUD_ID, JIRA_EMAIL, JIRA_API_TOKEN da env; key ADMIN e JLO.
 *
 * Input:
 *   - JIRA_EMAIL, JIRA_API_TOKEN — Basic auth Atlassian
 *   - JIRA_CLOUD_ID — cloud id sito (default myfuturejobsearch)
 *
 * Consumatori:
 *   - admin.portal.JiraCORE/jiraCORE.wip.push.mjs — push description e transizione parent
 *   - admin.portal.JiraCORE/jiraCORE.backlog.sync.mjs — fetch live complementare
 *
 * Export principali:
 *   - jiraLiveFetch — wrapper fetch REST /rest/api/3
 *   - syncIssueFromWipMarkdown — aggiorna description issue da markdown WIP
 *   - transitionIssueToDone — transizione stato Fatto se disponibile
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import "../lib/portal.load.env.mjs";

const CLOUD_ID = process.env.JIRA_CLOUD_ID ?? "3caddd74-469e-4ca3-adf8-926f79c98e7c";
const API_BASE = `https://api.atlassian.com/ex/jira/${CLOUD_ID}`;

const DONE_TRANSITION_RE = /^(done|fatto|completato|closed|resolved|complete)$/i;

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
export async function jiraLiveFetch(path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init
  , headers: {
      Accept        : "application/json"
    , "Content-Type": "application/json"
    , Authorization : authHeader()
    , ...(init.headers ?? {})
    }
  });

  const text = await res.text();
  /** @type {unknown} */
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const errObj = /** @type {{ errorMessages?: string[], message?: string }} */ (body);
    const msg = errObj?.errorMessages?.length
      ? errObj.errorMessages.join("; ")
      : errObj?.message
        ? errObj.message
        : text || res.statusText;

    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${msg}`);
  }

  return body;
}

/**
 * Converte markdown veve (heading, bullet checkbox, paragrafi) in ADF Jira.
 *
 * @param {string} markdown
 * @returns {{ type: "doc", version: 1, content: object[] }}
 */
export function markdownToAdfDoc(markdown) {
  const lines = String(markdown ?? "").split(/\r?\n/);
  /** @type {object[]} */
  const content = [];
  /** @type {object[]} */
  let listItems = [];

  /**
   * @param {object[]} items
   */
  function flushList(items) {
    if (items.length === 0) {
      return;
    }

    content.push({
      type   : "bulletList"
    , content: items
    });
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      flushList(listItems);
      listItems = [];
      continue;
    }

    if (line.startsWith("## ")) {
      flushList(listItems);
      listItems = [];
      content.push({
        type   : "heading"
      , attrs  : { level: 2 }
      , content: [{ type: "text", text: line.slice(3).trim() }]
      });
      continue;
    }

    const checkbox = line.match(/^-\s*\[([ xX])\]\s*(.+)$/);

    if (checkbox) {
      const mark = checkbox[1].toLowerCase();
      const prefix = mark === "x" ? "☑ " : "☐ ";
      listItems.push({
        type   : "listItem"
      , content: [{
          type   : "paragraph"
        , content: [{ type: "text", text: `${prefix}${checkbox[2].trim()}` }]
        }]
      });
      continue;
    }

    if (line.startsWith("- ")) {
      listItems.push({
        type   : "listItem"
      , content: [{
          type   : "paragraph"
        , content: [{ type: "text", text: line.slice(2).trim() }]
        }]
      });
      continue;
    }

    flushList(listItems);
    listItems = [];
    content.push({
      type   : "paragraph"
    , content: [{ type: "text", text: line.trim() }]
    });
  }

  flushList(listItems);

  if (content.length === 0) {
    content.push({
      type   : "paragraph"
    , content: [{ type: "text", text: "—" }]
    });
  }

  return { type: "doc", version: 1, content };
}

/**
 * @param {string} issueKey
 * @param {string} markdown
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function updateIssueDescriptionMarkdown(issueKey, markdown, opts = {}) {
  const key = String(issueKey).trim().toUpperCase();
  const adf = markdownToAdfDoc(markdown);

  if (opts.dryRun) {
    return { key, dryRun: true, chars: String(markdown ?? "").length };
  }

  await jiraLiveFetch(`/rest/api/3/issue/${key}`, {
    method: "PUT"
  , body  : JSON.stringify({
      fields: {
        description: adf
      }
    })
  });

  return { key, updated: true };
}

/**
 * @param {string} issueKey
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function transitionIssueToDone(issueKey, opts = {}) {
  const key = String(issueKey).trim().toUpperCase();

  const issue = /** @type {{ fields?: { status?: { name?: string, statusCategory?: { key?: string } } } }} */ (
    await jiraLiveFetch(`/rest/api/3/issue/${key}?fields=${encodeURIComponent("status")}`)
  );

  if (issue.fields?.status?.statusCategory?.key === "done") {
    return { key, skipped: true, reason: "already_done", status: issue.fields.status.name ?? "Done" };
  }

  const payload = /** @type {{ transitions?: Array<{ id: string, name: string, to?: { statusCategory?: { key?: string } } }> }} */ (
    await jiraLiveFetch(`/rest/api/3/issue/${key}/transitions`)
  );

  const transition = (payload.transitions ?? []).find((row) => {
    if (DONE_TRANSITION_RE.test(String(row.name ?? "").trim())) {
      return true;
    }

    return row.to?.statusCategory?.key === "done";
  });

  if (!transition) {
    throw new Error(`Nessuna transizione Fatto/Done per ${key}`);
  }

  if (opts.dryRun) {
    return {
      key
    , dryRun      : true
    , transitionId: transition.id
    , name        : transition.name
    };
  }

  await jiraLiveFetch(`/rest/api/3/issue/${key}/transitions`, {
    method: "POST"
  , body  : JSON.stringify({ transition: { id: transition.id } })
  });

  return { key, transitionId: transition.id, name: transition.name };
}

/**
 * @param {string} issueKey
 * @param {string} markdown
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function syncIssueFromWipMarkdown(issueKey, markdown, opts = {}) {
  const description = await updateIssueDescriptionMarkdown(issueKey, markdown, opts);
  const transition = await transitionIssueToDone(issueKey, opts);

  return { description, transition };
}
