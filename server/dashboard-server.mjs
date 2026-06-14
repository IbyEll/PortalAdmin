#!/usr/bin/env node
/**
 * PortalAdmin — dashboard server (bootstrap stub).
 *
 * Uso: npm run admin:dashboard
 * Env: .env — DASHBOARD_PORT | ADMIN_PORT | PORT (default 3999)
 */

import "../lib/load-env.mjs";

import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SERVER_DIR    = dirname(fileURLToPath(import.meta.url));
const CRUSCOTTO_DIR = join(SERVER_DIR, "..", "cruscotto");
const PORT          = Number(
  process.env.DASHBOARD_PORT
  ?? process.env.ADMIN_PORT
  ?? process.env.PORT
  ?? 3999
);

const MIME = {
  ".html": "text/html; charset=utf-8"
, ".css" : "text/css; charset=utf-8"
, ".js"  : "application/javascript; charset=utf-8"
, ".json": "application/json; charset=utf-8"
, ".svg" : "image/svg+xml"
, ".ico" : "image/x-icon"
};

/** @type {import("node:http").Server | null} */
let httpServer = null;

function sendStatic(res, filePath) {
  const ext  = extname(filePath);
  const type = MIME[ext] ?? "application/octet-stream";

  res.writeHead(200, { "Content-Type": type });
  createReadStream(filePath).pipe(res);
}

function handleRequest(req, res) {
  const urlPath = req.url?.split("?")[0] ?? "/";
  const rel     = urlPath === "/" ? "/index.html" : urlPath;
  const file    = join(CRUSCOTTO_DIR, rel);

  if (!file.startsWith(CRUSCOTTO_DIR) || !existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  sendStatic(res, file);
}

export function startDashboardServer() {
  if (httpServer) {
    return httpServer;
  }

  httpServer = createServer(handleRequest);

  httpServer.listen(PORT, () => {
    console.log(`PortalAdmin cruscotto http://localhost:${PORT}/`);
  });

  return httpServer;
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  startDashboardServer();
}
