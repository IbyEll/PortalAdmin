#!/usr/bin/env node
/**
 * start_API_Auth — avvio API Auth NestJS (JustLastOne)
 *
 * Servizio: @justlastone/auth · apps/authentication
 * Porta:    http://localhost:4001
 * Swagger:  http://localhost:4001/api/v1/docs
 * Health:   http://localhost:4001/api/v1/health
 *
 * Uso:
 *   node ellaStartScript/start_API_Auth.mjs
 *   node ellaStartScript/start_API_Auth.mjs --cleanup
 *   node ellaStartScript/start_API_Auth.mjs --no-build
 *   node ellaStartScript/start_API_Auth.mjs --help
 *
 * Env:
 *   PRODUCT_REPO_PATH — root monorepo JustLastOne (default da PortalAdmin)
 *
 * Database:
 *   Allinea schema con node ellaStartScript/db-dev.mjs --push se dev.db manca
 */

import {
  NEST_API_DEV
, maybeCleanBuildArtifacts
, parseApiStartArgs
, portalRoot
, prepareProductRepoForNestApi
, root
, runNestApiWorkspaceDev
} from "../ellaStartScript/lib.mjs";

const cfg        = NEST_API_DEV.auth;
const opts       = parseApiStartArgs(process.argv.slice(2));
const totalSteps = opts.cleanup ? 4 : 3;
let step         = 0;

if (opts.help) {
  console.log(`Uso: node ellaStartScript/start_API_Auth.mjs [opzioni]

Avvia solo l'API Auth (NestJS) su :4001.

Opzioni:
  --cleanup     rimuove artefatti compilati prima del prepare (default: no)
  --no-build    salta npm install, .env e build workspace (avvio rapido)
  --help, -h    questo messaggio

Equivalente:
  npm run dev -w @justlastone/auth   (dalla root product, dopo prepare)
`);
  process.exit(0);
}

console.log("start_API_Auth — API Auth JustLastOne");
console.log(`Product: ${root}`);
console.log(`Portal:  ${portalRoot}`);
console.log(`Target:  ${cfg.workspace} → :${cfg.port}`);

if (opts.cleanup) {
  step += 1;
  console.log(`\n[${step}/${totalSteps}] Cleanup artefatti compilati…`);
  maybeCleanBuildArtifacts(true);
}

if (!opts.noBuild) {
  step += 1;
  console.log(`\n[${step}/${totalSteps}] Prepare product repo (npm, .env, build workspace)…`);
  prepareProductRepoForNestApi();
} else {
  step += 1;
  console.log(`\n[${step}/${totalSteps}] Prepare saltato (--no-build)`);
}

step += 1;
console.log(`\n[${step}/${totalSteps}] Endpoint attesi dopo l'avvio:`);
console.log(`       Health  ${cfg.healthUrl}`);
console.log(`       Swagger ${cfg.docsUrl}`);

step += 1;
console.log(`\n[${step}/${totalSteps}] Avvio nest dev (Ctrl+C per terminare)…\n`);
runNestApiWorkspaceDev(cfg.workspace, `${cfg.label} — :${cfg.port}`);
