/**
 * Istanza progetto PortalAdmin — selezione overlay, .env e prepare cruscotto.
 *
 * Descrizione funzionale:
 *   Perché esiste: la HOME PortalAdmin deve attivare un product overlay (PRJ_NAME)
 *     senza editare manualmente .env e avviare script di prepare.
 *   A cosa serve: elenco PROJECT_*, persistenza multi-istanza (porta dedicata per overlay),
 *     patch .env, spawn prepare.
 *
 * Consumatori: server/dashboard-server.mjs, server/portal-home-server.mjs, scripts/portal-prepare-instance.mjs
 *
 * Export principali:
 *   listAvailableProjects, getPortalInstance, getPortalInstances, activatePortalInstance
 *   getPrepareStatus, resolveOverlayDashboardPort
 */

import { spawn } from "node:child_process";
import {
  existsSync
, mkdirSync
, readdirSync
, readFileSync
, writeFileSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { isPortListening } from "./portal.launch.dashboard.mjs";

const PORTAL_ROOT       = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR          = join(PORTAL_ROOT, "admin.portal");
const LEGACY_DATA_DIR   = join(PORTAL_ROOT, "cruscotto.database");
const INSTANCES_PATH    = join(DATA_DIR, "portal-instances.json");
const LEGACY_INSTANCE   = join(DATA_DIR, "portal-instance.json");
const RUNTIME_STATE     = join(DATA_DIR, "portal.instance.runtime.state.json");
const OLD_INSTANCES     = join(LEGACY_DATA_DIR, "portal-instances.json");
const OLD_LEGACY_INSTANCE = join(LEGACY_DATA_DIR, "portal-instance.json");
const OLD_RUNTIME_STATE = join(LEGACY_DATA_DIR, "portal.instance.runtime.state.json");
const ENV_PATH          = join(PORTAL_ROOT, ".env");

/** Ordine card HOME — overlay non elencati dopo, per nome. */
const HOME_PROJECT_ORDER = [
  "JustLastOne"
, "AdminDashBoard"
];

/** Porta cruscotto di fallback se PRJ_DASHBOARD_PORT assente nel config overlay. */
const DEFAULT_OVERLAY_PORTS = {
  JustLastOne    : 3999
, AdminDashBoard : 3998
};

/** @type {Map<string, import("node:child_process").ChildProcess>} */
const prepareChildren = new Map();

/**
 * @typedef {{
 *   overlay       : string
 *   prjName       : string
 *   prjSlug       : string
 *   prjJiraPrefix : string
 *   prjRepo       : string
 *   githubUrl     : string
 *   ready         : boolean
 *   missing       : string[]
 *   dashboardPort : number
 *   cruscottoRunning?: boolean
 * }} PortalProjectInfo
 */

/**
 * @typedef {{
 *   overlay          : string
 *   prjName          : string
 *   productRepoPath  : string
 *   dashboardPort    : number
 *   activatedAt      : string
 *   reloadRequired   : boolean
 *   prepare          : {
 *     status    : "idle" | "running" | "done" | "error"
 *   , startedAt : string | null
 *   , finishedAt: string | null
 *   , exitCode  : number | null
 *   , logTail   : string
 *   }
 * }} PortalInstanceState
 */

/**
 * @typedef {{ instances: Record<string, PortalInstanceState> }} PortalInstancesRegistry
 */

/**
 * @param {string} overlay
 * @returns {string[]}
 */
function requiredOverlayFiles(overlay) {
  return [
    `PROJECT_${overlay}/project.config.${overlay}.mjs`
  ];
}

/**
 * @param {string} overlay
 * @returns {Promise<import("./project.config.mjs").ProjectConfig | null>}
 */
export async function loadOverlayConfig(overlay) {
  const file = join(PORTAL_ROOT, `PROJECT_${overlay}`, `project.config.${overlay}.mjs`);

  if (!existsSync(file)) {
    return null;
  }

  const mod = await import(pathToFileURL(file).href);

  return mod.PROJECT_CONFIG_VALUES ?? null;
}

/**
 * @param {string} overlay
 * @param {import("./project.config.mjs").ProjectConfig} [config]
 * @returns {Promise<number>}
 */
export async function resolveOverlayDashboardPort(overlay, config = null) {
  const cfg = config ?? await loadOverlayConfig(overlay);

  if (cfg?.PRJ_DASHBOARD_PORT != null && cfg.PRJ_DASHBOARD_PORT !== "") {
    const port = Number(cfg.PRJ_DASHBOARD_PORT);

    if (Number.isFinite(port) && port > 0) {
      return port;
    }
  }

  return DEFAULT_OVERLAY_PORTS[overlay] ?? 3999;
}

/**
 * @param {string} path
 * @returns {PortalInstanceState | null}
 */
function readSingleInstanceFile(path) {
  if (!existsSync(path)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));

    if (parsed?.overlay) {
      return /** @type {PortalInstanceState} */ (parsed);
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * @returns {PortalInstancesRegistry}
 */
function readInstancesRegistry() {
  if (existsSync(INSTANCES_PATH)) {
    try {
      const parsed = JSON.parse(readFileSync(INSTANCES_PATH, "utf8"));

      if (parsed && typeof parsed === "object" && parsed.instances) {
        return /** @type {PortalInstancesRegistry} */ (parsed);
      }
    } catch {
      // ricostruisci sotto
    }
  }

  for (const path of [OLD_INSTANCES]) {
    if (!existsSync(path)) {
      continue;
    }

    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));

      if (parsed && typeof parsed === "object" && parsed.instances) {
        const registry = /** @type {PortalInstancesRegistry} */ (parsed);
        writeInstancesRegistry(registry);
        return registry;
      }
    } catch {
      // ignore
    }
  }

  for (const path of [LEGACY_INSTANCE, OLD_LEGACY_INSTANCE, RUNTIME_STATE, OLD_RUNTIME_STATE]) {
    const legacy = readSingleInstanceFile(path);

    if (legacy) {
      const registry = { instances: { [legacy.overlay]: legacy } };
      writeInstancesRegistry(registry);
      return registry;
    }
  }

  return { instances: {} };
}

