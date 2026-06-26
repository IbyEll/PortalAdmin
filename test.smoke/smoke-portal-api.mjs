#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TESTSCRIPT ** -- commentato il: 2026-06-25 22:00
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-25 22:00   by: IbyEll
 * modificato il: 2026-06-25 22:00   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Smoke portal API — spawn cruscotto opzionale + run-portal-api (--skip-home).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - La suite read-only admin.portal.testscript richiede cruscotto HTTP; CI deve eseguirla
 *     senza admin:home né avvio manuale della dashboard.
 *
 *   A cosa serve:
 *   - Riutilizza cruscotto già up o spawn cruscotto.server.mjs, poi run-portal-api sequenziale.
 *
 * Generalizzazione:
 *   Si — DASHBOARD_PORT, PRODUCT_REPO_PATH; --overlay da env PRJ_NAME.
 *
 * Input:
 *   - DASHBOARD_PORT — porta cruscotto (default 3999)
 *   - PRODUCT_REPO_PATH — root product per spawn server
 *   - PRJ_NAME — passato a run-portal-api come --overlay se impostato
 *
 * Uso:
 *   - node test.smoke/smoke-portal-api.mjs
 *
 * Exit code:
 *   0 — run-portal-api exit 0
 *   1 — spawn o suite API fallita
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

import { getProductRepoPath } from "../admin.portal.lib/portal.paths.resolver.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PORT = Number(process.env.DASHBOARD_PORT ?? 3999);

/** @type {import("node:child_process").ChildProcess | null} */
let child = null;

/**
 * @param {number} port
 * @returns {Promise<boolean>}
 */
async function isDashboardUpOnPort(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(2000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * @returns {Promise<{ port: number, base: string } | null>}
 */
async function findDashboardBase() {
  const candidates = [...new Set([
    DEFAULT_PORT
  , 3998
  , 3999
  , 3990
  ])];

  for (const port of candidates) {
    if (await isDashboardUpOnPort(port)) {
      return { port, base: `http://127.0.0.1:${port}` };
    }
  }

  return null;
}

async function main() {
  const product  = getProductRepoPath();
  let live       = await findDashboardBase();
  const spawned  = !live;

  if (spawned) {
    child = spawn(process.execPath, ["cruscotto.frontend/cruscotto.server.mjs"], {
      cwd   : PORTAL_ROOT
    , env   : {
        ...process.env
      , DASHBOARD_PORT    : String(DEFAULT_PORT)
      , PRODUCT_REPO_PATH : product
      }
    , stdio : ["ignore", "pipe", "pipe"]
    });

    await delay(3500);
    live = await findDashboardBase();

    if (!live) {
      throw new Error("cruscotto non raggiungibile su porte 3998/3999 dopo spawn");
    }
  }

  const BASE = live.base;

  /** @type {string[]} */
  const args = [
    "admin.portal.testscript/run-portal-api.mjs"
  , "--skip-home"
  , "--base"
  , BASE
  ];

  const overlay = process.env.PRJ_NAME?.trim();

  if (overlay) {
    args.push("--overlay", overlay);
  }

  const res = spawnSync(process.execPath, args, {
    cwd   : PORTAL_ROOT
  , env   : process.env
  , stdio : "inherit"
  });

  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }

  console.log(`OK smoke portal-api ${BASE}`);
}

main()
  .catch((err) => {
    console.error("FAIL smoke portal-api:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
  });
