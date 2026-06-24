/**
 * Render HTML condiviso — tabelle finding Avanzamento (adv-card + Issue refirement).
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

/** CSS condiviso pagine finding Avanzamento / audit. */
export const ADVANCEMENT_FINDINGS_CSS = `
    :root {
      color-scheme: light dark;
      --bg: #0f1419; --surface: #1a2332; --border: #2d3a4f;
      --text: #e7ecf3; --muted: #8b9cb3; --ok: #48bb78;
      --amber: #f0b429; --danger: #f56565; --accent: #3d9cf5;
    }
    body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.55; }
    .page { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem 3rem; }
    h1 { margin: 0 0 0.35rem; font-size: 1.65rem; }
    h2 { margin-top: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 0.35rem; }
    h3 { margin: 1.25rem 0 0.5rem; font-size: 1rem; color: var(--muted); }
    .meta { color: var(--muted); font-size: 0.9rem; }
    .lead { color: var(--muted); }
    .adv-card {
      margin: 0.85rem 0 1.1rem;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface);
      overflow: hidden;
    }
    .adv-card__summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.65rem 0.9rem;
      cursor: pointer;
      font-weight: 600;
      list-style: none;
      user-select: none;
    }
    .adv-card__summary::-webkit-details-marker { display: none; }
    .adv-card__summary::before {
      content: "▸";
      color: var(--muted);
      margin-right: 0.45rem;
      transition: transform 0.15s ease;
    }
    .adv-card[open] > .adv-card__summary::before { transform: rotate(90deg); }
    .adv-card__title { flex: 1 1 auto; }
    .adv-card__badge {
      font-size: 0.78rem;
      font-weight: 500;
      color: var(--muted);
      white-space: nowrap;
    }
    .adv-card__body { padding: 0 0.85rem 0.85rem; }
    .adv-card__body > table { margin-top: 0.35rem; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.75rem; margin: 0; }
    .metric { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem; }
    .metric strong { display: block; font-size: 1.4rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin: 0.75rem 0; }
    th, td { border: 1px solid var(--border); padding: 0.45rem 0.55rem; text-align: left; vertical-align: top; }
    code { font-family: ui-monospace, monospace; font-size: 0.85em; background: var(--bg); padding: 0.1em 0.35em; border-radius: 4px; }
    .tag { font-size: 0.75rem; font-weight: 700; padding: 0.1em 0.45em; border-radius: 4px; }
    .sev-p0 { color: var(--danger); } .sev-p1 { color: var(--amber); } .sev-p2 { color: var(--muted); } .sev-ok { color: var(--ok); }
    tr.finding-resolved td:not(.finding-status) del.resolved { display: inline; }
    tr.finding-resolved td:not(.finding-status) { opacity: 0.82; }
    tr.docs-fresh td { background: rgba(240, 180, 41, 0.07); }
    tr.docs-fresh td:first-child { box-shadow: inset 3px 0 0 var(--amber); }
    .finding-status .audit-resolution { display: block; margin-top: 0.25rem; font-size: 0.82rem; }
    .issue-ref { color: var(--accent); text-decoration: none; font-weight: 600; font-size: 0.85em; }
    .issue-ref:hover { text-decoration: underline; }
    .issue-ref.missing { color: var(--muted); font-weight: 400; }
    td.issue-refinement { white-space: nowrap; }
    .issue-refinement .issue-type {
      display: inline-block;
      margin-right: 0.35rem;
      padding: 0.1rem 0.38rem;
      border-radius: 4px;
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      vertical-align: middle;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--muted);
      text-transform: lowercase;
    }
    .issue-refinement .issue-type-bug { color: #fca5a5; border-color: rgba(248, 113, 113, 0.45); background: rgba(248, 113, 113, 0.1); }
    .issue-ref-create {
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.12rem 0.55rem;
      border-radius: 4px;
      border: 1px solid var(--accent);
      background: transparent;
      color: var(--accent);
      cursor: pointer;
    }
    .issue-ref-create:hover:not(:disabled) { background: rgba(61, 156, 245, 0.12); }
    .issue-ref-create:disabled { opacity: 0.55; cursor: wait; }
    .issue-ref-create-wrap { position: relative; display: inline-block; }
    .issue-ref-create-menu {
      position: absolute;
      z-index: 30;
      top: calc(100% + 0.2rem);
      left: 0;
      min-width: 11rem;
      padding: 0.45rem 0.5rem 0.5rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
    }
    .issue-ref-create-menu[hidden] { display: none; }
    .issue-ref-create-menu-label {
      display: block;
      margin-bottom: 0.25rem;
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--muted);
    }
    .issue-ref-create-type {
      display: block;
      width: 100%;
      margin-bottom: 0.35rem;
      padding: 0.2rem 0.35rem;
      border-radius: 4px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      font-size: 0.82rem;
    }
    .issue-ref-create-confirm {
      display: block;
      width: 100%;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.18rem 0.45rem;
      border-radius: 4px;
      border: 1px solid var(--accent);
      background: var(--accent);
      color: #0f1419;
      cursor: pointer;
    }
    .issue-ref-create-confirm:hover:not(:disabled) { filter: brightness(1.08); }
    .issue-ref-create-confirm:disabled { opacity: 0.55; cursor: wait; }
    td.finding-project { white-space: nowrap; font-size: 0.85em; }
    .finding-project-tag {
      display: inline-block;
      padding: 0.12rem 0.4rem;
      border-radius: 4px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      font-weight: 600;
    }
    .finding-project-justlastone { color: #6ee7b7; border-color: rgba(52, 211, 153, 0.35); }
    .finding-project-portaladmin { color: #93c5fd; border-color: rgba(96, 165, 250, 0.35); }
    .finding-project-portaladmin-cruscotto { color: #a5b4fc; border-color: rgba(129, 140, 248, 0.4); }
    .finding-project-multi { color: var(--amber); border-color: rgba(240, 180, 41, 0.35); }
    del.resolved { text-decoration: line-through; opacity: 0.72; }
    .audit-resolution { display: block; margin: 0.35rem 0 0.5rem; color: var(--ok); font-size: 0.88rem; }
    .audit-open { display: block; margin: 0.35rem 0 0.5rem; color: var(--amber); font-size: 0.88rem; }
    .banner {
      border: 1px solid var(--border);
      background: rgba(61, 156, 245, 0.08);
      padding: 0.75rem 1rem;
      border-radius: 8px;
      margin: 1rem 0;
      font-size: 0.92rem;
    }
    .mermaid {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      margin: 1rem 0;
    }
    a { color: var(--accent); }
`;

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
  , `<div class="metric"><strong>${m.checksPassed}/${m.checksTotal}</strong><span class="meta">Controlli automatici</span></div>`
  , `<div class="metric"><strong>${m.openGaps}</strong><span class="meta">Gap aperti</span></div>`
  , `<div class="metric"><strong>${m.openBugs}</strong><span class="meta">Bug aperti</span></div>`
  , `<div class="metric"><strong>${m.parkingImports}</strong><span class="meta">Import live da PARKING</span></div>`
  , `</div>`
  ].join("\n"), "metrics", { badge: `${m.openGaps} gap · ${m.openBugs} bug`, open: true });
}

/**
 * @param {{ base: { checks: Record<string, { label: string, ok: boolean, detail: string }> }, metrics: Record<string, unknown> }} report
 * @returns {string}
 */
export function renderAdvancementChecksCard(report) {
  const checkRows = Object.entries(report.base.checks)
    .map(([_, c]) => `<tr><td>${esc(c.label)}</td><td class="${c.ok ? "sev-ok" : "sev-p1"}">${c.ok ? "✅" : "⚠️"}</td><td>${esc(c.detail)}</td></tr>`)
    .join("");

  return renderAdvancementCard("Controlli automatici (docs.portal.analysis)", [
    `<!-- CHECKS:portal-analysis -->`
  , `<table>`
  , `<thead><tr><th>Controllo</th><th>Esito</th><th>Dettaglio</th></tr></thead>`
  , `<tbody>${checkRows}</tbody>`
  , `</table>`
  , `<!-- /CHECKS:portal-analysis -->`
  ].join("\n"), "checks", { badge: `${report.metrics.checksPassed}/${report.metrics.checksTotal} OK`, open: false });
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
