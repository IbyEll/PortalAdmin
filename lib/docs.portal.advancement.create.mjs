/**
 * Creazione issue Jira da finding Avanzamento (colonna Issue refirement).
 */

import { createJiraIssue, JIRA_CREATE_ISSUE_TYPES } from "../admin.portal.JiraCORE/jiraCORE.jira.create.mjs";

import { formatAdvancementSectionLabel } from "./docs.portal.advancement.sections.mjs";
import { projectLabelToJiraProjectKey } from "./docs.portal.advancement.project.mjs";

/** Tipo issue default nel menu Crea. */
export const ADVANCEMENT_DEFAULT_CREATE_ISSUE_TYPE = "BUG";

/** Tipi selezionabili da pagina Avanzamento (no Sub-task). */
export const ADVANCEMENT_CREATABLE_ISSUE_TYPES = ["BUG", "STORY", "TASK", "EPIC", "TODO"].map((key) => ({
  key
, label: JIRA_CREATE_ISSUE_TYPES[key].jiraName
}));

/** @type {Record<string, string>} */
export const FINDING_CREATE_ISSUE_TYPES = {
  // es. "bug-tree-regenerate": "BUG"
};

/** @type {Record<string, string>} */
export const FINDING_PARENT_STORY_KEYS = {
  // riservato — Sub-task escluso da UI Avanzamento
};

/**
 * @param {string} issueTypeKey
 * @returns {boolean}
 */
export function isAdvancementCreatableIssueType(issueTypeKey) {
  const key = String(issueTypeKey ?? "").trim().toUpperCase();

  return ADVANCEMENT_CREATABLE_ISSUE_TYPES.some((row) => row.key === key);
}

/**
 * @param {string} findingId
 * @param {string} [requestedType]
 * @returns {string}
 */
export function resolveAdvancementCreateIssueType(findingId, requestedType) {
  const fromFinding = FINDING_CREATE_ISSUE_TYPES[findingId];
  const raw         = (fromFinding ?? requestedType ?? ADVANCEMENT_DEFAULT_CREATE_ISSUE_TYPE).toUpperCase();

  if (!isAdvancementCreatableIssueType(raw)) {
    return ADVANCEMENT_DEFAULT_CREATE_ISSUE_TYPE;
  }

  return raw;
}

/**
 * @param {{
 *   projectLabel: string
 *   findingId: string
 *   title: string
 *   detail: string
 *   paths?: string[]
 *   issueTypeKey?: string
 *   sectionTitle?: string
 *   sectionLabel?: string
 * }} input
 * @returns {Promise<{ key: string, id: string, issueType: string, projectKey: string, browseUrl: string, sectionLabel: string }>}
 */
export async function createAdvancementFindingIssue(input) {
  const projectKey   = projectLabelToJiraProjectKey(input.projectLabel);
  const issueTypeKey = resolveAdvancementCreateIssueType(input.findingId, input.issueTypeKey);

  if (issueTypeKey === "SUBTASK") {
    throw new Error("Sub-task non consentito dalla pagina Avanzamento");
  }

  const paths        = Array.isArray(input.paths) ? input.paths : [];
  const sectionLabel = input.sectionLabel
    ?? formatAdvancementSectionLabel(input.sectionTitle);
  const description  = [
    `Finding Avanzamento: \`${input.findingId}\``
  , `Sezione: ${sectionLabel}`
  , ""
  , input.detail
  , ""
  , "Path:"
  , ...paths.map((p) => `- ${p}`)
  ].join("\n");

  const created = await createJiraIssue({
    projectKey
  , issueTypeKey
  , summary    : `[Avanzamento] ${input.title}`
  , description
  , labels     : [sectionLabel]
  });

  return {
    ...created
  , sectionLabel
  , browseUrl: `https://myfuturejobsearch.atlassian.net/browse/${encodeURIComponent(created.key)}`
  };
}
