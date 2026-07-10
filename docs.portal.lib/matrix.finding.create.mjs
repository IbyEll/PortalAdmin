/**
 * Creazione issue Jira da finding matrice — tipi ammessi e persistenza link.
 */

import { createJiraIssue, JIRA_CREATE_ISSUE_TYPES } from "../admin.portal.JiraCORE/jiraCORE.jira.create.mjs";

import { persistFindingIssueLink } from "./matrix.finding-issues.store.mjs";
import { formatMatrixSectionLabel, jiraLabelForMatrixSection } from "./matrix.finding.sections.mjs";
import { projectLabelToJiraProjectKey } from "./matrix.finding.project.mjs";

export const MATRIX_FINDING_DEFAULT_CREATE_ISSUE_TYPE = "BUG";

/** @deprecated */
export const ADVANCEMENT_DEFAULT_CREATE_ISSUE_TYPE = MATRIX_FINDING_DEFAULT_CREATE_ISSUE_TYPE;

export const MATRIX_FINDING_CREATABLE_ISSUE_TYPES = ["BUG", "STORY", "TASK", "EPIC", "TODO"].map((key) => ({
  key
, label: JIRA_CREATE_ISSUE_TYPES[key].jiraName
}));

/** @deprecated */
export const ADVANCEMENT_CREATABLE_ISSUE_TYPES = MATRIX_FINDING_CREATABLE_ISSUE_TYPES;

/** @type {Record<string, string>} */
export const FINDING_CREATE_ISSUE_TYPES = {
  // es. "bug-tree-regenerate": "BUG"
};

/**
 * @param {string} issueTypeKey
 * @returns {boolean}
 */
export function isMatrixFindingCreatableIssueType(issueTypeKey) {
  const key = String(issueTypeKey ?? "").trim().toUpperCase();

  return MATRIX_FINDING_CREATABLE_ISSUE_TYPES.some((row) => row.key === key);
}

/** @deprecated */
export const isAdvancementCreatableIssueType = isMatrixFindingCreatableIssueType;

/**
 * @param {string} findingId
 * @param {string} [requestedType]
 * @returns {string}
 */
export function resolveMatrixFindingCreateIssueType(findingId, requestedType) {
  const fromFinding = FINDING_CREATE_ISSUE_TYPES[findingId];
  const raw         = (fromFinding ?? requestedType ?? MATRIX_FINDING_DEFAULT_CREATE_ISSUE_TYPE).toUpperCase();

  if (!isMatrixFindingCreatableIssueType(raw)) {
    return MATRIX_FINDING_DEFAULT_CREATE_ISSUE_TYPE;
  }

  return raw;
}

/** @deprecated */
export const resolveAdvancementCreateIssueType = resolveMatrixFindingCreateIssueType;

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
 *   category?: string
 *   matrixKind?: string
 * }} input
 * @returns {Promise<{ key: string, id: string, issueType: string, projectKey: string, browseUrl: string, sectionLabel: string }>}
 */
export async function createMatrixFindingIssue(input) {
  const projectKey   = projectLabelToJiraProjectKey(input.projectLabel);
  const issueTypeKey = resolveMatrixFindingCreateIssueType(input.findingId, input.issueTypeKey);

  if (issueTypeKey === "SUBTASK") {
    throw new Error("Sub-task non consentito dalle matrici docs");
  }

  const sectionLabel = input.sectionLabel
    ?? formatMatrixSectionLabel(input.sectionTitle);
  const jiraLabel    = jiraLabelForMatrixSection(sectionLabel);

  const created = await createJiraIssue({
    projectKey
  , issueTypeKey
  , summary: `${jiraLabel} ${input.title}`
  , labels : [jiraLabel]
  });

  persistFindingIssueLink(input.findingId, {
    key      : created.key
  , issueType: created.issueType
  }, input.matrixKind);

  return {
    ...created
  , findingId: input.findingId
  , sectionLabel
  , browseUrl: `https://myfuturejobsearch.atlassian.net/browse/${encodeURIComponent(created.key)}`
  };
}

/** @deprecated */
export const createAdvancementFindingIssue = createMatrixFindingIssue;
