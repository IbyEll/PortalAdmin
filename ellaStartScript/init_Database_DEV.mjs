#!/usr/bin/env node
/**
 * Database dev JustLastOne — SQLite Prisma (product repo).
 *
 * Uso:
 *   node ellaStartScript/init_Database_DEV.mjs
 *   node ellaStartScript/init_Database_DEV.mjs --help
 *
 * Operazioni:
 *   (default)        nessuna operazione — usa --push, --reset e/o --seed
 *   --push           db:push — allinea schema (crea dev.db se assente)
 *   --reset          elimina dev.db (+ journal/wal/shm) e ricrea schema
 *   --seed           npm run db:seed (host@ / player@)
 *   --reset --seed   delete & create + inizializza righe
 *
 * Alias: --db-reset, --db-seed, --db-push, --db-force
 */

import {
  ensureEnvFiles
, ensureNodeModules
, parseDbDevArgs
, portalRoot
, printDbDevHelp
, root
, runDatabasePhase
, syncDatabase
} from "./lib.mjs";

const opts = parseDbDevArgs(process.argv.slice(2));

// 1. Help — esci senza toccare il database
if (opts.help) {
  printDbDevHelp();
  process.exit(0);
}

console.log("Ella — database JustLastOne (SQLite / Prisma)");
console.log(`Product: ${root}`);
console.log(`Portal:  ${portalRoot}`);

// 2. Dipendenze npm e file .env (packages/database)
ensureNodeModules();
ensureEnvFiles();

// 3. Solo push esplicito (--push) senza reset/seed
if (opts.pushOnly) {
  syncDatabase();
  process.exit(0);
}

// 4. Reset e/o seed — senza flag espliciti non si tocca il database
if (!opts.reset && !opts.seed) {
  console.log("\nNessuna operazione DB richiesta. Usa --push, --reset e/o --seed (vedi --help).\n");
  process.exit(0);
}

runDatabasePhase({
  dbReset : opts.reset
, dbSeed  : opts.seed
});
