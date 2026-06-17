#!/usr/bin/env node
/**
 * Attende porta libera, avvia npm run admin:dashboard, apre il cruscotto nel browser.
 *
 * Uso (di solito spawn da portal-home-server):
 *   node scripts/portal-launch-dashboard.mjs
 *   node scripts/portal-launch-dashboard.mjs --port 3999 --open /app.html#overview
 */

import "../lib/portal.load.env.mjs";

import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  isFullDashboardUp
, openSystemBrowser
, resolveDashboardPort
} from "../lib/admin/portal.launch.dashboard.mjs";
import { findListeningPids } from "../runner/kill-dev-ports.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  let port     = resolveDashboardPort();
  let openPath = "/app.html#overview";
  let overlay  = process.env.PRJ_NAME?.trim() || null;

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--port" && argv[i + 1]) {
      port = Number(argv[++i]);
    } else if (argv[i] === "--open" && argv[i + 1]) {
      openPath = argv[++i];
    } else if (argv[i] === "--overlay" && argv[i + 1]) {
      overlay = argv[++i].trim();
    }
  }

  return { port, openPath, overlay };
}

/**
 * @param {number} port
 * @param {number} maxMs
 */
async function waitPortFree(port, maxMs = 30000) {
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    if (findListeningPids(port).length === 0) {
      return true;
    }

    await delay(250);
  }

  return false;
}

/**
 * @param {number} port
 * @param {number} maxMs
 */
async function waitDashboardUp(port, maxMs = 120000) {
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    if (await isFullDashboardUp(port)) {
      return true;
    }

    await delay(500);
  }

  return false;
}

/**
 * @param {number} port
 * @param {{ overlay?: string | null }} [options]
 * @returns {number | undefined}
 */
function spawnDashboardProcess(port, options = {}) {
  /** @type {NodeJS.ProcessEnv} */
  const env = {
    ...process.env
  , DASHBOARD_PORT : String(port)
  };

  if (options.overlay) {
    env.PRJ_NAME = options.overlay;
  }

  const windowTitle = options.overlay ? `PortalAdmin ${options.overlay}` : "PortalAdmin Cruscotto";

  if (process.platform === "win32") {
    const child = spawn(
      "cmd.exe"
    , ["/c", "start", windowTitle, "cmd", "/k", "npm run admin:dashboard"]
    , {
        cwd      : PORTAL_ROOT
      , env
      , detached : true
      , stdio    : "ignore"
      }
    );

    child.unref();

    return child.pid;
  }

  const serverPath = join(PORTAL_ROOT, "server", "dashboard-server.mjs");
  const child      = spawn(process.execPath, [serverPath], {
    cwd      : PORTAL_ROOT
  , env
  , detached : true
  , stdio    : "ignore"
  });

  child.unref();

  return child.pid;
}

async function main() {
  const { port, openPath, overlay } = parseArgs(process.argv.slice(2));
  const openUrl                     = `http://localhost:${port}${openPath.startsWith("/") ? openPath : `/${openPath}`}`;

  if (await isFullDashboardUp(port)) {
    openSystemBrowser(openUrl);
    return;
  }

  const free = await waitPortFree(port);

  if (!free) {
    console.error(`Porta ${port} ancora occupata dopo timeout`);
    process.exitCode = 1;
    return;
  }

  spawnDashboardProcess(port, { overlay });

  const up = await waitDashboardUp(port);

  if (!up) {
    console.error(`Cruscotto non disponibile su :${port} entro timeout`);
    process.exitCode = 1;
    return;
  }

  openSystemBrowser(openUrl);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
