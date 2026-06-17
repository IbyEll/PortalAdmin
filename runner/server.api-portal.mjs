#!/usr/bin/env node
/**
 * Serve API Portal su http://localhost:4080
 *
 * Statiche: PortalAdmin/api-portal/
 * Config:   GET /config.json da PRODUCT_REPO_PATH (dev-manifest → api + auth)
 *
 * Uso:
 *   node runner/serve-api-portal.mjs
 *
 * Env:
 *   PRODUCT_REPO_PATH  — monorepo JustLastOne
 *   API_PORTAL_PORT    — porta (default 4080)
 */

import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";

import { buildApiPortalConfig } from "../lib/admin/config_api-portal.mjs";
import { getProductRepoPath, getPortalRoot } from "../lib/portal.paths.resolver.mjs";

const portalRoot = getPortalRoot();
const portalDir  = join(portalRoot, "api-portal");
const port       = Number(process.env.API_PORTAL_PORT ?? process.env.PORTAL_PORT ?? 4080);

const MIME = {
  ".html": "text/html; charset=utf-8"
, ".js"  : "text/javascript; charset=utf-8"
, ".css" : "text/css; charset=utf-8"
, ".json": "application/json; charset=utf-8"
};

/**
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 */
function sendConfigJson(res) {
  const productRoot = process.env.PRODUCT_REPO_PATH ?? getProductRepoPath();
  const config      = buildApiPortalConfig(productRoot);
  const body        = JSON.stringify(config, null, 2);

  res.writeHead(200, {
    "Content-Type"                : "application/json; charset=utf-8"
  , "Access-Control-Allow-Origin" : "*"
  });

  res.end(body);
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {string} urlPath
 */
function sendStaticFile(res, urlPath) {
  const rel  = urlPath === "/" ? "index.html" : urlPath.replace(/^\//, "");
  const file = join(portalDir, rel);

  if (!file.startsWith(portalDir) || !existsSync(file)) {
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

  console.log(`API Portal  http://localhost:${port}/`);
  console.log(`Statiche:  ${portalDir}`);
  console.log(`Product:   ${productRoot}`);
  console.log("Richiede auth :4001 e api :4000 per l'indice path completo.");
});
