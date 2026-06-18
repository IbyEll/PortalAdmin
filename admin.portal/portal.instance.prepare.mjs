#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-18 03:59
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 03:53   by: IbyEll
 * modificato il: 2026-06-18 03:59   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                     Prepare istanza cruscotto — migrate DB PortalAdmin e stack product per overlay.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - activatePortalInstance deve preparare DB cruscotto e (se configurato) stack product prima del dashboard.
 *   - Evita duplicare migrate + start_ALL --prepare-only in portal.instance.mjs e nella UI HOME.
 *
 *   A cosa serve:
 *   - Valida PROJECT_{overlay}/project.config.*, migrate cruscotto.database, verifica test.catalog, prepare product.
 *
 * Generalizzazione:
 *   Si — overlay da --overlay o PRJ_NAME; path product da PRODUCT_REPO_PATH.
 *
 * Input:
 *   - argv --overlay — nome overlay (es. JustLastOne)
 *   - PRJ_NAME — fallback se --overlay assente
 *   - PRODUCT_REPO_PATH — root repo product da validare
 *
 * Uso:
 *   - node admin.portal/portal.instance.prepare.mjs --overlay JustLastOne
 *
 * Flag CLI:
 *   --overlay NAME — obbligatorio se PRJ_NAME assente
 *
 * Variabili d'ambiente:
 *   - PRJ_NAME, PRODUCT_REPO_PATH — impostati da portal.instance prima dello spawn
 *
 * npm (se applicabile):
 *   - Input: —
 *
 * Prerequisiti:
 *   - PROJECT_{overlay}/project.config.{overlay}.mjs
 *   - PROJECT_{overlay}/test.catalog.{overlay}.mjs
 *   - cruscotto.database/migrate.mjs
 *   - runner/cruscotto.process.start.all.services.mjs (opzionale, se runner.config overlay)
 *
 * Consumatori:
 *   - lib/portal.instance.mjs — spawn dopo activatePortalInstance
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import "../lib/portal.load.env.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Overlay da --overlay argv o fallback PRJ_NAME env.
 *
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

// 1. Parse overlay — argv o env obbligatorio
const overlay = parseOverlay(process.argv.slice(2));

if (!overlay) {
  console.error("portal.instance.prepare — --overlay o PRJ_NAME obbligatorio");
  process.exit(1);
}

// 2. Valida project.config overlay
const configPath = join(PORTAL_ROOT, `PROJECT_${overlay}`, `project.config.${overlay}.mjs`);

if (!existsSync(configPath)) {
  console.error(`Config assente: ${configPath}`);
  process.exit(1);
}

const { PROJECT_CONFIG_VALUES } = await import(
  new URL(`../PROJECT_${overlay}/project.config.${overlay}.mjs`, import.meta.url).href
);

// 3. Valida PRODUCT_REPO_PATH
const productRoot = process.env.PRODUCT_REPO_PATH?.trim();

if (!productRoot || !existsSync(productRoot)) {
  console.error(`PRODUCT_REPO_PATH non valido: ${productRoot ?? "(vuoto)"}`);
  process.exit(1);
}

console.log(`[portal-prepare] overlay=${overlay} product=${PROJECT_CONFIG_VALUES.PRJ_NAME}`);
console.log(`[portal-prepare] repo=${productRoot}`);

// 4. Migrate cruscotto DB PortalAdmin (schema SQLite locale)
console.log("[portal-prepare] migrate cruscotto DB…");

const { spawnSync } = await import("node:child_process");
const migrateScript = join(PORTAL_ROOT, "cruscotto.database", "migrate.mjs");

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

// 5. Catalogo test overlay (opzionale — policy blocked/excluded; discovery in lib/test.catalog.mjs)
const catalogPath = join(
  PORTAL_ROOT
, `PROJECT_${overlay}`
, `test.catalog.${overlay}.mjs`
);

if (existsSync(catalogPath)) {
  console.log(`[portal-prepare] catalogo OK — ${catalogPath}`);
} else {
  console.log(`[portal-prepare] catalogo overlay assente (policy default vuota) — ${catalogPath}`);
}

// 6. Prepare product stack (opzionale — solo se runner.config overlay)
const runnerConfig = join(PORTAL_ROOT, `PROJECT_${overlay}`, `runner.config.${overlay}.mjs`);

if (existsSync(runnerConfig)) {
  console.log("[portal-prepare] prepare product stack (--prepare-only --no-db)…");

  const startAll = join(PORTAL_ROOT, "cruscotto.frontend", "cruscotto.process.start.all.services.mjs");

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
