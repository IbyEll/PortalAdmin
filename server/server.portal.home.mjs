#!/usr/bin/env node
/**
 * PortalAdmin Home server — solo pagina HOME e API istanzia progetto.
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - avvio leggero senza caricare cruscotto, test.catalog, Jira backlog, run-manager
 *
 *   A cosa serve:
 *   - servire home.html e API portal/instance per scegliere e preparare un overlay
 *   - dopo istanziazione l'utente avvia il cruscotto con npm run admin:dashboard
 *
 * Uso:
 *   node server/portal-home-server.mjs
 *   npm run admin:home
 *
 * Route:
 *   GET  / — home.html
 *   GET  /api/portal/projects, /api/portal/instance
 *   POST /api/portal/instance
 *   POST /api/portal/open-cruscotto — avvia admin:dashboard e apre /app.html
 *   GET  /api/health — ping
 *
 * Env: PORTAL_HOME_PORT (default 3990 — separata dai cruscotti progetto)
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
} from "../lib/admin/portal.instance.mjs";
import {
  isFullDashboardUp
, openSystemBrowser
, resolveCruscottoUrl
, spawnDashboardLauncher
} from "../lib/admin/portal.launch.dashboard.mjs";

const SERVER_DIR    = dirname(fileURLToPath(import.meta.url));
const CRUSCOTTO_DIR = join(SERVER_DIR, "..", "cruscotto");
const PORT          = Number(
  process.env.PORTAL_HOME_PORT
  ?? 3990
);

/** Asset statici ammessi in modalità home-only. */
const HOME_STATIC = new Set([
  "home.html"
, "home.css"
, "home.js"
, "favicon.svg"
]);

const MIME = {
  ".html": "text/html; charset=utf-8"
, ".css" : "text/css; charset=utf-8"
, ".js"  : "text/javascript; charset=utf-8"
, ".svg" : "image/svg+xml"
};

/** @type {import("node:http").Server | null} */
let httpServer = null;

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

  const file = join(CRUSCOTTO_DIR, rel);

  if (!file.startsWith(CRUSCOTTO_DIR) || !existsSync(file)) {
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
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {string} urlPath
 */
async function handleApi(req, res, urlPath) {
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

  if (urlPath.startsWith("/api/")) {
    await handleApi(req, res, urlPath);
    return;
  }

  if (urlPath === "/" || urlPath === "/home.html") {
    serveHomeAsset(req, res, "home.html");
    return;
  }

  if (urlPath === "/favicon.ico") {
    serveHomeAsset(req, res, "favicon.svg");
    return;
  }

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
  httpServer = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error(err instanceof Error ? err.message : err);

      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal server error" }, req);
      }
    });
  });

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

  httpServer.listen(PORT, () => {
    console.log(`PortalAdmin Home  http://localhost:${PORT}/`);
    console.log("Modalità home-only — dopo istanzia: npm run admin:dashboard (stessa porta)");
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
