#!/usr/bin/env node
/**
 * start_API_Portal — avvio API Portal (PortalAdmin)
 *
 * Server:   runner/serve-api-portal.mjs
 * Statiche: PortalAdmin/api-portal/
 * Config:   GET /config.json da PRODUCT_REPO_PATH (product.manifest → api + auth)
 * Porta:    http://localhost:4080
 *
 * Uso:
 *   node cruscotto.frontend/cruscotto.process.start.api.portal.mjs
 *   node cruscotto.frontend/cruscotto.process.start.api.portal.mjs --help
 *
 * Env:
 *   PRODUCT_REPO_PATH  — monorepo JustLastOne (servizi OpenAPI in config)
 *   API_PORTAL_PORT    — porta (default 4080)
 *
 * Prerequisito:
 *   Per l'indice path completo, avvia prima API Auth (:4001) e API Project (:4000).
 */

import { spawn } from "node:child_process";
import { join } from "node:path";

import { buildApiPortalConfig } from "./cruscotto.api.documentation.config.mjs";
import { portalRoot, root } from "../cruscotto.database/product.database.seed.run.mjs";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Uso: node cruscotto.frontend/cruscotto.process.start.api.portal.mjs

Avvia il portale statico OpenAPI su :4080 (PortalAdmin).

Il portale legge i servizi dal product.manifest del product repo; non avvia api/auth.

Equivalente:
  node runner/serve-api-portal.mjs
  npm run dev:api-portal
`);
  process.exit(0);
}

const port       = Number(process.env.API_PORTAL_PORT ?? process.env.PORTAL_PORT ?? 4080);
const scriptPath = join(portalRoot, "runner", "serve-api-portal.mjs");

console.log("start_API_Portal — navigazione OpenAPI centralizzata");
console.log(`Portal:  ${portalRoot}`);
console.log(`Product: ${root}`);
console.log(`Porta:   ${port}`);

console.log("\n[1/3] Config OpenAPI (da PRODUCT_REPO_PATH)…");
const config = buildApiPortalConfig(root);
const ids    = config.services.map((svc) => svc.id).join(", ") || "—";
console.log(`       Progetto: ${config.projectName}`);
console.log(`       Servizi:  ${ids}`);

console.log("\n[2/3] Server e statiche:");
console.log(`       Script:   ${scriptPath}`);
console.log(`       Statiche: ${join(portalRoot, "api-portal")}`);
console.log(`       URL:      http://localhost:${port}/`);

console.log("\n[3/3] Avvio server API Portal (Ctrl+C per terminare)…\n");

const child = spawn(process.execPath, [scriptPath], {
  cwd   : portalRoot
, stdio : "inherit"
, env   : {
    ...process.env
  , PRODUCT_REPO_PATH : process.env.PRODUCT_REPO_PATH ?? root
  }
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
