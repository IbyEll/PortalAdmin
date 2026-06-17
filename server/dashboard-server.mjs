#!/usr/bin/env node
/**
 * Dashboard server PortalAdmin — static cruscotto + API run, report, Jira e servizi dev.
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - il cruscotto (`cruscotto/`) è UI statica; serve un processo HTTP locale che esponga
 *     file statici e API per run test, backlog Jira, health stack e gestione servizi product
 *
 *   A cosa serve:
 *   - avvio run testScript (tecnici/funzionali/singolo script) e stato run in corso
 *   - proxy dati Jira (backlog, insights, working plan, pillar matrix, my-project)
 *   - health API/auth/web, discovery servizi repo, DB product (reset/seed/push)
 *   - report JSON/HTML, export Excel, analisi test tecnici
 *
 * Uso:
 *   node server/dashboard-server.mjs
 *   npm run admin:dashboard
 *
 * Route / endpoint (principali):
 *   GET  /api/status, /api/health, /api/scripts — stato run e catalogo test
 *   POST /api/run, /api/run/one, /api/run/suite, /api/run/funzionali, /api/run/case
 *   GET  /api/report, /api/report/html, /api/export
 *   GET  /api/dev/requirements, /api/dev/services
 *   GET|POST /api/repo/services/*, /api/repo/database/*
 *   GET  /api/jira/backlog, /api/jira/backlog/insights, /api/jira/working/*
 *   GET  /api/portal/projects, /api/portal/instance — HOME istanzia overlay
 *   POST /api/portal/instance — attiva PROJECT_{PRJ_NAME} + prepare
 *   POST /api/report/tecnici-analysis, /api/pillar-matrix/regenerate
 *   GET  /* — static: / home, /app.html cruscotto
 *
 * Dipendenze:
 *   - lib/admin/test.catalog.mjs, dashboard.project.mjs, test.dipendenze.mjs
 *   - server/run-manager.mjs, health.mjs, dev-api.mjs, repo-services-manager.mjs
 *   - lib/jira-*.mjs, lib/reporter.mjs, lib/discovery.services.repo.mjs
 *   - env: DASHBOARD_PORT | ADMIN_PORT | PORT (default 3999), PRJ_NAME, PRODUCT_REPO_PATH
 *
 * Consumatori: cruscotto/cruscotto.js, scripts/smoke-dashboard.mjs, npm run admin:dashboard
 */

import "../lib/portal.load.env.mjs";

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BLOCKED_REASONS
, BLOCKED_SCRIPTS
, discoverTestScripts
, REPO_ROOT
} from "../lib/admin/test.catalog.mjs";
import { getHealthStatus } from "./health.mjs";
import { getDevRequirements, getDevServicesWithHealth } from "./dev-api.mjs";
import {
  discoverScriptDescription
, discoverScriptDocHeader
, discoverTestCasesForScript
} from "../lib/admin/test.dipendenze.mjs";
import { fetchJiraBacklog, fetchJiraIssueStatus, loadJiraBacklog } from "../lib/jira/jira.backlog.mjs";
import { buildBacklogPillarTree } from "../lib/jira/jira.backlog.pillars.mjs";
import { fetchBacklogInsights, buildRepoAlignMap } from "../lib/jira/jira.backlog.insights.mjs";
import { scanRepoJiraReferences } from "../lib/function.repo.jira.refs.mjs";
import { fetchWorkingInsights } from "../lib/jira/jira.working.insights.mjs";
import {
  archiveAndRegenerateWorkingPlan
, listWorkingPlanArchives
, regenerateWorkingPlanHtml
, saveOldAndRebuildWorking
, workingArchivePath
} from "../lib/jira/jira.working.plan.mjs";
import { regenerateProjectTreeHtml } from "../lib/jira/jira.project.tree.plan.mjs";
import {
  analyzeMyProject
, getFunzionaliMetaPayload
, getTecniciMetaPayload
, loadAndAnalyzeTestTecnici
, TECNICI_ANALYSIS_HTML
, TECNICI_ANALYSIS_JSON
} from "../lib/admin/dashboard.project.mjs";
import { getRunStatus, isRunActive, startRun, startRunFunzionali } from "./run-manager.mjs";
import {
  clearRepoServicesLogs
, getProductDatabaseStatus
, getRepoServicesDiscover
, getRepoServicesLogs
, getRepoServicesStatus
, listDevStackProcesses
, pushProductDatabase
, resetProductDatabase
, seedProductDatabase
, startRepoServices
, startSingleRepoService
, stopRepoServices
, stopSingleRepoService
} from "./repo-services-manager.mjs";
import {
  buildExportBasename
, loadReportFromLatest
, writeJsonExport
, writeXlsxExport
} from "../export/export-report.mjs";
import {
  filterReportBySuite
, generateHtml
, LATEST_HTML
, LATEST_JSON
} from "../lib/reporter.mjs";
import { REPO_EXTRAS_ALL } from "../lib/discovery.services.repo.mjs";
import {
  activatePortalInstance
, getPortalInstance
, getPrepareStatus
, listAvailableProjects
} from "../lib/admin/portal.instance.mjs";

