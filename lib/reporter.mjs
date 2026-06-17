import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  getPortalReportsDir
} from "./portal.paths.resolver.mjs";

export const REPORTS_DIR = getPortalReportsDir();
export const HISTORY_DIR = join(REPORTS_DIR, "history");
export const LATEST_JSON = join(REPORTS_DIR, "latest.json");
export const LATEST_HTML = join(REPORTS_DIR, "latest.html");

/**
 * Directory report in PortalAdmin (`data/reports/`) — non nel product repo.
 *
 * @returns {string}
 */
export function getReportsDir() {
  return getPortalReportsDir();
}

/**
 * Estrae il report JSON da stdout script (anche se mescolato con log umani).
 *
 * @param {string} stdout
 * @returns {Record<string, unknown> | null}
 */
export function parseScriptJsonReport(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return /** @type {Record<string, unknown>} */ (JSON.parse(trimmed));
  } catch {
    const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    for (let i = lines.length - 1; i >= 0; i -= 1) {
      if (lines[i].startsWith("{")) {
        try {
          return /** @type {Record<string, unknown>} */ (JSON.parse(lines[i]));
        } catch {
          /* try previous line */
        }
      }
    }

    const start = trimmed.indexOf("{");
    const end   = trimmed.lastIndexOf("}");

    if (start >= 0 && end > start) {
      try {
        return /** @type {Record<string, unknown>} */ (
          JSON.parse(trimmed.slice(start, end + 1))
        );
      } catch {
        return null;
      }
    }

    return null;
  }
}

/**
 * @typedef {{
 *   name       : string
 *   ok         : boolean
 *   skipped?   : boolean
 *   detail?    : string
 *   startedAt? : string
 *   durationMs?: number
 * }} NormalizedTest
 */

/**
 * @typedef {{
 *   script     : string
 *   suite      : string
 *   startedAt? : string
 *   durationMs : number
 *   exitCode   : number
 *   tests      : NormalizedTest[]
 * }} NormalizedScriptReport
 */

/**
 * @typedef {{
 *   script     : string
 *   suite      : string
 *   status     : "passed" | "failed" | "skipped"
 *   exitCode   : number
 *   durationMs : number
 *   reason?    : string
 *   stderr?    : string
 *   report?    : NormalizedScriptReport | null
 * }} NormalizedScriptResult
 */

/**
 * @typedef {{
 *   generatedAt  : string
 *   totalScripts : number
 *   passed       : number
 *   failed       : number
 *   skipped      : number
 *   services     : { auth: boolean, api: boolean, web: boolean }
 *   scripts      : NormalizedScriptResult[]
 *   summary      : ReturnType<typeof computeSummary>
 * }} NormalizedRunReport
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} raw
 * @returns {NormalizedScriptReport | null}
 */
function normalizeScriptReport(raw) {
  if (!isObject(raw)) {
    return null;
  }

  const script = typeof raw.script === "string" ? raw.script : "unknown";
  const suite  = typeof raw.suite === "string" ? raw.suite : "unknown";
  const durationMs = typeof raw.durationMs === "number" ? raw.durationMs : 0;
  const exitCode   = typeof raw.exitCode === "number" ? raw.exitCode : 1;
  const startedAt  = typeof raw.startedAt === "string" ? raw.startedAt : undefined;

  /** @type {NormalizedTest[]} */
  const tests = [];

  if (Array.isArray(raw.tests)) {
    for (const row of raw.tests) {
      if (!isObject(row) || typeof row.name !== "string") {
        continue;
      }

      tests.push({
        name    : row.name
      , ok      : row.ok === true
      , skipped : row.skipped === true
      , detail  : typeof row.detail === "string" ? row.detail : undefined
      , ...(typeof row.durationMs === "number" ? { durationMs: row.durationMs } : {})
      , ...(typeof row.startedAt === "string" ? { startedAt: row.startedAt } : {})
      });
    }
  }

  return {
    script
  , suite
  , startedAt
  , durationMs
  , exitCode
  , tests
  };
}