/**
 * @param {PortalInstancesRegistry} registry
 */
function writeInstancesRegistry(registry) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(INSTANCES_PATH, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

/**
 * @param {string} overlay
 * @returns {PortalInstanceState | null}
 */
export function readInstanceForOverlay(overlay) {
  const registry = readInstancesRegistry();

  return registry.instances[overlay] ?? null;
}

/**
 * @returns {PortalInstanceState[]}
 */
export function readAllInstances() {
  const registry = readInstancesRegistry();

  return Object.values(registry.instances);
}

/**
 * @param {PortalInstanceState} state
 */
function upsertInstanceState(state) {
  const registry = readInstancesRegistry();

  registry.instances[state.overlay] = state;
  writeInstancesRegistry(registry);
}

/**
 * @returns {Promise<PortalProjectInfo[]>}
 */
export async function listAvailableProjects() {
  const projectsDir = PORTAL_ROOT;
  const entries     = readdirSync(projectsDir, { withFileTypes: true });
  /** @type {PortalProjectInfo[]} */
  const out = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("PROJECT_")) {
      continue;
    }

    const overlay = entry.name.slice("PROJECT_".length);
    const missing = requiredOverlayFiles(overlay).filter(
      (rel) => !existsSync(join(PORTAL_ROOT, rel))
    );
    const config  = await loadOverlayConfig(overlay);

    if (!config) {
      continue;
    }

    const productPath   = resolve(join(PORTAL_ROOT, "..", config.PRJ_REPO));
    const dashboardPort = await resolveOverlayDashboardPort(overlay, config);

    out.push({
      overlay
    , prjName         : config.PRJ_NAME
    , prjSlug         : config.PRJ_SLUG
    , prjJiraPrefix   : config.PRJ_JIRA_PREFIX
    , prjRepo         : config.PRJ_REPO
    , githubUrl       : `https://github.com/${config.PRJ_GITHUB_OWNER}/${config.PRJ_GITHUB_REPO}`
    , ready           : missing.length === 0 && existsSync(productPath)
    , missing         : missing.length
        ? missing
        : existsSync(productPath)
          ? []
          : [`product repo sibling ../${config.PRJ_REPO}`]
    , dashboardPort
    , cruscottoRunning: isPortListening(dashboardPort)
    });
  }

  return out.sort((a, b) => {
    const rankA = HOME_PROJECT_ORDER.indexOf(a.overlay);
    const rankB = HOME_PROJECT_ORDER.indexOf(b.overlay);
    const orderA = rankA === -1 ? HOME_PROJECT_ORDER.length : rankA;
    const orderB = rankB === -1 ? HOME_PROJECT_ORDER.length : rankB;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.overlay.localeCompare(b.overlay);
  });
}

/**
 * @param {string} key
 * @param {string} value
 */
function upsertEnvLine(key, value) {
  const line = `${key}=${value}`;
  let text   = "";

  if (existsSync(ENV_PATH)) {
    text = readFileSync(ENV_PATH, "utf8");
  }

  const re = new RegExp(`^${key}=.*$`, "m");

  if (re.test(text)) {
    text = text.replace(re, line);
  } else {
    text = text.trimEnd() ? `${text.trimEnd()}\n${line}\n` : `${line}\n`;
  }

  writeFileSync(ENV_PATH, text, "utf8");
}