// --- configurazione server — path cruscotto e porta HTTP ---
const SERVER_DIR   = dirname(fileURLToPath(import.meta.url));
const CRUSCOTTO_DIR = join(SERVER_DIR, "..", "cruscotto");
const PORT = Number(
  process.env.DASHBOARD_PORT
  ?? process.env.ADMIN_PORT
  ?? process.env.PORT
  ?? 3999
);

/** @type {import("node:http").Server | null} */
let httpServer = null;

const MIME = {
  ".html": "text/html; charset=utf-8"
, ".js"  : "text/javascript; charset=utf-8"
, ".css" : "text/css; charset=utf-8"
, ".json": "application/json; charset=utf-8"
, ".svg" : "image/svg+xml"
, ".ico" : "image/x-icon"
};

// --- HTTP helper — CORS localhost, JSON e body POST ---
/**
 * @param {import("node:http").IncomingMessage} req
 */
function isLocalhostOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) {
    return true;
  }

  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {import("node:http").IncomingMessage} req
 */
function applyCors(res, req) {
  if (isLocalhostOrigin(req)) {
    const origin = req.headers.origin ?? "http://localhost";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Vary", "Origin");
  }
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 * @param {import("node:http").IncomingMessage} req
 */
function sendJson(res, status, body, req) {
  applyCors(res, req);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(`${JSON.stringify(body)}\n`);
}

/**
 * Valida script/suite prima del guard «run in progress» — gli smoke test del
 * cruscotto devono poter verificare 404/400 anche mentre un run è attivo.
 *
 * @param {{ scriptRel?: string, suite?: string, testCase?: string }} options
 */
async function preflightRunTarget(options) {
  const scripts   = await discoverTestScripts();
  const scriptRel = options.scriptRel?.replace(/\\/g, "/") ?? null;
  const suite     = options.suite?.replace(/\\/g, "/") ?? null;
  const testCase  = options.testCase?.trim() ?? null;

  if (testCase && !scriptRel) {
    return { ok: false, status: 400, error: "testCase requires scriptRel" };
  }

  if (scriptRel && suite) {
    return { ok: false, status: 400, error: "use scriptRel or suite, not both" };
  }

  if (testCase && suite) {
    return { ok: false, status: 400, error: "testCase cannot be combined with suite" };
  }

  if (scriptRel) {
    const entry = scripts.find((s) => s.rel === scriptRel);

    if (!entry) {
      return { ok: false, status: 404, error: `script not found: ${scriptRel}` };
    }

    if (BLOCKED_SCRIPTS.has(scriptRel)) {
      return {
        ok    : false
      , status: 409
      , error : BLOCKED_REASONS[scriptRel] ?? "script blocked"
      };
    }
  }

  if (suite) {
    const suiteScripts = scripts.filter((s) => s.suite === suite);

    if (suiteScripts.length === 0) {
      return { ok: false, status: 404, error: `suite not found: ${suite}` };
    }
  }

  return { ok: true };
}

// --- static — file da cruscotto/ e archivi working plan HTML ---
/**
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
async function serveStatic(req, res) {
  const urlPath = req.url?.split("?")[0] ?? "/";
  let rel;

  if (urlPath === "/") {
    rel = "home.html";
  } else if (urlPath === "/app" || urlPath === "/app/") {
    applyCors(res, req);
    res.writeHead(302, { Location: "/app.html" });
    res.end();
    return;
  } else if (urlPath === "/app.html") {
    rel = "index.html";
  } else if (urlPath === "/favicon.ico") {
    rel = "favicon.svg";
  } else {
    rel = urlPath.replace(/^\//, "");
  }

  const file = join(CRUSCOTTO_DIR, rel);

  if (!file.startsWith(CRUSCOTTO_DIR) || !existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = extname(file);
  /** @type {Record<string, string>} */
  const headers = { "Content-Type": MIME[ext] ?? "application/octet-stream" };

  if (ext === ".html" || ext === ".js" || ext === ".css") {
    headers["Cache-Control"] = "no-cache, must-revalidate";
  }

  applyCors(res, req);
  res.writeHead(200, headers);
  createReadStream(file).pipe(res);
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {string} urlPath
 * @returns {Promise<boolean>} true se la richiesta è stata gestita
 */
async function serveWorkingArchive(req, res, urlPath) {
  const archiveMatch = urlPath.match(/^\/jira-working-archive\/([0-9T\-Z]+)\.html$/);

  if (!archiveMatch || req.method !== "GET") {
    return false;
  }

  try {
    const filePath = workingArchivePath(archiveMatch[1]);

    if (!existsSync(filePath)) {
      sendJson(res, 404, { error: "Archivio non trovato" }, req);
      return true;
    }

    applyCors(res, req);
    res.writeHead(200, {
      "Content-Type"  : "text/html; charset=utf-8"
    , "Cache-Control" : "no-store"
    });
    createReadStream(filePath).pipe(res);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 502, { error: message }, req);
  }

  return true;
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<unknown>}
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];

    req.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();

      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

