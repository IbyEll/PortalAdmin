/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 20:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 20:42   by: IbyEll
 * modificato il: 2026-06-23 20:42   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Avvio cruscotto (dashboard-server) da HOME — spawn detached e browser.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - HOME PortalAdmin deve aprire il cruscotto dell'overlay senza bloccare il processo HOME.
 *
 *   A cosa serve:
 *   - Risolve porta listener, verifica health, kill porta occupata e spawn server detached.
 *
 * Generalizzazione:
 *   Si — porta da env shell, PRJ_DASHBOARD_PORT overlay o default 3999.
 *
 * Input:
 *   - DASHBOARD_PORT, ADMIN_PORT, PORT — override env listener HTTP
 *   - PRJ_DASHBOARD_PORT — default da project.config overlay
 *
 * Consumatori:
 *   - lib/portal.instance.mjs — spawn dopo attivazione overlay
 *   - admin.portal/portal.dashboard.launch.mjs — launch da HOME UI
 *
 * Export principali:
 *   - resolveDashboardListenPort — porta HTTP cruscotto
 *   - isPortListening, isFullDashboardUp — probe health stack
 *   - spawnDashboardServerProcess, killDashboardOnPort — lifecycle processo
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getProjectConfig } from "./project.config.mjs";
import { findListeningPids, killListenersOnPort } from "../cruscotto.frontend/cruscotto.process.kill.ports.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Porta listener cruscotto — env shell, poi PRJ_DASHBOARD_PORT overlay, infine 3999.
 *
 * @returns {number}
 */
export function resolveDashboardListenPort() {
  const cfg = getProjectConfig();

  return Number(
    process.env.DASHBOARD_PORT
    ?? process.env.ADMIN_PORT
    ?? process.env.PORT
    ?? cfg.PRJ_DASHBOARD_PORT
    ?? 3999
  );
}

/**
 * @returns {number}
 */
export function resolveDashboardPort() {
  return Number(
    process.env.DASHBOARD_PORT
    ?? process.env.PORTAL_HOME_PORT
    ?? process.env.PORT
    ?? getProjectConfig().PRJ_DASHBOARD_PORT
    ?? 3999
  );
}

/**
 * @param {number} [port]
 * @param {string} [hash]
 * @returns {string}
 */
export function resolveCruscottoUrl(port = resolveDashboardPort(), hash = "overview") {
  const path = hash ? `/app.html#${hash}` : "/app.html";

  return `http://localhost:${port}${path}`;
}

/**
 * @param {number} port
 * @returns {boolean}
 */
export function isPortListening(port) {
  return findListeningPids(port).length > 0;
}

/**
 * @param {number} [port]
 * @returns {Promise<boolean>}
 */
export async function isFullDashboardUp(port = resolveDashboardPort()) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/scripts`, {
      signal : AbortSignal.timeout(2500)
    });

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * @param {string} url
 */
export function openSystemBrowser(url) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], {
      detached : true
    , stdio    : "ignore"
    }).unref();
    return;
  }

  if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }

  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

/**
 * Avvia cruscotto.server.mjs — senza finestra cmd su Windows (windowsHide).
 *
 * @param {{
 *   port?            : number
 *   overlay?         : string
 *   productRepoPath? : string
 *   detached?        : boolean
 *   stdio?           : import("node:child_process").StdioOptions
 * }} [options]
 * @returns {import("node:child_process").ChildProcess}
 */
export function spawnDashboardServerProcess(options = {}) {
  const port   = options.port ?? resolveDashboardPort();
  const script = join(PORTAL_ROOT, "cruscotto.frontend", "cruscotto.server.mjs");

  /** @type {NodeJS.ProcessEnv} */
  const env = {
    ...process.env
  , DASHBOARD_PORT: String(port)
  };

  if (options.overlay) {
    env.PRJ_NAME = options.overlay;
  }

  if (options.productRepoPath) {
    env.PRODUCT_REPO_PATH = options.productRepoPath;
  }

  return spawn(process.execPath, [script], {
    cwd         : PORTAL_ROOT
  , env
  , detached    : options.detached ?? false
  , stdio       : options.stdio ?? "ignore"
  , windowsHide : process.platform === "win32"
  });
}

/**
 * @param {{
 *   port?            : number
 *   openPath?        : string
 *   overlay?         : string
 *   productRepoPath? : string
 *   openBrowser?     : boolean
 * }} [options]
 * @returns {{ pid: number | undefined }}
 */
export function spawnDashboardLauncher(options = {}) {
  const port         = options.port ?? resolveDashboardPort();
  const openPath     = options.openPath ?? "/app.html#process";
  const openBrowser  = options.openBrowser !== false;
  const script       = join(PORTAL_ROOT, "admin.portal", "portal.dashboard.launch.mjs");
  const args         = [
    script
  , "--port"
  , String(port)
  , "--open"
  , openPath
  ];

  if (!openBrowser) {
    args.push("--no-browser");
  }

  if (options.overlay) {
    args.push("--overlay", options.overlay);
  }

  /** @type {NodeJS.ProcessEnv} */
  const env = {
    ...process.env
  , DASHBOARD_PORT: String(port)
  };

  if (options.overlay) {
    env.PRJ_NAME = options.overlay;
  }

  if (options.productRepoPath) {
    env.PRODUCT_REPO_PATH = options.productRepoPath;
  }

  const child = spawn(process.execPath, args, {
    cwd      : PORTAL_ROOT
  , env
  , detached : true
  , stdio    : "ignore"
  });

  child.unref();

  return { pid: child.pid };
}

/**
 * Termina processi in ascolto sulla porta cruscotto (non la HOME :3990).
 *
 * @param {number} port
 * @returns {{ port: number, killed: number[], failed: Array<{ pid: number, error?: string }> }}
 */
export function killDashboardOnPort(port) {
  const result = killListenersOnPort(port, {
    excludePids : [process.pid]
  });

  return {
    port
  , killed : result.killed
  , failed : result.failed
  };
}
