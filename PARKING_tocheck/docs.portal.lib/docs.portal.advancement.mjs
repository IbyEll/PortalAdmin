/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-26 08:40
 * ------------------------------------------------------------------------------------------------------------------------
 * creato il: 2026-06-26 08:40 by: IbyEll
 * modificato il: 2026-06-26 08:40 by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Merge refresh Avanzamento_Gap_Feature.html — finding, path e issue refinement
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - La pagina Avanzamento ha molte sezioni FINDINGS; Aggiorna deve unire righe live dal report
 *     con righe HTML esistenti, path rimossi e link Jira senza full rewrite.
 *
 *   A cosa serve:
 *   - renderFindingRow produce tr con data-finding-id; refreshAdvancementPageHtml aggiorna metriche,
 *     merge tbody per SECTION_CATEGORIES e sincronizza badge card adv.
 *
 * Generalizzazione:
 *   No — SECTION_CATEGORIES e layout colonna Avanzamento dedicati a matrix.avanzamento.gap.feature.
 *
 * Input: —
 *
 * Consumatori:
 *   - docs.portal.lib/docs.portal.refresh.mjs — branch filename Avanzamento_Gap_Feature.html
 *   - docs.portal/matrix.avanzamento.gap.feature.mjs — refreshAdvancementPageHtml su generazione
 *   - docs.portal.lib/docs.portal.advancement.render.mjs — renderFindingRow nelle sezioni
 *
 * Export principali:
 *   - renderFindingRow — HTML riga finding singola
 *   - refreshAdvancementPageHtml — merge completo pagina Avanzamento
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { parseIssueRefinementFromCell, renderIssueRefinementCell, normalizeJiraIssueKey } from "./docs.portal.advancement.issues.mjs";
import { stripAnalysisChecksBlocks } from "./matrix.refresh.mjs";
import { loadFindingIssueLinks } from "./docs.portal.advancement.finding-issues.store.mjs";
import { renderFindingProjectCell } from "./docs.portal.advancement.project.mjs";
import { sectionTitleForCategory } from "./docs.portal.advancement.sections.mjs";

/** @typedef {import("../docs.portal/matrix.avanzamento.gap.feature.mjs").analyzePortalAdvancement extends (...args: never) => infer R ? R : never} AdvancementReport */
/** @typedef {AdvancementReport["findings"][number]} Finding */

/** @type {Record<string, string[]>} */
const SECTION_CATEGORIES = {
  arch         : ["avanzamento", "architettura"]
, gap          : ["gap"]
, bug          : ["bug"]
, deprecation  : ["deprecation"]
, feature      : ["feature"]
, miglioramento: ["miglioramento"]
};

/**
 * @param {string} s
 * @returns {string}
 */
function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {string} html
 * @returns {string}
 */
function stripTags(html) {
  return html.replace(/<[^>]+>/g, "").trim();
}

/**
 * @param {string} title
 * @returns {string}
 */
function legacyIdFromTitle(title) {
  return `legacy:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80)}`;
}

/**
 * @param {string} pathsHtml
 * @returns {{ current: string[], removed: string[] }}
 */
function parsePathsFromCell(pathsHtml) {
  /** @type {string[]} */
  const removed = [];
  let activeHtml  = String(pathsHtml ?? "");

  activeHtml = activeHtml.replace(/<del[^>]*>[\s\S]*?<\/del>/gi, (delBlock) => {
    for (const m of delBlock.matchAll(/<code>([^<]*)<\/code>/g)) {
      const path = m[1]?.trim();

      if (path && path !== "—") {
        removed.push(path);
      }
    }

    return "";
  });

  /** @type {string[]} */
  const current = [];

  for (const m of activeHtml.matchAll(/<code>([^<]*)<\/code>/g)) {
    const path = m[1]?.trim();

    if (path && path !== "—") {
      current.push(path);
    }
  }

  return { current, removed };
}

/**
 * @param {string} trHtml
 * @param {string} pathsHtml
 * @returns {{ current: string[], removed: string[] }}
 */
function parsePathsFromRow(trHtml, pathsHtml) {
  const fromCell = parsePathsFromCell(pathsHtml);

  if (fromCell.current.length > 0 || fromCell.removed.length > 0) {
    return fromCell;
  }

  const raw = trHtml.match(/data-paths="([^"]+)"/)?.[1];

  if (!raw) {
    return fromCell;
  }

  try {
    const paths = JSON.parse(raw.replace(/&quot;/g, '"'));

    if (Array.isArray(paths)) {
      return {
        current: paths.map((p) => String(p).trim()).filter(Boolean)
      , removed: []
      };
    }
  } catch {
    // JSON path attribute non valido
  }

  return fromCell;
}

