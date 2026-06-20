#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-18 21:32
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 21:32   by: IbyEll
 * modificato il: 2026-06-18 21:32   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Rigenera bundle browser JiraIssueDisplay da core ESM + fragment DOM statico.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Le pagine cruscotto HTML non possono importare ESM Node; serve IIFE browser sincrono.
 *   - Evita duplicazione manuale tra cruscotto.jira.issue.display.core.mjs e asset servito al browser.
 *
 *   A cosa serve:
 *   - Serializza funzioni core, concatena dom.part, scrive cruscotto.jira.issue.display.client.js.
 *   - Propaga testata comcom nel bundle generato (preserva riga creato da output precedente).
 *
 * Generalizzazione:
 *   Si — core da cruscotto.jira.issue.display.core.mjs; prefisso Jira da window.CRUSCOTTO_PROJECT nel bundle.
 *
 * Input:
 *   - cruscotto.jira.issue.display.core.mjs — funzioni badge/link serializzate
 *   - cruscotto.jira.issue.display.client.dom.part.js — handler DOM editabile a mano
 *   - COMCOM_BY — autore righe metadati bundle (default IbyEll)
 *
 * Uso:
 *   - node admin.portal.JiraCORE/jiraCORE.issuedisplay.client.mjs
 *
 * Flag CLI:
 *   nessuno — rigenera sempre l'output
 *
 * npm:
 *   npm run sync:jira-issue-display
 *
 * Prerequisiti:
 *   - Core e dom.part aggiornati prima del sync (modifiche badge/link vanno nel core)
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.jira.issue.display.client.js — output generato
 *   - cruscotto.frontend/cruscotto.server.mjs — alias /jira-issue-display.js
 *   - Pagine HTML cruscotto backlog, working, my-project, project tree
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildJiraLinkChunkRe
, escapeRegExp
, formatJiraKeyListsInNoteHtml
, issueTypeClass
, issueTypeShortLabel
, resolveJiraPrefix
} from "../cruscotto.frontend/cruscotto.jira.issue.display.core.mjs";

const SCRIPT_DIR    = dirname(fileURLToPath(import.meta.url));
const CRUSCOTTO_DIR = join(SCRIPT_DIR, "..", "cruscotto.frontend");
const DOM_PART      = join(CRUSCOTTO_DIR, "cruscotto.jira.issue.display.client.dom.part.js");
const CLIENT_OUT    = join(CRUSCOTTO_DIR, "cruscotto.jira.issue.display.client.js");

// 1. Timestamp testata — re-comcom: preserva riga creato dal bundle esistente
const pad2          = (n) => String(n).padStart(2, "0");
const now           = new Date();
const stamp         = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
const by            = process.env.COMCOM_BY ?? "IbyEll";
let creatoLine      = `creato     il: ${stamp}   by: ${by}`;

try {
  const prev = readFileSync(CLIENT_OUT, "utf8");
  const m    = prev.match(/^\s*\* creato\s+il:\s*.+$/m);

  if (m) {
    creatoLine = m[0].replace(/^\s*\*\s*/, "");
  }
} catch {
  /* primo sync — creato = ora corrente */
}

// 2. Lettura parte DOM statica — funzioni browser non serializzabili da ESM
const domPartRaw  = readFileSync(DOM_PART, "utf8");
// Testata comcom del fragment resta solo nel sorgente dom.part — nel bundle c’è la testata esterna
const domPart     = domPartRaw.replace(/^\s*\/\*\*[\s\S]*?\*\/\s*/, "");

