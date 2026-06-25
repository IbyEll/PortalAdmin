#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** APPLICATION MODULE ** -- commentato il: 2026-06-23 22:15
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 05:40   by: IbyEll
 * modificato il: 2026-06-23 22:15   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *           Server HTTP cruscotto — static cruscotto.frontend e API run, Jira, servizi product.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Il cruscotto è UI statica in cruscotto.frontend/; serve un processo HTTP locale che esponga asset
 *     e API per run testScript, backlog Jira, health stack e gestione servizi product.
 *
 *   A cosa serve:
 *   - Avvio run test (tecnici, funzionali, singolo script, suite, case) e stato run in corso.
 *   - Proxy dati Jira (backlog, insights, wip, my-project, project overview).
 *   - Health API/auth/web, discovery servizi repo, DB product (reset, seed, push).
 *   - Report JSON/HTML, export Excel, analisi test tecnici; bootstrap overlay in pagine HTML.
 *
 * Generalizzazione:
 *   Si — overlay attivo (CRUSCOTTO_PROJECT), path product e route API parametrizzate da env e lib.
 *
 * Input:
 *   - PRJ_NAME, PRODUCT_REPO_PATH — contesto product da env e overlay attivo
 *   - DASHBOARD_PORT — porta listener da resolveDashboardListenPort (es. 3998 / 3999)
 *   - req.url, req.method, body JSON — routing API, static e deep-link tab SPA
 *
 * Uso:
 *   - node cruscotto.frontend/cruscotto.server.mjs
 *   - npm run admin:dashboard
 *
 * Route o endpoint (principali):
 *   - GET  /api/status, /api/health, /api/scripts — stato run e catalogo test
 *   - POST /api/run, /api/run/one, /api/run/suite, /api/run/funzionali, /api/run/case
 *   - GET  /api/report, /api/report/html, /api/export
 *   - GET  /api/dev/requirements, /api/dev/services
 *   - GET|POST /api/repo/services/*, /api/repo/database/*
 *   - GET  /api/jira/backlog — backlog live Jira API (forceApi; deprecazione prevista)
 *   - GET  /api/jira/my-backlog — backlog cache cruscotto DB (dbOnly)
 *   - POST /api/jira/my-backlog/sync — fetch Jira → persist DB
 *   - GET  /api/jira/backlog/insights
 *   - GET  /api/jira/issue/:KEY — dettaglio issue live (ADMIN-*, JLO-*)
 *   - GET  /api/jira/issue/:KEY/db — dettaglio issue da cache cruscotto DB
 *   - GET  /api/jira/wip/status · POST /api/jira/wip/push · POST /api/jira/wip/pr-poll — workflow database
 *   - GET  /api/cruscotto/project — config progetto attivo (bootstrap UI)
 *   - GET  /api/portal/projects, /api/portal/instance · POST /api/portal/instance
 *   - GET  /, /app.html — SPA cruscotto; alias cruscotto.js, backlog.html, …
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.home.js — fetch API run, report, Jira, Process
 *   - test.smoke/smoke-dashboard.mjs, smoke-portal-e2e.mjs — smoke avvio server
 *   - package.json admin:dashboard · admin.portal/portal.dashboard.launch.mjs — spawn dashboard
 *
 * Dipendenze:
 *   - lib/test.catalog.mjs, test.dipendenze.mjs, reporter.mjs, portal.instance.mjs
 *   - lib/overlay/cruscotto.config.overlay.mjs, lib/overlay/dashboard.project.mjs
 *   - cruscotto.health.mjs, cruscotto.dev.api.mjs, cruscotto.testscript.manager.mjs
 *   - cruscotto.process.services.manager.mjs, cruscotto.jira.*.mjs, admin.portal.JiraCORE/
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import "../lib/portal.load.env.mjs";

import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BLOCKED_REASONS
, BLOCKED_SCRIPTS
, discoverTestScripts
, REPO_ROOT
} from "../lib/test.catalog.mjs";
import { getHealthStatus } from "../cruscotto.frontend/cruscotto.health.mjs";
import { getDevRequirements, getDevServicesWithHealth } from "./cruscotto.dev.api.mjs";
import {
  discoverScriptDescription
, discoverScriptDocHeader
, discoverTestCasesForScript
} from "../lib/test.dipendenze.mjs";
import { fetchJiraBacklog, loadJiraBacklog } from "./cruscotto.jira.backlog.mjs";
import { fetchJiraIssueDetail, fetchJiraIssueDetailFromDb } from "./cruscotto.jira.issue.view.mjs";
import { fetchBacklogInsights, buildRepoAlignMap } from "./cruscotto.jira.backlog.insights.mjs";
import { scanRepoJiraReferences } from "../admin.portal.JiraCORE/jira.function.repo.refs.mjs";
import { fetchWipStatusByKeys } from "./cruscotto.jira.wip.mjs";
import { pushWipStory } from "../admin.portal.JiraCORE/jiraCORE.wip.push.mjs";
import { pollWipPullRequest } from "../admin.portal.JiraCORE/jiraCORE.wip.pr.poll.mjs";
import { enrollIssueInWip, finalizeWipAfterGogo } from "../admin.portal.JiraCORE/jiraCORE.wip.enroll.mjs";
import {
  analyzeMyProject
, analyzeProjectOverview
, getFunzionaliMetaPayload
, getTecniciMetaPayload
, loadAndAnalyzeTestTecnici
, TECNICI_ANALYSIS_HTML
, TECNICI_ANALYSIS_JSON
} from "../lib/overlay/dashboard.project.mjs";
import { getRunStatus, isRunActive, startRun, startRunFunzionali } from "./cruscotto.testscript.manager.mjs";
import {
  cancelCursorAgent
, clearCursorAgentLogs
, getCursorAgentConfigPayload
, getCursorAgentLogs
, getCursorAgentStatus
, isCursorAgentActive
, startCursorAgent
} from "../admin.portal/portal.cursor.agent.manager.mjs";
import { resolvePrUrlForIssueKey, checkNoOpenPullRequests } from "../admin.portal/portal.cursor.agent.workflow.mjs";
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
} from "./cruscotto.process.services.manager.mjs";
import {
  buildExportBasename
, loadReportFromLatest
, writeJsonExport
, writeXlsxExport
} from "../admin.script.standalone/export-report.mjs";
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
} from "../lib/portal.instance.mjs";
import { buildCruscottoProjectPayload } from "../lib/overlay/cruscotto.config.overlay.mjs";
import { resolveDashboardListenPort } from "../lib/portal.launch.dashboard.mjs";
import {
  describeCruscottoDbLayout
, resolveCruscottoDbPath
} from "../cruscotto.database/cruscotto.db.config.mjs";
import { runCruscottoMigrateDeploy } from "../cruscotto.database/cruscotto.db.migrate.mjs";
import { syncJiraBacklogFromApi } from "../cruscotto.database/Jira.backlog.sync.mjs";

// --- configurazione server — path cruscotto e porta HTTP ---
const SERVER_DIR    = dirname(fileURLToPath(import.meta.url));
const PORTAL_ROOT   = join(SERVER_DIR, "..");
const CRUSCOTTO_DIR = join(PORTAL_ROOT, "cruscotto.frontend");

/** Asset insight — URL brevi in HTML cruscotto (file in cruscotto.frontend/). */
const INSIGHT_STATIC_FILES = {
  "insight-toolbar.css" : join(CRUSCOTTO_DIR, "cruscotto.jira.toolbar.insight.css")
, "insight-validate.js" : join(CRUSCOTTO_DIR, "cruscotto.jira.toolbar.insight.validate.js")
};

