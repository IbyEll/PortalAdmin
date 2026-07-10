/**
 * Jira Cloud — creazione issue (Bug, Story, Task, Subtask, Epic, Todo).
 */

import { jiraLiveFetch, markdownToAdfDoc } from "./jiraCORE.jira.live.mjs";

/**
 * Tipi issue ammessi in creazione programmatica.
 *
 * @type {Record<string, { jiraName: string, label: string, requiresParent?: boolean }>}
 */
export const JIRA_CREATE_ISSUE_TYPES = {
  BUG    : { jiraName: "Bug", label: "bug" }
, STORY  : { jiraName: "Story", label: "story" }
, TASK   : { jiraName: "Task", label: "task" }
, SUBTASK: { jiraName: "Subtask", label: "sub", requiresParent: true }
, EPIC   : { jiraName: "Epic", label: "epic" }
, TODO   : { jiraName: "Todo", label: "todo" }
};

/**
 * @param {string} issueTypeKey
 * @returns {{ jiraName: string, label: string, requiresParent?: boolean }}
 */
export function resolveCreateIssueType(issueTypeKey) {
  const key = String(issueTypeKey ?? "BUG").trim().toUpperCase();

  return JIRA_CREATE_ISSUE_TYPES[key] ?? JIRA_CREATE_ISSUE_TYPES.BUG;
}

/**
 * @param {{
 *   projectKey: string
 *   issueTypeKey?: string
 *   summary: string
 *   description?: string
 *   parentKey?: string | null
 *   labels?: string[]
 * }} opts
 * @returns {Promise<{ key: string, id: string, issueType: string, projectKey: string }>}
 */
export async function createJiraIssue(opts) {
  const projectKey = String(opts.projectKey).trim().toUpperCase();
  const typeDef    = resolveCreateIssueType(opts.issueTypeKey);
  const summary    = String(opts.summary ?? "").trim().slice(0, 250);

  if (!summary) {
    throw new Error("summary obbligatorio");
  }

  if (typeDef.requiresParent && !opts.parentKey) {
    throw new Error(`parentKey obbligatorio per issue type ${typeDef.jiraName}`);
  }

  /** @type {Record<string, unknown>} */
  const fields = {
    project  : { key: projectKey }
  , issuetype: { name: typeDef.jiraName }
  , summary
  };

  const description = String(opts.description ?? "").trim();

  if (description) {
    fields.description = markdownToAdfDoc(description);
  }

  if (opts.parentKey) {
    fields.parent = { key: String(opts.parentKey).trim().toUpperCase() };
  }

  const labels = (opts.labels ?? [])
    .map((l) => String(l).trim().replace(/\s+/g, ""))
    .filter(Boolean);

  if (labels.length > 0) {
    fields.labels = labels;
  }

  const created = /** @type {{ key: string, id: string }} */ (
    await jiraLiveFetch("/rest/api/3/issue", {
      method: "POST"
    , body  : JSON.stringify({ fields })
    })
  );

  return {
    key       : created.key
  , id        : created.id
  , issueType : typeDef.jiraName
  , projectKey
  };
}
