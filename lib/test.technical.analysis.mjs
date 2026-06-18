/**
 * Analisi report TestTecnici — aggregazione latest.json, cluster, export MD/HTML (generico overlay).
 *
 * Descrizione funzionale:
 *   Perché esiste: il cruscotto deve trasformare latest.json testScript in insight senza
 *     duplicare logica nel server; raccomandazioni da project.config (workspace npm, web URL).
 *   A cosa serve: buildTestTecniciAnalysis, render MD/HTML, persistenza history, loadAndAnalyze.
 *
 * Consumatori:
 *   - lib/dashboard.project.mjs — fallback se manca test.technical.analysis.* nell'overlay
 *   - PROJECT_{Nome}/test.technical.analysis.mjs — re-export opzionale
 *
 * Export principali: TECNICI_ANALYSIS_*, buildTestTecniciAnalysis, render*, write*, loadAndAnalyze*
 */

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { getProjectConfig } from "./project.config.mjs";
import { historyStamp, LATEST_JSON, REPORTS_DIR } from "./reporter.mjs";

export const TECNICI_ANALYSIS_JSON = join(REPORTS_DIR, "tecnici-analysis-latest.json");
export const TECNICI_ANALYSIS_HTML = join(REPORTS_DIR, "tecnici-analysis-latest.html");
export const TECNICI_ANALYSIS_MD   = join(REPORTS_DIR, "tecnici-analysis-latest.md");

/**
 * @param {string} detail
 * @returns {string}
 */
function clusterFailureDetail(detail) {
  const text = String(detail ?? "");

  if (/login failed/i.test(text) || text.includes("401")) {
    return "401 Unauthorized / login seed";
  }

  if (/missing|setup incomplete|setup utente/i.test(text)) {
    return "setup incompleto (cascata)";
  }

  if (/ECONNREFUSED|fetch failed|ENOTFOUND/i.test(text)) {
    return "connessione servizio";
  }

  if (/assente.*seed|db:seed/i.test(text)) {
    return "utente seed assente";
  }

  if (/blocked/i.test(text)) {
    return "blocked atteso";
  }

  return text.slice(0, 72) || "errore";
}

/**
 * Azioni consigliate da cluster e stato servizi — parametri da project.config.
 *
 * @param {{
 *   clusters: Record<string, number>
 *   failedScripts: string[]
 *   report: Record<string, unknown>
 *   failed: number
 *   config: ReturnType<typeof getProjectConfig>
 * }} ctx
 * @returns {string[]}
 */
export function buildTecniciAnalysisRecommendations(ctx) {
  const { clusters, failedScripts, report, failed, config } = ctx;
  /** @type {string[]} */
  const recommendations = [];
  const ws              = config.PRJ_DB_NPM_WORKSPACE;
  const testScript      = config.PRJ_TEST_SCRIPT;

  if (clusters["401 Unauthorized / login seed"]) {
    recommendations.push(
      `Allineare seed e credenziali test: \`npm run db:seed -w ${ws}\` e verificare credenziali in ${testScript}/lib/http.mjs.`
    );
  }

  if (report.services && /** @type {{ web?: boolean }} */ (report.services).web === false) {
    const webHint = config.PRJ_WEB_OPEN_URL
      ? ` (${config.PRJ_WEB_OPEN_URL})`
      : "";

    recommendations.push(`Avviare il servizio web${webHint} per eseguire gli script web attualmente skipped.`);
  }

  if (clusters["utente seed assente"]) {
    recommendations.push(
      `Eseguire \`npm run db:seed -w ${ws}\` o impostare TEST_FORGOT_EMAIL per test forgot-password.`
    );
  }

  if (failedScripts.some((s) => s.includes("notifications/"))) {
    recommendations.push(
      `Dopo seed: \`npm run db:push -w ${ws}\` e rilanciare gli script notifications/*.mjs.`
    );
  }

  if (recommendations.length === 0 && failed > 0) {
    recommendations.push("Rieseguire i gruppi falliti singolarmente dal cruscotto per isolare le regressioni.");
  }

  return recommendations;
}

