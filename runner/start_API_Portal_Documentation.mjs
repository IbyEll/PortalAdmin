#!/usr/bin/env node
/**
 * API Portal PortalAdmin — http://localhost:4080
 *
 * Statiche da PortalAdmin/api-portal.
 * Config dinamica da PRODUCT_REPO_PATH → GET /config.json
 *
 * Uso:
 *   node ellaStartScript/serve-api-portal.mjs
 */

import "../lib/load-env.mjs";

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";

import { buildApiPortalConfig } from "../lib/api-portal-config.mjs";
import { getPortalRoot } from "../lib/portal-paths.mjs";

const portalRoot = getPortalRoot();
const portalDir  = join(portalRoot, "api-portal");
const port       = Number(process.env.API_PORTAL_PORT ?? process.env.PORTAL_PORT ?? 4080);

const MIME = {
  ".html": "text/html; charset=utf-8"
, ".js"  : "text/javascript; charset=utf-8"
, ".css" : "text/css; charset=utf-8"
, ".json": "application/json; charset=utf-8"
};

const server = createServer((req, res) => {
  const urlPath = req.url?.split("?")[0] ?? "/";

  if (urlPath === "/config.json") {
    const config = buildApiPortalConfig();
    const body   = JSON.stringify(config, null, 2);

    res.writeHead(200, {
      "Content-Type"                : "application/json; charset=utf-8"
    , "Access-Control-Allow-Origin" : "*"
    , "Cache-Control"               : "no-store"
    });

    res.end(body);
    return;
  }

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
});

server.listen(port, () => {
  const config = buildApiPortalConfig();

  console.log(`API Portal (PortalAdmin)  http://localhost:${port}/`);
  console.log(`Statiche: ${portalDir}`);
  console.log(`Progetto: ${config.projectName} (${config.productRoot})`);
  console.log(`Servizi OpenAPI: ${config.services.map((svc) => svc.id).join(", ") || "—"}`);
  console.log("Richiede api/auth (o altri servizi manifest) avviati per l'indice path.");
});
