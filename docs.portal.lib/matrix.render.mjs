/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-26 08:40
 * ------------------------------------------------------------------------------------------------------------------------
 * creato il: 2026-06-26 08:40 by: IbyEll
 * modificato il: 2026-06-26 08:40 by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Renderer HTML matrice adv-card — righe, sezioni, metriche e pagina
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Gap analysis, test coverage, audit e template matrice condividono markup HTML (adv-card,
 *     Issue refinement, path, stato) senza copiare stringhe in ogni generator.
 *
 *   A cosa serve:
 *   - renderMatrixRow, renderMatrixSection e renderMatrixPage producono HTML completo; helper esc
 *     e summarizeMatrixSections per metriche e conteggi.
 *
 * Generalizzazione:
 *   Si — MatrixPageConfig e MatrixRow generici; colonne e appendHtml opzionali per nuove matrici.
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - config — MatrixPageConfig (title, sections, metrics, appendHtml) per renderMatrixPage
 *   - r, opts.fresh — MatrixRow e flag stellina per renderMatrixRow
 *   - section — MatrixSection per renderMatrixSection
 *
 * Consumatori:
 *   - docs.portal.lib/matrix.refresh.mjs — renderMatrixRow in merge
 *   - docs.portal/matrix.template.mjs — renderMatrixPage
 *   - docs.portal/matrix.portal.gap.analysis.mjs — renderMatrixPage full e merge
 *
 * Export principali:
 *   - renderMatrixPage, renderMatrixRow, renderMatrixSection — HTML matrice
 *   - escHtml, escAttr — escape attributi e testo
 *   - summarizeMatrixSections — conteggi gap/parziale/fatto
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { MATRIX_TABLE_COLUMNS } from "./matrix.columns.mjs";
import {
  renderIssueRefinementCell
, matrixRowToIssueRefinementCtx
} from "./matrix.finding.issues.mjs";

/**
 * @typedef {{
 *   id: string
 *   sev: string
 *   status: string
 *   project: string
 *   voce: string
 *   dettaglio: string
 *   paths: string[]
 *   issueKey?: string | null
 *   issueType?: string | null
 *   issueSummary?: string | null
 *   category?: string | null
 *   create?: { section: string, summary: string, detail: string }
 *   resolvedNote?: string
 * }} MatrixRow
 */

/**
 * @typedef {{
 *   id: string
 *   title: string
 *   badge?: string
 *   open?: boolean
 *   partHeading?: string
 *   rows: MatrixRow[]
 *   columns?: string[]
 * }} MatrixSection
 */

/**
 * @typedef {{
 *   title: string
 *   pageTitle?: string
 *   generatedAt?: string
 *   metaHtml?: string
 *   leadHtml?: string
 *   metrics?: { label: string, value: string | number, meta?: string }[]
 *   metricsBadge?: string
 *   metricsCardTitle?: string
 *   sections: MatrixSection[]
 *   footerHtml?: string
 *   appendHtml?: string
 *   defaultColumns?: string[]
 *   stylesheetHref?: string
 *   scriptSrc?: string
 *   bodyClass?: string
 *   bodyAttrs?: Record<string, string>
 *   matrixKind?: string
 *   chromeHtml?: string
 *   headExtraHtml?: string
 * }} MatrixPageConfig
 */

const DEFAULT_COLUMNS = MATRIX_TABLE_COLUMNS;

export { MATRIX_TABLE_COLUMNS };

/**
 * @param {string} s
 * @returns {string}
 */
export function escAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/**
 * @param {string} s
 * @returns {string}
 */
export function escHtml(s) {
  return escAttr(s).replace(/&amp;/g, "&");
}

/**
 * @param {MatrixRow} r
 * @param {(inner: string) => string} wrap
 * @param {string} findingStatus
 * @param {string} [matrixKind]
 * @returns {string}
 */
function renderMatrixIssueRefinementCell(r, wrap, findingStatus, matrixKind) {
  return renderIssueRefinementCell(matrixRowToIssueRefinementCtx({
    ...r
  , status: findingStatus
  }, matrixKind), wrap);
}

