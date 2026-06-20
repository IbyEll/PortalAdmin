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
 *                        Avvio cruscotto — attesa porta libera, spawn dashboard e apertura browser.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Dopo istanziazione HOME serve avviare dashboard-server su porta overlay senza bloccare il parent HTTP.
 *   - Centralizza attesa porta libera, health /api/scripts e apertura browser (Windows cmd start o Node spawn).
 *
 *   A cosa serve:
 *   - Se cruscotto già up → apre URL; altrimenti spawn npm run admin:dashboard (Win) o dashboard-server.mjs.
 *
 * Generalizzazione:
 *   Si — porta, path hash e overlay da argv o env DASHBOARD_PORT / PRJ_NAME.
 *
 * Input:
 *   - argv --port, --open, --overlay
 *   - DASHBOARD_PORT, PRJ_NAME — env inoltrati al processo dashboard
 *
 * Uso:
 *   - node admin.portal/portal.dashboard.launch.mjs
 *   - node admin.portal/portal.dashboard.launch.mjs --port 3999 --open /app.html#overview
 *   - node admin.portal/portal.dashboard.launch.mjs --overlay JustLastOne
 *
 * Flag CLI:
 *   --port N       porta dashboard (default resolveDashboardPort)
 *   --open PATH    path/hash browser (default /app.html#overview)
 *   --overlay NAME imposta PRJ_NAME sul child
 *   --no-browser   non apre il browser al termine
 *
 * Variabili d'ambiente:
 *   - DASHBOARD_PORT, PORTAL_HOME_PORT, PORT — risoluzione porta
 *   - PRJ_NAME — overlay product se --overlay assente
 *
 * npm (se applicabile):
 *   - spawn da lib/portal.launch.dashboard.mjs (portal.home.server open-cruscotto)
 *
 * Prerequisiti:
 *   - lib/portal.launch.dashboard.mjs — isFullDashboardUp, openSystemBrowser
 *   - server/dashboard-server.mjs o npm run admin:dashboard
 *
 * ------------------------------------------------------------------------------------------------------------------------
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
} from "../lib/portal.launch.dashboard.mjs";
import { findListeningPids } from "../cruscotto.frontend/cruscotto.process.kill.ports.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Parse argv CLI — porta dashboard, path browser, overlay opzionale.
 *
 * @param {string[]} argv
 */
function parseArgs(argv) {
  let port         = resolveDashboardPort();
  let openPath     = "/app.html#overview";
  let overlay      = process.env.PRJ_NAME?.trim() || null;
  let openBrowser  = true;

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--port" && argv[i + 1]) {
      port = Number(argv[++i]);
    } else if (argv[i] === "--open" && argv[i + 1]) {
      openPath = argv[++i];
    } else if (argv[i] === "--overlay" && argv[i + 1]) {
      overlay = argv[++i].trim();
    } else if (argv[i] === "--no-browser") {
      openBrowser = false;
    }
  }

  return { port, openPath, overlay, openBrowser };
}

/**
 * Attende che la porta non sia in ascolto (kill precedente completato).
 *
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
 * Poll /api/scripts finché il cruscotto risponde o scade il timeout.
 *
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
 * Avvia dashboard detached — cmd start su Windows, node server su Unix.
 *
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
    // 1a. Windows — finestra cmd con npm run admin:dashboard
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

  // 1b. Unix — spawn diretto dashboard-server.mjs
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
  // 1. Parse argv — porta, URL browser, overlay opzionale
  const { port, openPath, overlay, openBrowser } = parseArgs(process.argv.slice(2));
  const openUrl                                  = `http://localhost:${port}${openPath.startsWith("/") ? openPath : `/${openPath}`}`;

  // 2. Cruscotto già attivo — apri browser se richiesto e termina
  if (await isFullDashboardUp(port)) {
    if (openBrowser) {
      openSystemBrowser(openUrl);
    }

    return;
  }

  // 3. Attesa porta libera prima dello spawn
  const free = await waitPortFree(port);

  if (!free) {
    console.error(`Porta ${port} ancora occupata dopo timeout`);
    process.exitCode = 1;
    return;
  }

  // 4. Spawn processo dashboard (detached)
  spawnDashboardProcess(port, { overlay });

  // 5. Poll health fino a /api/scripts OK
  const up = await waitDashboardUp(port);

  if (!up) {
    console.error(`Cruscotto non disponibile su :${port} entro timeout`);
    process.exitCode = 1;
    return;
  }

  // 6. Apertura browser sul path richiesto
  if (openBrowser) {
    openSystemBrowser(openUrl);
  }
}

main().catch((err) => {
  // exit 1 — errore non gestito in main
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