/**
 * @param {string[]} currentPaths
 * @param {string[]} removedPaths
 * @param {(inner: string) => string} wrapRemoved
 * @param {{ freshPaths?: string[] }} [opts]
 * @returns {string}
 */
function renderPathsColumn(currentPaths, removedPaths, wrapRemoved, opts = {}) {
  /** @type {string[]} */
  const items = [];

  for (const p of removedPaths) {
    if (p && p !== "—") {
      items.push(`<li>${wrapRemoved(`<code>${esc(p)}</code>`)}</li>`);
    }
  }

  for (const p of currentPaths) {
    if (!p || p === "—") {
      continue;
    }

    let inner = `<code>${esc(p)}</code>`;

    if (opts.freshPaths?.includes(p)) {
      inner = `<span class="docs-fresh-mark" title="Nuovo path in questo refresh">★</span> ${inner}`;
    }

    items.push(`<li>${inner}</li>`);
  }

  if (items.length === 0) {
    return "";
  }

  return `<ul class="finding-paths">${items.join("")}</ul>`;
}

/**
 * @param {Finding} f
 * @param {{ fresh?: boolean, resolvedNote?: string }} [opts]
 * @returns {string}
 */
export function renderFindingRow(f, opts = {}) {
  const { fresh = false, resolvedNote = "", freshPaths = [] } = opts;
  const sevCls        = { P0: "sev-p0", P1: "sev-p1", P2: "sev-p2", info: "sev-ok" }[f.severity] ?? "";
  const removedPaths  = Array.isArray(f.removedPaths) ? f.removedPaths : [];
  const isResolvedGap = Boolean(resolvedNote);
  const isDone        = f.status === "done" || f.status === "fatto";
  const display       = isDone || isResolvedGap ? "fatto" : f.status;
  const rowCls        = [
    isResolvedGap ? "finding-resolved" : ""
  , fresh ? "docs-fresh" : ""
  ].filter(Boolean).join(" ");
  const sig  = `${display}|${f.detail}`.replace(/"/g, "'");
  const star = fresh
    ? '<span class="docs-fresh-mark" title="Inserito o aggiornato in questo refresh">★</span> '
    : "";
  const wrap = (inner) => (isResolvedGap ? `<del class="resolved">${inner}</del>` : inner);
  const pathsInner = renderPathsColumn(
    f.paths ?? []
  , removedPaths
  , isResolvedGap ? (inner) => inner : (inner) => `<del class="resolved">${inner}</del>`
  , { freshPaths }
  );
  const pathsCell = isResolvedGap ? wrap(pathsInner) : pathsInner;
  const stato = isDone || isResolvedGap
    ? `<span class="sev-ok">fatto</span>${resolvedNote ? `<br/><span class="audit-resolution">${resolvedNote}</span>` : ""}`
    : esc(display);

  return [
    `<tr${rowCls ? ` class="${rowCls}"` : ""} data-finding-id="${esc(f.id)}" data-finding-status="${esc(display)}" data-finding-sig="${esc(sig)}">`
  , `<td>${star}${wrap(`<span class="tag ${sevCls}">${esc(f.severity)}</span>`)}</td>`
  , renderIssueRefinementCell({
      findingId      : f.id
    , issueKey       : f.issueKey ?? null
    , issueSummary   : f.issueSummary ?? null
    , issueType      : f.issueType ?? null
    , project        : f.project ?? null
    , title          : f.title
    , detail         : f.detail
    , paths          : f.paths
    , createIssueType: f.createIssueType ?? null
    , sectionTitle   : f.sectionTitle ?? null
    , category       : f.category ?? null
    , findingStatus  : display
    }, wrap)
  , renderFindingProjectCell(f.project ?? null, wrap)
  , `<td>${wrap(esc(f.title))}</td>`
  , `<td>${wrap(esc(f.detail))}</td>`
  , `<td class="finding-paths">${pathsCell}</td>`
  , `<td class="finding-status">${stato}</td>`
  , `</tr>`
  ].join("");
}

/**
 * @param {string} trHtml
 * @returns {{ id: string, title: string, status: string, severity: string, detail: string, pathsHtml: string, issueKey: string, project: string } | null}
 */
function parseFindingRow(trHtml) {
  const tds = [...trHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1]);

  if (tds.length < 5) {
    return null;
  }

  const id = trHtml.match(/data-finding-id="([^"]+)"/)?.[1]
    ?? trHtml.match(/data-finding-id='([^']+)'/)?.[1]
    ?? "";

  const hasProject  = tds.length >= 7;
  const hasIssueCol = tds.length >= 6;
  const titleIdx    = hasProject ? 3 : hasIssueCol ? 2 : 1;
  const detailIdx   = hasProject ? 4 : hasIssueCol ? 3 : 2;
  const pathsIdx    = hasProject ? 5 : hasIssueCol ? 4 : 3;
  const statusIdx   = hasProject ? 6 : hasIssueCol ? 5 : 4;
  const statusRaw   = trHtml.match(/data-finding-status="([^"]+)"/)?.[1]
    ?? stripTags(tds[statusIdx]);
  const issueCell   = hasIssueCol ? parseIssueRefinementFromCell(tds[1]) : { key: null, issueType: null };
  const fallbackKey = hasIssueCol ? normalizeJiraIssueKey(stripTags(tds[1])) : null;

  return {
    id
  , issueKey   : issueCell.key ?? fallbackKey ?? ""
  , issueType  : issueCell.issueType
  , project    : hasProject ? stripTags(tds[2]) : ""
  , title      : stripTags(tds[titleIdx])
  , status     : statusRaw.toLowerCase()
  , severity   : stripTags(tds[0])
  , detail     : stripTags(tds[detailIdx])
  , pathsHtml  : tds[pathsIdx]
  };
}

