#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** APPLICATION MODULE ** -- commentato il: 2026-06-18 03:59
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 03:53   by: IbyEll
 * modificato il: 2026-06-18 03:59   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                    Server HTTP HOME PortalAdmin — istanzia overlay, API portal e static admin.portal.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Avvio leggero senza caricare cruscotto, test.catalog, Jira backlog o run-manager.
 *   - Separare scelta overlay (HOME) dal dashboard completo su porta dedicata per product.
 *
 *   A cosa serve:
 *   - Serve portal.home.html e asset admin.portal/; API istanziazione e apertura cruscotto post-prepare.
 *
 * Generalizzazione:
 *   Si — overlay e porte da lib/portal.instance; static da admin.portal e cruscotto.frontend (favicon).
 *
 * Input:
 *   - req.url, req.method, body JSON — API portal/instance e open-cruscotto
 *   - PORTAL_HOME_PORT — porta listener (default 3990)
 *
 * Route o endpoint:
 *   - GET  /, /home.html — portal.home.html
 *   - GET  /api/health — ping modalità home-only
 *   - GET  /api/portal/projects, /api/portal/instances, /api/portal/instance
 *   - POST /api/portal/instance — activatePortalInstance
 *   - POST /api/portal/open-cruscotto — spawn admin.portal/portal.dashboard.launch.mjs
 *   - POST /api/portal/open-cruscotto-browser — openSystemBrowser
 *
 * Consumatori:
 *   - npm run admin:home — entrypoint package.json
 *   - admin.portal/portal.home.start.mjs — spawn alternativo
 *   - admin.portal/portal.home.html, portal.home.js — UI istanziazione
 *
 * Dipendenze:
 *   - lib/portal.instance.mjs — istanze overlay e prepare
 *   - lib/portal.launch.dashboard.mjs — spawn dashboard e browser
 *   - admin.portal/ (questo modulo), cruscotto.frontend/PortalAdmin.icona..svg
 *
 * Variabili d'ambiente:
 *   - PORTAL_HOME_PORT — default 3990 (separata dalle porte cruscotto progetto)
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import "../lib/portal.load.env.mjs";

import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  activatePortalInstance
, getPortalInstance
, getPortalInstances
, getPrepareStatus
, listAvailableProjects
, readInstanceForOverlay
} from "../lib/portal.instance.mjs";
import {
  isFullDashboardUp
, openSystemBrowser
, resolveCruscottoUrl
, spawnDashboardLauncher
} from "../lib/portal.launch.dashboard.mjs";

// --- path e porta server HOME ---
const SERVER_DIR           = dirname(fileURLToPath(import.meta.url));
const PORTAL_ROOT          = join(SERVER_DIR, "..");
const ADMIN_PORTAL_DIR     = SERVER_DIR;
const CRUSCOTTO_FRONTEND   = join(PORTAL_ROOT, "cruscotto.frontend");
const PORT                 = Number(
  process.env.PORTAL_HOME_PORT
  ?? 3990
);

// --- alias static admin.portal (URL brevi in portal.home.html) ---
/** URL brevi → file in admin.portal/ (HTML referenzia /home.css, /home.js). */
const HOME_STATIC_ALIASES = {
  "home.html"        : "portal.home.html"
, "portal.home.html" : "portal.home.html"
, "home.css"         : "portal.home.css"
, "portal.home.css"  : "portal.home.css"
, "home.js"          : "portal.home.js"
, "portal.home.js"   : "portal.home.js"
};

/** @type {Record<string, string>} */
const HOME_STATIC_FILES = {
  ...HOME_STATIC_ALIASES
, "favicon.svg" : join(CRUSCOTTO_FRONTEND, "PortalAdmin.icona..svg")
};

const HOME_STATIC = new Set(Object.keys(HOME_STATIC_FILES));

const MIME = {
  ".html": "text/html; charset=utf-8"
, ".css" : "text/css; charset=utf-8"
, ".js"  : "text/javascript; charset=utf-8"
, ".svg" : "image/svg+xml"
};

