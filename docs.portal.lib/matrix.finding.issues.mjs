/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-26 08:40
 * ------------------------------------------------------------------------------------------------------------------------
 * creato il: 2026-06-26 08:40 by: IbyEll
 * modificato il: 2026-06-26 08:40 by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Issue refinement — colonna Jira, enrichment finding e cella HTML Crea/link
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Le matrici docs mostrano colonna Issue refinement con link ADMIN/JLO, badge tipo issue e
 *     pulsante Crea; i finding devono arricchirsi da DB Jira, path sorgente e store persistito.
 *
 *   A cosa serve:
 *   - enrichFindingsWithIssueRefinement collega ticket; renderIssueRefinementCell produce td HTML;
 *     helper grep ticket refirement nei sorgenti e chiude finding se Jira è Done.
 *
 * Generalizzazione:
 *   Si — portalRoot e candidate keys da finding; tipi issue da admin.portal.lib/issue.display.
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - portalRoot — root repo per issueKeysFromPaths e read file sorgente
 *   - findings — array finding da arricchire o appendPersistedResolvedFindings
 *   - ctx IssueRefinementRenderCtx — dati cella per renderIssueRefinementCell
 *   - JIRA_EMAIL, JIRA_API_TOKEN — env opzionali per fetch live Jira
 *
 * Consumatori:
 *   - docs.portal.lib/docs.portal.advancement.mjs — renderIssueRefinementCell
 *   - docs.portal.lib/matrix.render.mjs — renderIssueRefinementCell su righe matrice
 *   - docs.portal/matrix.avanzamento.gap.feature.mjs — enrichFindingsWithIssueRefinement
 *
 * Export principali:
 *   - renderIssueRefinementCell — HTML colonna issue
 *   - enrichFindingsWithIssueRefinement, appendPersistedResolvedFindings — dati finding
 *   - normalizeJiraIssueKey, isFindingIssueRefClosed — policy chiavi e stati
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cruscottoDbFileExists, openCruscottoDb } from "../cruscotto.database/cruscotto.db.config.mjs";
import { issueTypeClass, issueTypeShortLabel } from "../admin.portal.lib/issue.display.core.mjs";
import {
  MATRIX_FINDING_CREATABLE_ISSUE_TYPES
, MATRIX_FINDING_DEFAULT_CREATE_ISSUE_TYPE
, resolveMatrixFindingCreateIssueType
} from "./matrix.finding.create.mjs";
import { loadFindingIssueLinks } from "./matrix.finding-issues.store.mjs";
import { MATRIX_KIND_PORTAL_GAP } from "../cruscotto.database/matrix.db.mjs";
import { formatMatrixSectionLabel } from "./matrix.finding.sections.mjs";

const JIRA_BROWSE_BASE = "https://myfuturejobsearch.atlassian.net/browse";

const JIRA_ISSUE_KEY_RE = /^(?:ADMIN|JLO)-\d+$/i;

/**
 * @param {string | null | undefined} key
 * @returns {string | null}
 */
export function normalizeJiraIssueKey(key) {
  const trimmed = String(key ?? "").trim().toUpperCase();

  return JIRA_ISSUE_KEY_RE.test(trimmed) ? trimmed : null;
}

/** @typedef {{ summary: string, issueType: string | null, statusName?: string | null }} IssueRefinementMeta */

/**
 * @typedef {{
 *   findingId: string
 *   issueKey?: string | null
 *   issueSummary?: string | null
 *   issueType?: string | null
 *   project?: string | null
 *   title?: string
 *   detail?: string
 *   paths?: string[]
 *   createIssueType?: string
 *   sectionTitle?: string
 *   findingStatus?: string
 *   category?: string
 * }} IssueRefinementRenderCtx
 */

/** @type {Record<string, string>} */
export const FINDING_BUG_KEYS = {
  // es. "bug-ci-portal-paths": "ADMIN-xxx"
};

/**
 * @param {string | null | undefined} issueType
 * @returns {boolean}
 */
export function isJiraBugType(issueType) {
  return issueTypeShortLabel(issueType) === "BUG";
}

/**
 * @param {string | null | undefined} issueType
 * @returns {boolean}
 */