/**
 * @param {AdvancementReport} report
 * @param {string[]} categories
 * @returns {Map<string, Finding>}
 */
function liveActiveByCategory(report, categories) {
  /** @type {Map<string, Finding>} */
  const map = new Map();

  for (const f of report.findings) {
    if (!categories.includes(f.category)) {
      continue;
    }

    if (f.status === "open" || f.status === "partial") {
      map.set(f.id, f);
    }
  }

  return map;
}

/**
 * @param {{ id: string, title: string, severity: string, detail: string, pathsHtml: string, issueKey?: string }} parsed
 * @param {string} legacyId
 * @param {string} note
 * @param {boolean} fresh
 * @param {string | null} [issueKey]
 * @param {string | null} [issueSummary]
 * @param {string | null} [issueType]
 * @param {string | null} [project]
 * @returns {string}
 */
function renderLegacyFattoRow(parsed, legacyId, note, fresh, issueKey = null, issueSummary = null, issueType = null, project = null, trHtml = "") {
  const pathState = parsePathsFromRow(trHtml, parsed.pathsHtml);
  const allPaths  = [...new Set([...pathState.current, ...pathState.removed])];
  const persisted = loadFindingIssueLinks().get(legacyId);
  const key       = normalizeJiraIssueKey(issueKey)
    ?? normalizeJiraIssueKey(parsed.issueKey)
    ?? normalizeJiraIssueKey(persisted?.key)
    ?? null;
  const type      = issueType ?? parsed.issueType ?? persisted?.issueType ?? null;

  return renderFindingRow({
    id           : legacyId
  , category     : "gap"
  , severity     : parsed.severity.replace(/[^P0-9info]/gi, "") || "P2"
  , title        : parsed.title
  , detail       : parsed.detail
  , paths        : allPaths.length > 0 ? allPaths : ["—"]
  , status       : "done"
  , issueKey     : key
  , issueSummary : issueSummary ?? null
  , issueType    : type
  , project      : project || parsed.project || null
  }, { fresh, resolvedNote: note });
}

/**
 * @param {string} trHtml
 * @returns {string}
 */
