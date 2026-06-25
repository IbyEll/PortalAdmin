/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:30
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:30   by: IbyEll
 * modificato il: 2026-06-23 21:30   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Stato coda WIP backlog — lettura jira_issue_wip e parsing AC/DoD da veveDescription.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Tab WIP cruscotto deve mostrare AC/DoD e stato push senza query Jira live a ogni poll.
 *
 *   A cosa serve:
 *   - Legge jira_issue_wip SQLite, parse checkbox AC/DoD da markdown veve e calcola isDone.
 *
 * Generalizzazione:
 *   Si — overlay da PRJ_NAME via openCruscottoDb; key ADMIN e JLO ammesse.
 *
 * Input:
 *   - CRUSCOTTO_DB_PATH — cache SQLite cruscotto overlay
 *   - parentKey — ticket ADMIN-xxx o JLO-xxx in coda WIP
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.server.mjs — API GET wip status backlog
 *   - admin.portal.JiraCORE/jiraCORE.wip.push.mjs — assert prima push step 8
 *
 * Export principali:
 *   - fetchWipStatusByKeys — mappa key → WipStatusEntry per UI
 *   - parseVeveCheckboxSection, buildWipStatusEntry — parse AC/DoD da veve markdown
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { openCruscottoDb } from "../cruscotto.database/cruscotto.db.config.mjs";

/** @typedef {{ checked: boolean, text: string }} WipCheckItem */

/** @typedef {{
 *   awaitingPush: boolean
 *   prUrl: string | null
 *   ac: WipCheckItem[]
 *   dod: WipCheckItem[]
 *   acSummary: string | null
 *   dodSummary: string | null
 *   isDone: boolean
 *   status: string | null
 * }} WipStatusEntry */

/** @typedef {'in_progress' | 'subtasks_complete' | 'awaiting_push' | 'published'} WipWorkflowPhase */

/** @typedef {WipStatusEntry & {
 *   inWip: true
 *   jiraKey: string
 *   workflowPhase: WipWorkflowPhase
 *   workflowPhaseLabel: string
 *   developmentComplete: boolean
 *   subtasksDone: number
 *   subtasksTotal: number
 *   gitPushed: boolean
 *   jiraSynced: boolean
 *   wipClosedAt: string | null
 *   closedAt: string | null
 *   pushedAt: string | null
 *   jiraSyncedAt: string | null
 *   commitHash: string | null
 *   branch: string | null
 *   chiudiParent: boolean
 *   gapTest: string | null
 *   wipUpdatedAt: string | null
 * }} WipAdvancementEntry */

const ISSUE_KEY_RE = /^(ADMIN|JLO)-\d+$/;

/**
 * @param {string | null | undefined} rawFields
 * @returns {Record<string, unknown>}
 */
function parseRawFields(rawFields) {
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
 * Estrae checkbox markdown da sezione veve (## Acceptance Criteria / ## Definition of Done).
 *
 * @param {string} markdown
 * @param {string} sectionTitle
 * @returns {WipCheckItem[]}
 */
export function parseVeveCheckboxSection(markdown, sectionTitle) {
  if (!markdown || typeof markdown !== "string") {
    return [];
  }

  const escaped = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionRe = new RegExp(
    `##\\s+${escaped}\\s*[\\r\\n]+([\\s\\S]*?)(?=\\r?\\n##\\s|$)`,
    "i"
  );
  const body = markdown.match(sectionRe)?.[1] ?? "";
  /** @type {WipCheckItem[]} */
  const items = [];

  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^-\s*\[([ xX✓✔☑])\]\s*(.+)$/);

    if (!match) {
      continue;
    }

    const mark = match[1].toLowerCase();

    items.push({
      checked: mark === "x" || mark === "✓" || mark === "✔" || mark === "☑"
    , text   : match[2].trim()
    });
  }

  return items;
}

/**
 * @param {{ jiraKey: string, rawFields?: string | null, isDone?: boolean, status?: string | null }} row
 * @returns {WipStatusEntry}
 */
export function buildWipStatusEntry(row) {
  const raw = parseRawFields(row.rawFields);
  const veveDescription = typeof raw.veveDescription === "string" ? raw.veveDescription : "";
  const ac = parseVeveCheckboxSection(veveDescription, "Acceptance Criteria");
  const dod = parseVeveCheckboxSection(veveDescription, "Definition of Done");
  const acDone = ac.filter((item) => item.checked).length;
  const dodDone = dod.filter((item) => item.checked).length;
  const prUrl = typeof raw.prUrl === "string" && raw.prUrl.startsWith("http")
    ? raw.prUrl
    : null;

  return {
    awaitingPush: raw.awaitingPush === true
  , prUrl
  , ac
  , dod
  , acSummary: ac.length > 0 ? `${acDone}/${ac.length}` : null
  , dodSummary: dod.length > 0 ? `${dodDone}/${dod.length}` : null
  , isDone    : row.isDone === true
  , status    : row.status ?? null
  };
}

/**
 * @param {WipWorkflowPhase} phase
 * @returns {string}
 */
export function workflowPhaseLabel(phase) {
  const labels = {
    in_progress      : "In sviluppo"
  , subtasks_complete: "Subtask completate"
  , awaiting_push    : "In attesa PUSH"
  , published        : "Pubblicato (PR / Jira)"
  };

  return labels[phase] ?? String(phase);
}

