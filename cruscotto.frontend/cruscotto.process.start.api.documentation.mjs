#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-18 21:00
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 21:00   by: IbyEll
 * modificato il: 2026-06-18 21:00   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *           Avvio API Documentation — spawn server OpenAPI PortalAdmin su :4080 (config da manifest)
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - la tab Process e discovery avviano api-documentation senza duplicare spawn nel cruscotto
 *   - separa avvio UI OpenAPI (:4080) dallo stack Nest auth/api/web del product
 *
 *   A cosa serve:
 *   - anteprima buildApiDocumentationConfig(PRODUCT_REPO_PATH) in console
 *   - spawn detached di cruscotto.api.documentation.server.mjs con env product allineato
 *
 * Generalizzazione:
 *   Si — servizi e label da product.manifest del repo attivo; porta da env API_DOCUMENTATION_PORT.
 *
 * Input:
 *   - PRODUCT_REPO_PATH — root monorepo product (default root da cruscotto.runner.stack)
 *   - API_DOCUMENTATION_PORT, PORTAL_PORT — porta listener (default 4080)
 *   - argv --help, -h — riepilogo ed exit 0
 *
 * Uso:
 *   - node cruscotto.frontend/cruscotto.process.start.api.documentation.mjs
 *   - node cruscotto.frontend/cruscotto.process.start.api.documentation.mjs --help
 *
 * Flag CLI:
 *   --help, -h     riepilogo ed exit 0
 *
 * Variabili d'ambiente:
 *   PRODUCT_REPO_PATH       — checkout product per /config.json
 *   API_DOCUMENTATION_PORT  — porta HTTP API Documentation (default 4080)
 *   PORTAL_PORT             — fallback porta se API_DOCUMENTATION_PORT assente
 *
 * npm (se applicabile):
 *   - npm run dev:api-documentation — alias discovery (cruscotto.process.start.service portal)
 *
 * Prerequisiti:
 *   - Per indice path completo: API Auth (:4001) e API Project (:4000) devono essere in ascolto
 *
 * Consumatori:
 *   - admin.portal.lib/discovery.services.repo.mjs — discoverPortalApiPortal, id api-documentation
 *   - PROJECT_AdminDashBoard/discovery.config.AdminDashBoard.mjs — apiDocumentationRunnerRel
 *   - cruscotto.frontend/cruscotto.process.start.api.documentation.ps1 — wrapper PowerShell
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { spawn } from "node:child_process";
import { join } from "node:path";

import { buildApiDocumentationConfig } from "./cruscotto.api.documentation.config.mjs";
import { portalRoot, root } from "../cruscotto.database/product.database.seed.run.mjs";

const args = process.argv.slice(2);

// 1. Help — esci subito senza spawn server
if (args.includes("--help") || args.includes("-h")) {
  console.log(`Uso: node cruscotto.frontend/cruscotto.process.start.api.documentation.mjs

Avvia il portale statico OpenAPI su :4080 (PortalAdmin).

Il portale legge i servizi dal product.manifest del product repo; non avvia api/auth.

Equivalente:
  node cruscotto.frontend/cruscotto.api.documentation.server.mjs
  npm run dev:api-documentation
`);
  process.exit(0);
}

// 2. Porta e path assoluto server HTTP API Documentation
const port       = Number(process.env.API_DOCUMENTATION_PORT ?? process.env.PORTAL_PORT ?? 4080);
const scriptPath = join(portalRoot, "cruscotto.frontend", "cruscotto.api.documentation.server.mjs");

console.log("cruscotto.process.start.api.documentation — navigazione OpenAPI centralizzata");
console.log(`Portal:  ${portalRoot}`);
console.log(`Product: ${root}`);
console.log(`Porta:   ${port}`);

// 3. Anteprima config OpenAPI da product.manifest
console.log("\n[1/3] Config OpenAPI (da PRODUCT_REPO_PATH)…");
const config = buildApiDocumentationConfig(root);
const ids    = config.services.map((svc) => svc.id).join(", ") || "—";
console.log(`       Progetto: ${config.projectName}`);
console.log(`       Servizi:  ${ids}`);

console.log("\n[2/3] Server e statiche:");
console.log(`       Script:   ${scriptPath}`);
console.log(`       Statiche: ${join(portalRoot, "cruscotto.frontend")} (index + portal.js)`);
console.log(`       URL:      http://localhost:${port}/`);

console.log("\n[3/3] Avvio server API Documentation (Ctrl+C per terminare)…\n");

// 4. Spawn server — output inoltrato al parent (console Process cruscotto, no finestra Node)
const child = spawn(process.execPath, [scriptPath], {
  cwd         : portalRoot
, stdio       : ["ignore", "pipe", "pipe"]
, windowsHide : process.platform === "win32"
, env         : {
    ...process.env
  , PRODUCT_REPO_PATH      : process.env.PRODUCT_REPO_PATH ?? root
  , API_DOCUMENTATION_PORT : String(port)
  , API_PORTAL_PORT        : String(port)
  }
});

child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
child.stderr?.on("data", (chunk) => process.stderr.write(chunk));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
