/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-26 08:40
 * ------------------------------------------------------------------------------------------------------------------------
 * creato il: 2026-06-26 08:40 by: IbyEll
 * modificato il: 2026-06-26 08:40 by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *    Aggiorna pagine docs HTML — barrato inline, sezione auto, banner e merge Avanzamento
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Il pulsante Aggiorna deve riflettere lo stato repo corrente su ogni pagina docs: marker
 *     data-docs-check, tabella architettura filtrata e stelline sui delta.
 *
 *   A cosa serve:
 *   - refreshDocHtml applica inline audit, banner verifica, blocco DOCS-AUTO-ADDITIONS e delega
 *     Avanzamento_Gap_Feature a refreshAdvancementPageHtml; helper parsePreviousAutoStates e
 *     isFreshEntry condivisi con merge matrice.
 *
 * Generalizzazione:
 *   Si — analysis e filename guidano scope pagina; isFreshEntry riusato da generatori matrice.
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - html, filename — pagina target e nome file per branch Avanzamento
 *   - analysis — output analyzeRepository con checks e portalRoot
 *   - prev — Map da parsePreviousAutoStates per confronto stelline
 *
 * Consumatori:
 *   - docs.portal.lib/docs.portal.mjs — refreshDocs loop
 *   - docs.portal/matrix.portal.gap.analysis.mjs — parsePreviousAutoStates, stripFreshMarks
 *
 * Export principali:
 *   - refreshDocHtml — pipeline Aggiorna singola pagina
 *   - parsePreviousAutoStates, isFreshEntry, stripFreshMarks — stato e delta
 *   - ensureDocsChromeMarker — placeholder chrome in body
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import {
  ARCHITECTURE_STATUS_ROWS
, extractPageTitle
, inferPageScope
, rowMatchesPageTopics
} from "./docs.portal.page-scope.mjs";
import { buildGapMatrixSections, buildPortalGapMatrixMetrics } from "./matrix.gap.mjs";
import { refreshMatrixPageHtml } from "./matrix.refresh.mjs";
import { analyzePortalAdvancement } from "./matrix.gap.scan.mjs";

function ensureChromeStyles(html) {
  if (html.includes("docs.style.css")) {
    return html;
  }

  if (html.includes("</head>")) {
    return html.replace(
      "</head>"
    , `  <link rel="stylesheet" href="/docs/docs.style.css" />\n</head>`
    );
  }

  return html;
}

/** Stellina — inserito o modificato in questo refresh. */
function freshMarkHtml() {
  return '<span class="docs-fresh-mark" title="Inserito o aggiornato in questo refresh">★</span> ';
}

/**
 * @param {string} html
 * @returns {string}
 */
export function stripFreshMarks(html) {
  let out = html.replace(/<span class="docs-fresh-mark"[^>]*>★<\/span>\s*/g, "");
  out = out.replace(/ docs-fresh/g, "");

  return out;
}

/**
 * @param {string} iso
 * @returns {string}
 */