/**
 * @param {string} sev
 * @param {string} status
 * @returns {string}
 */
function sevTagHtml(sev, status) {
  if (status === "fatto" && /^P[0-5]$/.test(sev)) {
    return `<del class="resolved"><span class="tag sev-${sev.toLowerCase()}">${sev}</span></del>`;
  }

  if (sev === "info") {
    return `<span class="tag sev-ok">info</span>`;
  }

  if (sev === "warn") {
    return `<span class="tag sev-warn">warn</span>`;
  }

  if (sev === "lock") {
    return `<span class="tag sev-warn">🔒</span>`;
  }

  const cls = ["P0", "P1", "P2"].includes(sev) ? sev.toLowerCase() : "p2";

  return `<span class="tag sev-${cls}">${escHtml(sev)}</span>`;
}

/**
 * @param {string} project
 * @returns {string}
 */
function projectTagHtml(project) {
  const isCruscotto = project === "PortalAdmin.Cruscotto";
  const cls         = isCruscotto ? "finding-project-portaladmin-cruscotto" : "finding-project-portaladmin";
  const label       = isCruscotto ? "PortalAdmin.Cruscotto" : project || "PortalAdmin";

  return `<span class="finding-project-tag ${cls}" title="Progetto / overlay">${escHtml(label)}</span>`;
}

/**
 * @param {string[]} paths
 * @param {boolean} resolved
 * @returns {string}
 */
function pathsCellHtml(paths, resolved = false, obsolete = false) {
  const wrap = (html) => {
    if (resolved) {
      return `<del class="resolved">${html}</del>`;
    }

    if (obsolete) {
      return `<span class="finding-obsolete-text">${html}</span>`;
    }

    return html;
  };

  if (!paths.length) {
    return "<td></td>";
  }

  if (paths.length === 1) {
    return `<td>${wrap(`<code>${escHtml(paths[0])}</code>`)}</td>`;
  }

  const items = paths.map((p) => `<li><code>${escHtml(p)}</code></li>`).join("");

  return `<td class="finding-paths">${wrap(`<ul class="finding-paths">${items}</ul>`)}</td>`;
}

/**
 * @param {string} status
 * @param {string} [note]
 * @returns {string}
 */
function statoCellHtml(status, note = "") {
  if (status === "coperto") {
    return `<td class="finding-status"><span class="sev-ok">coperto</span>${note}</td>`;
  }

  if (status === "parziale") {
    return `<td class="finding-status"><span class="sev-warn">parziale</span>${note}</td>`;
  }

  if (status === "fatto") {
    return `<td class="finding-status"><span class="sev-ok">fatto</span>${note ? `<br/><span class="audit-resolution">${escHtml(note)}</span>` : ""}</td>`;
  }

  if (status === "blocked") {
    return `<td class="finding-status"><span class="sev-warn">manuale</span>${note}</td>`;
  }

  if (status === "obsoleto") {
    return `<td class="finding-status"><span class="sev-warn">obsoleto</span>${note ? `<br/><span class="audit-resolution">${escHtml(note)}</span>` : ""}</td>`;
  }

  if (status === "open" || status === "gap") {
    return `<td class="finding-status">open</td>`;
  }

  return `<td class="finding-status">${escHtml(status)}</td>`;
}

/**
 * @param {MatrixRow} r
 * @param {{ fresh?: boolean }} [opts]
 * @returns {string}
 */