/**
 * @param {Record<string, unknown>} report
 * @param {{ buildRecommendations?: typeof buildTecniciAnalysisRecommendations, projectConfig?: ReturnType<typeof getProjectConfig> }} [options]
 * @returns {Record<string, unknown>}
 */
export function buildTestTecniciAnalysis(report, options = {}) {
  const config               = options.projectConfig ?? getProjectConfig();
  const buildRecommendations = options.buildRecommendations ?? buildTecniciAnalysisRecommendations;
  const scripts              = Array.isArray(report.scripts) ? report.scripts : [];
  /** @type {Record<string, { passed: number, failed: number, skipped: number, scripts: Array<{ script: string, status: string, reason?: string }> }>} */
  const bySuite = {};
  /** @type {string[]} */
  const failedScripts = [];
  /** @type {string[]} */
  const passedScripts = [];
  /** @type {Array<{ script: string, suite: string, reason?: string }>} */
  const skippedScripts = [];
  /** @type {Array<{ script: string, suite: string, name: string, detail: string }>} */
  const failedCases = [];
  /** @type {Record<string, number>} */
  const clusters = {};

  for (const row of scripts) {
    const script = typeof row.script === "string" ? row.script : "—";
    const suite  = typeof row.suite === "string" ? row.suite : "root";
    const status = typeof row.status === "string" ? row.status : "failed";
    const reason = typeof row.reason === "string" ? row.reason : undefined;

    if (!bySuite[suite]) {
      bySuite[suite] = { passed: 0, failed: 0, skipped: 0, scripts: [] };
    }

    bySuite[suite][/** @type {"passed"|"failed"|"skipped"} */ (status)] += 1;
    bySuite[suite].scripts.push({ script, status, reason });

    if (status === "failed") {
      failedScripts.push(script);
    } else if (status === "passed") {
      passedScripts.push(script);
    } else if (status === "skipped") {
      skippedScripts.push({ script, suite, reason });
    }

    const tests = row.report && typeof row.report === "object"
      ? /** @type {{ tests?: unknown[] }} */ (row.report).tests
      : null;

    if (!Array.isArray(tests)) {
      continue;
    }

    for (const test of tests) {
      const t = /** @type {{ name?: string, ok?: boolean, skipped?: boolean, detail?: string }} */ (test);

      if (t.ok || t.skipped) {
        continue;
      }

      const detail = String(t.detail ?? "");
      const name   = String(t.name ?? "—");
      failedCases.push({ script, suite, name, detail });

      const key = clusterFailureDetail(detail);
      clusters[key] = (clusters[key] ?? 0) + 1;
    }
  }

  const totalScripts = Number(report.totalScripts ?? scripts.length);
  const passed       = Number(report.passed ?? passedScripts.length);
  const failed       = Number(report.failed ?? failedScripts.length);
  const skipped      = Number(report.skipped ?? skippedScripts.length);
  const passRate     = totalScripts > 0 ? Math.round((passed / totalScripts) * 100) : 0;

  const sortedClusters = Object.entries(clusters)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  const seenScripts = new Set();
  /** @type {Array<{ script: string, suite: string, name: string, detail: string }>} */
  const sampleFailures = [];

  for (const item of failedCases) {
    if (seenScripts.has(item.script)) {
      continue;
    }

    seenScripts.add(item.script);
    sampleFailures.push(item);

    if (sampleFailures.length >= 20) {
      break;
    }
  }

  const recommendations = buildRecommendations({
    clusters
  , failedScripts
  , report
  , failed
  , config
  });

  return {
    generatedAt       : new Date().toISOString()
  , reportGeneratedAt : String(report.generatedAt ?? "")
  , source            : LATEST_JSON
  , projectName       : config.PRJ_NAME
  , summary           : {
      totalScripts
    , passed
    , failed
    , skipped
    , passRate
    , failedTestCases: failedCases.length
    , services       : report.services ?? null
    }
  , bySuite
  , passedScripts
  , failedScripts
  , skippedScripts
  , clusters        : sortedClusters
  , sampleFailures
  , recommendations
  };
}

