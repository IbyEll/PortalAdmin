/**
 * HTML portal Admin — matrice pilastri JLO × visione × repo.
 */

const PORTAL_BASE = "/pillar-matrix";
const CONFLUENCE_MATRIX_URL = "https://myfuturejobsearch.atlassian.net/wiki/spaces/SDS/pages/8912914/JLO+Visione+Repo+Matrice+pilastri";
const DOC_URL = "https://myfuturejobsearch.atlassian.net/wiki/spaces/SDS/pages/9076737/Piattaforma+Social+per+Gamer+Documento+di+lavoro";

/**
 * @param {string} html
 */
export function confluenceHtmlToPortal(html) {
  return String(html)
    .replace(/<div data-type="panel-info">/g, '<div class="panel panel-info">')
    .replace(/<span data-type="status" data-color="green">([^<]*)<\/span>/g, '<span class="status status-ok">$1</span>')
    .replace(/<span data-type="status" data-color="yellow">([^<]*)<\/span>/g, '<span class="status status-warn">$1</span>')
    .replace(/<span data-type="status" data-color="red">([^<]*)<\/span>/g, '<span class="status status-danger">$1</span>')
    .replace(/<span data-type="status" data-color="neutral">([^<]*)<\/span>/g, '<span class="status status-muted">$1</span>')
    .replace(/<span data-type="status" data-color="purple">([^<]*)<\/span>/g, '<span class="status status-purple">$1</span>');
}

/**
 * @param {string} text
 */
function esc(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @typedef {{ id: string, label: string }} PortalNavItem
 */

/**
 * @param {{ title: string, activeId: string, bodyHtml: string, navItems: PortalNavItem[], fetchedAt?: string }} opts
 */
export function renderPortalPage(opts) {
  const nav = opts.navItems.map((item) => {
    const href = item.id === "index"
      ? `${PORTAL_BASE}/index.html`
      : `${PORTAL_BASE}/${item.id}.html`;
    const cls = item.id === opts.activeId ? ' class="active"' : "";

    return `<a href="${href}"${cls}>${esc(item.label)}</a>`;
  }).join("\n        ");

  const fetched = opts.fetchedAt
    ? `<p class="meta pillar-version">Versione <time datetime="${esc(opts.fetchedAt.slice(0, 10))}">${esc(opts.fetchedAt.slice(0, 10))}</time> · <a href="${DOC_URL}" target="_blank" rel="noopener">Doc 9076737</a></p>`
    : "";

  return [
    "<!DOCTYPE html>"
  , '<html lang="it">'
  , "<head>"
  , '  <meta charset="utf-8" />'
  , '  <meta name="viewport" content="width=device-width, initial-scale=1" />'
  , `  <title>${esc(opts.title)} — Matrice pilastri</title>`
  , '  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />'
  , '  <link rel="stylesheet" href="/jira-issue-display.css" />'
  , '  <link rel="stylesheet" href="/expand-collapse-toolbar.css" />'
  , '  <link rel="stylesheet" href="/pillar-matrix.css" />'
  , "</head>"
  , "<body>"
  , '  <div class="page">'
  , "    <header>"
  , "      <h1>JLO × Visione × Repo</h1>"
  , '      <p class="meta">Matrice pilastri — backlog JLO, documento prodotto, segnali repository</p>'
  , fetched
  , '      <nav class="pillar-nav" aria-label="Pilastri">'
  , `        ${nav}`
  , "      </nav>"
  , "    </header>"
  , "    <main>"
  , `      ${opts.bodyHtml}`
  , "    </main>"
  , '    <footer class="page-footer muted">'
  , '      <a href="/">Cruscotto Dev</a> ·'
  , '      <a href="/backlog.html">Backlog</a> ·'
  , '      <a href="/my-project.html">My Project</a> ·'
  , '      <a href="/jira-working.html">Jira Working</a>'
  , "    </footer>"
  , "  </div>"
  , '  <script src="/expand-collapse-ui.js" defer></script>'
  , '  <script src="/pillar-matrix.js?v=20260614-portal" defer></script>'
  , "</body>"
  , "</html>"
  ].join("\n");
}

/**
 * @param {Array<{ id: string, pillar: string }>} pillars
 */
export function renderIndexPillarList(pillars) {
  const items = pillars.map((pillar) => {
    return `<li><a href="${PORTAL_BASE}/${esc(pillar.id)}.html">${esc(pillar.pillar)}</a></li>`;
  }).join("\n");

  return [
    "<h2>Indice pilastri</h2>"
  , '<ol class="pillar-index-list">'
  , items
  , "</ol>"
  ].join("\n");
}

/**
 * @param {Array<{ id: string, pillar: string }>} pillars
 * @param {Array<{ title: string, stats: { total: number, jiraDone: number, jiraOpen: number, repoOk: number, gapRepoJira: number } }>} pillarBlocks
 */
export function renderIndexPillarTable(pillars, pillarBlocks) {
  const rows = pillars.map((pillar, idx) => {
    const stats = pillarBlocks[idx]?.stats ?? { total: 0, jiraDone: 0, jiraOpen: 0, repoOk: 0, gapRepoJira: 0 };

    return [
      "<tr>"
    , `<td><a href="${PORTAL_BASE}/${esc(pillar.id)}.html">${esc(pillar.pillar)}</a></td>`
    , `<td>${stats.total}</td>`
    , `<td>${stats.jiraDone}</td>`
    , `<td>${stats.jiraOpen}</td>`
    , `<td>${stats.repoOk}</td>`
    , `<td>${stats.gapRepoJira}</td>`
    , "</tr>"
    ].join("");
  });

  return [
    renderIndexPillarList(pillars)
  , "<h3>Riepilogo metriche</h3>"
  , '<table class="matrix-table">'
  , "<thead><tr><th>Pilastro</th><th>Issue</th><th>Jira Fatto</th><th>Jira aperte</th><th>Repo ok</th><th>Gap repo/Jira</th></tr></thead>"
  , "<tbody>"
  , rows.join("\n")
  , "</tbody></table>"
  ].join("\n");
}

/**
 * @param {Array<{ id: string, pillar: string }>} pillars
 * @returns {PortalNavItem[]}
 */
export function buildNavItems(pillars) {
  return [
    { id: "index", label: "Indice" }
  , ...pillars.map((row, idx) => ({ id: row.id, label: `${idx + 1}. ${row.pillar}` }))
  ];
}

export { CONFLUENCE_MATRIX_URL, DOC_URL, PORTAL_BASE };