/** Alias statici cruscotto.frontend (nomi brevi in HTML legacy). */
const CRUSCOTTO_STATIC_ALIASES = {
  "cruscotto.js"            : "cruscotto.home.js"
, "favicon.svg"             : "PortalAdmin.icona..svg"
, "jira-issue-display.css"  : "cruscotto.jira.issue.display.css"
, "jira-issue-display.js"   : "cruscotto.jira.issue.display.client.js"
, "home.html"               : "cruscotto.home.html"
, "index.html"              : "cruscotto.home.html"
, "expand-collapse-ui.js"   : "expand.collapse.toolbar.js"
, "expand-collapse-ui.css"  : "expand.collapse.toolbar.css"
, "backlog.html"            : "cruscotto.jira.backlog.html"
, "my-backlog.html"         : "cruscotto.jira.my-backlog.html"
, "issue.html"              : "cruscotto.jira.issue.html"
, "my-project.html"         : "cruscotto.jira.my-project.html"
, "project-overview.html"   : "cruscotto.project.overview.html"
};

/** Route URL → file relativo in cruscotto.frontend/. */
const CRUSCOTTO_ROUTE_FILES = {
  "/"         : "cruscotto.home.html"
, "/app.html" : "cruscotto.home.html"
};

const PORT = resolveDashboardListenPort();