/** @type {import("node:http").Server | null} */
let httpServer = null;

/**
 * Origine localhost — CORS permissivo solo per dev locale.
 *
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
 * Header CORS per fetch da portal.home.js su localhost.
 *
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
 * Risposta JSON con CORS e newline finale.
 *
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
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<Record<string, unknown>>}
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
      } catch (err) {
        reject(err);
      }
    });

    req.on("error", reject);
  });
}

/**
 * Serve file static HOME (admin.portal o favicon da cruscotto.frontend).
 *
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {string} rel
 */
function serveHomeAsset(req, res, rel) {
  if (!HOME_STATIC.has(rel)) {
    sendJson(res, 404, {
      error   : "non disponibile in modalità home"
    , hint    : "Avvia il cruscotto: npm run admin:dashboard"
    , mode    : "home-only"
    }, req);
    return;
  }

  const mapped = HOME_STATIC_FILES[rel] ?? rel;
  const file   = rel === "favicon.svg"
    ? mapped
    : join(ADMIN_PORTAL_DIR, mapped);
  const rootDir = rel === "favicon.svg" ? PORTAL_ROOT : ADMIN_PORTAL_DIR;

  if (!file.startsWith(rootDir) || !existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = extname(file);

  applyCors(res, req);
  res.writeHead(200, {
    "Content-Type"  : MIME[ext] ?? "application/octet-stream"
  , "Cache-Control" : "no-cache, must-revalidate"
  });
  createReadStream(file).pipe(res);
}

/**
 * Router API /api/* — istanze, progetti, open-cruscotto.
 *
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {string} urlPath
 */
async function handleApi(req, res, urlPath) {
  // 1. Health e mode — ping home-only
  if (urlPath === "/api/health" && req.method === "GET") {
    sendJson(res, 200, {
      ok   : true
    , mode : "home-only"
    , port : PORT
    }, req);
    return;
  }

  if (urlPath === "/api/portal/mode" && req.method === "GET") {
    sendJson(res, 200, { mode: "home-only" }, req);
    return;
  }

  // 2. Elenco PROJECT_* disponibili per card HOME
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

  // 3. Stato istanze persistite (multi-overlay)
  if (urlPath === "/api/portal/instances" && req.method === "GET") {
    try {
      const { instances } = await getPortalInstances();

      sendJson(res, 200, { instances }, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message }, req);
    }

    return;
  }

  // 4. Istanza corrente o per query overlay — include prepare status
  if (urlPath === "/api/portal/instance" && req.method === "GET") {
    try {
      const query     = new URL(req.url ?? "", "http://localhost").searchParams;
      const overlayQ  = query.get("overlay")?.trim() || undefined;
      const ctx         = await getPortalInstance(overlayQ);
      const prepare     = getPrepareStatus(overlayQ ?? ctx.instance?.overlay);

      sendJson(res, 200, {
        instance   : ctx.instance
          ? { ...ctx.instance, prepare: prepare ?? ctx.instance.prepare }
          : null
      , instances  : ctx.instances.map((row) => ({
          ...row
        , prepare: getPrepareStatus(row.overlay) ?? row.prepare
        }))
      , envPrjName : ctx.envPrjName
      , aligned    : ctx.aligned
      , mode       : "home-only"
      , homePort   : PORT
      }, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message }, req);
    }

    return;
  }

  // 5. Attiva overlay — patch .env e spawn portal.instance.prepare
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

  // 6. Avvia cruscotto dashboard se prepare done — spawn portal.dashboard.launch
  if (urlPath === "/api/portal/open-cruscotto" && req.method === "POST") {
    try {
      const body    = await readJsonBody(req);
      const overlay = typeof body.overlay === "string" ? body.overlay.trim() : "";

      if (!overlay) {
        sendJson(res, 400, { error: "overlay obbligatorio" }, req);
        return;
      }

      const instance = readInstanceForOverlay(overlay);

      if (!instance) {
        sendJson(res, 404, { error: `istanza non trovata per ${overlay} — esegui Istanzia` }, req);
        return;
      }

      if (instance.prepare.status !== "done") {
        sendJson(res, 409, {
          error  : `prepare non completato per ${overlay}`
        , status : instance.prepare.status
        }, req);
        return;
      }

      const port = instance.dashboardPort;
      const url  = resolveCruscottoUrl(port);

      if (await isFullDashboardUp(port)) {
        sendJson(res, 200, {
          ok             : true
        , alreadyRunning : true
        , url
        , port
        , overlay
        }, req);
        return;
      }

      spawnDashboardLauncher({
        port
      , overlay
      , productRepoPath : instance.productRepoPath
      , openPath        : "/app.html#overview"
      });

      sendJson(res, 200, {
        ok       : true
      , starting : true
      , url
      , port
      , overlay
      }, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message }, req);
    }

    return;
  }

  // 7. Apri browser su porta cruscotto già nota
  if (urlPath === "/api/portal/open-cruscotto-browser" && req.method === "POST") {
    try {
      const body    = await readJsonBody(req);
      const overlay = typeof body.overlay === "string" ? body.overlay.trim() : "";
      const instance = overlay ? readInstanceForOverlay(overlay) : null;
      const port     = instance?.dashboardPort ?? Number(body.port);

      if (!Number.isFinite(port) || port <= 0) {
        sendJson(res, 400, { error: "porta cruscotto non valida" }, req);
        return;
      }

      openSystemBrowser(resolveCruscottoUrl(port));
      sendJson(res, 200, { ok: true, port }, req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: message }, req);
    }

    return;
  }

  sendJson(res, 404, { error: "Not found", mode: "home-only" }, req);
}

