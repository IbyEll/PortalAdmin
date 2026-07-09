/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-26 08:40
 * ------------------------------------------------------------------------------------------------------------------------
 * creato il: 2026-06-26 08:40 by: IbyEll
 * modificato il: 2026-06-26 08:40 by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Render HTML adv-card — metriche e sezioni finding pagina Avanzamento
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - matrix.avanzamento.gap.feature.mjs genera HTML iniziale; card details, tabelle e metriche
 *     devono usare lo stesso markup del merge refreshAdvancementPageHtml.
 *
 *   A cosa serve:
 *   - renderAdvancementCard, renderAdvancementFindingSection e renderAdvancementMetricsCard
 *     compongono blocchi FINDINGS; renderAllAdvancementFindingSections itera tutte le categorie.
 *
 * Generalizzazione:
 *   No — struttura colonne e sectionKey allineata alla pagina Avanzamento PortalAdmin.
 *
 * Input: —
 *
 * Consumatori:
 *   - docs.portal/matrix.avanzamento.gap.feature.mjs — render full page sections e metriche
 *
 * Export principali:
 *   - renderAdvancementCard — wrapper details adv-card
 *   - renderAdvancementFindingSection — tabella finding per categoria
 *   - renderAdvancementMetricsCard, renderAllAdvancementFindingSections — sintesi e loop
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { renderFindingRow } from "./docs.portal.advancement.mjs";

/**
 * @param {string} s
 * @returns {string}
 */
export function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {string} title
 * @param {string} bodyHtml
 * @param {string} sectionKey
 * @param {{ badge?: string, open?: boolean }} [opts]
 * @returns {string}
 */
export function renderAdvancementCard(title, bodyHtml, sectionKey, opts = {}) {
  const badge = opts.badge ?? "";
  const open  = opts.open ? " open" : "";

  return [
    `<details class="adv-card"${open} data-adv-section="${esc(sectionKey)}">`
  , `<summary class="adv-card__summary">`
  , `<span class="adv-card__title">${esc(title)}</span>`
  , badge ? `<span class="adv-card__badge">${esc(badge)}</span>` : ""
  , `</summary>`
  , `<div class="adv-card__body">`
  , bodyHtml
  , `</div>`
  , `</details>`
  ].join("\n");
}

/**
 * @param {{ title: string, status: string }[]} items
 * @returns {number}
 */
export function countActiveFindings(items) {
  return items.filter((f) => f.status === "open" || f.status === "partial").length;
}

/**
 * @param {string} title
 * @param {Array<{ id: string, category: string, severity: string, title: string, detail: string, paths: string[], status: string, issueKey?: string | null, issueSummary?: string | null, issueType?: string | null }>} items
 * @param {string} sectionKey
 * @returns {string}
 */
export function renderAdvancementFindingSection(title, items, sectionKey) {
  if (items.length === 0) {
    return "";
  }

  const active = countActiveFindings(items);
  const badge  = active > 0 ? `${active} aperti · ${items.length} voci` : `${items.length} voci`;
  const rows   = items.map((f) => renderFindingRow({
    ...f
  , sectionTitle: title
  , status      : f.status === "done" ? "done" : f.status
  })).join("");
  const table  = [
    `<!-- FINDINGS:${sectionKey} -->`
  , `<table><thead><tr><th>Sev</th><th>Issue refirement</th><th>Project</th><th>Voce</th><th>Dettaglio</th><th>Path</th><th>Stato</th></tr></thead><tbody>`
  , rows
  , `</tbody></table>`
  , `<!-- /FINDINGS:${sectionKey} -->`
  ].join("\n");

  return renderAdvancementCard(title, table, sectionKey, { badge, open: active > 0 });
}

/**
 * @param {{ metrics: Record<string, unknown> }} report
 * @returns {string}
 */
export function renderAdvancementMetricsCard(report) {
  const m = report.metrics;

  return renderAdvancementCard("Sintesi avanzamento", [
    `<div class="metrics">`
  , `<div class="metric"><strong>${m.archProgressPct}%</strong><span class="meta">Migrazioni architetturali</span></div>`
  , `<div class="metric"><strong>${m.archScore}/${m.archTotal}</strong><span class="meta">Target arch. OK</span></div>`
  , `<div class="metric"><strong>${m.openGaps}</strong><span class="meta">Gap aperti</span></div>`
  , `<div class="metric"><strong>${m.openBugs}</strong><span class="meta">Bug aperti</span></div>`
  , `<div class="metric"><strong>${m.parkingImports}</strong><span class="meta">Import live da PARKING</span></div>`
  , `</div>`
  ].join("\n"), "metrics", { badge: `${m.openGaps} gap · ${m.openBugs} bug`, open: true });
}

/**
 * @param {{ findings: Array<{ category: string }> }} report
 * @param {(cat: string) => Array<{ category: string, status: string }>} byCat
 * @returns {string}
 */
export function renderAllAdvancementFindingSections(report, byCat) {
  return [
    renderAdvancementFindingSection("Architettura e avanzamento", [...byCat("avanzamento"), ...byCat("architettura")], "arch")
  , renderAdvancementFindingSection("Gap analysis", byCat("gap"), "gap")
  , renderAdvancementFindingSection("Bug", byCat("bug"), "bug")
  , renderAdvancementFindingSection("Deprecation / drift", byCat("deprecation"), "deprecation")
  , renderAdvancementFindingSection("Feature completate", byCat("feature"), "feature")
  , renderAdvancementFindingSection("Miglioramenti suggeriti", byCat("miglioramento"), "miglioramento")
  ].join("\n\n");
}