export function isMatrixFindingLinkedIssueType(issueType) {
  if (!issueType) {
    return true;
  }

  const label = issueTypeShortLabel(issueType);

  return ["BUG", "STORY", "TASK", "EPIC", "TODO"].includes(label);
}

/** @deprecated */
export const isAdvancementLinkedIssueType = isMatrixFindingLinkedIssueType;

/**
 * @param {import("./matrix.render.mjs").MatrixRow} row
 * @returns {string}
 */
export function resolveMatrixRowCreateCategory(row) {
  if (row.category) {
    return row.category;
  }

  if (row.sev === "P0" || row.sev === "P1" || row.sev === "P2") {
    return "bug";
  }

  return "miglioramento";
}

/**
 * @param {import("./matrix.render.mjs").MatrixRow} row
 * @param {string} [sectionTitle]
 * @returns {import("./matrix.render.mjs").MatrixRow}
 */
export function ensureMatrixRowCreateMeta(row, sectionTitle = "") {
  if (row.issueKey || isFindingIssueRefClosed(row.status) || row.create) {
    return row;
  }

  const isOpen = row.status === "gap" || row.status === "parziale" || row.status === "open";

  if (!isOpen || !sectionTitle) {
    return row;
  }

  return {
    ...row
  , create: {
      section : sectionTitle
    , summary : row.voce
    , detail  : row.dettaglio
    }
  };
}

/**
 * @param {import("./matrix.render.mjs").MatrixRow} row
 * @returns {IssueRefinementRenderCtx}
 */
export function matrixRowToIssueRefinementCtx(row) {
  const findingStatus = row.status === "gap" ? "open" : row.status;
  const category      = resolveMatrixRowCreateCategory(row);

  return {
    findingId      : row.id
  , issueKey       : row.issueKey ?? null
  , issueSummary   : row.issueSummary ?? null
  , issueType      : row.issueType ?? null
  , project        : row.project ?? null
  , title          : row.create?.summary ?? row.voce
  , detail         : row.create?.detail ?? row.dettaglio
  , paths          : row.paths
  , sectionTitle   : row.create?.section ?? null
  , category
  , createIssueType: category === "miglioramento" ? "STORY" : "BUG"
  , findingStatus
  };
}

/**
 * @param {import("./matrix.render.mjs").MatrixRow[]} rows
 * @param {string} portalRoot
 * @returns {Promise<void>}
 */
export async function enrichMatrixRowsWithIssueRefinement(rows, portalRoot, opts = {}) {
  await enrichFindingsWithIssueRefinement(rows, portalRoot, opts);

  for (const row of rows) {
    if (row.status === "done") {
      row.status = "fatto";
    }
  }
}

/**
 * @param {string} cellHtml
 * @returns {{ key: string | null, issueType: string | null }}
 */
export function parseIssueRefinementFromCell(cellHtml) {
  const html = String(cellHtml ?? "");

  const dataKey = html.match(/data-issue-key="((?:ADMIN|JLO)-\d+)"/i)?.[1]
    ?? html.match(/class="issue-ref"[^>]*>(ADMIN-\d+)</i)?.[1]
    ?? html.match(/browse\/(ADMIN-\d+)/i)?.[1];

  const key = normalizeJiraIssueKey(dataKey);

  if (!key) {
    return { key: null, issueType: null };
  }

  const dataType = html.match(/data-issue-type="([^"]+)"/i)?.[1] ?? null;
  const slug     = html.match(/issue-type-([a-z0-9_-]+)/i)?.[1] ?? null;
  const issueType = dataType
    ?? (slug === "bug" ? "Bug" : slug === "story" ? "Story" : slug === "task" ? "Task" : slug === "epic" ? "Epic" : slug === "todo" ? "Todo" : null);

  return {
    key
  , issueType
  };
}

/**
 * @param {string} s
 * @returns {string}
 */
function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * @param {string | null | undefined} issueType
 * @returns {string}
 */
function issueTypeBadgeHtml(issueType) {
  if (!issueType) {
    return "";
  }

  const label = issueTypeShortLabel(issueType);
  const slug  = issueTypeClass(label);

  return `<span class="issue-type issue-type-${slug}">${escHtml(label.toLowerCase())}</span>`;
}