/**
 * @returns {string}
 */
function getCruscottoProjectBootstrapInjection() {
  const json = JSON.stringify(buildCruscottoProjectPayload({ dashboardPort: PORT })).replace(/</g, "\\u003c");

  return [
    `<script>window.__CRUSCOTTO_PROJECT__=${json};</script>`
  , `<script src="/cruscotto.project.bootstrap.js"></script>`
  ].join("\n");
}

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
  // 1. Verifica Origin — CORS solo da localhost o assente (same-origin)
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
  // 1. Header CORS — mirror origin localhost per fetch da tab browser dev
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
  // 1. CORS + JSON — risposta uniforme per tutte le route /api/*
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
  // 1. Catalogo test — valida scriptRel/suite/testCase prima del guard run attivo
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

/**
 * Arricchisce payload backlog con allineamento repo e albero pilastri.
 *
 * @param {Awaited<ReturnType<typeof loadJiraBacklog>>} data
 */
function enrichBacklogPayload(data) {
  const repoRefs = scanRepoJiraReferences();

  data.repoAlign  = buildRepoAlignMap(data.issues, repoRefs);

  return data;
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {import("node:http").IncomingMessage} req
 * @param {Awaited<ReturnType<typeof loadJiraBacklog>>} data
 */
function sendBacklogJson(res, req, data) {
  sendJson(res, 200, enrichBacklogPayload(data), req);
}

// --- static — file da cruscotto.frontend/ e archivi working plan HTML ---
/**
 * @param {string} rel — path relativo sotto cruscotto.frontend o chiave alias
 * @returns {{ file: string, rootDir: string } | null}
 */
function resolveCruscottoStaticFile(rel) {
  // 1. Risoluzione path — insight jira/, alias brevi o file sotto cruscotto.frontend/
  if (INSIGHT_STATIC_FILES[rel]) {
    return { file: INSIGHT_STATIC_FILES[rel], rootDir: CRUSCOTTO_DIR };
  }

  const aliased = CRUSCOTTO_STATIC_ALIASES[rel] ?? rel;
  const file    = join(CRUSCOTTO_DIR, aliased);

  if (!file.startsWith(CRUSCOTTO_DIR) || !existsSync(file)) {
    return null;
  }

  return { file, rootDir: CRUSCOTTO_DIR };
}

/**
 * @param {string} html
 * @returns {string}
 */
function injectCruscottoProjectBootstrap(html) {
  // 1. Idempotenza — salta se bootstrap già presente nel markup
  if (html.includes("__CRUSCOTTO_PROJECT__")) {
    return html;
  }

  const injection = getCruscottoProjectBootstrapInjection();
  const bodyClose = html.match(/<\/body>/i);

  if (bodyClose && typeof bodyClose.index === "number") {
    return `${html.slice(0, bodyClose.index)}${injection}\n${html.slice(bodyClose.index)}`;
  }

  const headClose = html.match(/<\/head>/i);

  if (headClose && typeof headClose.index === "number") {
    return `${html.slice(0, headClose.index)}${injection}\n${html.slice(headClose.index)}`;
  }

  return `${injection}\n${html}`;
}

async function serveStatic(req, res) {
  // 1. Normalizza URL — redirect /app, route fisse e path relativo sotto cruscotto.frontend/
  const urlPath = req.url?.split("?")[0] ?? "/";
  let rel;

  if (urlPath === "/app" || urlPath === "/app/") {
    applyCors(res, req);
    res.writeHead(302, { Location: "/app.html" });
    res.end();
    return;
  }

  if (urlPath === "/favicon.ico") {
    rel = "favicon.svg";
  } else if (CRUSCOTTO_ROUTE_FILES[urlPath]) {
    rel = CRUSCOTTO_ROUTE_FILES[urlPath];
  } else {
    rel = urlPath.replace(/^\//, "");
  }

  const resolved = resolveCruscottoStaticFile(rel);

  if (!resolved) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const { file, rootDir } = resolved;

  if (!file.startsWith(rootDir)) {
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

  // 2. HTML cruscotto — inietta window.__CRUSCOTTO_PROJECT__ prima di </head>
  if (ext === ".html" && rootDir === CRUSCOTTO_DIR) {
    const raw  = await readFile(file, "utf8");
    const html = injectCruscottoProjectBootstrap(raw);

    res.writeHead(200, headers);
    res.end(html);
    return;
  }

  res.writeHead(200, headers);
  createReadStream(file).pipe(res);
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<unknown>}
 */
function readJsonBody(req) {
  // 1. Accumulo chunk — parse JSON body POST o {} se vuoto
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
  // 1. Router lineare — match path/metodo; delega a lib cruscotto, Jira, run e servizi product
  if (urlPath === "/api/cruscotto/project" && req.method === "GET") {
    sendJson(res, 200, buildCruscottoProjectPayload({ dashboardPort: PORT }), req);
    return;
  }

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
    sendJson(res, 200, await getFunzionaliMetaPayload(), req);
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

  // Backlog live (app.html#backlog → /backlog.html) — sempre API Jira; cache DB non usata qui.
  if (urlPath === "/api/jira/backlog" && req.method === "GET") {
    try {
      const data = await loadJiraBacklog({ forceApi: true });
      sendBacklogJson(res, req, data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { error: message }, req);
    }

    return;
  }

  // MyBacklog (app.html#mybacklog → /my-backlog.html) — solo cache cruscotto DB; sync via POST my-backlog/sync.
  if (urlPath === "/api/jira/my-backlog" && req.method === "GET") {
    try {
      const data = await loadJiraBacklog({ dbOnly: true });
      sendBacklogJson(res, req, data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/jira/my-backlog/sync" && req.method === "POST") {
    try {
      // Solo migrate deploy — generate fallirebbe EPERM con Prisma già caricato nel processo server
      runCruscottoMigrateDeploy({ stdio: "pipe" });

      const result = await syncJiraBacklogFromApi();

      sendJson(res, 200, {
        ok       : true
      , syncRunId: result.syncRunId
      , issueCount: result.issueCount
      , fetchedAt: result.fetchedAt
      , dbPath   : resolveCruscottoDbPath()
      , layout   : describeCruscottoDbLayout()
      }, req);
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

  if (urlPath === "/api/project-overview/analyze" && req.method === "GET") {
    try {
      const data = await analyzeProjectOverview();
      sendJson(res, 200, data, req);
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

 

  if (urlPath === "/api/cursor/config" && req.method === "GET") {
    sendJson(res, 200, getCursorAgentConfigPayload(), req);
    return;
  }

  if (urlPath === "/api/workflow/pr-url" && req.method === "GET") {
    const url = new URL(req.url ?? "", "http://localhost");
    const key = String(url.searchParams.get("key") ?? "").trim().toUpperCase();

    if (!/^(ADMIN|JLO)-\d+$/.test(key)) {
      sendJson(res, 400, { error: "key non valida (ADMIN-xxx o JLO-xxx)" }, req);
      return;
    }

    sendJson(res, 200, resolvePrUrlForIssueKey(key), req);
    return;
  }

  if (urlPath === "/api/workflow/gogo-preflight" && req.method === "GET") {
    const gate = checkNoOpenPullRequests();
    sendJson(res, gate.ok ? 200 : 409, gate, req);
    return;
  }

  if (urlPath === "/api/jira/wip/status" && req.method === "GET") {
    const url = new URL(req.url ?? "", "http://localhost");
    const keysParam = String(url.searchParams.get("keys") ?? "").trim();
    const keys = keysParam
      ? keysParam.split(/[\s,]+/).map((key) => key.trim()).filter(Boolean)
      : [];

    try {
      const data = await fetchWipStatusByKeys(keys);
      sendJson(res, 200, data, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/jira/wip/enroll" && req.method === "POST") {
    try {
      const body = /** @type {Record<string, unknown>} */ (await readJsonBody(req));
      const key  = String(body.key ?? "").trim().toUpperCase();

      if (!/^(ADMIN|JLO)-\d+$/.test(key)) {
        sendJson(res, 400, { error: "key non valida (ADMIN-xxx o JLO-xxx)" }, req);
        return;
      }

      const result = await enrollIssueInWip(key);
      sendJson(res, 200, { ok: true, ...result }, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 404, { ok: false, error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/jira/wip/finalize-gogo" && req.method === "POST") {
    try {
      const body = /** @type {Record<string, unknown>} */ (await readJsonBody(req));
      const key  = String(body.key ?? "").trim().toUpperCase();

      if (!/^(ADMIN|JLO)-\d+$/.test(key)) {
        sendJson(res, 400, { error: "key non valida (ADMIN-xxx o JLO-xxx)" }, req);
        return;
      }

      const advancement = await finalizeWipAfterGogo(key);
      sendJson(res, 200, {
        ok          : true
      , key
      , advancement
      , wip         : advancement
      }, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { ok: false, error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/jira/wip/push" && req.method === "POST") {
    try {
      const body = /** @type {Record<string, unknown>} */ (await readJsonBody(req));
      const key = String(body.key ?? "").trim().toUpperCase();

      if (!/^(ADMIN|JLO)-\d+$/.test(key)) {
        sendJson(res, 400, { error: "key non valida (ADMIN-xxx o JLO-xxx)" }, req);
        return;
      }

      const result = await pushWipStory(key, {
        dryRun: body.dryRun === true
      });

      sendJson(res, result.ok ? 200 : 409, result, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 409, { ok: false, error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/jira/wip/pr-poll" && req.method === "POST") {
    try {
      const body = /** @type {Record<string, unknown>} */ (await readJsonBody(req));
      const key = String(body.key ?? "").trim().toUpperCase();

      if (!/^(ADMIN|JLO)-\d+$/.test(key)) {
        sendJson(res, 400, { ok: false, error: "key non valida (ADMIN-xxx o JLO-xxx)" }, req);
        return;
      }

      const result = await pollWipPullRequest(key);
      sendJson(res, result.ok === false && result.complete !== true ? 502 : 200, result, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { ok: false, error: message }, req);
    }

    return;
  }

  if (urlPath === "/api/cursor/agent/status" && req.method === "GET") {
    sendJson(res, 200, getCursorAgentStatus(), req);
    return;
  }

  if (urlPath === "/api/cursor/agent/logs" && req.method === "GET") {
    const url    = new URL(req.url ?? "", "http://localhost");
    const cursor = Number(url.searchParams.get("cursor") ?? "0");
    sendJson(res, 200, getCursorAgentLogs(cursor), req);
    return;
  }

  if (urlPath === "/api/cursor/agent/cancel" && req.method === "POST") {
    const result = cancelCursorAgent();
    sendJson(res, result.ok ? 200 : 409, result, req);
    return;
  }

  if (urlPath === "/api/cursor/agent/clear-logs" && req.method === "POST") {
    sendJson(res, 200, clearCursorAgentLogs(), req);
    return;
  }

  if (urlPath === "/api/cursor/agent" && req.method === "POST") {
    if (isCursorAgentActive()) {
      sendJson(res, 409, { error: "agent già in esecuzione" }, req);
      return;
    }

    try {
      const body    = await readJsonBody(req);
      const prompt  = typeof body.prompt === "string" ? body.prompt.trim() : "";
      const runtime = body.runtime === "cloud" || body.runtime === "local" ? body.runtime : undefined;
      const resume  = Boolean(body.resume);
      const resumeRunId = typeof body.resumeRunId === "string" ? body.resumeRunId.trim() : "";
      const resumeAgentId = typeof body.resumeAgentId === "string" ? body.resumeAgentId.trim() : "";

      if (!prompt) {
        sendJson(res, 400, { error: "prompt obbligatorio" }, req);
        return;
      }

      const result = await startCursorAgent({
        prompt
      , runtime
      , resume
      , resumeRunId: resumeRunId || undefined
      , resumeAgentId: resumeAgentId || undefined
      });

      if (!result.started) {
        sendJson(res, result.error?.includes("CURSOR_API_KEY") ? 503 : 409, {
          error   : result.error ?? "avvio fallito"
        , openPrs : Array.isArray(result.openPrs) ? result.openPrs : undefined
        }, req);
        return;
      }

      sendJson(res, 202, {
        started   : true
      , runtime   : result.runtime
      , startedAt : result.startedAt
      , logCursor : result.logCursor
      }, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message }, req);
    }

    return;
  }

  const issueMatch = urlPath.match(/^\/api\/jira\/issue\/((?:ADMIN|JLO)-\d+)$/i);

  if (issueMatch && req.method === "GET") {
    try {
      const data = await fetchJiraIssueDetail(issueMatch[1]);
      sendJson(res, 200, data, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 502, { error: message }, req);
    }

    return;
  }

  const issueDbMatch = urlPath.match(/^\/api\/jira\/issue\/((?:ADMIN|JLO)-\d+)\/db$/i);

  if (issueDbMatch && req.method === "GET") {
    try {
      const data = await Promise.race([
        fetchJiraIssueDetailFromDb(issueDbMatch[1])
      , new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Timeout lettura cache DB (25s) — riavvia il cruscotto"))
          , 25000
          );
        })
      ]);
      sendJson(res, 200, data, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status  = /assente in cache|non disponibile|Nessun sync/i.test(message) ? 404 : 502;
      sendJson(res, status, { error: message }, req);
    }

    return;
  }

  // 2. Nessuna route API corrispondente — 404 JSON uniforme
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
    if (tabPath === "utility") {
      applyCors(res, req);
      res.writeHead(302, { Location: "/app.html#process" });
      res.end();
      return;
    }

    const knownTabs = new Set([
      "overview"
    , "requisiti"
    , "servizi"
    , "test"
    , "summary"
    , "testtecnici"
    , "testfunzionali"
    , "jiraproject"
    , "backlog"
    , "mybacklog"
    , "issue"
    , "process"
    , "cursor"
    ]);

    if (knownTabs.has(tabPath)) {
      applyCors(res, req);
      res.writeHead(302, { Location: `/app.html#${tabPath}` });
      res.end();
      return;
    }
  }

  // 4. Asset statici cruscotto/
  await serveStatic(req, res);
}

// --- lifecycle — SIGINT/SIGTERM e bind porta ---
function shutdown(signal) {
  // 1. Graceful close — httpServer.close con timeout forzato exit 1
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
    const project = buildCruscottoProjectPayload({ dashboardPort: PORT });
    console.log(`Admin Dashboard  http://localhost:${PORT}/`);
    console.log(
      `Progetto: ${project.projectDisplayName} (${project.overlayName}) · Jira ${project.jiraPrefix}`
    );
    console.log(`Static: cruscotto.frontend/ (+ jira insight assets)`);
  });
}

// 4. Signal handler — SIGINT/SIGTERM chiudono listener prima di exit
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch((err) => {
  // exit 1 — main fallito prima del listen (import o bind)
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