/**
 * @param {NormalizedScriptResult} row
 * @returns {NormalizedScriptReport | null}
 */
function fallbackScriptReport(row) {
  if (row.report) {
    return row.report;
  }

  if (row.status === "skipped") {
    return {
      script     : row.script
    , suite      : row.suite
    , durationMs : 0
    , exitCode   : 0
    , tests      : [{
        name    : "skipped"
      , ok      : true
      , skipped : true
      , detail  : row.reason
      }]
    };
  }

  const detail = row.stderr
    || (row.exitCode !== 0 ? `exit code ${row.exitCode}` : undefined);

  return {
    script     : row.script
  , suite      : row.suite
  , durationMs : row.durationMs
  , exitCode   : row.exitCode
  , tests      : [{
      name   : row.script
    , ok     : row.status === "passed"
    , detail : row.status === "failed" ? detail : undefined
    }]
  };
}

/**
 * @param {unknown} raw
 * @returns {NormalizedRunReport}
 */
export function normalizeReport(raw) {
  const generatedAt = isObject(raw) && typeof raw.generatedAt === "string"
    ? raw.generatedAt
    : new Date().toISOString();

  const services = isObject(raw) && isObject(raw.services)
    ? {
        auth : raw.services.auth === true
      , api  : raw.services.api === true
      , web  : raw.services.web === true
      }
    : { auth: false, api: false, web: false };

  /** @type {NormalizedScriptResult[]} */
  const scripts = [];

  if (isObject(raw) && Array.isArray(raw.scripts)) {
    for (const row of raw.scripts) {
      if (!isObject(row) || typeof row.script !== "string") {
        continue;
      }

      const status = row.status === "passed"
        || row.status === "failed"
        || row.status === "skipped"
        ? row.status
        : "failed";

      const normalized = {
        script     : row.script
      , suite      : typeof row.suite === "string" ? row.suite : "unknown"
      , status
      , exitCode   : typeof row.exitCode === "number" ? row.exitCode : 1
      , durationMs : typeof row.durationMs === "number" ? row.durationMs : 0
      , reason     : typeof row.reason === "string" ? row.reason : undefined
      , stderr     : typeof row.stderr === "string" ? row.stderr : undefined
      , report     : normalizeScriptReport(row.report)
      };

      if (!normalized.report) {
        normalized.report = fallbackScriptReport(normalized);
      }

      scripts.push(normalized);
    }
  }

  const summary = computeSummary(scripts);

  return {
    generatedAt
  , totalScripts : scripts.length
  , passed       : summary.scripts.passed
  , failed       : summary.scripts.failed
  , skipped      : summary.scripts.skipped
  , services
  , scripts
  , summary
  };
}

/**
 * @param {NormalizedScriptResult[]} scripts
 */
export function computeSummary(scripts) {
  let passed  = 0;
  let failed  = 0;
  let skipped = 0;
  let testsPassed  = 0;
  let testsFailed  = 0;
  let testsSkipped = 0;
  let totalDurationMs = 0;

  for (const row of scripts) {
    if (row.status === "passed") {
      passed += 1;
    } else if (row.status === "failed") {
      failed += 1;
    } else {
      skipped += 1;
    }

    totalDurationMs += row.durationMs;

    const report = row.report ?? fallbackScriptReport(row);
    for (const test of report.tests) {
      if (test.skipped) {
        testsSkipped += 1;
      } else if (test.ok) {
        testsPassed += 1;
      } else {
        testsFailed += 1;
      }
    }
  }

  return {
    scripts: { passed, failed, skipped, total: scripts.length }
  , tests  : {
      passed  : testsPassed
    , failed  : testsFailed
    , skipped : testsSkipped
    , total   : testsPassed + testsFailed + testsSkipped
    }
  , totalDurationMs
  };
}

