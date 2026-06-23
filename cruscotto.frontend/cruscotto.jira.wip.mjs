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