/**
 * @param {string} [defaultKey]
 * @returns {string}
 */
function renderCreatableIssueTypeSelect(defaultKey = MATRIX_FINDING_DEFAULT_CREATE_ISSUE_TYPE) {
  const resolved = resolveMatrixFindingCreateIssueType("", defaultKey);

  return MATRIX_FINDING_CREATABLE_ISSUE_TYPES.map(({ key, label }) => {
    const selected = key === resolved ? " selected" : "";

    return `<option value="${escAttr(key)}"${selected}>${escHtml(label)}</option>`;
  }).join("");
}

/**
 * @param {string} s
 * @returns {string}
 */
function escAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function extractTicketTitleHintFromText(text) {
  const m = text.match(/ticket\s+refirement:\s*(?:ADMIN|JLO)-\d+\s+(.+)/i);

  return m?.[1]?.trim() || null;
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function extractTicketKeysFromText(text) {
  /** @type {string[]} */
  const keys = [];

  for (const m of text.matchAll(/ticket\s+refirement:\s*((?:ADMIN|JLO)-\d+)/gi)) {
    keys.push(m[1].toUpperCase());
  }

  for (const m of text.matchAll(/\b((?:ADMIN|JLO)-\d+)\b/g)) {
    keys.push(m[1].toUpperCase());
  }

  return [...new Set(keys)];
}

/**
 * @param {string} portalRoot
 * @param {string[]} paths
 * @returns {string | null}
 */
export function issueTitleHintFromPaths(portalRoot, paths) {
  for (const rel of paths) {
    if (!rel || rel.endsWith("/")) {
      continue;
    }

    const hint = extractTicketTitleHintFromText(readTextFile(portalRoot, rel));

    if (hint) {
      return hint;
    }
  }

  return null;
}

/**
 * @param {string} issueKey
 * @param {string | null | undefined} issueSummary
 * @returns {string}
 */
export function issueRefinementTooltip(issueKey, issueSummary) {
  if (issueSummary) {
    return escAttr(`${issueKey} — ${issueSummary}`);
  }

  return escAttr(`Apri bug ${issueKey} su Jira`);
}

/**
 * @returns {Promise<Map<string, IssueRefinementMeta>>}
 */
async function loadIssueRefinementMapFromDb() {
  /** @type {Map<string, IssueRefinementMeta>} */
  const map = new Map();

  if (!cruscottoDbFileExists()) {
    return map;
  }

  const db = await openCruscottoDb();
  const syncRun = await db.syncRun.findFirst({
    where  : { status: "success", issueCount: { gt: 0 } }
  , orderBy: { finishedAt: "desc" }
  });

  if (!syncRun) {
    return map;
  }

  const rows = await db.jiraIssue.findMany({
    where : { syncRunId: syncRun.id }
  , select: { jiraKey: true, summary: true, issueType: true, status: true }
  });

  for (const row of rows) {
    if (row.jiraKey) {
      map.set(row.jiraKey.toUpperCase(), {
        summary   : row.summary ?? ""
      , issueType : row.issueType ?? null
      , statusName: row.status ?? null
      });
    }
  }

  return map;
}

/**
 * @param {string[]} issueKeys
 * @returns {Promise<Map<string, IssueRefinementMeta>>}
 */
export async function loadIssueRefinementMap(issueKeys) {
  /** @type {Map<string, IssueRefinementMeta>} */
  const map    = new Map();
  const unique = [...new Set(issueKeys.map((k) => String(k).trim().toUpperCase()).filter(Boolean))];

  if (unique.length === 0) {
    return map;
  }

  const fromDb = await loadIssueRefinementMapFromDb().catch(() => new Map());

  for (const [key, meta] of fromDb) {
    map.set(key, meta);
  }

  const missing = unique.filter((key) => {
    const meta = map.get(key);

    return !meta || !meta.summary || !meta.issueType || !meta.statusName;
  });

  if (missing.length === 0 || !process.env.JIRA_EMAIL?.trim() || !process.env.JIRA_API_TOKEN?.trim()) {
    return map;
  }

  const { jiraLiveFetch } = await import("../admin.portal.JiraCORE/jiraCORE.jira.live.mjs");

  for (const key of missing) {
    try {
      const issue = await jiraLiveFetch(
        `/rest/api/3/issue/${encodeURIComponent(key)}?fields=${encodeURIComponent("summary,issuetype,status")}`
      );
      const body = /** @type {{ fields?: { summary?: string, issuetype?: { name?: string }, status?: { name?: string } } }} */ (issue);
      const prev = map.get(key) ?? { summary: "", issueType: null, statusName: null };

      map.set(key, {
        summary   : body.fields?.summary ?? prev.summary
      , issueType : body.fields?.issuetype?.name ?? prev.issueType
      , statusName: body.fields?.status?.name ?? prev.statusName ?? null
      });
    } catch {
      // ticket assente o credenziali/API non disponibili
    }
  }

  return map;
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function extractTicketKeyFromText(text) {
  const keys = extractTicketKeysFromText(text);

  return keys[0] ?? null;
}

/**
 * @param {string} portalRoot
 * @param {string} rel
 * @returns {string}
 */
function readTextFile(portalRoot, rel) {
  const file = join(portalRoot, rel);

  if (!existsSync(file)) {
    return "";
  }

  return readFileSync(file, "utf8");
}

/**
 * @param {string} portalRoot
 * @param {string[]} paths
 * @returns {string[]}
 */
export function issueKeysFromPaths(portalRoot, paths) {
  /** @type {string[]} */
  const keys = [];

  for (const rel of paths) {
    if (!rel || rel.endsWith("/")) {
      continue;
    }

    keys.push(...extractTicketKeysFromText(readTextFile(portalRoot, rel)));
  }

  return [...new Set(keys)];
}

/**
 * @param {{ id: string, paths: string[], issueKey?: string | null, project?: string | null }} finding
 * @param {string} portalRoot
 * @returns {string[]}
 */
export function collectFindingBugKeyCandidates(finding, portalRoot) {
  /** @type {string[]} */
  const keys = [];

  if (finding.issueKey) {
    keys.push(String(finding.issueKey).toUpperCase());
  }

  if (FINDING_BUG_KEYS[finding.id]) {
    keys.push(FINDING_BUG_KEYS[finding.id].toUpperCase());
  }

  keys.push(...issueKeysFromPaths(portalRoot, finding.paths));

  // Pagina Avanzamento = repo PortalAdmin — mai JLO-* in Issue refinement.
  return [...new Set(keys)].filter((key) => key.startsWith("ADMIN-"));
}

/**
 * @param {string[]} candidateKeys
 * @param {Map<string, IssueRefinementMeta>} refinementMap
 * @returns {{ key: string | null, meta: IssueRefinementMeta | null }}
 */
export function pickJiraBugRefinement(candidateKeys, refinementMap) {
  for (const key of candidateKeys) {
    const meta = refinementMap.get(key);

    if (meta && isJiraBugType(meta.issueType)) {
      return { key, meta };
    }
  }

  return { key: null, meta: null };
}

/**
 * @param {string | null | undefined} statusName
 * @returns {boolean}
 */
export function isJiraIssueClosed(statusName) {
  const s = String(statusName ?? "").trim().toLowerCase();

  return s === "done"
    || s === "fatto"
    || s === "closed"
    || s === "completato"
    || s.includes("done")
    || s.includes("fatto");
}

/**
 * Chiude finding collegati a ticket Jira in stato Done/Fatto (issue refirement persistito).
 *
 * @param {Array<{ id: string, status: string, issueKey?: string | null, detail?: string, resolvedNote?: string }>} findings
 * @param {Map<string, IssueRefinementMeta>} refinementMap
 */
export function applyJiraClosedFindings(findings, refinementMap) {
  for (const finding of findings) {
    const key = finding.issueKey?.trim().toUpperCase();

    if (!key) {
      continue;
    }

    const meta = refinementMap.get(key);

    if (!meta?.statusName || !isJiraIssueClosed(meta.statusName)) {
      continue;
    }

    finding.status       = "done";
    finding.resolvedNote = `✅ Jira ${key} — ${meta.statusName}`;
    finding.detail       = `${finding.detail ?? ""} · Ticket chiuso su Jira.`.trim();
  }
}

/**
 * Verifica se una issue Jira è ancora raggiungibile (live REST o cache sync più recente).
 *
 * @param {string | null | undefined} jiraKey
 * @returns {Promise<boolean>}
 */
export async function isJiraIssueKeyAlive(jiraKey) {
  const key = normalizeJiraIssueKey(jiraKey);

  if (!key) {
    return false;
  }

  if (process.env.JIRA_EMAIL?.trim() && process.env.JIRA_API_TOKEN?.trim()) {
    try {
      const { jiraLiveFetch } = await import("../admin.portal.JiraCORE/jiraCORE.jira.live.mjs");

      await jiraLiveFetch(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=key`);

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      if (/\→ 404:/.test(msg)) {
        return false;
      }
    }
  }

  const map = await loadIssueRefinementMap([key]);

  return map.has(key);
}

/**
 * @param {Array<{ id: string, paths: string[], issueKey?: string | null, issueSummary?: string | null, issueType?: string | null, status?: string, detail?: string, resolvedNote?: string }>} findings
 * @param {string} portalRoot
 * @param {{ matrixKind?: string }} [opts]
 * @returns {Promise<Map<string, IssueRefinementMeta>>}
 */
export async function enrichFindingsWithIssueRefinement(findings, portalRoot, opts = {}) {
  const matrixKind     = String(opts.matrixKind ?? MATRIX_KIND_PORTAL_GAP).trim();
  const persistedLinks = await loadFindingIssueLinks(matrixKind);
  /** @type {string[]} */
  const allCandidates = [];

  for (const finding of findings) {
    allCandidates.push(...collectFindingBugKeyCandidates(finding, portalRoot));

    const persisted = persistedLinks.get(finding.id);

    if (persisted?.key) {
      allCandidates.push(persisted.key);
    }
  }

  const refinementMap = await loadIssueRefinementMap(allCandidates);

  for (const finding of findings) {
    const persisted = persistedLinks.get(finding.id);

    if (persisted?.key) {
      const alive = await isJiraIssueKeyAlive(persisted.key);

      if (!alive) {
        finding.issueKey     = null;
        finding.issueSummary = null;
        finding.issueType    = null;
        continue;
      }

      const meta = refinementMap.get(persisted.key);

      finding.issueKey     = persisted.key;
      finding.issueSummary = meta?.summary ?? null;
      finding.issueType    = persisted.issueType ?? meta?.issueType ?? null;
      continue;
    }

    if (finding.issueKey) {
      const alive = await isJiraIssueKeyAlive(finding.issueKey);

      if (!alive) {
        finding.issueKey     = null;
        finding.issueSummary = null;
        finding.issueType    = null;
      }
    }

    const candidates = collectFindingBugKeyCandidates(finding, portalRoot);
    const picked     = pickJiraBugRefinement(candidates, refinementMap);

    finding.issueKey     = picked.key;
    finding.issueSummary = picked.meta?.summary ?? null;
    finding.issueType    = picked.meta?.issueType ?? null;

    if (!picked.key) {
      finding.issueSummary = null;
      finding.issueType    = null;
    }
  }

  applyJiraClosedFindings(findings, refinementMap);

  return refinementMap;
}

/** Titoli noti per finding risolti ma non più rilevati dal grep. */
const PERSISTED_RESOLVED_TITLES = {
  "bug-ci-portal-paths"       : "CI workflow importa portal-paths.mjs rimosso"
, "dep-runner-comments"       : "Commenti/doc citano runner/cruscotto.server.mjs (legacy)"
, "dep-portal-paths-consumers": "Consumer residui su portal-paths (shim rimosso)"
};

/**
 * Aggiunge finding con link Jira persistito ma assenti dalla scansione corrente (repo pulito).
 *
 * @param {Array<{ id: string, category?: string, severity?: string, title?: string, detail?: string, paths?: string[], status?: string, issueKey?: string | null, issueType?: string | null, resolvedNote?: string }>} findings
 */
export async function appendPersistedResolvedFindings(findings) {
  const links = await loadFindingIssueLinks();

  for (const [id, link] of links) {
    if (findings.some((f) => f.id === id)) {
      continue;
    }

    findings.push({
      id
    , category: id.startsWith("bug-") ? "bug" : id.startsWith("dep-") ? "deprecation" : "gap"
    , severity: id.includes("ci") || id.startsWith("bug-") ? "P1" : "P2"
    , title    : PERSISTED_RESOLVED_TITLES[id] ?? id
    , detail   : "Non più rilevato nel codice attivo (PARKING/docs esclusi)."
    , paths    : []
    , status   : "done"
    , issueKey : link.key
    , issueType: link.issueType ?? null
    , resolvedNote: `✅ ${link.key} — condizione repo assente`
    });
  }
}

/**
 * Stati finding per cui Issue refinement resta vuota (niente Crea).
 *
 * @param {string | null | undefined} status
 * @returns {boolean}
 */
export function isFindingIssueRefClosed(status) {
  const s = String(status ?? "").trim().toLowerCase();

  return s === "done"
    || s === "fatto"
    || s === "coperto"
    || s === "blocked"
    || s === "obsoleto";
}

/**
 * @param {IssueRefinementRenderCtx} ctx
 * @param {(inner: string) => string} wrap
 * @returns {string}
 */
function renderIssueRefinementCreateButton(ctx, wrap) {
  const project      = ctx.project?.trim() || "PortalAdmin";
  const sectionLabel = formatMatrixSectionLabel(ctx.sectionTitle);
  const pathsJson    = escAttr(JSON.stringify(ctx.paths ?? []));
  const defaultType  = resolveMatrixFindingCreateIssueType(ctx.findingId, ctx.createIssueType ?? MATRIX_FINDING_DEFAULT_CREATE_ISSUE_TYPE);
  const selectHtml   = renderCreatableIssueTypeSelect(defaultType);

  const inner = [
    `<div class="issue-ref-create-wrap">`
  , `<button type="button" class="issue-ref-create"`
  , ` data-finding-id="${escAttr(ctx.findingId)}"`
  , ` data-project="${escAttr(project)}"`
  , ` data-section-label="${escAttr(sectionLabel)}"`
  , ` data-category="${escAttr(ctx.category ?? "")}"`
  , ` data-summary="${escAttr(ctx.title ?? "")}"`
  , ` data-detail="${escAttr(ctx.detail ?? "")}"`
  , ` data-paths="${pathsJson}"`
  , ` title="Crea issue su Jira (${project}) — etichetta ${escAttr(sectionLabel)}">Crea</button>`
  , `<div class="issue-ref-create-menu" hidden>`
  , `<label class="issue-ref-create-menu-label">Tipo issue</label>`
  , `<select class="issue-ref-create-type">${selectHtml}</select>`
  , `<button type="button" class="issue-ref-create-confirm">Crea issue</button>`
  , `</div>`
  , `</div>`
  ].join("");

  return wrap(inner);
}

/**
 * @param {IssueRefinementRenderCtx} ctx
 * @param {(inner: string) => string} wrap
 * @returns {string}
 */
export function renderIssueRefinementCell(ctx, wrap) {
  const { issueKey, issueSummary, issueType, findingStatus } = ctx;
  const key      = normalizeJiraIssueKey(issueKey);
  const isClosed = isFindingIssueRefClosed(findingStatus);

  if (key && isMatrixFindingLinkedIssueType(issueType)) {
    const url   = `${JIRA_BROWSE_BASE}/${encodeURIComponent(key)}`;
    const title = issueRefinementTooltip(key, issueSummary);
    const badge = issueTypeBadgeHtml(issueType);
    const link  = `<a class="issue-ref" href="${url}" target="_blank" rel="noopener noreferrer" title="${title}">${escHtml(key)}</a>`;
    const inner = `${badge}${link}`;

    return [
      `<td class="issue-refinement issue-refinement--linked" data-issue-key="${escAttr(key)}"`
    , issueType ? ` data-issue-type="${escAttr(issueType)}"` : ""
    , `>${isClosed ? inner : wrap(inner)}</td>`
    ].join("");
  }

  if (isClosed) {
    return `<td class="issue-refinement">${wrap("")}</td>`;
  }

  return `<td class="issue-refinement">${renderIssueRefinementCreateButton(ctx, wrap)}</td>`;
}
