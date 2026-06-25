#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TESTSCRIPT ** -- commentato il: 2026-06-23 21:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:05   by: IbyEll
 * modificato il: 2026-06-23 21:05   by: IbyEll
 * ticket refirement: ADMIN-95 smoke CI aggregate
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Smoke CI — orchestrazione sequenziale smoke PortalAdmin (paths, config, workflow).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - CI e pre-merge richiedono un unico entrypoint che esegua tutti gli smoke host in ordine.
 *
 *   A cosa serve:
 *   - Spawn sequenziale degli script smoke; fallisce al primo step con exit code diverso da 0.
 *
 * Generalizzazione:
 *   Si — PRODUCT_REPO_PATH validato prima degli step; env propagata ai child.
 *
 * Input:
 *   - PRODUCT_REPO_PATH — product repo deve esistere prima degli step
 *   - elenco STEPS — path relativi script smoke sotto PortalAdmin
 *
 * Uso:
 *   - node test.smoke/smoke-ci.mjs
 *
 * Exit code:
 *   0 — tutti gli step passati
 *   1 — PRODUCT_REPO_PATH invalido o step fallito
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveProductRepoPath } from "../admin.portal.lib/portal.paths.resolver.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const STEPS = [
  "test.smoke/smoke-portal-paths.mjs"
, "test.smoke/smoke-portal-config.mjs"
, "test.smoke/smoke-workflow.mjs"
, "test.smoke/smoke-cruscotto-db.mjs"
, "test.smoke/smoke-portal-e2e.mjs"
, "test.smoke/smoke-run-all.mjs"
, "test.smoke/smoke-dashboard.mjs"
];

try {
  resolveProductRepoPath({ required: true });
} catch (err) {
  console.error("FAIL smoke-ci: PRODUCT_REPO_PATH invalid before steps");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

for (const rel of STEPS) {
  const res = spawnSync(process.execPath, [rel], {
    cwd   : ROOT
  , env   : process.env
  , stdio : "inherit"
  });

  if (res.status !== 0) {
    console.error(`FAIL smoke-ci step: ${rel}`);
    process.exit(res.status ?? 1);
  }
}

console.log("OK smoke-ci — all steps passed");
