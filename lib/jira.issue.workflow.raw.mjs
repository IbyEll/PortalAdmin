/**
 * Chiavi workflow in jira_issue.raw_fields / jira_issue_wip.raw_fields — stesso schema su entrambe le tabelle.
 */

/** @typedef {Record<string, unknown>} WorkflowRawFields */

/** Campi avanzamento WIP/PR copiati WIP → jira_issue al sync post-merge. */
export const WORKFLOW_RAW_FIELD_KEYS = [
  "veveDescription"
, "awaitingPush"
, "pushedAt"
, "jiraSyncedAt"
, "wipClosedAt"
, "closedAt"
, "branch"
, "commitHash"
, "prUrl"
, "prTitle"
, "prState"
, "prMergedAt"
, "prClosedAt"
, "prAppliedAt"
, "prPollComplete"
, "prPollActive"
, "prLastPolledAt"
, "backlogStar"
, "cacheSyncedFromWipAt"
, "chiudiParent"
, "gapTest"
, "gogoStartedAt"
, "gogoCompletedAt"
, "workflowSource"
];

/**
 * @param {string | null | undefined} rawFields
 * @returns {WorkflowRawFields}
 */
export function parseWorkflowRawFields(rawFields) {
  if (!rawFields) {
    return {};
  }

  try {
    const parsed = typeof rawFields === "string" ? JSON.parse(rawFields) : rawFields;

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * @param {WorkflowRawFields} raw
 * @returns {boolean}
 */
export function hasWorkflowAdvancementData(raw) {
  if (!raw || typeof raw !== "object") {
    return false;
  }

  return Boolean(
    raw.prUrl
    || raw.pushedAt
    || raw.prPollComplete === true
    || raw.awaitingPush === true
    || raw.branch
    || raw.commitHash
    || raw.prTitle
  );
}

/**
 * @param {WorkflowRawFields} raw
 * @returns {string | null}
 */
export function prTitleFromWorkflowRaw(raw) {
  const title = typeof raw?.prTitle === "string" ? raw.prTitle.trim() : "";

  return title || null;
}