export function renderMatrixRow(r, opts = {}) {
  const { fresh = false, matrixKind } = opts;
  const resolved      = r.status === "fatto" && (Boolean(r.resolvedNote) || Boolean(r.issueKey) || /^P[0-5]$/.test(r.sev));
  const obsolete      = r.status === "obsoleto";
  const trClasses     = [
    resolved ? "finding-resolved" : ""
  , obsolete ? "finding-obsolete" : ""
  , fresh ? "docs-fresh" : ""
  ].filter(Boolean).join(" ");
  const trClass       = trClasses ? ` class="${trClasses}"` : "";
  const wrap          = (html) => {
    if (resolved) {
      return `<del class="resolved">${html}</del>`;
    }

    if (obsolete) {
      return `<span class="finding-obsolete-text">${html}</span>`;
    }

    return html;
  };
  const findingStatus = r.status === "gap" ? "open" : r.status;
  const statoKey      = r.status === "gap" ? "open" : r.status;
  const star          = fresh
    ? '<span class="docs-fresh-mark" title="Inserito o aggiornato in questo refresh">★</span> '
    : "";
  const irCell        = obsolete
    ? `<td class="issue-refinement issue-refinement--obsolete"></td>`
    : renderMatrixIssueRefinementCell(r, wrap, findingStatus, matrixKind);

  return [
    `<tr${trClass} data-finding-id="${escAttr(r.id)}" data-finding-status="${escAttr(findingStatus)}" data-finding-sig="${escAttr(`${findingStatus}|${r.dettaglio}`)}">`
  , `<td>${star}${sevTagHtml(r.sev, r.status)}</td>`
  , irCell
  , `<td class="finding-project">${wrap(projectTagHtml(r.project))}</td>`
  , `<td>${wrap(escHtml(r.voce))}</td>`
  , `<td>${wrap(escHtml(r.dettaglio))}</td>`
  , pathsCellHtml(r.paths, resolved, obsolete)
  , statoCellHtml(statoKey, r.resolvedNote ?? "")
  , `</tr>`
  ].join("");
}

/**
 * @param {MatrixSection} section
 * @param {string[]} [defaultColumns]
 * @returns {string}
 */
export function renderMatrixSection(section, defaultColumns = DEFAULT_COLUMNS, renderOpts = {}) {
  const columns = section.columns ?? defaultColumns;
  const openAttr  = section.open ? " open" : "";
  const badge     = section.badge ?? `${section.rows.length} voci`;
  const head      = columns.map((c) => `<th>${escHtml(c)}</th>`).join("");
  const rows      = section.rows.map((row) => renderMatrixRow(row, { matrixKind: renderOpts.matrixKind })).join("");
  const partHtml  = section.partHeading
    ? [
        `<div class="matrix-part-heading" id="part-${escAttr(section.id)}">`
      , `<h2>${escHtml(section.partHeading)}</h2>`
      , `</div>`
      ].join("\n")
    : "";

  return [
    partHtml
  , `<details class="adv-card"${openAttr} data-adv-section="${escAttr(section.id)}">`
  , `<summary class="adv-card__summary">`
  , `<span class="adv-card__title">${escHtml(section.title)}</span>`
  , `<span class="adv-card__badge">${escHtml(badge)}</span>`
  , `</summary>`
  , `<div class="adv-card__body">`
  , `<!-- FINDINGS:${escAttr(section.id)} -->`
  , `<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`
  , `<!-- /FINDINGS:${escAttr(section.id)} -->`
  , `</div>`
  , `</details>`
  ].join("\n");
}

/**
 * @param {{ label: string, value: string | number, meta?: string }[]} metrics
 * @param {string} [badge]
 * @param {string} [title]
 * @returns {string}
 */
export function renderMatrixMetricsCard(metrics, badge = "", title = "Sintesi") {
  const items = metrics.map((m) => [
    `<div class="metric"><strong>${escHtml(String(m.value))}</strong>`
  , `<span class="meta">${escHtml(m.meta ?? m.label)}</span></div>`
  ].join("")).join("\n");

  return [
    `<details class="adv-card" open data-adv-section="metrics">`
  , `<summary class="adv-card__summary">`
  , `<span class="adv-card__title">${escHtml(title)}</span>`
  , badge ? `<span class="adv-card__badge">${escHtml(badge)}</span>` : ""
  , `</summary>`
  , `<div class="adv-card__body"><div class="metrics">${items}</div></div>`
  , `</details>`
  ].join("\n");
}

