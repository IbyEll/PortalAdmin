/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-18 03:31
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-17 00:00   by: IbyEll
 * modificato il: 2026-06-18 03:31   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                         Ticket correlati backlog — parsing ADF description e issue link Jira.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Il backlog cruscotto arricchisce ogni issue con relatedKeys per tree, filtri e inspect;
 *     Jira espone description in ADF e issueLinks, non un campo flat.
 *   - Centralizza regex e parsing «Ticket correlati» evitando duplicazione in fetch backlog.
 *
 *   A cosa serve:
 *   - Estrae IssueKEY da testo plain, sezione ADF dedicata e link inward/outward.
 *   - resolveRelatedTicketKeys unisce le fonti, esclude la key corrente, ordina numericamente.
 *
 * Generalizzazione:
 *   Si — prefissi IssueKEY da JIRA_PROJECT_KEYS (overlay PRJ_NAME via jira.project.config.overlay).
 *
 * Input:
 *   - JIRA_PROJECT_KEYS — prefissi ammessi (es. JLO, ADMIN) da loadJiraConfig / PRJ_NAME
 *
 * Consumatori:
 *   - cruscotto.jira.backlog.mjs — relatedKeys su ogni riga in fetchJiraBacklog
 *
 * Export principali:
 *   - ISSUE_KEY_IN_TEXT_RE — regex citazioni da JIRA_PROJECT_KEYS
 *   - adfToPlainText — ADF document → testo (helper debug / fallback)
 *   - extractIssueKeysFromText — IssueKEY in stringa
 *   - extractJloKeysFromText — alias storico di extractIssueKeysFromText
 *   - extractRelatedKeysFromDescription — sezione «Ticket correlati» in ADF
 *   - extractRelatedKeysFromIssueLinks — inward/outward issue link (solo prefissi configurati)
 *   - resolveRelatedTicketKeys — unione deduplicata per issue
 * 
 * ------------------------------------------------------------------------------------------------------------------------*/

import { JIRA_PROJECT_KEYS } from "../cruscotto.frontend/jira/jira.project.config.overlay.mjs";

/** Regex IssueKEY in testo e URL — prefissi da overlay (PRJ_NAME). */
export const ISSUE_KEY_IN_TEXT_RE = new RegExp(
  `\\b((?:${JIRA_PROJECT_KEYS.join("|")})-\\d+)\\b`
, "gi"
);

/**
 * @param {string | undefined | null} key
 * @returns {boolean}
 */
function isConfiguredIssueKey(key) {
  const upper = String(key ?? "").toUpperCase();
  if (!upper) {
    return false;
  }
  return JIRA_PROJECT_KEYS.some((prefix) => upper.startsWith(`${prefix}-`));
}

/**
 * Prima IssueKEY configurata in una stringa (URL inlineCard, snippet).
 *
 * @param {string} text
 * @returns {string}
 */
function firstIssueKeyInText(text) {
  ISSUE_KEY_IN_TEXT_RE.lastIndex = 0;
  const found = ISSUE_KEY_IN_TEXT_RE.exec(String(text));
  return found ? (found[1] ?? found[0]).toUpperCase() : "";
}

/**
 * Testo ricorsivo da nodo ADF (text, inlineCard con URL Jira, hardBreak, content annidato).
 *
 * @param {unknown} node
 * @returns {string}
 */
function adfNodeText(node) {
  if (!node || typeof node !== "object") {
    return "";
  }
  /** @type {{ type?: string, text?: string, attrs?: { url?: string }, content?: unknown[] }} */
  const n = node;
  if (n.type === "text") {
    return n.text ?? "";
  }
  if (n.type === "inlineCard" && n.attrs?.url) {
    return firstIssueKeyInText(n.attrs.url);
  }
  if (n.type === "hardBreak") {
    return "\n";
  }
  return (n.content ?? []).map(adfNodeText).join("");
}

/**
 * Documento ADF Jira → plain text (blocchi separati da newline).
 *
 * @param {unknown} adf
 * @returns {string}
 */
