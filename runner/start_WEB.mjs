#!/usr/bin/env node
/**
 * start_WEB — avvio frontend Next.js (JustLastOne)
 *
 * Servizio: @justlastone/web · apps/web
 * Porta:    http://localhost:3000
 * UI:       http://localhost:3000/it
 *
 * Uso:
 *   node ellaStartScript/start_WEB.mjs
 *   node ellaStartScript/start_WEB.mjs --cleanup
 *   node ellaStartScript/start_WEB.mjs --no-build
 *   node ellaStartScript/start_WEB.mjs --help
 *
 * Env:
 *   PRODUCT_REPO_PATH — root monorepo JustLastOne (default da PortalAdmin)
 */

import {
  WEB_DEV
, maybeCleanBuildArtifacts
, parseApiStartArgs
, portalRoot
, prepareProductRepoForWebDev
, root
, runWebWorkspaceDev
} from "../ellaStartScript/lib.mjs";

const cfg        = WEB_DEV;
const opts       = parseApiStartArgs(process.argv.slice(2));
const totalSteps = opts.cleanup ? 4 : 3;
let step         = 0;

if (opts.help) {
  console.log(`Uso: node ellaStartScript/start_WEB.mjs [opzioni]

Avvia solo la web (Next.js) su :3000.

Opzioni:
  --cleanup     rimuove artefatti compilati prima del prepare (default: no)
  --no-build    salta npm install, .env e build shared/i18n (avvio rapido)
  --help, -h    questo messaggio

Equivalente:
  npm run dev -w @justlastone/web   (dalla root product, dopo prepare)
`);
  process.exit(0);
}

console.log("start_WEB — Web JustLastOne");
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
  console.log(`\n[${step}/${totalSteps}] Prepare product repo (npm, .env, build shared/i18n)…`);
  prepareProductRepoForWebDev();
} else {
  step += 1;
  console.log(`\n[${step}/${totalSteps}] Prepare saltato (--no-build)`);
}

step += 1;
console.log(`\n[${step}/${totalSteps}] Endpoint attesi dopo l'avvio:`);
console.log(`       UI      ${cfg.openUrl}`);

step += 1;
console.log(`\n[${step}/${totalSteps}] Avvio next dev (Ctrl+C per terminare)…\n`);
runWebWorkspaceDev(`${cfg.label} — :${cfg.port}`);
