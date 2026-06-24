/**
 * Riverifica finding Avanzamento_Gap_Feature.html su Aggiorna documenti.
 */

import { renderIssueRefinementCell } from "./docs.portal.advancement.issues.mjs";
import { renderFindingProjectCell } from "./docs.portal.advancement.project.mjs";
import { sectionTitleForCategory } from "./docs.portal.advancement.sections.mjs";

/** @typedef {import("../docs/Avanzamento_Gap_Feature.mjs").analyzePortalAdvancement extends (...args: never) => infer R ? R : never} AdvancementReport */
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
 * @param {Finding} f
 * @param {{ fresh?: boolean, resolvedNote?: string }} [opts]
 * @returns {string}
 */
export function renderFindingRow(f, opts = {}) {
  const { fresh = false, resolvedNote = "" } = opts;
  const sevCls        = { P0: "sev-p0", P1: "sev-p1", P2: "sev-p2", info: "sev-ok" }[f.severity] ?? "";
  const paths         = f.paths.map((p) => `<code>${esc(p)}</code>`).join(", ");
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
    , findingStatus  : display
    }, wrap)
  , renderFindingProjectCell(f.project ?? null, wrap)
  , `<td>${wrap(esc(f.title))}</td>`
  , `<td>${wrap(esc(f.detail))}</td>`
  , `<td>${wrap(paths)}</td>`
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

  return {
    id
  , issueKey   : hasIssueCol ? stripTags(tds[1]) : ""
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
function renderLegacyFattoRow(parsed, legacyId, note, fresh, issueKey = null, issueSummary = null, issueType = null, project = null) {
  const paths = [...parsed.pathsHtml.matchAll(/<code>([^<]*)<\/code>/g)].map((m) => m[1]);
  const key   = issueKey || parsed.issueKey || null;

  return renderFindingRow({
    id           : legacyId
  , category     : "gap"
  , severity     : parsed.severity.replace(/[^P0-9info]/gi, "") || "P2"
  , title        : parsed.title
  , detail       : parsed.detail
  , paths        : paths.length > 0 ? paths : ["—"]
  , status       : "done"
  , issueKey     : key && key !== "—" ? key : null
  , issueSummary : issueSummary ?? null
  , issueType    : issueType ?? null
  , project      : project || parsed.project || null
  }, { fresh, resolvedNote: note });
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

      out.push(tr);
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
      const sig   = `${live.status}|${live.detail}`;
      const fresh = isFresh(`finding:${live.id}`, sig, prev);

      out.push(renderFindingRow({
        ...live
      , sectionTitle: sectionTitleForCategory(live.category)
      }, { fresh }));
      continue;
    }

    const note     = `✅ ${verifiedAt} — non più rilevato dall'analisi repo`;
    const fresh    = isFresh(`finding:${resolvedId}`, `fatto|${note}`, prev);
    const archived     = titleIndex.get(parsed.title);
    const issueKey     = live?.issueKey ?? archived?.issueKey ?? (parsed.issueKey || null);
    const issueSummary = live?.issueSummary ?? archived?.issueSummary ?? null;
    const issueType    = live?.issueType ?? archived?.issueType ?? null;
    const project      = live?.project ?? archived?.project ?? (parsed.project || null);

    seenIds.add(resolvedId);
    out.push(renderLegacyFattoRow(parsed, resolvedId, note, fresh, issueKey ?? null, issueSummary, issueType, project));
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
    /(<div class="metric"><strong>)\d+\/\d+(<\/strong><span class="meta">Controlli automatici<\/span><\/div>)/
  , `$1${metrics.checksPassed}/${metrics.checksTotal}$2`
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
 * @param {string} html
 * @param {AdvancementReport["base"]["checks"]} checks
 * @returns {string}
 */
function updateChecksTable(html, checks) {
  const rows = Object.entries(checks)
    .map(([_, c]) => `<tr><td>${esc(c.label)}</td><td class="${c.ok ? "sev-ok" : "sev-p1"}">${c.ok ? "✅" : "⚠️"}</td><td>${esc(c.detail)}</td></tr>`)
    .join("");

  const block = [
    `<!-- CHECKS:portal-analysis -->`
  , `<table>`
  , `<thead><tr><th>Controllo</th><th>Esito</th><th>Dettaglio</th></tr></thead>`
  , `<tbody>${rows}</tbody>`
  , `</table>`
  , `<!-- /CHECKS:portal-analysis -->`
  ].join("\n");

  if (html.includes("<!-- CHECKS:portal-analysis -->")) {
    return html.replace(
      /<!-- CHECKS:portal-analysis -->[\s\S]*?<!-- \/CHECKS:portal-analysis -->/
    , block
    );
  }

  return html.replace(
    /<h2>Controlli automatici \(docs\.portal\.analysis\)<\/h2>\s*<table>[\s\S]*?<tbody>[\s\S]*?<\/tbody>\s*<\/table>/
  , `<h2>Controlli automatici (docs.portal.analysis)</h2>\n    ${block}`
  );
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
  let out          = updateMetricsBlock(html, report.metrics);

  out = updateChecksTable(out, report.base.checks);

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