/**
 * @param {string | undefined} overlay
 * @returns {Promise<{
 *   instance: PortalInstanceState | null
 *   instances: PortalInstanceState[]
 *   envPrjName: string | null
 *   aligned: boolean
 * }>}
 */
export async function getPortalInstance(overlay) {
  const instances  = readAllInstances();
  const envPrjName = process.env.PRJ_NAME?.trim() || null;
  const focused    = overlay
    ? readInstanceForOverlay(overlay)
    : instances.at(-1) ?? null;

  return {
    instance   : focused
  , instances
  , envPrjName
  , aligned    : Boolean(focused && envPrjName && focused.overlay === envPrjName)
  };
}

/**
 * @returns {Promise<{ instances: PortalInstanceState[] }>}
 */
export async function getPortalInstances() {
  return { instances: readAllInstances() };
}

/**
 * @param {string} logChunk
 * @param {string} overlay
 */
function appendPrepareLog(logChunk, overlay) {
  const current = readInstanceForOverlay(overlay);

  if (!current) {
    return;
  }

  current.prepare.logTail = `${current.prepare.logTail}${logChunk}`.slice(-8000);
  upsertInstanceState(current);
}

/**
 * @param {string} overlay
 * @param {{ productRepoPath?: string }} [opts]
 * @returns {Promise<PortalInstanceState>}
 */
export async function activatePortalInstance(overlay, opts = {}) {
  const config = await loadOverlayConfig(overlay);

  if (!config) {
    throw new Error(`Overlay "${overlay}" non trovato (project.config mancante)`);
  }

  const missing = requiredOverlayFiles(overlay).filter(
    (rel) => !existsSync(join(PORTAL_ROOT, rel))
  );

  if (missing.length > 0) {
    throw new Error(`Overlay incompleto: ${missing.join(", ")}`);
  }

  const defaultProduct = resolve(join(PORTAL_ROOT, "..", config.PRJ_REPO));
  const productRepoPath = opts.productRepoPath?.trim()
    ? resolve(opts.productRepoPath.trim())
    : defaultProduct;

  if (!existsSync(productRepoPath)) {
    throw new Error(`Product repo non trovato: ${productRepoPath}`);
  }

  const runningChild = prepareChildren.get(overlay);

  if (runningChild && runningChild.exitCode === null) {
    throw new Error(`Prepare già in corso per ${overlay}`);
  }

  const dashboardPort = await resolveOverlayDashboardPort(overlay, config);

  upsertEnvLine("PRJ_NAME", overlay);
  upsertEnvLine("PRODUCT_REPO_PATH", productRepoPath.replace(/\\/g, "/"));

  /** @type {PortalInstanceState} */
  const state = {
    overlay
  , prjName         : config.PRJ_NAME
  , productRepoPath : productRepoPath.replace(/\\/g, "/")
  , dashboardPort
  , activatedAt     : new Date().toISOString()
  , reloadRequired  : process.env.PRJ_NAME?.trim() !== overlay
  , prepare         : {
      status     : "running"
    , startedAt  : new Date().toISOString()
    , finishedAt : null
    , exitCode   : null
    , logTail    : ""
    }
  };

  upsertInstanceState(state);

  const script = join(PORTAL_ROOT, "admin.portal", "portal.instance.prepare.mjs");

  const child = spawn(
    process.execPath
  , [script, "--overlay", overlay]
  , {
      cwd   : PORTAL_ROOT
    , env   : {
        ...process.env
      , PRJ_NAME          : overlay
      , PRODUCT_REPO_PATH : productRepoPath
      , DASHBOARD_PORT    : String(dashboardPort)
      }
    , stdio : ["ignore", "pipe", "pipe"]
    }
  );

  prepareChildren.set(overlay, child);

  child.stdout?.on("data", (chunk) => {
    appendPrepareLog(chunk.toString(), overlay);
  });

  child.stderr?.on("data", (chunk) => {
    appendPrepareLog(chunk.toString(), overlay);
  });

  child.on("close", (code) => {
    const current = readInstanceForOverlay(overlay) ?? state;

    current.prepare.status     = code === 0 ? "done" : "error";
    current.prepare.finishedAt = new Date().toISOString();
    current.prepare.exitCode   = code ?? 1;
    upsertInstanceState(current);
    prepareChildren.delete(overlay);
  });

  return state;
}

/**
 * @param {string} [overlay]
 * @returns {PortalInstanceState["prepare"] | null}
 */
export function getPrepareStatus(overlay) {
  if (!overlay) {
    const instances = readAllInstances();

    return instances.at(-1)?.prepare ?? null;
  }

  const instance = readInstanceForOverlay(overlay);

  if (!instance) {
    return null;
  }

  const child = prepareChildren.get(overlay);

  if (child && child.exitCode === null) {
    instance.prepare.status = "running";
  }

  return instance.prepare;
}
