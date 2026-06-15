#!/usr/bin/env node
/**
 * Apply cruscotto DB migrations (Prisma migrate deploy).
 *
 * Uso: node lib/cruscotto-db/migrate.mjs
 */

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { prepareCruscottoDatabaseUrl, resolveCruscottoDbPath } from "./index.mjs";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const PRISMA_BIN = join(MODULE_DIR, "node_modules", "prisma", "build", "index.js");

const url = prepareCruscottoDatabaseUrl();

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

console.log(`Cruscotto DB migrato: ${url}`);
console.log(`  path: ${resolveCruscottoDbPath()}`);
