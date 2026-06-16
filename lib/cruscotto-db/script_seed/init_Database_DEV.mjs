#!/usr/bin/env node
/**
 * Database dev JustLastOne — SQLite Prisma nel product repo (schema, reset, seed).
 *
 * Uso:
 *   node lib/cruscotto-db/script_seed/init_Database_DEV.mjs --help
 *   node lib/cruscotto-db/script_seed/init_Database_DEV.mjs --push
 *   node lib/cruscotto-db/script_seed/init_Database_DEV.mjs --reset
 *   node lib/cruscotto-db/script_seed/init_Database_DEV.mjs --seed
 *   node lib/cruscotto-db/script_seed/init_Database_DEV.mjs --reset --seed
 *
 * Operazioni (almeno un flag esplicito, salvo --help):
 *   --push, --db-push     db:push — allinea schema (crea JLO_DEV.db se assente)
 *   --reset, --db-reset   elimina JLO_DEV.db (+ journal/wal/shm) e ricrea schema
 *   --seed, --db-seed     npm run db:seed (host@ / player@)
 *   --reset --seed        delete & create + inizializza righe (Utility cruscotto)
 *
 * Alias: --db-reset, --db-seed, --db-push, --db-force
 *
 * Variabili d'ambiente:
 *   PRODUCT_REPO_PATH   root monorepo JustLastOne (default sibling ../JustLastOne)
 *   DATABASE_URL        in packages/database/.env — path file SQLite dev
 *
 * npm:
 *   npm run dev:db
 *
 * Wrapper:
 *   init_Database_DEV.ps1 / init_Database_DEV.sh — delegano a questo script
 */

import { ensureNodeModules, ensureProductEnvFiles } from "../../../runner/runner.stack.mjs";

import {
  parseDbDevArgs
, portalRoot
, printDbDevHelp
, root
, runDatabasePhase
, syncDatabase
} from "./script_seed-lib.mjs";

const opts = parseDbDevArgs(process.argv.slice(2));

// 1. Help — esci subito senza toccare il database
if (opts.help) {
  printDbDevHelp();
  process.exit(0);
}

console.log("Ella — database JustLastOne (SQLite / Prisma)");
console.log(`Product: ${root}`);
console.log(`Portal:  ${portalRoot}`);

// 2. Prerequisiti product repo — npm install e .env da .env.example se mancanti
ensureNodeModules();
ensureProductEnvFiles();

// 3. Solo push esplicito (--push) — allinea schema senza reset/seed
if (opts.pushOnly) {
  syncDatabase();
  process.exit(0);
}

// 4. Nessun flag operativo — non eseguire db:push/reset/seed impliciti
if (!opts.reset && !opts.seed) {
  console.log("\nNessuna operazione DB richiesta. Usa --push, --reset e/o --seed (vedi --help).\n");
  process.exit(0);
}

// 5. Reset e/o seed Prisma (logica in lib.mjs → runDatabasePhase)
runDatabasePhase({
  dbReset : opts.reset
, dbSeed  : opts.seed
});
