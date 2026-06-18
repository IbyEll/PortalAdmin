/**
 * Avvio cruscotto (dashboard-server) da HOME — spawn detached e apertura browser.
 *
 * Consumatori: server/portal-home-server.mjs, scripts/portal-launch-dashboard.mjs
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findListeningPids } from "../cruscotto.frontend/cruscotto.process.kill.ports.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @returns {number}
 */
export function resolveDashboardPort() {
  return Number(
    process.env.DASHBOARD_PORT
    ?? process.env.PORTAL_HOME_PORT
    ?? process.env.PORT
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
 * @param {{
 *   port?            : number
 *   openPath?        : string
 *   overlay?         : string
 *   productRepoPath? : string
 * }} [options]
 * @returns {{ pid: number | undefined }}
 */
export function spawnDashboardLauncher(options = {}) {
  const port     = options.port ?? resolveDashboardPort();
  const openPath = options.openPath ?? "/app.html#overview";
  const script   = join(PORTAL_ROOT, "admin.portal", "portal.dashboard.launch.mjs");
  const args     = [
    script
  , "--port"
  , String(port)
  , "--open"
  , openPath
  ];

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
