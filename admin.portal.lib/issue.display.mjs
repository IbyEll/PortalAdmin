/**
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-17
 *
 * HTML server-side badge/link Jira — wrapper su cruscotto.jira.issue.display.core.mjs.
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Le pagine cruscotto generate lato Node (working plan, tree, pillar matrix) emettono
 *     stringhe HTML, non DOM; serve escape + markup allineato al client browser.
 *   - Separa il core puro (regex/label) dalla serializzazione HTML sicura per il server.
 *
 *   A cosa serve:
 *   - issueTypeBadgeHtml, jiraLinkHtml per chunk link+badge nelle pagine statiche generate.
 *   - formatJiraKeyListsInNoteHtml con pretty:true per note piano nel working plan.
 *   - Re-export issueTypeShortLabel e issueTypeClass per consumer server che non servono HTML.
 *
 * Generalizzazione:
 *   Si — jiraBase configurabile; delega label e classi CSS al core condiviso browser/server.
 *
 * Input:
 *   - key, summary, type — issue Jira per jiraLinkHtml e badge
 *   - jiraBase — URL browse Jira (default cloud Atlassian)
 *   - pretty — opzione indent per formatJiraKeyListsInNoteHtml
 *
 * Consumatori:
 *   - cruscotto.jira.working.plan.mjs — jiraLinkHtml, formatJiraKeyListsInNoteHtml
 *   - cruscotto.jira.issue.display.css — classi issue-type-* emesse da issueTypeClass()
 *
 * Export principali:
 *   - issueTypeBadgeHtml — span.issue-type con escape HTML
 *   - jiraLinkHtml — badge + a.jira-link + summary opzionale
 *   - formatJiraKeyListsInNoteHtml — delega al core con pretty indent
 *   - issueTypeShortLabel, issueTypeClass — re-export da core
 */

import {
  formatJiraKeyListsInNoteHtml as formatJiraKeyListsInNoteHtmlCore
, issueTypeClass
, issueTypeShortLabel
} from "./issue.display.core.mjs";

export {
  issueTypeClass
, issueTypeShortLabel
} from "./issue.display.core.mjs";

/**
 * Escape attributi e testo per HTML server-side.
 *
 * @param {string} raw
 * @returns {string}
 */
function escapeHtml(raw) {
  return String(raw)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Badge tipo issue come markup HTML (stringa vuota se tipo assente).
 *
 * @param {string} [type]
 * @returns {string}
 */
export function issueTypeBadgeHtml(type) {
  const label = issueTypeShortLabel(type);

  if (!label) {
    return "";
  }

  const cls = issueTypeClass(label);

  return `<span class="issue-type issue-type-${cls}" title="${escapeHtml(type ?? "")}">${escapeHtml(label)}</span>`;
}

/**
 * Chunk completo badge + link browse + summary opzionale per una key Jira.
 *
 * @param {string} key
 * @param {string} [summary]
 * @param {string} [type]
 * @param {string} [jiraBase]
 * @returns {string}
 */
export function jiraLinkHtml(key, summary, type, jiraBase = "https://myfuturejobsearch.atlassian.net/browse/") {
  const typeHtml    = issueTypeBadgeHtml(type);
  const summaryHtml = summary
    ? `<span class="issue-summary"> — ${escapeHtml(summary)}</span>`
    : "";

  return `${typeHtml}<a class="jira-link" href="${jiraBase}${escapeHtml(key)}">${escapeHtml(key)}</a>${summaryHtml}`;
}

/**
 * Note piano server — elenchi JLO-xxx con indentazione pretty (working HTML).
 *
 * @param {string} html
 * @param {string} [jiraBase]
 */
export function formatJiraKeyListsInNoteHtml(html, jiraBase = "https://myfuturejobsearch.atlassian.net/browse/") {
  return formatJiraKeyListsInNoteHtmlCore(html, jiraBase, { pretty: true });
}