/**
 * @param {string} title
 * @param {Array<{ label: string, ok: boolean, detail: string }>} checks
 * @param {string} [badge]
 * @returns {string}
 */
export function renderMatrixChecksSection(title, checks, badge = "") {
  const rows = checks.map((c) => [
    `<tr><td>${escHtml(c.label)}</td>`
  , `<td class="${c.ok ? "sev-ok" : "sev-p1"}">${c.ok ? "✅" : "⚠️"}</td>`
  , `<td>${escHtml(c.detail)}</td></tr>`
  ].join("")).join("");

  return [
    `<details class="adv-card" data-adv-section="checks">`
  , `<summary class="adv-card__summary">`
  , `<span class="adv-card__title">${escHtml(title)}</span>`
  , `<span class="adv-card__badge">${escHtml(badge || `${checks.filter((c) => c.ok).length}/${checks.length} OK`)}</span>`
  , `</summary>`
  , `<div class="adv-card__body">`
  , `<!-- CHECKS:matrix -->`
  , `<table><thead><tr><th>Controllo</th><th>Esito</th><th>Dettaglio</th></tr></thead><tbody>${rows}</tbody></table>`
  , `<!-- /CHECKS:matrix -->`
  , `</div>`
  , `</details>`
  ].join("\n");
}

/**
 * @param {MatrixPageConfig} config
 * @returns {string}
 */
export function renderMatrixPage(config) {
  const pageTitle      = config.pageTitle ?? config.title;
  const generatedAt    = config.generatedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const stylesheetHref = config.stylesheetHref ?? "/docs/docs.style.css";
  const scriptSrc      = config.scriptSrc ?? "/docs/utility.toolbar.document.js";
  const bodyClass      = config.bodyClass ? ` class="${escAttr(config.bodyClass)}"` : "";
  const bodyAttrs      = config.bodyAttrs
    ? Object.entries(config.bodyAttrs)
      .map(([key, value]) => ` ${escAttr(key)}="${escAttr(value)}"`)
      .join("")
    : "";
  const chromeHtml     = config.chromeHtml ?? "<!-- DOCS-CHROME -->";
  const headExtraHtml  = config.headExtraHtml ?? "";
  const metricsHtml    = config.metrics?.length
    ? renderMatrixMetricsCard(config.metrics, config.metricsBadge, config.metricsCardTitle)
    : "";
  const sectionsHtml = config.sections
    .map((s) => renderMatrixSection(s, config.defaultColumns, { matrixKind: config.matrixKind }))
    .join("\n");

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escHtml(pageTitle)}</title>
  <link rel="stylesheet" href="${escAttr(stylesheetHref)}" />
  ${headExtraHtml}
</head>
<body${bodyClass}${bodyAttrs}>
  ${chromeHtml}
  <div class="page page--wide">
    <header>
      <h1>${escHtml(config.title)}</h1>
      <p class="meta">${config.metaHtml ?? `Generato: ${generatedAt}`}</p>
      ${config.leadHtml ? `<p class="lead">${config.leadHtml}</p>` : ""}
    </header>

    ${metricsHtml}
    ${sectionsHtml}
    ${config.appendHtml ?? ""}

    ${config.footerHtml ? `<p class="meta">${config.footerHtml}</p>` : ""}
  </div>
  <script src="${escAttr(scriptSrc)}" defer></script>
</body>
</html>`;
}

/**
 * @param {MatrixSection[]} sections
 * @returns {{ total: number, gap: number, partial: number, done: number, obsolete: number }}
 */
export function summarizeMatrixSections(sections) {
  const rows = sections.flatMap((s) => s.rows);

  return {
    total  : rows.length
  , gap    : rows.filter((r) => r.status === "gap").length
  , partial: rows.filter((r) => r.status === "parziale" || r.status === "blocked").length
  , done   : rows.filter((r) => r.status === "coperto" || r.status === "fatto").length
  , obsolete: rows.filter((r) => r.status === "obsoleto").length
  };
}