function formatAuditDate(iso) {
  const d = new Date(iso);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * @param {boolean} ok
 * @param {string} detail
 * @returns {string}
 */
function checkSignature(ok, detail) {
  return `${ok ? "ok" : "fail"}|${detail.replace(/"/g, "'")}`;
}

/**
 * Stati precedenti dalla sezione auto e dai marker inline (per confronto stelline).
 *
 * @param {string} html
 * @returns {Map<string, string>}
 */
export function parsePreviousAutoStates(html) {
  /** @type {Map<string, string>} */
  const states = new Map();

  for (const m of html.matchAll(/data-docs-key="([^"]+)"[^>]*data-docs-sig="([^"]+)"/g)) {
    states.set(m[1], m[2]);
  }

  /** @type {Map<string, number>} */
  const inlineIdx = new Map();

  for (const m of html.matchAll(/data-docs-check="([^"]+)"[^>]*data-docs-sig="([^"]+)"/g)) {
    const n = inlineIdx.get(m[1]) ?? 0;

    states.set(`inline:${m[1]}#${n}`, m[2]);
    inlineIdx.set(m[1], n + 1);
  }

  for (const m of html.matchAll(/data-finding-id="([^"]+)"[^>]*data-finding-sig="([^"]+)"/g)) {
    states.set(`finding:${m[1]}`, m[2]);
  }

  return states;
}

/**
 * @param {string} key
 * @param {string} sig
 * @param {Map<string, string>} prev
 * @returns {boolean}
 */
export function isFreshEntry(key, sig, prev) {
  return !prev.has(key) || prev.get(key) !== sig;
}

/**
 * @param {string} key
 * @param {string} sig
 * @param {boolean} fresh
 * @param {string} innerHtml
 * @returns {string}
 */
function wrapAutoRow(key, sig, fresh, innerHtml) {
  const cls   = fresh ? " docs-fresh" : "";
  const star  = fresh ? freshMarkHtml() : "";
  const cells = innerHtml.replace(/^<td>/, `<td>${star}`);

  return `<tr class="${cls.trim()}" data-docs-key="${key}" data-docs-sig="${sig}">${cells}</tr>`;
}

/**
 * @param {string[]} checkIds
 * @param {Record<string, { ok: boolean, label: string, detail: string }>} checks
 * @returns {{ ok: boolean, detail: string }}
 */
function summarizeChecks(checkIds, checks) {
  const items = checkIds.map((id) => checks[id]).filter(Boolean);

  if (items.length === 0) {
    return { ok: false, detail: "Nessun controllo mappato" };
  }

  const ok     = items.every((c) => c.ok);
  const detail = items.map((c) => `${c.ok ? "✅" : "⚠️"} ${c.label}: ${c.detail}`).join(" · ");

  return { ok, detail };
}

/**
 * @param {ReturnType<import("./docs.portal.analysis.mjs").analyzeRepository>} analysis
 * @param {ReturnType<typeof inferPageScope>} scope
 * @param {Map<string, string>} prev
 * @returns {string}
 */
function buildArchitectureTable(analysis, scope, prev) {
  const { checks } = analysis;
  const rows = ARCHITECTURE_STATUS_ROWS
    .filter((row) => rowMatchesPageTopics(scope.topics, row.topics))
    .map((row) => {
      const summary = summarizeChecks(row.checkIds, checks);
      const sig     = checkSignature(summary.ok, summary.detail);
      const fresh   = isFreshEntry(row.id, sig, prev);
      const cls     = summary.ok ? "sev-ok" : "sev-warn";
      const sym     = summary.ok ? "✅" : "⚠️";
      const cells   = `<td>${row.area}</td><td class="${cls}">${sym}</td><td>${summary.detail}</td>`;

      return { html: wrapAutoRow(row.id, sig, fresh, cells), sig: `${row.id}:${sig}` };
    });

  if (rows.length === 0) {
    return "";
  }

  const archSig   = rows.map((r) => r.sig).join("|");
  const tableFresh = isFreshEntry("arch-table", archSig, prev);

  return [
    `<h3${tableFresh ? ' class="docs-fresh"' : ""} data-docs-key="arch-table" data-docs-sig="${archSig}">`
  , tableFresh ? freshMarkHtml() : ""
  , `Stato architettura</h3>`
  , `<table class="docs-verify-table">`
  , `<thead><tr><th>Area</th><th>Esito</th><th>Dettaglio analisi</th></tr></thead>`
  , `<tbody>${rows.map((r) => r.html).join("")}</tbody>`
  , `</table>`
  ].join("");
}

/**
 * @param {ReturnType<import("./docs.portal.analysis.mjs").analyzeRepository>} analysis
 * @param {Map<string, string>} prev
 * @returns {string}
 */
function buildFullChecksTable(analysis, prev) {
  return Object.entries(analysis.checks)
    .map(([id, c]) => {
      const sig   = checkSignature(c.ok, c.detail);
      const fresh = isFreshEntry(`check:${id}`, sig, prev);
      const cls   = c.ok ? "sev-ok" : "sev-warn";
      const sym   = c.ok ? "✅" : "⚠️";
      const cells = `<td>${c.label}</td><td class="${cls}">${sym}</td><td>${c.detail}</td>`;

      return wrapAutoRow(`check:${id}`, sig, fresh, cells);
    })
    .join("");
}

/**
 * @param {ReturnType<import("./docs.portal.analysis.mjs").analyzeRepository>} analysis
 * @param {Map<string, string>} prev
 * @returns {string}
 */
function buildGapList(analysis, prev) {
  const failed = Object.entries(analysis.checks).filter(([, c]) => !c.ok);

  if (failed.length === 0) {
    const sig   = "none";
    const fresh = isFreshEntry("gaps:none", sig, prev);

    return `<p class="meta${fresh ? " docs-fresh" : ""}">${fresh ? freshMarkHtml() : ""}Nessun gap aperto nei controlli automatici.</p>`;
  }

  return failed
    .map(([id, c]) => {
      const sig   = checkSignature(false, c.detail);
      const fresh = isFreshEntry(`gap:${id}`, sig, prev);
      const cls   = fresh ? " docs-fresh" : "";

      return `<li class="${cls.trim()}" data-docs-key="gap:${id}" data-docs-sig="${sig}">${fresh ? freshMarkHtml() : ""}<strong>${c.label}</strong> — ${c.detail}</li>`;
    })
    .join("");
}

/**
 * @param {string} html
 * @param {ReturnType<import("./docs.portal.analysis.mjs").analyzeRepository>} analysis
 * @param {ReturnType<typeof inferPageScope>} scope
 * @param {Map<string, string>} prev
 * @returns {string}
 */
function buildAutoAdditionsBlock(html, analysis, scope, prev) {
  const date           = formatAuditDate(analysis.analyzedAt);
  const summarySig     = `${analysis.summary.passed}/${analysis.summary.total}/${analysis.summary.failed}`;
  const sectionFresh   = isFreshEntry("section", summarySig, prev);
  const archTable      = buildArchitectureTable(analysis, scope, prev);

  return [
    "<!-- DOCS-AUTO-ADDITIONS -->"
  , `<section class="docs-auto-additions${sectionFresh ? " docs-fresh" : ""}" id="docs-auto-additions" data-docs-key="section" data-docs-sig="${summarySig}">`
  , `<h2>${sectionFresh ? freshMarkHtml() : ""}Analisi repo — ${scope.focusLabel} (${date})</h2>`
  , `<p class="meta">Titolo documento: <em>${scope.title}</em> · ambito dedotto dal titolo:`
  , `${scope.topics.join(", ")}.</p>`
  , archTable
  , `</section>`
  , "<!-- /DOCS-AUTO-ADDITIONS -->"
  ].join("\n");
}

/**
 * @param {ReturnType<import("./docs.portal.analysis.mjs").analyzeRepository>} analysis
 * @param {Map<string, string>} prev
 * @returns {boolean}
 */
function failedGapHeadingFresh(analysis, prev) {
  const failed = Object.entries(analysis.checks).filter(([, c]) => !c.ok);

  return failed.some(([id, c]) => isFreshEntry(`gap:${id}`, checkSignature(false, c.detail), prev));
}

const AUTO_BLOCK_RE = /<!-- DOCS-AUTO-ADDITIONS -->[\s\S]*?<!-- \/DOCS-AUTO-ADDITIONS -->/;
const AUTO_PLACEHOLDER = "<!-- DOCS-AUTO-BLOCK-PLACEHOLDER -->";

/**
 * @param {string} inner
 * @returns {{ wasOk: boolean, detail: string } | null}
 */
function parseAuditSpanInner(inner) {
  const stripped = inner.replace(/<span class="docs-fresh-mark"[^>]*>★<\/span>\s*/g, "").trim();
  const m        = stripped.match(/^(✅|⚠️)\s+\d{4}-\d{2}-\d{2} \d{2}:\d{2}\s+—\s+([\s\S]+)$/);

  if (!m) {
    return null;
  }

  return { wasOk: m[1] === "✅", detail: m[2].trim() };
}

/**
 * @param {string} checkId
 * @param {boolean} ok
 * @param {string} date
 * @param {string} detail
 * @param {boolean} fresh
 * @returns {string}
 */
function buildInlineAuditSpan(checkId, ok, date, detail, fresh) {
  const cls  = ok ? "audit-resolution" : "audit-open";
  const sym  = ok ? "✅" : "⚠️";
  const sig  = checkSignature(ok, detail);
  const star = fresh ? freshMarkHtml() : "";

  return `<span class="${cls}${fresh ? " docs-fresh" : ""}" data-docs-check="${checkId}" data-docs-sig="${sig}">${star}${sym} ${date} — ${detail}</span>`;
}

/**
 * Aggiorna nel corpo HTML i marker data-docs-check (barrato + commento inline).
 *
 * @param {string} html
 * @param {ReturnType<import("./docs.portal.analysis.mjs").analyzeRepository>} analysis
 * @param {Map<string, string>} prev
 * @returns {string}
 */
function applyInlineCheckMarkers(html, analysis, prev) {
  const autoMatch = html.match(AUTO_BLOCK_RE);
  const autoBlock = autoMatch?.[0] ?? "";
  let segment     = autoBlock
    ? html.replace(AUTO_BLOCK_RE, AUTO_PLACEHOLDER)
    : html;

  const date     = formatAuditDate(analysis.analyzedAt);
  const { checks } = analysis;
  /** @type {Map<string, number>} */
  const occurrence = new Map();

  /**
   * @param {string} checkId
   * @returns {string}
   */
  const nextInlineKey = (checkId) => {
    const n = occurrence.get(checkId) ?? 0;

    occurrence.set(checkId, n + 1);

    return `inline:${checkId}#${n}`;
  };

  segment = segment.replace(
    /<span class="audit-(resolution|open)([^"]*)" data-docs-check="([^"]+)"(?: data-docs-sig="([^"]*)")?>([\s\S]*?)<\/span>/g
  , (full, kind, _extraCls, checkId, _oldSig, inner) => {
      const check = checks[checkId];

      if (!check) {
        return full;
      }

      const stateKey = nextInlineKey(checkId);
      const parsed   = parseAuditSpanInner(inner);
      const wasOk    = kind === "resolution";
      const detail   = parsed && check.ok === wasOk ? parsed.detail : check.detail;
      const sig      = checkSignature(check.ok, detail);
      const fresh    = isFreshEntry(stateKey, sig, prev);

      return buildInlineAuditSpan(checkId, check.ok, date, detail, fresh);
    }
  );

  segment = segment.replace(
    /<del([^>]*\sdata-docs-check="([^"]+)"[^>]*)>([\s\S]*?)<\/del>/gi
  , (full, attrs, checkId, inner) => {
      const check = checks[checkId];

      if (!check?.ok) {
        return full;
      }

      if (/\bresolved\b/.test(attrs)) {
        return full;
      }

      if (/\bclass="/i.test(attrs)) {
        return `<del${attrs.replace(/class="([^"]*)"/, 'class="$1 resolved"')}>${inner}</del>`;
      }

      return `<del class="resolved"${attrs}>${inner}</del>`;
    }
  );

  segment = segment.replace(
    /(<del[^>]*data-docs-check="([^"]+)"[^>]*>[\s\S]*?<\/del>)(?!\s*<span class="audit-)/gi
  , (full, delPart, checkId) => {
      const check = checks[checkId];

      if (!check) {
        return full;
      }

      const stateKey = nextInlineKey(checkId);
      const detail   = check.detail;
      const sig      = checkSignature(check.ok, detail);
      const fresh    = isFreshEntry(stateKey, sig, prev);

      return `${delPart}${buildInlineAuditSpan(checkId, check.ok, date, detail, fresh)}`;
    }
  );

  segment = segment.replace(
    /(<span class="audit-(?:resolution|open)[^"]*" data-docs-check="([^"]+)"[^>]*>[\s\S]*?<\/span>)\s*<span class="audit-(?:resolution|open)[^"]*" data-docs-check="\2"[^>]*>[\s\S]*?<\/span>/g
  , "$1"
  );

  segment = segment.replace(
    /<del(?![^>]*data-docs-check)([^>]*)>((?:(?!<del)[\s\S])*?)<\/del>\s*<span class="audit-(?:resolution|open)[^"]*" data-docs-check="[^"]+"[^>]*>[\s\S]*?<\/span>/gi
  , "<del$1>$2</del>"
  );

  if (autoBlock) {
    segment = segment.replace(AUTO_PLACEHOLDER, autoBlock);
  }

  return segment;
}