/**
 * @param {{ isDone?: boolean, rawFields?: string | null }} row
 * @param {Array<{ isDone?: boolean }>} subtaskRows
 * @returns {WipWorkflowPhase}
 */
export function resolveWipWorkflowPhase(row, subtaskRows) {
  const raw = parseRawFields(row.rawFields);
  const subtasksTotal = subtaskRows.length;
  const subtasksDone  = subtaskRows.filter((sub) => sub.isDone === true).length;
  const prUrl         = typeof raw.prUrl === "string" && raw.prUrl.startsWith("http")
    ? raw.prUrl
    : null;

  if (raw.pushedAt || (prUrl && raw.awaitingPush !== true)) {
    return "published";
  }

  if (raw.awaitingPush === true || (row.isDone === true && raw.wipClosedAt)) {
    return "awaiting_push";
  }

  if (subtasksTotal > 0 && subtasksDone === subtasksTotal) {
    return "subtasks_complete";
  }

  return "in_progress";
}

/**
 * @param {{ jiraKey: string, rawFields?: string | null, isDone?: boolean, status?: string | null, syncedAt?: Date | null }} row
 * @param {Array<{ isDone?: boolean, rawFields?: string | null }>} [subtaskRows]
 * @returns {WipAdvancementEntry}
 */
export function buildWipAdvancementEntry(row, subtaskRows = []) {
  const raw       = parseRawFields(row.rawFields);
  const status    = buildWipStatusEntry(row);
  const subtasks  = subtaskRows ?? [];
  const phase     = resolveWipWorkflowPhase(row, subtasks);
  const commits   = subtasks
    .map((sub) => parseRawFields(sub.rawFields).commitHash)
    .filter((hash) => typeof hash === "string" && hash.trim());

  const commitHash = typeof raw.commitHash === "string" && raw.commitHash.trim()
    ? raw.commitHash.trim()
    : (commits[commits.length - 1] ?? null);

  const prUrl = status.prUrl;

  return {
    ...status
  , inWip               : true
  , jiraKey             : row.jiraKey
  , workflowPhase       : phase
  , workflowPhaseLabel  : workflowPhaseLabel(phase)
  , developmentComplete : row.isDone === true
  , subtasksDone        : subtasks.filter((sub) => sub.isDone === true).length
  , subtasksTotal       : subtasks.length
  , gitPushed           : Boolean(raw.pushedAt) || Boolean(prUrl)
  , jiraSynced          : Boolean(raw.jiraSyncedAt)
  , wipClosedAt         : typeof raw.wipClosedAt === "string" ? raw.wipClosedAt : null
  , closedAt            : typeof raw.closedAt === "string" ? raw.closedAt : null
  , pushedAt            : typeof raw.pushedAt === "string" ? raw.pushedAt : null
  , jiraSyncedAt        : typeof raw.jiraSyncedAt === "string" ? raw.jiraSyncedAt : null
  , commitHash
  , branch              : typeof raw.branch === "string" && raw.branch.trim()
    ? raw.branch.trim()
    : null
  , chiudiParent        : raw.chiudiParent === true
  , gapTest             : typeof raw.gapTest === "string" ? raw.gapTest : null
  , wipUpdatedAt        : row.syncedAt instanceof Date
    ? row.syncedAt.toISOString()
    : null
  };
}

/**
 * Avanzamento WIP per issue key — parent + subtask in coda `jira_issue_wip`.
 *
 * @param {string} issueKey
 * @returns {Promise<WipAdvancementEntry | null>}
 */
export async function fetchWipAdvancementForIssue(issueKey) {
  const key = String(issueKey ?? "").trim().toUpperCase();

  if (!ISSUE_KEY_RE.test(key)) {
    return null;
  }

  const db  = await openCruscottoDb();
  const row = await db.jiraIssueWip.findUnique({
    where: { jiraKey: key }
  });

  if (!row) {
    return null;
  }

  const subtasks = await db.jiraIssueWip.findMany({
    where  : { parentJiraKey: key }
  , orderBy: [{ devSort: "asc" }, { jiraKey: "asc" }]
  });

  return buildWipAdvancementEntry(row, subtasks);
}

/**
 * @param {string[]} keys
 * @returns {Promise<{ byKey: Record<string, WipStatusEntry> }>}
 */
export async function fetchWipStatusByKeys(keys) {
  const normalized = [
    ...new Set(
      keys
        .map((key) => String(key ?? "").trim().toUpperCase())
        .filter((key) => ISSUE_KEY_RE.test(key))
    )
  ];

  if (normalized.length === 0) {
    return { byKey: {} };
  }

  const db = await openCruscottoDb();
  const rows = await db.jiraIssueWip.findMany({
    where: { jiraKey: { in: normalized } }
  , select: {
      jiraKey   : true
    , rawFields : true
    , isDone    : true
    , status    : true
    }
  });

  /** @type {Record<string, WipStatusEntry>} */
  const byKey = {};

  for (const row of rows) {
    byKey[row.jiraKey] = buildWipStatusEntry(row);
  }

  return { byKey };
}
