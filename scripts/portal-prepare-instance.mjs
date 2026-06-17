#!/usr/bin/env node
/**
 * Prepare istanza cruscotto per overlay PROJECT_{PRJ_NAME}.
 *
 * Uso:
 *   node scripts/portal-prepare-instance.mjs --overlay JustLastOne
 *
 * Env: PRJ_NAME, PRODUCT_REPO_PATH (impostati da portal.instance)
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import "../lib/portal.load.env.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {string[]} argv
 * @returns {string | null}
 */
function parseOverlay(argv) {
  const idx = argv.indexOf("--overlay");

  if (idx >= 0 && argv[idx + 1]) {
    return argv[idx + 1].trim();
  }

  return process.env.PRJ_NAME?.trim() || null;
}

const overlay = parseOverlay(process.argv.slice(2));

if (!overlay) {
  console.error("portal-prepare-instance — --overlay o PRJ_NAME obbligatorio");
  process.exit(1);
}

const configPath = join(PORTAL_ROOT, `PROJECT_${overlay}`, `config.project.${overlay}.mjs`);

if (!existsSync(configPath)) {
  console.error(`Config assente: ${configPath}`);
  process.exit(1);
}

const { PROJECT_CONFIG_VALUES } = await import(
  new URL(`../PROJECT_${overlay}/config.project.${overlay}.mjs`, import.meta.url).href
);

const productRoot = process.env.PRODUCT_REPO_PATH?.trim();

if (!productRoot || !existsSync(productRoot)) {
  console.error(`PRODUCT_REPO_PATH non valido: ${productRoot ?? "(vuoto)"}`);
  process.exit(1);
}

console.log(`[portal-prepare] overlay=${overlay} product=${PROJECT_CONFIG_VALUES.PRJ_NAME}`);
console.log(`[portal-prepare] repo=${productRoot}`);

// 1. Cruscotto DB PortalAdmin (schema SQLite locale)
console.log("[portal-prepare] migrate cruscotto DB…");

const { spawnSync } = await import("node:child_process");
const migrateScript = join(PORTAL_ROOT, "lib", "cruscotto-db", "migrate.mjs");

if (existsSync(migrateScript)) {
  const migrateRes = spawnSync(process.execPath, [migrateScript], {
    cwd   : PORTAL_ROOT
  , env   : {
      ...process.env
    , PRJ_NAME          : overlay
    , PRODUCT_REPO_PATH : productRoot
    }
  , stdio : "inherit"
  });

  if (migrateRes.status !== 0) {
    console.error(`[portal-prepare] migrate exit ${migrateRes.status}`);
    process.exit(migrateRes.status ?? 1);
  }
}

// 2. Verifica overlay minimo per dashboard
const catalogPath = join(
  PORTAL_ROOT
, `PROJECT_${overlay}`
, `test.catalog.${overlay}.mjs`
);

if (!existsSync(catalogPath)) {
  console.error(`Catalogo test assente: ${catalogPath}`);
  process.exit(1);
}

console.log(`[portal-prepare] catalogo OK — ${catalogPath}`);

// 3. Prepare product (solo se runner.config overlay presente)
const runnerConfig = join(PORTAL_ROOT, `PROJECT_${overlay}`, `runner.config.${overlay}.mjs`);

if (existsSync(runnerConfig)) {
  console.log("[portal-prepare] prepare product stack (--prepare-only --no-db)…");

  const startAll = join(PORTAL_ROOT, "runner", "process.start.all.services.mjs");

  if (existsSync(startAll)) {
    const res = spawnSync(
      process.execPath
    , [startAll, "--prepare-only", "--no-db"]
    , {
        cwd   : PORTAL_ROOT
      , env   : {
          ...process.env
        , PRJ_NAME          : overlay
        , PRODUCT_REPO_PATH : productRoot
        }
      , stdio : "inherit"
      }
    );

    if (res.status !== 0) {
      console.error(`[portal-prepare] prepare product exit ${res.status}`);
      process.exit(res.status ?? 1);
    }
  } else {
    console.log("[portal-prepare] skip product prepare — start_ALL non trovato");
  }
} else {
  console.log("[portal-prepare] skip product prepare — runner.config assente");
}

console.log("[portal-prepare] completato");
