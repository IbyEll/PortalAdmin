/**
 * Applica aggiornamenti barrato + commento alle pagine docs/*.html.
 */

const CHROME_STYLES = `
    del.resolved {
      text-decoration: line-through;
      opacity: 0.72;
    }

    .audit-resolution {
      display: block;
      margin: 0.35rem 0 0.5rem;
      color: var(--ok);
      font-size: 0.88rem;
      font-weight: 500;
    }

    .audit-open {
      display: block;
      margin: 0.35rem 0 0.5rem;
      color: var(--amber);
      font-size: 0.88rem;
      font-weight: 500;
    }

    .verification-banner {
      border: 1px solid var(--border);
      background: rgba(72, 187, 120, 0.06);
      padding: 0.65rem 0.85rem;
      border-radius: 6px;
      margin: 1rem 0;
      font-size: 0.92rem;
    }

    .docs-fresh-mark {
      color: var(--amber, #f0b429);
      font-weight: 700;
      margin-right: 0.15em;
    }
`;

/** Stellina — righe inserite o aggiornate in questo refresh. */
function freshMarkHtml() {
  return '<span class="docs-fresh-mark" title="Inserito o aggiornato in questo refresh">★</span> ';
}

/**
 * Rimuove stelline del refresh precedente prima di applicare le nuove.
 *
 * @param {string} html
 * @returns {string}
 */