// 3. Composizione IIFE — testata comcom + core serializzato + dom.part + export globale
const body = `/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** PAGE SCRIPT ** -- commentato il: ${stamp}
 * ------------------------------------------------------------------------------------------------------------------------
 * ${creatoLine}
 * modificato il: ${stamp}   by: ${by}
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                JiraIssueDisplay — bundle browser IIFE core + DOM per pagine cruscotto Jira
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Le pagine cruscotto HTML non possono importare ESM Node; espongono window.JiraIssueDisplay.
 *   - Bundle unico servito come static asset senza build step (concat core + dom.part).
 *
 *   A cosa serve:
 *   - Etichette EPIC/STORY/SUB/BUG/TODO, decorazione link IssueKEY, fetch tipi da backlog API.
 *   - Formattazione elenchi IssueKEY nelle celle .plan-note del working plan.
 *
 * Generalizzazione:
 *   Si — prefisso IssueKEY e URL browse da window.CRUSCOTTO_PROJECT (overlay PRJ_JIRA_PREFIX).
 *
 * Input:
 *   - window.CRUSCOTTO_PROJECT / __CRUSCOTTO_PROJECT__ — jiraPrefix, jiraBrowseBase opzionale
 *   - GET /api/jira/backlog — mappa key → issuetype
 *   - jiraBase — argomento opzionale sulle funzioni decorate
 *
 * Consumatori:
 *   - cruscotto.jira.backlog.html, cruscotto.jira.working.html, cruscotto.jira.my-project.html
 *   - PROJECT_JustLastOne/cruscotto.jira.project.tree.html — script tag /jira-issue-display.js
 *
 * Pagina HTML:
 *   - Pagine cruscotto che caricano /jira-issue-display.js (backlog, working, pillar matrix, …)
 *
 * Servito da:
 *   - cruscotto.frontend/cruscotto.server.mjs — alias statico /jira-issue-display.js
 *
 * Asset correlati:
 *   - cruscotto.jira.issue.display.core.mjs — funzioni core serializzate nello scope IIFE
 *   - cruscotto.jira.issue.display.client.dom.part.js — parte DOM concatenata sotto il core
 *   - cruscotto.jira.issue.display.css — classi issue-type-* sui badge
 *
 * API (fetch same-origin):
 *   - GET /api/jira/backlog — tipi issue per decorateJiraLinksFromApi
 *
 * Dipendenze runtime:
 *   - window.CRUSCOTTO_PROJECT — config iniettata da bootstrap o inline script server
 *   - elementi a.jira-link, .plan-note — markup pagine cruscotto Jira
 *
 * Note:
 *   - File generato — non editare a mano le funzioni core serializzate; modificare core o dom.part.
 *   - Rigenerare: npm run sync:jira-issue-display (admin.portal.JiraCORE/jiraCORE.issuedisplay.client.mjs)
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */
(function jiraIssueDisplayModule(global) {

// --- funzioni core — serializzate da cruscotto.jira.issue.display.core.mjs ---
${escapeRegExp.toString()}

${resolveJiraPrefix.toString()}

${buildJiraLinkChunkRe.toString()}

${issueTypeShortLabel.toString()}

${issueTypeClass.toString()}

${formatJiraKeyListsInNoteHtml.toString()}

// --- parte DOM — cruscotto.jira.issue.display.client.dom.part.js (testata comcom solo nel sorgente) ---
${domPart}

  // --- export globale — API window.JiraIssueDisplay per pagine HTML ---
  global.JiraIssueDisplay = {
    issueTypeShortLabel,
    issueTypeClass,
    resolveJiraPrefix,
    buildJiraLinkChunkRe,
    cruscottoJiraPrefix,
    defaultJiraBrowseBase,
    createIssueTypeBadge,
    appendIssueKey,
    setIssueTypeMap,
    issueTypeForKey,
    decorateJiraLinks,
    decorateJiraLinksFromApi,
    decoratePlanNoteKeyLists,
    formatJiraKeyListsInNoteHtml,
    fetchIssueTypeMap,
  };
}(typeof window !== "undefined" ? window : globalThis));
`;

// 4. Scrittura output — LF normalizzato per coerenza cross-platform
writeFileSync(CLIENT_OUT, body.replace(/\r\n/g, "\n"), "utf8");

// 5. Report esito — path file generato
console.log(`Scritto ${CLIENT_OUT}`);