/**
 * @param {ReturnType<typeof buildTestTecniciAnalysis>} analysis
 * @returns {string}
 */
function formatServicesLine(services) {
  if (!services || typeof services !== "object") {
    return "";
  }

  const parts = Object.entries(/** @type {Record<string, boolean>} */ (services))
    .map(([name, ok]) => `${name} ${ok ? "✅" : "❌"}`);

  return parts.length ? `- **Servizi:** ${parts.join(" · ")}` : "";
}

/**
 * @param {ReturnType<typeof buildTestTecniciAnalysis>} analysis
 * @returns {string}
 */
export function renderTestTecniciAnalysisMarkdown(analysis) {
  const lines       = [];
  const s           = analysis.summary;
  const projectName = String(analysis.projectName ?? getProjectConfig().PRJ_NAME);

  lines.push(`# Analisi TestTecnici — ${projectName}`);
  lines.push("");
  lines.push(`- **Analisi generata:** ${analysis.generatedAt}`);
  lines.push(`- **Report sorgente:** ${analysis.reportGeneratedAt || "—"}`);
  lines.push(`- **Script:** ${s.totalScripts} · **Pass:** ${s.passed} · **Fail:** ${s.failed} · **Skip:** ${s.skipped} · **Pass rate:** ${s.passRate}%`);
  lines.push(`- **Test case falliti:** ${s.failedTestCases}`);

  const servicesLine = formatServicesLine(s.services);

  if (servicesLine) {
    lines.push(servicesLine);
  }

  lines.push("");
  lines.push("## Per suite");
  lines.push("");
  lines.push("| Suite | Pass | Fail | Skip |");
  lines.push("| --- | ---: | ---: | ---: |");

  for (const [suite, data] of Object.entries(analysis.bySuite).sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`| ${suite} | ${data.passed} | ${data.failed} | ${data.skipped} |`);
  }

  lines.push("");
  lines.push("## Cluster cause (test case)");
  lines.push("");

  for (const { label, count } of analysis.clusters.slice(0, 12)) {
    lines.push(`- **${label}** — ${count}`);
  }

  if (analysis.failedScripts.length) {
    lines.push("");
    lines.push("## Script falliti");
    lines.push("");

    for (const script of analysis.failedScripts) {
      lines.push(`- \`${script}\``);
    }
  }

  if (analysis.skippedScripts.length) {
    lines.push("");
    lines.push("## Script skipped");
    lines.push("");

    for (const row of analysis.skippedScripts) {
      const reason = row.reason ? ` — ${row.reason}` : "";
      lines.push(`- \`${row.script}\`${reason}`);
    }
  }

  if (analysis.sampleFailures.length) {
    lines.push("");
    lines.push("## Campioni (primo fallimento per script)");
    lines.push("");

    for (const row of analysis.sampleFailures) {
      lines.push(`- **${row.suite}/${row.script}** — ${row.name}`);
      lines.push(`  - ${row.detail.slice(0, 200)}`);
    }
  }

  if (analysis.recommendations.length) {
    lines.push("");
    lines.push("## Azioni consigliate");
    lines.push("");

    for (const rec of analysis.recommendations) {
      lines.push(`1. ${rec}`);
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

/**
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {ReturnType<typeof buildTestTecniciAnalysis>} analysis
 * @returns {string}
 */
export function renderTestTecniciAnalysisHtml(analysis) {
  const s           = analysis.summary;
  const md          = renderTestTecniciAnalysisMarkdown(analysis);
  const projectName = escapeHtml(String(analysis.projectName ?? getProjectConfig().PRJ_NAME));

  const suiteRows = Object.entries(analysis.bySuite)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([suite, data]) => `
      <tr>
        <td>${escapeHtml(suite)}</td>
        <td class="num pass">${data.passed}</td>
        <td class="num fail">${data.failed}</td>
        <td class="num skip">${data.skipped}</td>
      </tr>`)
    .join("");

  const clusterList = analysis.clusters.slice(0, 12).map(
    (row) => `<li><strong>${escapeHtml(row.label)}</strong> — ${row.count}</li>`
  ).join("");

  const failedList = analysis.failedScripts.map(
    (script) => `<li><code>${escapeHtml(script)}</code></li>`
  ).join("");

  const sampleList = analysis.sampleFailures.map(
    (row) => `<li><code>${escapeHtml(`${row.suite}/${row.script}`)}</code> — ${escapeHtml(row.name)}<br><span class="muted">${escapeHtml(row.detail.slice(0, 200))}</span></li>`
  ).join("");

  const recList = analysis.recommendations.map(
    (rec) => `<li>${escapeHtml(rec)}</li>`
  ).join("");

  const services = s.services && typeof s.services === "object"
    ? /** @type {Record<string, boolean>} */ (s.services)
    : null;

  const servicesHtml = services
    ? `<p class="meta">Servizi: ${Object.entries(services).map(([k, ok]) => `${k} ${ok ? "✅" : "❌"}`).join(" · ")}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Analisi TestTecnici — ${escapeHtml(analysis.reportGeneratedAt || analysis.generatedAt)}</title>
  <style>
    :root { color-scheme: light dark; --bg:#0f1419; --surface:#1a2332; --border:#2d3a4f; --text:#e7ecf3; --muted:#8b9cb3; --pass:#34d399; --fail:#f87171; --skip:#fbbf24; --accent:#3d9cf5; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.55; }
    .page { max-width: 920px; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
    h1 { margin: 0 0 0.5rem; font-size: 1.5rem; }
    h2 { margin: 1.75rem 0 0.65rem; font-size: 1.05rem; color: #2ee8d6; }
    .meta { color: var(--muted); font-size: 0.88rem; }
    .stats { display: flex; flex-wrap: wrap; gap: 0.65rem; margin: 1rem 0; }
    .stat { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0.55rem 0.8rem; min-width: 7rem; }
    .stat strong { display: block; font-size: 1.15rem; }
    .stat span { color: var(--muted); font-size: 0.75rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.86rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    th, td { padding: 0.5rem 0.7rem; border-bottom: 1px solid var(--border); text-align: left; }
    th { background: #152030; color: var(--muted); font-size: 0.74rem; text-transform: uppercase; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    td.pass { color: var(--pass); }
    td.fail { color: var(--fail); }
    td.skip { color: var(--skip); }
    ul { margin: 0.35rem 0 0.8rem; padding-left: 1.2rem; }
    li { margin: 0.3rem 0; }
    code { font-size: 0.84em; }
    .muted { color: var(--muted); font-size: 0.84rem; }
    pre { background: #152030; border: 1px solid var(--border); border-radius: 8px; padding: 1rem; overflow: auto; font-size: 0.78rem; color: var(--muted); white-space: pre-wrap; }
    a { color: var(--accent); }
  </style>
</head>
<body>
  <div class="page">
    <h1>Analisi TestTecnici — ${projectName}</h1>
    <p class="meta">Generata ${escapeHtml(analysis.generatedAt)} · report ${escapeHtml(analysis.reportGeneratedAt || "—")}</p>
    <div class="stats">
      <div class="stat"><strong>${s.totalScripts}</strong><span>script</span></div>
      <div class="stat"><strong style="color:var(--pass)">${s.passed}</strong><span>pass</span></div>
      <div class="stat"><strong style="color:var(--fail)">${s.failed}</strong><span>fail</span></div>
      <div class="stat"><strong style="color:var(--skip)">${s.skipped}</strong><span>skip</span></div>
      <div class="stat"><strong>${s.passRate}%</strong><span>pass rate</span></div>
      <div class="stat"><strong>${s.failedTestCases}</strong><span>case falliti</span></div>
    </div>
    ${servicesHtml}
    <h2>Per suite</h2>
    <table>
      <thead><tr><th>Suite</th><th>Pass</th><th>Fail</th><th>Skip</th></tr></thead>
      <tbody>${suiteRows}</tbody>
    </table>
    <h2>Cluster cause</h2>
    <ul>${clusterList || "<li>Nessun case fallito</li>"}</ul>
    <h2>Script falliti</h2>
    <ul>${failedList || "<li>Nessuno</li>"}</ul>
    <h2>Campioni</h2>
    <ul>${sampleList || "<li>—</li>"}</ul>
    <h2>Azioni consigliate</h2>
    <ul>${recList || "<li>Nessuna azione specifica</li>"}</ul>
    <h2>Markdown</h2>
    <pre>${escapeHtml(md)}</pre>
    <p class="meta"><a href="/">← Cruscotto</a></p>
  </div>
</body>
</html>`;
}

/**
 * @param {Record<string, unknown>} report
 * @param {{ buildRecommendations?: typeof buildTecniciAnalysisRecommendations }} [options]
 * @returns {Promise<{ analysis: ReturnType<typeof buildTestTecniciAnalysis>, paths: Record<string, string>, urls: Record<string, string> }>}
 */
export async function writeTestTecniciAnalysisReport(report, options = {}) {
  const analysis = buildTestTecniciAnalysis(report, options);
  const markdown = renderTestTecniciAnalysisMarkdown(analysis);
  const html     = renderTestTecniciAnalysisHtml(analysis);

  if (!existsSync(REPORTS_DIR)) {
    await mkdir(REPORTS_DIR, { recursive: true });
  }

  const historyDir = join(REPORTS_DIR, "history");

  if (!existsSync(historyDir)) {
    await mkdir(historyDir, { recursive: true });
  }

  const stamp = historyStamp(analysis.generatedAt);

  await Promise.all([
    writeFile(TECNICI_ANALYSIS_JSON, `${JSON.stringify(analysis, null, 2)}\n`, "utf8")
  , writeFile(TECNICI_ANALYSIS_MD, markdown, "utf8")
  , writeFile(TECNICI_ANALYSIS_HTML, html, "utf8")
  , writeFile(join(historyDir, `tecnici-analysis-${stamp}.json`), `${JSON.stringify(analysis, null, 2)}\n`, "utf8")
  , writeFile(join(historyDir, `tecnici-analysis-${stamp}.html`), html, "utf8")
  ]);

  return {
    analysis
  , paths: {
      json        : TECNICI_ANALYSIS_JSON
    , html        : TECNICI_ANALYSIS_HTML
    , markdown    : TECNICI_ANALYSIS_MD
    , historyJson : join(historyDir, `tecnici-analysis-${stamp}.json`)
    , historyHtml : join(historyDir, `tecnici-analysis-${stamp}.html`)
    }
  , urls: {
      html: "/api/report/tecnici-analysis/html"
    , json: "/api/report/tecnici-analysis"
    }
  };
}

/**
 * @param {Record<string, unknown>} [report]
 * @returns {Promise<ReturnType<typeof writeTestTecniciAnalysisReport>>}
 */
export async function loadAndAnalyzeTestTecnici(report = null) {
  if (report) {
    return writeTestTecniciAnalysisReport(report);
  }

  const { readFile } = await import("node:fs/promises");

  if (!existsSync(LATEST_JSON)) {
    throw new Error("no report available");
  }

  const raw    = await readFile(LATEST_JSON, "utf8");
  const parsed = /** @type {Record<string, unknown>} */ (JSON.parse(raw));

  return writeTestTecniciAnalysisReport(parsed);
}