/**
 * Dispatcher HTTP — API, static HOME, 404 home-only.
 *
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
async function handleRequest(req, res) {
  if (req.method === "OPTIONS") {
    applyCors(res, req);
    res.writeHead(204);
    res.end();
    return;
  }

  const urlPath = req.url?.split("?")[0] ?? "/";

  // 1. Prefisso /api/ → handleApi
  if (urlPath.startsWith("/api/")) {
    await handleApi(req, res, urlPath);
    return;
  }

  // 2. Root e home.html
  if (urlPath === "/" || urlPath === "/home.html") {
    serveHomeAsset(req, res, "home.html");
    return;
  }

  // 3. Favicon alias
  if (urlPath === "/favicon.ico") {
    serveHomeAsset(req, res, "favicon.svg");
    return;
  }

  // 4. Altri asset static whitelisted
  const rel = urlPath.replace(/^\//, "");

  if (HOME_STATIC.has(rel)) {
    serveHomeAsset(req, res, rel);
    return;
  }

  sendJson(res, 404, {
    error : "cruscotto non caricato in modalità home"
  , hint  : "npm run admin:dashboard"
  , path  : urlPath
  }, req);
}

/** SIGINT/SIGTERM — chiusura graceful httpServer. */
function shutdown(signal) {
  console.log(`\n${signal} — chiusura PortalAdmin Home…`);

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
  // 1. Crea server HTTP — delega a handleRequest con catch 500
  httpServer = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error(err instanceof Error ? err.message : err);

      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal server error" }, req);
      }
    });
  });

  // 2. Error handler — EADDRINUSE con hint PORTAL_HOME_PORT
  httpServer.on("error", (err) => {
    if (/** @type {NodeJS.ErrnoException} */ (err).code === "EADDRINUSE") {
      console.error(`Porta ${PORT} già in uso.`);
      console.error(`Prova PORTAL_HOME_PORT=3998 npm run admin:home`);
      process.exit(1);
      return;
    }

    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });

  // 3. Listen — log URL e modalità home-only
  httpServer.listen(PORT, () => {
    console.log(`PortalAdmin Home  http://localhost:${PORT}/`);
    console.log(`Static: ${ADMIN_PORTAL_DIR}/`);
    console.log("Modalità home-only — dopo istanzia: npm run admin:dashboard");
  });
}

// 4. Signal handler — chiusura su SIGINT/SIGTERM
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