function parseResolvedNote(trHtml) {
  return trHtml.match(/audit-resolution">([^<]+)/)?.[1]?.trim() ?? "";
}

/**
 * @param {string} trHtml
 * @returns {boolean}
 */
function findingRowNeedsIssueRefinementRepair(trHtml, parsed) {
  if (!parsed.id) {
    return false;
  }

  const persisted = loadFindingIssueLinks().get(parsed.id);

  if (!persisted?.key) {
    return false;
  }

  if (normalizeJiraIssueKey(parsed.issueKey) === persisted.key) {
    return false;
  }

  return true;
}

/**
 * @param {string} tbodyHtml
 * @param {string[]} categories
 * @param {AdvancementReport} report
 * @param {string} verifiedAt
 * @param {Map<string, string>} prev
 * @param {(key: string, sig: string, prev: Map<string, string>) => boolean} isFresh
 * @returns {string}
 */
function mergeSectionTbody(tbodyHtml, categories, report, verifiedAt, prev, isFresh) {
  const rows       = [...tbodyHtml.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => m[0]);
  const liveById   = liveActiveByCategory(report, categories);
  const liveByTitle = new Map(
    [...liveById.values()].map((f) => [f.title, f])
  );
  const titleIndex = new Map(report.findings.map((f) => [f.title, f]));
  /** @type {Set<string>} */
  const seenIds    = new Set();
  /** @type {string[]} */
  const out        = [];

  for (const tr of rows) {
    const parsed = parseFindingRow(tr);

    if (!parsed) {
      out.push(tr);
      continue;
    }

    if (parsed.status === "fatto" || parsed.status === "done") {
      if (parsed.id) {
        seenIds.add(parsed.id);
      }

      if (findingRowNeedsIssueRefinementRepair(tr, parsed)) {
        const persisted = loadFindingIssueLinks().get(parsed.id);
        const note      = parseResolvedNote(tr) || `✅ ${verifiedAt} — non più rilevato dall'analisi repo`;

        out.push(renderLegacyFattoRow(
          parsed
        , parsed.id
        , note
        , false
        , persisted?.key ?? null
        , null
        , persisted?.issueType ?? null
        , parsed.project || null
        , tr
        ));
      } else {
        out.push(tr);
      }

      continue;
    }

    if (parsed.status !== "open" && parsed.status !== "partial") {
      out.push(tr);
      continue;
    }

    const resolvedId = parsed.id
      || liveByTitle.get(parsed.title)?.id
      || titleIndex.get(parsed.title)?.id
      || legacyIdFromTitle(parsed.title);

    const live = liveById.get(resolvedId) ?? liveByTitle.get(parsed.title);

    if (live) {
      seenIds.add(live.id);
      const sig        = `${live.status}|${live.detail}`;
      const fresh      = isFresh(`finding:${live.id}`, sig, prev);
      const pathState  = parsePathsFromRow(tr, parsed.pathsHtml);
      const newPaths   = live.paths ?? [];
      const newlyRemoved = pathState.current.filter((p) => !newPaths.includes(p));
      const allRemoved = [...new Set([...pathState.removed, ...newlyRemoved])];
      const addedPaths = newPaths.filter(
        (p) => !pathState.current.includes(p) && !pathState.removed.includes(p)
      );
      const parsedKey  = parsed.issueKey && /^(?:ADMIN|JLO)-\d+$/i.test(parsed.issueKey)
        ? String(parsed.issueKey).toUpperCase()
        : null;

      out.push(renderFindingRow({
        ...live
      , issueKey  : live.issueKey ?? parsedKey
      , issueType : live.issueType ?? parsed.issueType ?? null
      , sectionTitle: sectionTitleForCategory(live.category)
      , removedPaths: allRemoved
      }, { fresh, freshPaths: addedPaths }));
      continue;
    }

    const note         = `✅ ${verifiedAt} — non più rilevato dall'analisi repo`;
    const fresh        = isFresh(`finding:${resolvedId}`, `fatto|${note}`, prev);
    const archived     = titleIndex.get(parsed.title);
    const persisted    = loadFindingIssueLinks().get(resolvedId);
    const issueKey     = normalizeJiraIssueKey(live?.issueKey)
      ?? normalizeJiraIssueKey(archived?.issueKey)
      ?? normalizeJiraIssueKey(persisted?.key)
      ?? normalizeJiraIssueKey(parsed.issueKey);
    const issueSummary = live?.issueSummary ?? archived?.issueSummary ?? null;
    const issueType    = live?.issueType ?? archived?.issueType ?? persisted?.issueType ?? parsed.issueType ?? null;
    const project      = live?.project ?? archived?.project ?? (parsed.project || null);

    seenIds.add(resolvedId);
    out.push(renderLegacyFattoRow(parsed, resolvedId, note, fresh, issueKey, issueSummary, issueType, project, tr));
  }

  for (const f of liveById.values()) {
    if (!seenIds.has(f.id)) {
      out.push(renderFindingRow({
        ...f
      , sectionTitle: sectionTitleForCategory(f.category)
      }, { fresh: true }));
    }
  }

  return out.join("");
}

/**
 * @param {string} html
 * @param {AdvancementReport["metrics"]} metrics
 * @returns {string}
 */
function updateMetricsBlock(html, metrics) {
  let out = html;

  out = out.replace(
    /(<div class="metric"><strong>)\d+%(<\/strong><span class="meta">Migrazioni architetturali<\/span><\/div>)/
  , `$1${metrics.archProgressPct}$2`
  );
  out = out.replace(
    /(<div class="metric"><strong>)\d+\/\d+(<\/strong><span class="meta">Target arch\. OK<\/span><\/div>)/
  , `$1${metrics.archScore}/${metrics.archTotal}$2`
  );
  out = out.replace(
    /(<div class="metric"><strong>)\d+(<\/strong><span class="meta">Gap aperti<\/span><\/div>)/
  , `$1${metrics.openGaps}$2`
  );
  out = out.replace(
    /(<div class="metric"><strong>)\d+(<\/strong><span class="meta">Bug aperti<\/span><\/div>)/
  , `$1${metrics.openBugs}$2`
  );
  out = out.replace(
    /(<div class="metric"><strong>)\d+(<\/strong><span class="meta">Import live da PARKING<\/span><\/div>)/
  , `$1${metrics.parkingImports}$2`
  );

  return out;
}

/**
 * @param {string} tbodyHtml
 * @returns {{ total: number, active: number }}
 */
function countRowStatuses(tbodyHtml) {
  let total  = 0;
  let active = 0;

  for (const m of tbodyHtml.matchAll(/data-finding-status="([^"]+)"/g)) {
    total += 1;

    if (m[1] === "open" || m[1] === "partial") {
      active += 1;
    }
  }

  if (total === 0) {
    for (const m of tbodyHtml.matchAll(/<td class="finding-status">([^<]+)</g)) {
      total += 1;
      const s = m[1].trim().toLowerCase();

      if (s === "open" || s === "partial") {
        active += 1;
      }
    }
  }

  return { total, active };
}

