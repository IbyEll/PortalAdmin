#!/usr/bin/env node
/**
 * Applica migrazioni Prisma sul SQLite cruscotto (migrate deploy).
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - schema Jira cache in cruscotto.database/prisma richiede entrypoint CLI idempotente
 *
 *   A cosa serve:
 *   - crea/aggiorna cruscotto.db con migrate deploy prima di sync o smoke CI
 *
 * Uso:
 *   - node cruscotto.database/migrate.mjs
 *   - node cruscotto.database/migrate.mjs --deploy-only
 *
 * Flag CLI:
 *   --deploy-only — solo migrate deploy (no generate; sync con dashboard attiva)
 *   --help        — sintassi e esci 0
 *
 * Variabili d'ambiente:
 *   CRUSCOTTO_DB_PATH        override path file .db (via cruscotto.db.config.mjs)
 *   CRUSCOTTO_DATABASE_URL   impostata dallo script per Prisma CLI
 *
 * npm:
 *   npm run db:migrate
 *
 * Prerequisiti:
 *   npm install in cruscotto.database/ (Prisma in node_modules locale)
 */

import {
  runCruscottoMigrateDeploy
, runCruscottoMigrateFull
} from "./cruscotto.db.migrate.mjs";
import { resolveCruscottoDbPath } from "./cruscotto.db.config.mjs";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log("Uso: node cruscotto.database/migrate.mjs [--deploy-only]");
  process.exit(0);
}

const deployOnly = args.includes("--deploy-only");

if (deployOnly) {
  runCruscottoMigrateDeploy();
} else {
  runCruscottoMigrateFull();
}

console.log(`Cruscotto DB migrato: ${resolveCruscottoDbPath()}`);