/**
 * @param {string} html
 * @param {string} analyzedAt
 * @param {ReturnType<import("./docs.portal.analysis.mjs").analyzeRepository>} analysis
 * @param {ReturnType<typeof inferPageScope>} scope
 * @param {Map<string, string>} prev
 * @returns {string}
 */
function upsertVerificationBanner(html, analyzedAt, analysis, scope, prev) {
  let out = html.replace(
    /^<div class="verification-banner[^>]*>[\s\S]*?<\/div>\s*(?=<!DOCTYPE)/i
  , "");

  const dateLabel  = formatAuditDate(analyzedAt);
  const summarySig = `${analysis.summary.passed}/${analysis.summary.total}`;
  const fresh      = isFreshEntry("banner", summarySig, prev);
  const banner     = [
    `<div class="verification-banner${fresh ? " docs-fresh" : ""}" id="docs-auto-banner" data-docs-key="banner" data-docs-sig="${summarySig}">`
  , fresh ? freshMarkHtml() : ""
  , `<strong>Verifica repo</strong> — ${scope.focusLabel} · ${dateLabel} ·`
  , `${analysis.summary.passed}/${analysis.summary.total} controlli OK.`
  , `</div>`
  ].join(" ");

  if (out.includes('id="docs-auto-banner"')) {
    return out.replace(
      /<div class="verification-banner[^"]*" id="docs-auto-banner"[^>]*>[\s\S]*?<\/div>/
    , banner
    );
  }

  if (out.includes("<header>")) {
    return out.replace("<header>", `${banner}\n    <header>`);
  }

  if (out.includes('<main class="doc-page">')) {
    return out.replace('<main class="doc-page">', `<main class="doc-page">\n\n    ${banner}`);
  }

  if (out.includes('<div class="page')) {
    return out.replace(/<div class="page[^"]*">/, (open) => `${open}\n    ${banner}`);
  }

  if (out.includes("<!-- DOCS-CHROME -->")) {
    return out.replace("<!-- DOCS-CHROME -->", `<!-- DOCS-CHROME -->\n  ${banner}`);
  }

  if (out.includes("<body>")) {
    return out.replace("<body>", `<body>\n  ${banner}`);
  }

  return out;
}