// --- API JSON — run test, report, Jira, servizi dev e DB product ---
/**
 * Router API sotto `/api/*` — un handler per path/metodo.
 *
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {string} urlPath
 */
async function handleApi(req, res, urlPath) {
  if (urlPath === "/api/portal/projects" && req.method === "GET") {
    try {
      const projects = await listAvailableProjects();
      sendJson(res, 200, { projects }, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/portal/instance" && req.method === "GET") {
    try {
      const ctx     = await getPortalInstance();
      const prepare = getPrepareStatus();

      sendJson(res, 200, {
        instance   : ctx.instance
          ? { ...ctx.instance, prepare: prepare ?? ctx.instance.prepare }
          : null
      , envPrjName : ctx.envPrjName
      , aligned    : ctx.aligned
      }, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/portal/instance" && req.method === "POST") {
    try {
      const body    = await readJsonBody(req);
      const overlay = typeof body.overlay === "string" ? body.overlay.trim() : "";

      if (!overlay) {
        sendJson(res, 400, { error: "overlay obbligatorio" }, req);
        return;
      }

      const productRepoPath = typeof body.productRepoPath === "string"
        ? body.productRepoPath.trim()
        : undefined;

      const state = await activatePortalInstance(overlay, { productRepoPath });
      sendJson(res, 200, state, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, message.includes("non trovato") ? 404 : 409, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/status" && req.method === "GET") {
    const status = getRunStatus();
    sendJson(res, 200, {
      running       : status.running
    , startedAt     : status.startedAt
    , currentScript : status.currentScript
    , progress      : status.progress
    , exitCode      : status.exitCode
    , error         : status.error
    , mode           : status.mode
    , targetScript   : status.targetScript
    , targetTestCase : status.targetTestCase
    }, req);
    return;
  }

  if (urlPath === "/api/scripts" && req.method === "GET") {
    const scripts = await discoverTestScripts();

    sendJson(res, 200, {
      scripts: await Promise.all(scripts.map(async (entry) => {
        let testCases = [];
        let description = null;
        let docHeader   = null;

        try {
          testCases = await discoverTestCasesForScript(entry.abs);
        } catch {
          testCases = [];
        }

        try {
          description = await discoverScriptDescription(entry.abs);
        } catch {
          description = null;
        }

        try {
          docHeader = await discoverScriptDocHeader(entry.abs);
        } catch {
          docHeader = null;
        }

        return {
          rel           : entry.rel
        , suite         : entry.suite
        , file          : entry.file
        , description   : description
        , docHeader     : docHeader
        , blocked       : BLOCKED_SCRIPTS.has(entry.rel)
        , blockedReason : BLOCKED_REASONS[entry.rel] ?? null
        , testCases     : testCases.map((item) => ({
            name         : item.name
          , index        : item.index
          , dependencies : item.dependencies
          , chain        : item.chain
          , stepComment  : item.stepComment ?? null
          }))
        };
      }))
    }, req);
    return;
  }

  if (urlPath === "/api/run" && req.method === "POST") {
    if (isRunActive()) {
      sendJson(res, 409, { error: "run already in progress" }, req);
      return;
    }

    const result = await startRun(REPO_ROOT);
    if (!result.started) {
      sendJson(res, 409, { error: result.error ?? "run already in progress" }, req);
      return;
    }

    sendJson(res, 202, {
      started   : true
    , startedAt : getRunStatus().startedAt
    , mode      : "all"
    }, req);
    return;
  }

  if (urlPath === "/api/run/one" && req.method === "POST") {
    let body = {};

    try {
      body = /** @type {Record<string, unknown>} */ (await readJsonBody(req));
    } catch (err) {
      sendJson(res, 400, {
        error: err instanceof Error ? err.message : "invalid body"
      }, req);
      return;
    }

    const script = typeof body.script === "string" ? body.script.trim() : "";

    if (!script) {
      sendJson(res, 400, { error: "missing script" }, req);
      return;
    }

    const preflight = await preflightRunTarget({ scriptRel: script });

    if (!preflight.ok) {
      sendJson(res, preflight.status, { error: preflight.error }, req);
      return;
    }

    if (isRunActive()) {
      sendJson(res, 409, { error: "run already in progress" }, req);
      return;
    }

    const result = await startRun(REPO_ROOT, { scriptRel: script });

    if (!result.started) {
      const status = result.error?.includes("not found") ? 404 : 409;
      sendJson(res, status, { error: result.error ?? "run failed" }, req);
      return;
    }

    sendJson(res, 202, {
      started   : true
    , startedAt : getRunStatus().startedAt
    , mode      : "single"
    , script
    }, req);
    return;
  }

  if (urlPath === "/api/run/suite" && req.method === "POST") {
    let body = {};

    try {
      body = /** @type {Record<string, unknown>} */ (await readJsonBody(req));
    } catch (err) {
      sendJson(res, 400, {
        error: err instanceof Error ? err.message : "invalid body"
      }, req);
      return;
    }

    const suite = typeof body.suite === "string" ? body.suite.trim() : "";

    if (!suite) {
      sendJson(res, 400, { error: "missing suite" }, req);
      return;
    }

    const preflight = await preflightRunTarget({ suite });

    if (!preflight.ok) {
      sendJson(res, preflight.status, { error: preflight.error }, req);
      return;
    }

    if (isRunActive()) {
      sendJson(res, 409, { error: "run already in progress" }, req);
      return;
    }

    const result = await startRun(REPO_ROOT, { suite });

    if (!result.started) {
      const status = result.error?.includes("not found") ? 404 : 409;
      sendJson(res, status, { error: result.error ?? "run failed" }, req);
      return;
    }

    sendJson(res, 202, {
      started   : true
    , startedAt : getRunStatus().startedAt
    , mode      : "suite"
    , suite
    }, req);
    return;
  }

  if (urlPath === "/api/run/funzionali" && req.method === "POST") {
    if (isRunActive()) {
      sendJson(res, 409, { error: "run already in progress" }, req);
      return;
    }

    const result = await startRunFunzionali(REPO_ROOT);

    if (!result.started) {
      sendJson(res, 409, { error: result.error ?? "run failed" }, req);
      return;
    }

    sendJson(res, 202, {
      started   : true
    , startedAt : getRunStatus().startedAt
    , mode      : "funzionali"
    , script    : "funzionali/run-funzionali.mjs"
    }, req);
    return;
  }

  if (urlPath === "/api/funzionali/meta" && req.method === "GET") {
    sendJson(res, 200, getFunzionaliMetaPayload(), req);
    return;
  }

  if (urlPath === "/api/tecnici/meta" && req.method === "GET") {
    sendJson(res, 200, await getTecniciMetaPayload(), req);
    return;
  }

  if (urlPath === "/api/run/case" && req.method === "POST") {
    let body = {};

    try {
      body = /** @type {Record<string, unknown>} */ (await readJsonBody(req));
    } catch (err) {
      sendJson(res, 400, {
        error: err instanceof Error ? err.message : "invalid body"
      }, req);
      return;
    }

    const script = typeof body.script === "string" ? body.script.trim() : "";
    const test   = typeof body.test === "string" ? body.test.trim() : "";

    if (!script || !test) {
      sendJson(res, 400, { error: "missing script or test" }, req);
      return;
    }

    const preflight = await preflightRunTarget({ scriptRel: script, testCase: test });

    if (!preflight.ok) {
      sendJson(res, preflight.status, { error: preflight.error }, req);
      return;
    }

    if (isRunActive()) {
      sendJson(res, 409, { error: "run already in progress" }, req);
      return;
    }

    const result = await startRun(REPO_ROOT, { scriptRel: script, testCase: test });

    if (!result.started) {
      const status = result.error?.includes("not found") ? 404 : 409;
      sendJson(res, status, { error: result.error ?? "run failed" }, req);
      return;
    }

    sendJson(res, 202, {
      started   : true
    , startedAt : getRunStatus().startedAt
    , mode      : "case"
    , script
    , test
    }, req);
    return;
  }

  if (urlPath === "/api/report" && req.method === "GET") {
    if (!existsSync(LATEST_JSON)) {
      sendJson(res, 404, { error: "no report available" }, req);
      return;
    }

    const body = await readFile(LATEST_JSON, "utf8");
    applyCors(res, req);
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(body.endsWith("\n") ? body : `${body}\n`);
    return;
  }

  if (urlPath === "/api/report/html" && req.method === "GET") {
    const query  = req.url?.includes("?") ? req.url.split("?")[1] : "";
    const params = new URLSearchParams(query);
    const suite  = params.get("suite");

    if (suite) {
      const report = await loadReportFromLatest();

      if (!report) {
        sendJson(res, 404, { error: "no report available" }, req);
        return;
      }

      const filtered = filterReportBySuite(report, suite);

      if (filtered.scripts.length === 0) {
        sendJson(res, 404, { error: `no scripts for suite ${suite}` }, req);
        return;
      }

      applyCors(res, req);
      res.writeHead(200, {
        "Content-Type"  : "text/html; charset=utf-8"
      , "Cache-Control" : "no-store"
      });
      res.end(generateHtml(filtered));
      return;
    }

    if (!existsSync(LATEST_HTML)) {
      sendJson(res, 404, { error: "no html report available" }, req);
      return;
    }

    applyCors(res, req);
    res.writeHead(200, {
      "Content-Type"  : "text/html; charset=utf-8"
    , "Cache-Control" : "no-store"
    });
    createReadStream(LATEST_HTML).pipe(res);
    return;
  }

  if (urlPath === "/api/report/tecnici-analysis" && req.method === "POST") {
    try {
      const result = await loadAndAnalyzeTestTecnici();
      sendJson(res, 200, result, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : "analysis failed";
      sendJson(res, message === "no report available" ? 404 : 500, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/report/tecnici-analysis" && req.method === "GET") {
    if (!existsSync(TECNICI_ANALYSIS_JSON)) {
      sendJson(res, 404, { error: "no analysis available" }, req);
      return;
    }

    const body = await readFile(TECNICI_ANALYSIS_JSON, "utf8");
    applyCors(res, req);
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(body.endsWith("\n") ? body : `${body}\n`);
    return;
  }

  if (urlPath === "/api/report/tecnici-analysis/html" && req.method === "GET") {
    if (!existsSync(TECNICI_ANALYSIS_HTML)) {
      sendJson(res, 404, { error: "no analysis html available" }, req);
      return;
    }

    applyCors(res, req);
    res.writeHead(200, {
      "Content-Type"  : "text/html; charset=utf-8"
    , "Cache-Control" : "no-store"
    });
    createReadStream(TECNICI_ANALYSIS_HTML).pipe(res);
    return;
  }

  if (urlPath === "/api/export" && req.method === "GET") {
    const query    = req.url?.includes("?") ? req.url.split("?")[1] : "";
    const params   = new URLSearchParams(query);
    const format   = params.get("format") === "json" ? "json" : "xlsx";
    const suite    = params.get("suite");
    let report     = await loadReportFromLatest();

    if (!report) {
      sendJson(res, 404, { error: "no report available" }, req);
      return;
    }

    if (suite) {
      report = filterReportBySuite(report, suite);

      if (report.scripts.length === 0) {
        sendJson(res, 404, { error: `no scripts for suite ${suite}` }, req);
        return;
      }
    }

    const basename = buildExportBasename(report, undefined, suite);

    if (format === "json") {
      const exported = await writeJsonExport(report, { save: false });
      applyCors(res, req);
      res.writeHead(200, {
        "Content-Type"        : "application/json; charset=utf-8"
      , "Content-Disposition" : `attachment; filename="${basename}.json"`
      , "Cache-Control"       : "no-store"
      });
      res.end(exported.body);
      return;
    }

    const exported = await writeXlsxExport(report, { save: false });
    applyCors(res, req);
    res.writeHead(200, {
      "Content-Type"        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    , "Content-Disposition" : `attachment; filename="${basename}.xlsx"`
    , "Cache-Control"       : "no-store"
    });
    res.end(exported.buffer);
    return;
  }

  if (urlPath === "/api/health" && req.method === "GET") {
    const health = await getHealthStatus();
    sendJson(res, 200, health, req);
    return;
  }

  if (urlPath === "/api/dev/requirements" && req.method === "GET") {
    const requirements = await getDevRequirements();
    sendJson(res, 200, requirements, req);
    return;
  }

  if (urlPath === "/api/dev/services" && req.method === "GET") {
    const services = await getDevServicesWithHealth();
    sendJson(res, 200, { checkedAt: new Date().toISOString(), services }, req);
    return;
  }

  if (urlPath === "/api/repo/services/discover" && req.method === "GET") {
    try {
      const query      = req.url?.includes("?") ? req.url.split("?")[1] : "";
      const params     = new URLSearchParams(query);
      const withPortal = params.get("withPortal") === "1" || params.get("withPortal") === "true";
      const allExtras  = params.get("allExtras") === "1" || params.get("allExtras") === "true";
      const extrasRaw  = params.get("extras") ?? "";
      const extras     = allExtras
        ? [...REPO_EXTRAS_ALL]
        : extrasRaw.split(",").map((part) => part.trim()).filter(Boolean);

      const data = await getRepoServicesDiscover({
        extras
      , withPortal : allExtras || withPortal
      });

      sendJson(res, 200, data, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/repo/services/status" && req.method === "GET") {
    sendJson(res, 200, getRepoServicesStatus(), req);
    return;
  }

  if (urlPath === "/api/repo/services/processes" && req.method === "GET") {
    try {
      const data = await listDevStackProcesses();
      sendJson(res, 200, data, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/repo/services/logs" && req.method === "GET") {
    const query  = req.url?.includes("?") ? req.url.split("?")[1] : "";
    const params = new URLSearchParams(query);
    const cursor = Number(params.get("cursor") ?? "0");
    sendJson(res, 200, getRepoServicesLogs(cursor), req);
    return;
  }

  if (urlPath === "/api/repo/services/logs" && req.method === "DELETE") {
    clearRepoServicesLogs();
    sendJson(res, 200, { ok: true, cursor: getRepoServicesLogs().cursor }, req);
    return;
  }

  if (urlPath === "/api/repo/services/start" && req.method === "POST") {
    try {
      const body = /** @type {Record<string, unknown>} */ (await readJsonBody(req));
      const extras = Array.isArray(body.extras)
        ? body.extras.filter((part) => typeof part === "string")
        : typeof body.extras === "string"
          ? body.extras.split(",").map((part) => part.trim()).filter(Boolean)
          : [];

      const result = await startRepoServices({
        extras
      , withPortal : body.withPortal === true
      , noDb       : body.noDb !== false
      , allExtras  : body.allExtras === true
      , productOnly          : body.productOnly === true
      , productStackComplete : body.productStackComplete === true
      });

      const status = result.started ? 202 : 409;
      sendJson(res, status, result, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 400, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/repo/services/start-one" && req.method === "POST") {
    try {
      const body       = /** @type {Record<string, unknown>} */ (await readJsonBody(req));
      const serviceId  = typeof body.serviceId === "string" ? body.serviceId.trim() : "";

      if (!serviceId) {
        sendJson(res, 400, { error: "serviceId obbligatorio" }, req);
        return;
      }

      const result = await startSingleRepoService(serviceId);
      const status = result.started ? 202 : 409;
      sendJson(res, status, result, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 400, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/repo/services/stop-one" && req.method === "POST") {
    try {
      const body      = /** @type {Record<string, unknown>} */ (await readJsonBody(req));
      const serviceId = typeof body.serviceId === "string" ? body.serviceId.trim() : "";

      if (!serviceId) {
        sendJson(res, 400, { error: "serviceId obbligatorio" }, req);
        return;
      }

      const result = await stopSingleRepoService(serviceId);
      const status = result.ok === false && result.error ? 409 : 200;
      sendJson(res, status, result, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/repo/database/status" && req.method === "GET") {
    try {
      sendJson(res, 200, getProductDatabaseStatus(), req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/repo/database/reset" && req.method === "POST") {
    try {
      const result = await resetProductDatabase();
      sendJson(res, result.ok ? 200 : 500, result, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/repo/database/push" && req.method === "POST") {
    try {
      const result = await pushProductDatabase();
      sendJson(res, result.ok ? 200 : 500, result, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/repo/database/seed" && req.method === "POST") {
    try {
      const result = await seedProductDatabase();
      sendJson(res, result.ok ? 200 : 500, result, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/repo/services/stop" && req.method === "POST") {
    try {
      const body = /** @type {Record<string, unknown>} */ (await readJsonBody(req));
      const result = await stopRepoServices({
        includeDashboard : body.includeDashboard === true
      , productOnly          : body.productOnly === true
      , productStackComplete : body.productStackComplete === true
      });
      sendJson(res, 200, result, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/jira/backlog" && req.method === "GET") {
    try {
      const data = await loadJiraBacklog();
      const repoRefs = scanRepoJiraReferences();
      data.repoAlign = buildRepoAlignMap(data.issues, repoRefs);
      data.pillarTree = buildBacklogPillarTree(data.issues);
      sendJson(res, 200, data, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/jira/backlog/insights" && req.method === "GET") {
    try {
      const data = await fetchBacklogInsights();
      sendJson(res, 200, data, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/my-project/analyze" && req.method === "GET") {
    try {
      const data = await analyzeMyProject();
      sendJson(res, 200, data, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/jira/working/insights" && req.method === "GET") {
    try {
      const data = await fetchWorkingInsights();
      sendJson(res, 200, data, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/jira/working/archives" && req.method === "GET") {
    try {
      const archives = await listWorkingPlanArchives();
      sendJson(res, 200, { archives }, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/jira/working/archive-regenerate" && req.method === "POST") {
    try {
      const result = await archiveAndRegenerateWorkingPlan();
      sendJson(res, 200, result, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/jira/working/regenerate" && req.method === "POST") {
    try {
      const result = await regenerateWorkingPlanHtml();
      sendJson(res, 200, result, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/jira/working/save-old-rebuild" && req.method === "POST") {
    try {
      const result = await saveOldAndRebuildWorking();
      sendJson(res, 200, result, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/jira/project-tree/regenerate" && req.method === "POST") {
    try {
      const result = await regenerateProjectTreeHtml();
      sendJson(res, 200, result, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/pillar-matrix/regenerate" && req.method === "POST") {
    sendJson(res, 403, {
      error   : "Rigenerazione da cruscotto disabilitata"
    , command : "node scripts/generate-pillar-matrix-portal.mjs"
    }, req);
    return;
  }

  const issueMatch = urlPath.match(/^\/api\/jira\/issue\/(JLO-\d+)$/);

  if (issueMatch && req.method === "GET") {
    try {
      const data = await fetchJiraIssueStatus(issueMatch[1]);
      sendJson(res, 200, data, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { error: message }, req);
    }

    return;
  }

  sendJson(res, 404, { error: "Not found" }, req);
}

// --- dispatcher richieste — OPTIONS, API, tab redirect, static ---
/**
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
async function handleRequest(req, res) {
  // 1. Preflight CORS
  if (req.method === "OPTIONS") {
    applyCors(res, req);
    res.writeHead(204);
    res.end();
    return;
  }

  const urlPath = req.url?.split("?")[0] ?? "/";

  // 2. API JSON
  if (urlPath.startsWith("/api/")) {
    await handleApi(req, res, urlPath);
    return;
  }

  const tabPath = urlPath.replace(/^\//, "");

  // 3. Deep-link tab cruscotto → hash SPA (/#overview, /#test, …)
  if (tabPath && !tabPath.includes("/") && !tabPath.includes(".")) {
    const knownTabs = new Set([
      "overview"
    , "requisiti"
    , "servizi"
    , "test"
    , "summary"
    , "testtecnici"
    , "testfunzionali"
    , "jiraworking"
    , "jiraworkingold"
    , "jiraproject"
    , "backlog"
    , "myproject"
    , "pillarmatrix"
    , "utility"
    ]);

    if (knownTabs.has(tabPath)) {
      applyCors(res, req);
      res.writeHead(302, { Location: `/app.html#${tabPath}` });
      res.end();
      return;
    }
  }

  // 4. Archivio HTML working plan
  if (await serveWorkingArchive(req, res, urlPath)) {
    return;
  }

  // 5. Asset statici cruscotto/
  await serveStatic(req, res);
}

// --- lifecycle — SIGINT/SIGTERM e bind porta ---
function shutdown(signal) {
  console.log(`\n${signal} — chiusura server…`);

  if (!httpServer) {
    process.exit(0);
    return;
  }

  httpServer.close(() => {
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 5000).unref();
}

async function main() {
  // 1. HTTP server — delega a handleRequest con catch 500
  httpServer = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal server error" }, req);
      }
    });
  });

  // 2. Errore bind (EADDRINUSE) o altro — exit con messaggio operativo
  httpServer.on("error", (err) => {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === "EADDRINUSE") {
      console.error(
        `Porta ${PORT} già in uso — un'altra istanza dashboard è attiva.`
      );
      console.error(
        `Windows: netstat -ano | findstr :${PORT}  poi  taskkill /PID <pid> /F`
      );
      console.error(
        `Oppure chiudi il terminale dove gira node server/dashboard-server.mjs`
      );
      process.exit(1);
      return;
    }

    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });

  // 3. Listen — log URL dashboard e root static
  httpServer.listen(PORT, () => {
    console.log(`Admin Dashboard  http://localhost:${PORT}/`);
    console.log(`Static: cruscotto/`);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