/**
 * Restringe un report normalizzato a una suite catalogo (es. `funzionali`).
 *
 * @param {unknown} report
 * @param {string} suite
 * @returns {NormalizedRunReport}
 */
export function filterReportBySuite(report, suite) {
  const normalized = normalizeReport(report);
  const scripts    = normalized.scripts.filter((row) => row.suite === suite);
  const summary    = computeSummary(scripts);

  return {
    generatedAt  : normalized.generatedAt
  , totalScripts : scripts.length
  , passed       : summary.scripts.passed
  , failed       : summary.scripts.failed
  , skipped      : summary.scripts.skipped
  , services     : normalized.services
  , scripts
  , summary
  };
}

/**
 * @param {NormalizedScriptResult[]} scripts
 * @returns {Array<{ suite: string, passed: number, failed: number, skipped: number }>}
 */
export function computeTestCountsBySuite(scripts) {
  /** @type {Map<string, { passed: number, failed: number, skipped: number }>} */
  const bySuite = new Map();

  for (const row of scripts) {
    const suite  = String(row.suite ?? "unknown");
    const bucket = bySuite.get(suite) ?? { passed: 0, failed: 0, skipped: 0 };
    const report = row.report ?? fallbackScriptReport(row);

    for (const test of report.tests) {
      if (test.skipped) {
        bucket.skipped += 1;
      } else if (test.ok) {
        bucket.passed += 1;
      } else {
        bucket.failed += 1;
      }
    }

    bySuite.set(suite, bucket);
  }

  return [...bySuite.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([suite, counts]) => ({
      suite   : suite.toUpperCase()
    , passed  : counts.passed
    , failed  : counts.failed
    , skipped : counts.skipped
    }));
}

/**
 * @param {number} ms
 */
function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms} ms`;
  }

  return `${(ms / 1000).toFixed(2)} s`;
}

/**
 * @param {string} value
 */
function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

/**
 * @param {"passed" | "failed" | "skipped"} status
 */
function statusClass(status) {
  if (status === "passed") {
    return "status-pass";
  }
  if (status === "skipped") {
    return "status-skip";
  }
  return "status-fail";
}

/**
 * @param {NormalizedRunReport} report
 */
export function generateHtml(report) {
  const normalized = normalizeReport(report);
  const runLabel   = new Date(normalized.generatedAt).toLocaleString("it-IT");
  const summary    = normalized.summary;

  const scriptRows = normalized.scripts.map((row) => {
    const detail = row.report ?? fallbackScriptReport(row);
    const testItems = detail.tests.map((test) => {
      const testStatus = test.skipped
        ? "skipped"
        : test.ok
          ? "passed"
          : "failed";
      const errorBlock = test.detail && !test.ok
        ? `<pre class="error-detail">${escapeHtml(test.detail)}</pre>`
        : "";

      return `
        <li class="test-row ${statusClass(testStatus)}">
          <span class="test-name">${escapeHtml(test.name)}</span>
          <span class="test-status">${testStatus}</span>
          ${errorBlock}
        </li>`;
    }).join("");

    return `
      <details class="script-block">
        <summary>
          <span class="script-suite">${escapeHtml(row.suite)}</span>
          <span class="script-name">${escapeHtml(row.script)}</span>
          <span class="badge ${statusClass(row.status)}">${row.status}</span>
          <span class="script-meta">${formatDuration(row.durationMs)} · exit ${row.exitCode}</span>
        </summary>
        <ul class="test-list">${testItems}</ul>
      </details>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>JustLastOne — Test report</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #0f1419;
      --panel: #1a2332;
      --text: #e7ecf3;
      --muted: #9aa7b8;
      --pass: #3ecf8e;
      --fail: #ff6b6b;
      --skip: #f0c14b;
      --border: #2a3648;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.45;
    }
    main { max-width: 1100px; margin: 0 auto; padding: 24px 20px 48px; }
    h1 { margin: 0 0 8px; font-size: 1.6rem; }
    .subtitle { color: var(--muted); margin-bottom: 24px; }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 16px;
    }
    .card strong { display: block; font-size: 1.4rem; }
    .card span { color: var(--muted); font-size: 0.85rem; }
    .card.pass strong { color: var(--pass); }
    .card.fail strong { color: var(--fail); }
    .card.skip strong { color: var(--skip); }
    .services {
      color: var(--muted);
      font-size: 0.9rem;
      margin-bottom: 20px;
    }
    .script-block {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-bottom: 10px;
      overflow: hidden;
    }
    .script-block summary {
      cursor: pointer;
      list-style: none;
      display: grid;
      grid-template-columns: 90px 1fr auto auto;
      gap: 10px;
      align-items: center;
      padding: 12px 14px;
    }
    .script-block summary::-webkit-details-marker { display: none; }
    .script-suite { color: var(--muted); font-size: 0.85rem; text-transform: uppercase; }
    .script-name { font-family: Consolas, monospace; font-size: 0.92rem; }
    .script-meta { color: var(--muted); font-size: 0.85rem; white-space: nowrap; }
    .badge {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid currentColor;
    }
    .status-pass { color: var(--pass); }
    .status-fail { color: var(--fail); }
    .status-skip { color: var(--skip); }
    .test-list {
      list-style: none;
      margin: 0;
      padding: 0 14px 12px;
      border-top: 1px solid var(--border);
    }
    .test-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
    }
    .test-row:last-child { border-bottom: none; }
    .test-name { font-size: 0.9rem; }
    .test-status {
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 600;
    }
    .error-detail {
      grid-column: 1 / -1;
      margin: 6px 0 0;
      padding: 8px 10px;
      background: #111822;
      border-radius: 6px;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 0.82rem;
      color: #ffb4b4;
    }
  </style>
