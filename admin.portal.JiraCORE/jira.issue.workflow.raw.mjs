/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-25 21:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-25 21:05   by: IbyEll
 * modificato il: 2026-06-25 21:05   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *       Chiavi e parser raw_fields workflow — jira_issue e jira_issue_wip (schema unico).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Avanzamento WIP/PR (branch, push, poll, chiudi) vive in JSON raw_fields su SQLite;
 *     serve un contratto unico tra cache backlog e coda WIP.
 *
 *   A cosa serve:
 *   - Elenca le chiavi workflow, parse sicuro del JSON e helper per titolo PR, chiusura WIP e merge
 *     post-sync WIP → jira_issue.
 *
 * Generalizzazione:
 *   Si — stesso schema su jira_issue.raw_fields e jira_issue_wip.raw_fields per overlay ADMIN e JLO.
 *
 * Input:
 *   - rawFields — colonna SQLite (stringa JSON o oggetto già decodificato)
 *   - prev / rawMerge — oggetti WorkflowRawFields in mergeWorkflowRawFields
 *
 * Consumatori:
 *   - admin.portal.JiraCORE/jiraCORE.wip.db.mjs — mergeWorkflowRawFields al push WIP
 *   - admin.portal.JiraCORE/jiraCORE.wip.pr.poll.mjs — hasWorkflowAdvancementData
 *   - cruscotto.frontend/cruscotto.jira.wip.mjs — parse e resolveWipClosedAtFromRaw in UI WIP
 *   - cruscotto.frontend/cruscotto.jira.issue.view.mjs — badge avanzamento su issue view
 *
 * Export principali:
 *   - WORKFLOW_RAW_FIELD_KEYS — elenco chiavi copiate WIP → cache al sync
 *   - parseWorkflowRawFields — JSON → WorkflowRawFields
 *   - hasWorkflowAdvancementData — true se push/PR/branch presenti
 *   - prTitleFromWorkflowRaw — titolo PR normalizzato
 *   - resolveWipClosedAtFromRaw — timestamp chiusura WIP esplicito o dedotto
 *   - mergeWorkflowRawFields — merge con wipClosedAt coerente post-merge
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

/** @typedef {Record<string, unknown>} WorkflowRawFields */

/**
 * Chiavi avanzamento workflow copiate da jira_issue_wip a jira_issue al sync post-merge.
 *
 * @type {readonly string[]}
 */
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
 * Decodifica raw_fields workflow da colonna SQLite (stringa JSON o oggetto).
 *
 * @param {string | null | undefined} rawFields
 * @returns {WorkflowRawFields}
 */
export function parseWorkflowRawFields(rawFields) {
  // 1. Input assente — oggetto vuoto senza eccezioni
  if (!rawFields) {
    return {};
  }

  try {
    // 2. Parse JSON se stringa; altrimenti usa valore già oggetto
    const parsed = typeof rawFields === "string" ? JSON.parse(rawFields) : rawFields;

    // 3. Normalizza solo plain object
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * True se raw_fields contiene almeno un segnale push/PR/branch (UI e poll gate).
 *
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
 * Estrae titolo PR da raw_fields (trim, null se assente).
 *
 * @param {WorkflowRawFields} raw
 * @returns {string | null}
 */
export function prTitleFromWorkflowRaw(raw) {
  const title = typeof raw?.prTitle === "string" ? raw.prTitle.trim() : "";

  return title || null;
}

/**
 * Chiusura ciclo WIP — esplicita o dedotta da PR applicata / sync cache.
 *
 * @param {WorkflowRawFields} raw
 * @returns {string | null}
 */
export function resolveWipClosedAtFromRaw(raw) {
  // 1. wipClosedAt esplicito ha priorità
  const explicit = typeof raw?.wipClosedAt === "string" ? raw.wipClosedAt.trim() : "";

  if (explicit) {
    return explicit;
  }

  // 2. Poll PR completato — prAppliedAt poi prMergedAt
  if (raw?.prPollComplete === true) {
    const applied = typeof raw.prAppliedAt === "string" ? raw.prAppliedAt.trim() : "";

    if (applied) {
      return applied;
    }

    const merged = typeof raw.prMergedAt === "string" ? raw.prMergedAt.trim() : "";

    if (merged) {
      return merged;
    }
  }

  // 3. Fallback sync cache WIP → jira_issue
  const cacheSynced = typeof raw?.cacheSyncedFromWipAt === "string"
    ? raw.cacheSyncedFromWipAt.trim()
    : "";

  return cacheSynced || null;
}

/**
 * Merge raw_fields workflow con default coerenti (es. wipClosedAt post-merge).
 *
 * @param {WorkflowRawFields} prev
 * @param {WorkflowRawFields} [rawMerge]
 * @returns {WorkflowRawFields}
 */
export function mergeWorkflowRawFields(prev, rawMerge = {}) {
  const merged = { ...prev, ...rawMerge };

  // 1. Se wipClosedAt manca, prova deduzione da PR/cache sul merge risultante
  if (!resolveWipClosedAtFromRaw(merged)) {
    const closed = resolveWipClosedAtFromRaw({ ...merged, wipClosedAt: undefined });

    if (closed) {
      merged.wipClosedAt = closed;
    }
  }

  return merged;
}
