#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TESTSCRIPT ** -- commentato il: 2026-06-23 21:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:05   by: IbyEll
 * modificato il: 2026-06-23 21:05   by: IbyEll
 * ticket refirement: ADMIN-112 dashboard-server static e health · ADMIN-228 issue.html smoke
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Smoke dashboard — cruscotto.server health e pagine statiche index/backlog.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Regressione rapida su cruscotto HTTP senza aprire browser manuale dopo refactor server.
 *
 *   A cosa serve:
 *   - Spawn opzionale cruscotto.server, fetch /api/health e HTML principali con body minimo (incluso issue.html).
 *
 * Generalizzazione:
 *   Si — DASHBOARD_PORT env per listener; riusa server già up se health ok.
 *
 * Input:
 *   - DASHBOARD_PORT — porta HTTP cruscotto (default 3999)
 *
 * Uso:
 *   - node test.smoke/smoke-dashboard.mjs
 *
 * Exit code:
 *   0 — health e pagine statiche raggiungibili
 *   1 — fetch fallito o body troppo corto
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT        = Number(process.env.DASHBOARD_PORT ?? 3999);
const BASE        = `http://127.0.0.1:${PORT}`;

/** @type {import("node:child_process").ChildProcess | null} */
let child = null;

/**
 * @returns {Promise<boolean>}
 */
async function isDashboardUp() {
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
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
  const spawned = !(await isDashboardUp());

  if (spawned) {
    child = spawn(process.execPath, ["cruscotto.frontend/cruscotto.server.mjs"], {
      cwd       : PORTAL_ROOT
    , env       : { ...process.env, DASHBOARD_PORT: String(PORT) }
    , stdio     : ["ignore", "pipe", "pipe"]
    });

    await delay(2500);
  }

  await fetchOk("/");
  await fetchOk("/home.html");
  await fetchOk("/app.html");
  await fetchOk("/index.html");

  try {
    await fetchOk("/backlog.html");
  } catch (err) {
    console.warn("backlog.html:", err instanceof Error ? err.message : err);
  }

  const issueHtml = await fetchOk("/issue.html");

  if (!issueHtml.includes("issue-search-form") || !issueHtml.includes("btn-load-db")) {
    throw new Error("/issue.html markup issue display incompleto");
  }

  console.log(`OK smoke dashboard ${BASE}/`);
}

main()
  .catch((err) => {
    console.error("FAIL smoke dashboard:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }
  });