</head>
<body>
  <main>
    <h1>Test report</h1>
    <p class="subtitle">Run: ${escapeHtml(runLabel)} · durata totale ${formatDuration(summary.totalDurationMs)}</p>
    <div class="cards">
      <div class="card pass"><strong>${summary.scripts.passed}</strong><span>script passati</span></div>
      <div class="card fail"><strong>${summary.scripts.failed}</strong><span>script falliti</span></div>
      <div class="card skip"><strong>${summary.scripts.skipped}</strong><span>script skipped</span></div>
      <div class="card"><strong>${summary.tests.total}</strong><span>test totali</span></div>
    </div>
    <p class="services">Servizi: auth ${normalized.services.auth ? "✓" : "✗"} · api ${normalized.services.api ? "✓" : "✗"} · web ${normalized.services.web ? "✓" : "✗"}</p>
    ${scriptRows}
  </main>
</body>
</html>`;
}

/**
 * @param {NormalizedScriptResult} row
 */
function scriptResultToRaw(row) {
  return {
    script     : row.script
  , suite      : row.suite
  , status     : row.status
  , exitCode   : row.exitCode
  , durationMs : row.durationMs
  , reason     : row.reason
  , stderr     : row.stderr
  , report     : row.report
  };
}

/**
 * @param {NormalizedScriptResult} previous
 * @param {NormalizedScriptResult} incoming
 * @returns {Record<string, unknown>}
 */
function mergeScriptTestCases(previous, incoming) {
  const prevReport = previous.report ?? fallbackScriptReport(previous);
  const incReport  = incoming.report ?? fallbackScriptReport(incoming);

  /** @type {Map<string, NormalizedTest>} */
  const byName = new Map();

  for (const test of prevReport.tests) {
    byName.set(test.name, test);
  }

  for (const test of incReport.tests) {
    byName.set(test.name, test);
  }

  const mergedTests = [...byName.values()];
  let status        = "passed";
  let exitCode      = 0;

  if (mergedTests.some((test) => !test.ok && !test.skipped)) {
    status   = "failed";
    exitCode = 1;
  } else if (mergedTests.length > 0 && mergedTests.every((test) => test.skipped)) {
    status = "skipped";
  }

  const mergedReport = {
    ...prevReport
  , ...incReport
  , tests      : mergedTests
  , durationMs : incoming.durationMs ?? prevReport.durationMs
  , exitCode
  , startedAt  : incReport.startedAt ?? prevReport.startedAt
  };

  return {
    script     : previous.script
  , suite      : previous.suite
  , status
  , exitCode
  , durationMs : incoming.durationMs ?? previous.durationMs
  , stderr     : incoming.stderr ?? previous.stderr
  , report     : mergedReport
  };
}

/**
 * Un run parziale (singolo script, suite o test case) aggiorna solo le righe
 * eseguite e conserva i risultati precedenti degli altri script in latest.json.
 *
 * @param {unknown} partialRaw
 * @returns {Promise<Record<string, unknown>>}
 */
export async function mergeWithLatestReport(partialRaw) {
  const partial = normalizeReport(partialRaw);
  const testCaseRun = typeof partialRaw === "object"
    && partialRaw !== null
    && /** @type {Record<string, unknown>} */ (partialRaw).testCaseRun === true;

  if (!existsSync(LATEST_JSON)) {
    return /** @type {Record<string, unknown>} */ (partialRaw);
  }

  let previous;

  try {
    const body = await readFile(LATEST_JSON, "utf8");
    previous = normalizeReport(JSON.parse(body));
  } catch {
    return /** @type {Record<string, unknown>} */ (partialRaw);
  }

  /** @type {Map<string, Record<string, unknown>>} */
  const byScript = new Map();

  for (const row of previous.scripts) {
    byScript.set(row.script, scriptResultToRaw(row));
  }

  for (const row of partial.scripts) {
    const prevRow = previous.scripts.find((item) => item.script === row.script);

    if (testCaseRun && prevRow) {
      byScript.set(row.script, mergeScriptTestCases(prevRow, row));
    } else {
      byScript.set(row.script, scriptResultToRaw(row));
    }
  }

  const scripts = [...byScript.values()].sort(
    (a, b) => String(a.suite).localeCompare(String(b.suite))
      || String(a.script).localeCompare(String(b.script))
  );

  let passed  = 0;
  let failed  = 0;
  let skipped = 0;

  for (const row of scripts) {
    if (row.status === "passed") {
      passed += 1;
    } else if (row.status === "failed") {
      failed += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    generatedAt  : partial.generatedAt
  , totalScripts : scripts.length
  , passed
  , failed
  , skipped
  , services     : partial.services
  , scripts
  };
}

/**
 * @param {string} iso
 */
export function historyStamp(iso) {
  const date = new Date(iso);
  const pad  = (/** @type {number} */ n) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}`;
}

/**
 * @param {unknown} raw
 * @param {{ html?: boolean }} [options]
 */
export async function writeRunReports(raw, options = {}) {
  const html     = options.html !== false;
  const report   = normalizeReport(raw);
  const stamp    = historyStamp(report.generatedAt);
  const jsonBody = `${JSON.stringify(report, null, 2)}\n`;

  await mkdir(REPORTS_DIR, { recursive: true });
  await mkdir(HISTORY_DIR, { recursive: true });

  await writeFile(LATEST_JSON, jsonBody, "utf8");
  await writeFile(join(HISTORY_DIR, `${stamp}.json`), jsonBody, "utf8");

  /** @type {{ json: string, html?: string, historyJson: string, historyHtml?: string }} */
  const paths = {
    json        : LATEST_JSON
  , historyJson : join(HISTORY_DIR, `${stamp}.json`)
  };

  if (html) {
    const htmlBody = generateHtml(report);
    await writeFile(LATEST_HTML, htmlBody, "utf8");
    await writeFile(join(HISTORY_DIR, `${stamp}.html`), htmlBody, "utf8");
    paths.html        = LATEST_HTML;
    paths.historyHtml = join(HISTORY_DIR, `${stamp}.html`);
  }

  return paths;
}
