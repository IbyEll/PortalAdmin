#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** APPLICATION MODULE ** -- commentato il: 2026-06-18 20:15
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 20:15   by: IbyEll
 * modificato il: 2026-06-18 20:15   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                    Server HTTP API Documentation — statiche OpenAPI e GET /config.json su :4080
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - servire UI API Documentation e config runtime senza il cruscotto completo né build frontend
 *   - separare navigazione OpenAPI dev (porta 4080) dallo stack auth/api/web del product
 *
 *   A cosa serve:
 *   - GET /config.json da buildApiDocumentationConfig(PRODUCT_REPO_PATH)
 *   - file statici da cruscotto.frontend/ (index + portal.js alias companion)
 *
 * Generalizzazione:
 *   Si — servizi e label da product.manifest del repo attivo; porta da env API_DOCUMENTATION_PORT.
 *
 * Input:
 *   - PRODUCT_REPO_PATH — root monorepo product per buildApiDocumentationConfig
 *   - API_DOCUMENTATION_PORT, PORTAL_PORT — porta listener (default 4080)
 *   - req.url — path statico o /config.json
 *
 * Route o endpoint:
 *   - GET  /config.json — payload servizi OpenAPI (JSON)
 *   - GET  /* — cruscotto.api.documentation.index.html, portal.js → companion .js
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.process.start.api.documentation.mjs — spawn processo dev
 *   - admin.portal.lib/discovery.services.repo.mjs — id api-documentation nel piano Process cruscotto
 *   - cruscotto.frontend/cruscotto.api.documentation.js — fetch /config.json e spec servizi
 *
 * Dipendenze:
 *   - cruscotto.api.documentation.config.mjs — buildApiDocumentationConfig
 *   - admin.portal.lib/portal.paths.resolver.mjs — getPortalRoot, getProductRepoPath
 *
 * Variabili d'ambiente:
 *   - PRODUCT_REPO_PATH, API_DOCUMENTATION_PORT, PORTAL_PORT
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildApiDocumentationConfig } from "./cruscotto.api.documentation.config.mjs";
import { getProductRepoPath } from "../admin.portal.lib/portal.paths.resolver.mjs";

// --- path statici (sorgenti in cruscotto.frontend/, non cartella api-documentation/) ---
const SERVER_DIR   = dirname(fileURLToPath(import.meta.url));
const staticRoot   = SERVER_DIR;
const port         = Number(
  process.env.API_DOCUMENTATION_PORT
  ?? process.env.API_PORTAL_PORT
  ?? process.env.PORTAL_PORT
  ?? 4080
);

/** Alias URL → file relativo sotto staticRoot (index HTML + portal.js legacy). */
const STATIC_ALIASES = {
  "/"           : "cruscotto.api.documentation.index.html"
, "/index.html" : "cruscotto.api.documentation.index.html"
, "/portal.js"  : "cruscotto.api.documentation.js"
};

const MIME = {
  ".html": "text/html; charset=utf-8"
, ".js"  : "text/javascript; charset=utf-8"
, ".css" : "text/css; charset=utf-8"
, ".json": "application/json; charset=utf-8"
};

/**
 * @param {import("node:http").ServerResponse} res
 */
function sendConfigJson(res) {
  const productRoot = process.env.PRODUCT_REPO_PATH ?? getProductRepoPath();
  const config      = buildApiDocumentationConfig(productRoot);
  const body        = JSON.stringify(config, null, 2);

  res.writeHead(200, {
    "Content-Type"                : "application/json; charset=utf-8"
  , "Access-Control-Allow-Origin" : "*"
  });

  res.end(body);
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {string} urlPath
 */
function sendStaticFile(res, urlPath) {
  const rel  = STATIC_ALIASES[urlPath] ?? urlPath.replace(/^\//, "");
  const file = join(staticRoot, rel);

  if (!file.startsWith(staticRoot) || !existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = extname(file);

  res.writeHead(200, {
    "Content-Type"                : MIME[ext] ?? "application/octet-stream"
  , "Access-Control-Allow-Origin" : "*"
  });

  res.end(readFileSync(file));
}

// --- listener HTTP — /config.json o statiche api-documentation ---
const server = createServer((req, res) => {
  const urlPath = req.url?.split("?")[0] ?? "/";

  if (urlPath === "/config.json") {
    sendConfigJson(res);
    return;
  }

  sendStaticFile(res, urlPath);
});

server.listen(port, () => {
  const productRoot = process.env.PRODUCT_REPO_PATH ?? getProductRepoPath();

  console.log(`API Documentation  http://localhost:${port}/`);
  console.log(`Statiche:  ${staticRoot}`);
  console.log(`Product:   ${productRoot}`);
  console.log("Per indice path completo avvia prima API Auth (:4001) e API Project (:4000).");
});