/**
 * @param {string} html
 * @param {string} filename
 * @param {ReturnType<import("./docs.portal.analysis.mjs").analyzeRepository>} analysis
 * @returns {Promise<{ html: string, changed: boolean }>}
 */
export async function refreshDocHtml(html, filename, analysis) {
  let out      = ensureChromeStyles(html);
  const before = out;
  const prev   = parsePreviousAutoStates(out);
  const title  = extractPageTitle(out);
  const scope  = inferPageScope(title);

  out = stripFreshMarks(out);
  out = applyInlineCheckMarkers(out, analysis, prev);

  if (filename === "matrix.portal.gap.html" || filename === "matrix.avanzamento.gap.feature.html" || filename === "Avanzamento_Gap_Feature.html") {
    const advancementReport = await analyzePortalAdvancement(analysis.portalRoot);
    const sections          = buildGapMatrixSections(advancementReport);
    const { metrics, metricsBadge } = buildPortalGapMatrixMetrics(advancementReport, sections);

    out = refreshMatrixPageHtml(
      out
    , sections
    , prev
    , advancementReport.generatedAt
    , isFreshEntry
    , { metrics, metricsBadge }
    );
  }

  out = upsertVerificationBanner(out, analysis.analyzedAt, analysis, scope, prev);

  const autoBlock = buildAutoAdditionsBlock(out, analysis, scope, prev);

  if (out.includes("<!-- DOCS-AUTO-ADDITIONS -->")) {
    out = out.replace(
      /<!-- DOCS-AUTO-ADDITIONS -->[\s\S]*?<!-- \/DOCS-AUTO-ADDITIONS -->/
    , autoBlock
    );
  } else if (out.includes("</body>")) {
    out = out.replace("</body>", `${autoBlock}\n</body>`);
  } else {
    out = `${out}\n${autoBlock}`;
  }

  if (!out.includes("<!-- DOCS-CHROME -->")) {
    out = out.replace("<body>", "<body>\n  <!-- DOCS-CHROME -->");
  }

  return { html: out, changed: out !== before };
}

/**
 * @param {string} html
 * @returns {string}
 */
export function ensureDocsChromeMarker(html) {
  if (html.includes("<!-- DOCS-CHROME -->")) {
    return html;
  }

  if (html.includes("<body>")) {
    return html.replace("<body>", "<body>\n  <!-- DOCS-CHROME -->");
  }

  return `<!-- DOCS-CHROME -->\n${html}`;
}
