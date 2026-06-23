#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-23 21:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:05   by: IbyEll
 * modificato il: 2026-06-23 21:05   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Applica migrazioni Prisma sul SQLite cruscotto backlog (migrate deploy).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Schema Jira cache in cruscotto.database/prisma richiede entrypoint CLI idempotente.
 *
 *   A cosa serve:
 *   - Crea o aggiorna cruscotto.db con migrate deploy prima di sync o smoke CI.
 *
 * Generalizzazione:
 *   Si — path DB da PRJ_NAME e CRUSCOTTO_DB_PATH via cruscotto.db.config.mjs.
 *
 * Input:
 *   - argv --deploy-only, --help
 *   - CRUSCOTTO_DB_PATH — override path file SQLite
 *
 * Uso:
 *   - node cruscotto.database/migrate.mjs
 *   - npm run db:migrate
 *
 * Exit code:
 *   0 — migrate completato (implicito da child Prisma)
 *
 * ------------------------------------------------------------------------------------------------------------------------
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
