#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TESTSCRIPT ** -- commentato il: 2026-07-08 21:55
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-07-08 21:55   by: IbyEll
 * modificato il: 2026-07-08 21:55   by: IbyEll
 * ticket refirement: ADMIN-168 CI job AdminDashBoard + smoke admin:home
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Smoke HOME — portal.home.server health, static e testscript home-only su :3990.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - CI AdminDashBoard deve verificare admin:home senza avvio manuale del selettore overlay.
 *
 *   A cosa serve:
 *   - Spawn opzionale portal.home.server, fetch health/static e suite home test.portal.home.*.
 *
 * Generalizzazione:
 *   Si — PORTAL_HOME_PORT env per listener; riusa server già up se health ok.
 *
 * Input:
 *   - PORTAL_HOME_PORT — porta HTTP HOME (default 3990)
 *
 * Uso:
 *   - node test.smoke/smoke-home.mjs
 *
 * Exit code:
 *   0 — health, pagine statiche e testscript home passati
 *   1 — fetch o suite home fallita
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT        = Number(process.env.PORTAL_HOME_PORT ?? 3990);
const BASE        = `http://127.0.0.1:${PORT}`;

const HOME_SCRIPTS = [
  "admin.portal.testscript/home/test.portal.home.health.mjs"
, "admin.portal.testscript/home/test.portal.home.projects.mjs"
];

/** @type {import("node:child_process").ChildProcess | null} */
let child = null;

/**
 * @returns {Promise<boolean>}
 */
async function isHomeUp() {
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) });

    if (!res.ok) {
      return false;
    }

    const data = /** @type {Record<string, unknown>} */ (await res.json());

    return data.ok === true && data.mode === "home-only";
  } catch {
    return false;
  }
}

/**
 * @param {string} path
 */
async function fetchOk(path) {
  const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(8000) });

  if (!res.ok) {
    throw new Error(`${path} HTTP ${res.status}`);
  }

  const text = await res.text();

  if (text.length < 32) {
    throw new Error(`${path} body troppo corto`);
  }

  return text;
}

async function main() {
  const spawned = !(await isHomeUp());

  if (spawned) {
    child = spawn(process.execPath, ["admin.portal/portal.home.server.mjs"], {
      cwd   : PORTAL_ROOT
    , env   : { ...process.env, PORTAL_HOME_PORT: String(PORT) }
    , stdio : ["ignore", "pipe", "pipe"]
    });

    await delay(2500);

    if (!(await isHomeUp())) {
      throw new Error(`portal.home.server non raggiungibile su ${BASE}`);
    }
  }

  await fetchOk("/");
  await fetchOk("/home.html");
  await fetchOk("/home.css");
  await fetchOk("/home.js");

  for (const rel of HOME_SCRIPTS) {
    const res = spawnSync(process.execPath, [rel], {
      cwd   : PORTAL_ROOT
    , env   : { ...process.env, PORTAL_HOME_URL: BASE, HOME_PORT: String(PORT) }
    , stdio : "inherit"
    });

    if (res.status !== 0) {
      throw new Error(`${rel} exit ${res.status ?? 1}`);
    }
  }

  console.log(`OK smoke home ${BASE}/`);
}

main()
  .catch((err) => {
    console.error("FAIL smoke home:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
  });
