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
 *
 * Variabili d'ambiente:
 *   CRUSCOTTO_DB_PATH        override path file .db (via index.mjs)
 *   CRUSCOTTO_DATABASE_URL   impostata dallo script per Prisma CLI
 *
 * npm:
 *   npm run db:migrate
 *
 * Prerequisiti:
 *   npm install in cruscotto.database/ (Prisma in node_modules locale)
 */

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { prepareCruscottoDatabaseUrl, resolveCruscottoDbPath } from "./index.mjs";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const PRISMA_BIN = join(MODULE_DIR, "node_modules", "prisma", "build", "index.js");

// 1. Assicura directory db e costruisce URL datasource
const url = prepareCruscottoDatabaseUrl();

// 2. Prisma migrate deploy sullo schema in cruscotto.database/prisma
execFileSync(
  process.execPath
, [
    PRISMA_BIN
  , "migrate"
  , "deploy"
  , "--schema"
  , join(MODULE_DIR, "prisma", "schema.prisma")
  ]
, {
    cwd       : MODULE_DIR
  , encoding  : "utf8"
  , stdio     : "inherit"
  , env       : {
      ...process.env
    , CRUSCOTTO_DATABASE_URL: url
    }
  }
);

// 3. Prisma generate — client locale (PortalAdmin root non ha npm workspaces)
execFileSync(
  process.execPath
, [
    PRISMA_BIN
  , "generate"
  , "--schema"
  , join(MODULE_DIR, "prisma", "schema.prisma")
  ]
, {
    cwd       : MODULE_DIR
  , encoding  : "utf8"
  , stdio     : "inherit"
  , env       : {
      ...process.env
    , CRUSCOTTO_DATABASE_URL: url
    }
  }
);

// 4. Report path per log CI e portal-prepare
console.log(`Cruscotto DB migrato: ${url}`);
console.log(`  path: ${resolveCruscottoDbPath()}`);