/**
 * @param {string} html
 * @param {string} sectionKey
 * @param {string} tbodyHtml
 * @returns {string}
 */
function syncCardBadge(html, sectionKey, tbodyHtml) {
  const { total, active } = countRowStatuses(tbodyHtml);
  const badge             = active > 0 ? `${active} aperti · ${total} voci` : `${total} voci`;
  const re                = new RegExp(
    `(<details[^>]*data-adv-section="${sectionKey}"[^>]*>[\\s\\S]*?<span class="adv-card__badge">)([^<]*)(</span>)`
  );

  if (!re.test(html)) {
    return html;
  }

  return html.replace(re, `$1${badge}$3`);
}

/**
 * @param {string} html
 * @param {AdvancementReport} report
 * @param {Map<string, string>} prev
 * @param {string} verifiedAtIso
 * @param {(key: string, sig: string, prev: Map<string, string>) => boolean} isFresh
 * @returns {string}
 */
export function refreshAdvancementPageHtml(html, report, prev, verifiedAtIso, isFresh) {
  const verifiedAt = verifiedAtIso.slice(0, 16).replace("T", " ");
  let out          = stripAnalysisChecksBlocks(html);

  out = updateMetricsBlock(out, report.metrics);

  out = out.replace(
    /(<details[^>]*data-adv-section="metrics"[^>]*>[\s\S]*?<span class="adv-card__badge">)([^<]*)(<\/span>)/
  , `$1${report.metrics.openGaps} gap · ${report.metrics.openBugs} bug$3`
  );

  for (const sectionKey of Object.keys(SECTION_CATEGORIES)) {
    const categories = SECTION_CATEGORIES[sectionKey];
    const blockRe    = new RegExp(
      `(<!-- FINDINGS:${sectionKey} -->\\s*<table>[\\s\\S]*?<tbody>)([\\s\\S]*?)(</tbody>[\\s\\S]*?</table>\\s*<!-- /FINDINGS:${sectionKey} -->)`
    );

    out = out.replace(blockRe, (full, head, tbody, tail) => {
      const merged = mergeSectionTbody(tbody, categories, report, verifiedAt, prev, isFresh);

      if (merged === tbody) {
        return full;
      }

      return `${head}${merged}${tail}`;
    });
  }

  for (const sectionKey of Object.keys(SECTION_CATEGORIES)) {
    const tbodyMatch = out.match(
      new RegExp(`<!-- FINDINGS:${sectionKey} -->[\\s\\S]*?<tbody>([\\s\\S]*?)</tbody>`)
    );

    if (tbodyMatch) {
      out = syncCardBadge(out, sectionKey, tbodyMatch[1]);
    }
  }

  return out;
}