function stripFreshMarks(html) {
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
 * @param {string} html
 * @param {string} phrase
 * @returns {boolean}
 */
function phraseAlreadyResolved(html, phrase) {
  const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re  = new RegExp(`<del[^>]*>[\\s\\S]*?${esc}`, "i");

  return re.test(html);
}

/**
 * @param {string} html
 * @param {string} phrase
 * @param {string} resolution
 * @returns {string}
 */
function wrapPhrase(html, phrase, resolution) {
  if (!html.includes(phrase) || phraseAlreadyResolved(html, phrase)) {
    return html;
  }

  const wrapped = [
    `<del class="resolved docs-fresh">${phrase}</del>`
  , `<span class="audit-resolution docs-fresh">${freshMarkHtml()}${resolution}</span>`
  ].join("");

  return html.replace(phrase, wrapped);
}

/**
 * @param {string} html
 * @returns {string}
 */
function ensureChromeStyles(html) {
  if (html.includes("del.resolved") || html.includes("docs-chrome.css")) {
    return html;
  }

  if (html.includes("</style>")) {
    return html.replace("</style>", `${CHROME_STYLES}\n  </style>`);
  }

  return html.replace(
    "</head>"
  , `<link rel="stylesheet" href="/docs/docs-chrome.css" />\n</head>`
  );
}

/**
 * @param {string} html
 * @param {string} analyzedAt
 * @param {ReturnType<import("./docs.portal.analysis.mjs").analyzeRepository>} analysis
 * @returns {string}
 */
function upsertVerificationBanner(html, analyzedAt, analysis) {
  const dateLabel = formatAuditDate(analyzedAt);
  const banner    = [
    `<div class="verification-banner docs-fresh" id="docs-auto-banner">`
  , `${freshMarkHtml()}<strong>Verifica repo automatica</strong> — ${dateLabel} ·`
  , `${analysis.summary.passed}/${analysis.summary.total} controlli OK.`
  , `Aggiornamento con barrato + commento.`
  , `</div>`
  ].join(" ");

  if (html.includes('id="docs-auto-banner"')) {
    return html.replace(
      /<div class="verification-banner" id="docs-auto-banner">[\s\S]*?<\/div>/
    , banner
    );
  }

  if (html.includes('class="verification-banner"')) {
    return html.replace(
      /<div class="verification-banner"[^>]*>[\s\S]*?<\/div>/
    , banner
    );
  }

  if (html.includes("<header>")) {
    return html.replace("<header>", `${banner}\n    <header>`);
  }

  return `${banner}\n${html}`;
}

/**
 * @param {string} html
 * @param {ReturnType<import("./docs.portal.analysis.mjs").analyzeRepository>} analysis
 * @returns {string}
 */
function applyPhraseRules(html, analysis) {
  const { checks } = analysis;
  const date       = formatAuditDate(analysis.analyzedAt);
  let out          = html;

  if (checks.jiraWorkingParked?.ok) {
    out = wrapPhrase(
      out
    , "Jira backlog e working plan"
    , `✅ ${date} — Jira Working in PARKING_tocheck; Backlog usa piano sprint (working.order.mjs).`
    );
    out = wrapPhrase(
      out
    , "Jira working plan"
    , `✅ ${date} — Pagina working rimossa dalla SPA; sorgenti orfani in PARKING.`
    );
    out = wrapPhrase(
      out
    , "/jira-working.html"
    , `✅ ${date} — Route rimossa; file in PARKING_tocheck.`
    );
    out = wrapPhrase(
      out
    , "data-tab=\"jiraworking\""
    , `✅ ${date} — Tab rimossa dal cruscotto.`
    );
  }

  if (checks.overlayInLibOverlay?.ok) {
    out = wrapPhrase(
      out
    , "lib/cruscotto.config.overlay.mjs"
    , `✅ ${date} — Spostato in lib/overlay/cruscotto.config.overlay.mjs.`
    );
    out = wrapPhrase(
      out
    , "lib/dashboard.project.mjs"
    , `✅ ${date} — Spostato in lib/overlay/dashboard.project.mjs.`
    );
  }

  if (checks.projectBaseFallback?.ok) {
    out = wrapPhrase(
      out
    , "solo <code>PROJECT_JustLastOne</code> e <code>PROJECT_AdminDashBoard</code>"
    , `✅ ${date} — Aggiunto PROJECT_Base come fallback condiviso.`
    );
  }

  if (!checks.workingPlanDataPresent?.ok) {
    const open = `<span class="audit-open docs-fresh">${freshMarkHtml()}⚠️ ${date} — ${checks.workingPlanDataPresent.detail}</span>`;

    if (!out.includes("working.plan.data.JustLastOne") || out.includes("audit-open")) {
      // già annotato
    } else if (out.includes("<tbody>") && out.includes("Gap")) {
      out = out.replace("<tbody>", `<tbody>\n        <tr><td colspan="4">${open}</td></tr>`);
    }
  }

  if (!checks.packageJsonSmokePaths?.ok) {
    out = wrapPhrase(
      out
    , "scripts/smoke-"
    , `⚠️ ${date} — ${checks.packageJsonSmokePaths.detail} (gap aperto).`
    );
  }

  if (checks.healthInFrontend?.ok) {
    out = wrapPhrase(
      out
    , "<code>server/dev-api.mjs</code>, <code>server/cruscotto.health.mjs</code> importati da <code>cruscotto.server.mjs</code>"
    , `✅ ${date} — Server usa cruscotto.frontend/cruscotto.health.mjs e cruscotto.dev.api.mjs.`
    );
  }

  return out;
}

/**
 * @param {string} html
 * @param {ReturnType<import("./docs.portal.analysis.mjs").analyzeRepository>} analysis
 * @returns {string}
 */
function upsertAutoAdditions(html, analysis) {
  const date   = formatAuditDate(analysis.analyzedAt);
  const failed = Object.entries(analysis.checks).filter(([, c]) => !c.ok);
  const lines  = failed.map(([, c]) => `<li><strong>${c.label}</strong> — ${c.detail}</li>`);
  const block  = [
    "<!-- DOCS-AUTO-ADDITIONS -->"
  , `<section class="docs-auto-additions docs-fresh" id="docs-auto-additions">`
  , `<h2>${freshMarkHtml()}Sintesi analisi repo (${date})</h2>`
  , `<p class="meta">Generato dal pulsante <strong>Aggiorna</strong> — gap ancora aperti:</p>`
  , lines.length > 0 ? `<ul>${lines.join("")}</ul>` : "<p class=\"meta\">Nessun gap aperto nei controlli automatici.</p>"
  , `<p class="meta">Controlli OK: ${analysis.summary.passed} · aperti: ${analysis.summary.failed}</p>`
  , "</section>"
  , "<!-- /DOCS-AUTO-ADDITIONS -->"
  ].join("\n");

  if (html.includes("<!-- DOCS-AUTO-ADDITIONS -->")) {
    return html.replace(
      /<!-- DOCS-AUTO-ADDITIONS -->[\s\S]*?<!-- \/DOCS-AUTO-ADDITIONS -->/
    , block
    );
  }

  if (html.includes("</body>")) {
    return html.replace("</body>", `${block}\n</body>`);
  }

  return `${html}\n${block}`;
}

/**
 * @param {string} html
 * @param {string} filename
 * @param {ReturnType<import("./docs.portal.analysis.mjs").analyzeRepository>} analysis
 * @returns {{ html: string, changed: boolean }}
 */
export function refreshDocHtml(html, filename, analysis) {
  let out      = ensureChromeStyles(html);
  const before = out;

  out = stripFreshMarks(out);
  out = upsertVerificationBanner(out, analysis.analyzedAt, analysis);
  out = applyPhraseRules(out, analysis);
  out = upsertAutoAdditions(out, analysis);

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
