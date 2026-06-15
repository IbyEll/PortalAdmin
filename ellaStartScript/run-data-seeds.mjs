#!/usr/bin/env node
/**
 * Esegue script di alimentazione dati (dopo db:push / con stack avviato se richiesto).
 *
 * Uso:
 *   node ellaStartScript/run-data-seeds.mjs --seed db
 *   node ellaStartScript/run-data-seeds.mjs --seed func
 *   node ellaStartScript/run-data-seeds.mjs --seed db,func
 *   node ellaStartScript/run-data-seeds.mjs --seed func --wait-auth 180
 *
 * Variabili:
 *   AUTH_URL   default http://localhost:4001/api/v1
 *   API_URL    default http://localhost:4000/api/v1
 */

import {
  parseSeedIds
, printDataSeedsHelp
, runDataSeeds
, waitForDevStack
} from "./lib.mjs";

const args = process.argv.slice(2);

// 1. Help — esci subito senza eseguire seed
if (args.includes("--help") || args.includes("-h")) {
  printDataSeedsHelp();
  process.exit(0);
}

// 2. Parse --seed (db, func, …) — almeno uno obbligatorio
const seedIds = parseSeedIds(args);

if (seedIds.length === 0) {
  console.error("Specifica almeno uno script: --seed db | func | db,func");
  printDataSeedsHelp();
  process.exit(1);
}

// 3. Opzionale: --wait-auth [ms] — attende auth/api prima dei seed funzionali
const waitIdx = args.findIndex((arg) => arg === "--wait-auth");

let waitAuthMs = 0;

if (waitIdx !== -1) {
  const raw = args[waitIdx + 1];
  waitAuthMs = raw && !raw.startsWith("-") ? Number(raw) : 120_000;
}

// 4. Poll stack dev se richiesto (es. seed func dopo avvio manuale)
if (waitAuthMs > 0) {
  await waitForDevStack({ timeoutMs: waitAuthMs });
}

// 5. Esegue gli script di alimentazione dati nel product repo
await runDataSeeds(seedIds);