export function adfToPlainText(adf) {
  // 1. Guard — documento ADF assente o non oggetto
  if (!adf || typeof adf !== "object") {
    return "";
  }
  /** @type {{ content?: unknown[] }} */
  const doc = adf;
  // 2. Flatten blocchi top-level in plain text
  return (doc.content ?? [])
    .map((block) => adfNodeText(block))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Tutte le IssueKEY configurate in un testo, opzionale esclusione self.
 *
 * @param {string} text
 * @param {string} [excludeKey]
 * @returns {string[]}
 */
export function extractIssueKeysFromText(text, excludeKey) {
  const exclude = excludeKey?.toUpperCase();
  /** @type {Set<string>} */
  const keys = new Set();
  ISSUE_KEY_IN_TEXT_RE.lastIndex = 0;
  for (const match of String(text).matchAll(ISSUE_KEY_IN_TEXT_RE)) {
    const key = (match[1] ?? match[0]).toUpperCase();
    if (key !== exclude) {
      keys.add(key);
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** @deprecated Usare extractIssueKeysFromText — alias per compatibilità. */
export const extractJloKeysFromText = extractIssueKeysFromText;

/**
 * Key nella sezione ADF sotto heading «Ticket correlati» (o varianti).
 *
 * @param {unknown} description
 * @param {string} [issueKey]
 * @returns {string[]}
 */
export function extractRelatedKeysFromDescription(description, issueKey) {
  if (!description || typeof description !== "object") {
    return [];
  }
  // 1. Scan blocchi ADF — heading «Ticket correlati» poi contenuto fino al prossimo heading
  /** @type {{ content?: Array<{ type?: string, attrs?: { level?: number }, content?: unknown[] }> }} */
  const doc = description;
  const blocks = doc.content ?? [];
  let inSection = false;
  /** @type {string[]} */
  const sectionParts = [];
  for (const block of blocks) {
    if (block.type === "heading") {
      const heading = adfNodeText(block).trim();
      if (/ticket\s*correlati/i.test(heading)) {
        inSection = true;
        continue;
      }
      if (inSection) {
        break;
      }
      continue;
    }
    if (inSection) {
      sectionParts.push(adfNodeText(block));
    }
  }
  if (!sectionParts.length) {
    return [];
  }
  return extractIssueKeysFromText(sectionParts.join("\n"), issueKey);
}

/**
 * Key da issue link Jira (inward/outward), esclusa issue corrente — solo prefissi configurati.
 *
 * @param {Array<{ inwardIssue?: { key?: string }, outwardIssue?: { key?: string } }> | null | undefined} issueLinks
 * @param {string} [issueKey]
 * @returns {string[]}
 */
export function extractRelatedKeysFromIssueLinks(issueLinks, issueKey) {
  const exclude = issueKey?.toUpperCase();
  /** @type {Set<string>} */
  const keys = new Set();
  // 1. Scan issue link — inward e outward, esclusa key corrente e prefissi fuori overlay
  for (const link of issueLinks ?? []) {
    for (const side of ["inwardIssue", "outwardIssue"]) {
      const key = link[side]?.key?.toUpperCase();
      if (key && key !== exclude && isConfiguredIssueKey(key)) {
        keys.add(key);
      }
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * Unione description + issue link — relatedKeys per backlog row.
 *
 * @param {string} issueKey
 * @param {unknown} description
 * @param {Array<{ inwardIssue?: { key?: string }, outwardIssue?: { key?: string } }> | null | undefined} issueLinks
 * @returns {string[]}
 */
export function resolveRelatedTicketKeys(issueKey, description, issueLinks) {
  // 1. Unione description + issue link — dedup, esclusione self, sort numerico
  /** @type {Set<string>} */
  const keys = new Set([
    ...extractRelatedKeysFromDescription(description, issueKey)
  , ...extractRelatedKeysFromIssueLinks(issueLinks, issueKey)
  ]);
  return [...keys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

