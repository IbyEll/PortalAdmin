/**
 * Issue refirement — solo ticket Jira Bug ADMIN-* (host PortalAdmin / cruscotto).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cruscottoDbFileExists, openCruscottoDb } from "../cruscotto.database/cruscotto.db.config.mjs";
import { issueTypeClass, issueTypeShortLabel } from "../cruscotto.frontend/cruscotto.jira.issue.display.core.mjs";
import {
  ADVANCEMENT_CREATABLE_ISSUE_TYPES
, ADVANCEMENT_DEFAULT_CREATE_ISSUE_TYPE
, resolveAdvancementCreateIssueType
} from "./docs.portal.advancement.create.mjs";
import { formatAdvancementSectionLabel } from "./docs.portal.advancement.sections.mjs";

const JIRA_BROWSE_BASE = "https://myfuturejobsearch.atlassian.net/browse";

/** @typedef {{ summary: string, issueType: string | null }} IssueRefinementMeta */

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
function renderCreatableIssueTypeSelect(defaultKey = ADVANCEMENT_DEFAULT_CREATE_ISSUE_TYPE) {
  const resolved = resolveAdvancementCreateIssueType("", defaultKey);

  return ADVANCEMENT_CREATABLE_ISSUE_TYPES.map(({ key, label }) => {
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
  , select: { jiraKey: true, summary: true, issueType: true }
  });

  for (const row of rows) {
    if (row.jiraKey) {
      map.set(row.jiraKey.toUpperCase(), {
        summary  : row.summary ?? ""
      , issueType: row.issueType ?? null
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

    return !meta || !meta.summary || !meta.issueType;
  });

  if (missing.length === 0 || !process.env.JIRA_EMAIL?.trim() || !process.env.JIRA_API_TOKEN?.trim()) {
    return map;
  }

  const { jiraLiveFetch } = await import("../admin.portal.JiraCORE/jiraCORE.jira.live.mjs");

  for (const key of missing) {
    try {
      const issue = await jiraLiveFetch(
        `/rest/api/3/issue/${encodeURIComponent(key)}?fields=${encodeURIComponent("summary,issuetype")}`
      );
      const body = /** @type {{ fields?: { summary?: string, issuetype?: { name?: string } } }} */ (issue);
      const prev = map.get(key) ?? { summary: "", issueType: null };

      map.set(key, {
        summary  : body.fields?.summary ?? prev.summary
      , issueType: body.fields?.issuetype?.name ?? prev.issueType
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
 * @param {Array<{ id: string, paths: string[], issueKey?: string | null, issueSummary?: string | null, issueType?: string | null }>} findings
 * @param {string} portalRoot
 * @returns {Promise<void>}
 */
export async function enrichFindingsWithIssueRefinement(findings, portalRoot) {
  const allCandidates = findings.flatMap((f) => collectFindingBugKeyCandidates(f, portalRoot));
  const refinementMap = await loadIssueRefinementMap(allCandidates);

  for (const finding of findings) {
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
}

/**
 * @param {IssueRefinementRenderCtx} ctx
 * @param {(inner: string) => string} wrap
 * @returns {string}
 */
function renderIssueRefinementCreateButton(ctx, wrap) {
  const project      = ctx.project?.trim() || "PortalAdmin";
  const sectionLabel = formatAdvancementSectionLabel(ctx.sectionTitle);
  const pathsJson    = escAttr(JSON.stringify(ctx.paths ?? []));
  const defaultType  = resolveAdvancementCreateIssueType(ctx.findingId, ctx.createIssueType ?? ADVANCEMENT_DEFAULT_CREATE_ISSUE_TYPE);
  const selectHtml   = renderCreatableIssueTypeSelect(defaultType);

  const inner = [
    `<div class="issue-ref-create-wrap">`
  , `<button type="button" class="issue-ref-create"`
  , ` data-finding-id="${escAttr(ctx.findingId)}"`
  , ` data-project="${escAttr(project)}"`
  , ` data-section-label="${escAttr(sectionLabel)}"`
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
  const isDone = findingStatus === "done" || findingStatus === "fatto";

  if (issueKey && isJiraBugType(issueType)) {
    const url   = `${JIRA_BROWSE_BASE}/${encodeURIComponent(issueKey)}`;
    const title = issueRefinementTooltip(issueKey, issueSummary);
    const badge = issueTypeBadgeHtml(issueType);
    const link  = `<a class="issue-ref" href="${url}" target="_blank" rel="noopener noreferrer" title="${title}">${escHtml(issueKey)}</a>`;

    return `<td class="issue-refinement">${wrap(`${badge}${link}`)}</td>`;
  }

  if (isDone) {
    return `<td class="issue-refinement">${wrap("")}</td>`;
  }

  return `<td class="issue-refinement">${renderIssueRefinementCreateButton(ctx, wrap)}</td>`;
}
