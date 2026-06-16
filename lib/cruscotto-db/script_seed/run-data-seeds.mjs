#!/usr/bin/env node
/**
 * Esegue script di alimentazione dati nel product repo (config da config_project).
 *
 * Uso:
 *   node lib/cruscotto-db/script_seed/run-data-seeds.mjs --help
 *   node lib/cruscotto-db/script_seed/run-data-seeds.mjs --seed db
 *   node lib/cruscotto-db/script_seed/run-data-seeds.mjs --seed func --wait-auth
 *   node lib/cruscotto-db/script_seed/run-data-seeds.mjs --seed db,func --wait-auth 180
 *
 * Seed (--seed) — catalogo da config_project.{Progetto}.mjs:
 *   db    PRJ_SEED + PRJ_DB_NPM_WORKSPACE (Prisma seed)
 *   func  PRJ_SEED_FUNC (script Node nel product repo, richiede stack)
 *
 * Variabili d'ambiente:
 *   PRODUCT_REPO_PATH      override path checkout (default ../PRJ_REPO)
 *   AUTH_HEALTH_URL        override PRJ_AUTH_HEALTH_URL
 *   API_HEALTH_URL         override PRJ_API_HEALTH_URL
 *
 * npm:
 *   npm run dev:seed-data -- --seed db
 *   npm run dev:seed-data -- --seed func --wait-auth
 */

import { existsSync } from "node:fs";

import { getProjectConfig, resolveProductFuncSeedPath, resolveProductSeedPath } from "../../config.project.mjs";

import {
  getAvailableSeedIds
, parseSeedIds
, printDataSeedsHelp
, root
, runDataSeeds
, seedIdsNeedStack
, waitForDevStack
} from "./script_seed-lib.mjs";

const project = getProjectConfig();
const args    = process.argv.slice(2);

// 1. Help — esci subito senza eseguire seed
if (args.includes("--help") || args.includes("-h")) {
  printDataSeedsHelp();
  process.exit(0);
}

console.log(`run-data-seeds — ${project.PRJ_NAME}`);
console.log(`Product: ${root}`);

// 2. Parse --seed — almeno un id dal catalogo config_project
const seedIds   = parseSeedIds(args);
const available = getAvailableSeedIds();

if (seedIds.length === 0) {
  console.error(`Specifica almeno uno script: --seed ${available.join(" | ")}`);
  printDataSeedsHelp();
  process.exit(1);
}

// 3. Verifica path script seed nel product repo prima dell'esecuzione
if (seedIds.includes("db") && !existsSync(resolveProductSeedPath(root))) {
  console.error(`Script Prisma seed assente: ${project.PRJ_SEED}`);
  process.exit(1);
}

if (seedIds.includes("func") && !existsSync(resolveProductFuncSeedPath(root))) {
  console.error(`Script seed funzionale assente: ${project.PRJ_SEED_FUNC}`);
  process.exit(1);
}

// 4. --wait-auth [ms] — obbligatorio implicito se seed func senza flag esplicito
const waitIdx = args.findIndex((arg) => arg === "--wait-auth");

let waitAuthMs = 0;

if (waitIdx !== -1) {
  const raw = args[waitIdx + 1];
  waitAuthMs = raw && !raw.startsWith("-") ? Number(raw) : 120_000;
} else if (seedIdsNeedStack(seedIds)) {
  waitAuthMs = 120_000;
  console.log(
    `\n=== Seed func richiede stack — attesa auth/api (${project.PRJ_AUTH_HEALTH_URL}) ===\n`
  );
}

// 5. Poll stack dev se richiesto o necessario per PRJ_SEED_FUNC
if (waitAuthMs > 0) {
  await waitForDevStack({ timeoutMs: waitAuthMs });
}

// 6. Esegue seed in sequenza (db → func, ordine CLI)
await runDataSeeds(seedIds);
