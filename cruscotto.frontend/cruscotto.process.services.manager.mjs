/**
 * repo-services-manager — orchestrazione stack dev product dal cruscotto (Process / Servizi).
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - avvio e kill di web, api, auth, api-documentation, friendBOT dal browser senza shell manuali
 *   - job Prisma dev (push, reset, seed) con log unificato per la console Process
 *
 *   A cosa serve:
 *   - spawn detached di script runner e StartUnit da discovery.services.repo
 *   - ring buffer stdout/stderr per polling GET /api/repo/services/logs
 *   - elenco processi in ascolto (porte, command line, node non mappati)
 *
 * Route (montate da dashboard-server.mjs):
 *   GET    /api/repo/services/discover  — manifest + piano avvio
 *   GET    /api/repo/services/status    — stato orchestratore
 *   GET    /api/repo/services/processes — tabella PID/porte Process
 *   GET    /api/repo/services/logs      — log incrementale (cursor)
 *   DELETE /api/repo/services/logs      — svuota console
 *   POST   /api/repo/services/start     — avvio stack (product / full / extras)
 *   POST   /api/repo/services/start-one — avvio singolo servizio
 *   POST   /api/repo/services/stop      — Kill All / product / stack-complete
 *   POST   /api/repo/services/stop-one  — kill singolo servizio
 *   GET    /api/repo/database/status    — stato SQLite dev (PRJ_DB_FILENAME)
 *   POST   /api/repo/database/push      — db:push via init_Database_DEV.mjs
 *   POST   /api/repo/database/reset     — delete & create schema
 *   POST   /api/repo/database/seed      — npm run db:seed
 *
 * Consumatori: server/dashboard-server.mjs, runner/cruscotto.process.stop.all.services.mjs
 *
 * Dipendenze: lib/discovery.services.repo.mjs, cruscotto.process.kill.ports.mjs,
 *   cruscotto.process.stop.all.services.mjs, cruscotto.database/script_seed
 *
 * Env: PRODUCT_REPO_PATH, DASHBOARD_PORT, PRJ_NAME (config project)
 */

import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import { getProjectConfig, projectHasProductDatabase } from "../lib/project.config.mjs";
import { getDiscoveryConfig } from "../lib/discovery.config.mjs";
import { resolveSqliteDbFiles } from "../cruscotto.database/product.database.seed.run.mjs";

import {
  findListeningPids
, findListeningPidsByPorts
, findPidsByCommandFragment
, killListenersOnPorts
, killProcessTree
, killProcessesByCommandFragment
} from "./cruscotto.process.kill.ports.mjs";
import {
  findFriendBotPids
, killFriendBotProcesses
, killProductNestService
, killProductNestStack
, PRODUCT_NEST_PORTS
} from "./cruscotto.process.stop.all.services.mjs";
import {
  clearProcessStarterCache
, resolveProcessStarter
, warmProcessStarterCache
} from "./cruscotto.process.started.user.mjs";
import {
  clearProcessStartedAtCache
, getProcessStartedAt
, warmProcessStartedAtCache
} from "./cruscotto.process.started.at.mjs";
import {
  discoverRepoServices
, formatStartPlan
, FRIEND_BOT_PROCESS_FRAGMENT
, PRODUCT_REPO_EXTRAS
, PRODUCT_STACK_COMPLETE_EXTRAS
, REPO_EXTRAS_ALL
, resolveServiceStartUnit
} from "../lib/discovery.services.repo.mjs";
import { getPortalDataDir, getPortalRoot, getProductRepoPath } from "../lib/portal.paths.resolver.mjs";
import {
  isFullDashboardUp
, killDashboardOnPort
, spawnDashboardLauncher
} from "../lib/portal.launch.dashboard.mjs";
import {
  listProjectNodeProcesses
, matchNodeProcessToServiceId
, shortenNodeCommand
} from "../runner/list-project-node-processes.mjs";
import { spawnShellOption } from "../lib/portal.utils.mjs";

const { PRJ_DB_FILENAME, PRJ_DB_PRISMA_DIR } = getProjectConfig();
const HAS_PRODUCT_DATABASE                     = projectHasProductDatabase();

/**
 * @returns {{ ok: false, error: string }}
 */
function productDatabaseDisabledResult() {
  return {
    ok    : false
  , error : "Database product non configurato per questo overlay (PRJ_DB_* vuoti in project.config)"
  };
}

// --- configurazione modulo — porte dashboard, script runner, core stack ---
const DASHBOARD_PORT = Number(
  process.env.DASHBOARD_PORT
  ?? process.env.ADMIN_PORT
  ?? process.env.PORT
  ?? 3999
);
const MAX_LOG_LINES = 3000;

const INIT_DATABASE_DEV_SCRIPT  = "cruscotto.database/product.database.init.mjs";
const START_ALL_SERVICES_SCRIPT = "cruscotto.frontend/cruscotto.process.start.all.services.mjs";

const PRODUCT_CORE_SERVICE_IDS = ["web", "api", "auth"];

// --- persistenza stato seed DB Process (cruscotto.database/process-db-seed-state.json) ---
/** @returns {string} */
function dbSeedStatePath() {
  return join(getPortalDataDir(), "process-db-seed-state.json");
}

/**
 * @returns {{ seedCompletedAt: string | null }}
 */
function readDbSeedState() {
  const file = dbSeedStatePath();
  const legacyFile = join(getPortalDataDir(), "utility-db-seed-state.json");

  if (!existsSync(file) && existsSync(legacyFile)) {
    try {
      copyFileSync(legacyFile, file);
    } catch {
      // ignore — riprova lettura legacy sotto
    }
  }

  const readFrom = existsSync(file) ? file : (existsSync(legacyFile) ? legacyFile : null);

  if (!readFrom) {
    return { seedCompletedAt: null };
  }

  try {
    const raw             = JSON.parse(readFileSync(readFrom, "utf8"));
    const seedCompletedAt = typeof raw.seedCompletedAt === "string" && raw.seedCompletedAt
      ? raw.seedCompletedAt
      : null;

    return { seedCompletedAt };
  } catch {
    return { seedCompletedAt: null };
  }
}

/**
 * @param {{ seedCompletedAt: string | null }} patch
 */
function writeDbSeedState(patch) {
  const file = dbSeedStatePath();

  mkdirSync(dirname(file), { recursive: true });

  writeFileSync(file, `${JSON.stringify({
    seedCompletedAt : patch.seedCompletedAt
  , updatedAt       : new Date().toISOString()
  }, null, 2)}\n`, "utf8");
}

function markDbSeedCompleted() {
  writeDbSeedState({ seedCompletedAt: new Date().toISOString() });
}

function clearDbSeedState() {
  writeDbSeedState({ seedCompletedAt: null });
}

/**
 * @typedef {{
 *   running: boolean
 *   startedAt: string | null
 *   pid: number | null
 *   error: string | null
 *   lastMode: string | null
 * }} RepoServicesStatus
 */

/**
 * @typedef {{
 *   seq: number
 *   stream: "stdout" | "stderr" | "system"
 *   text: string
 *   at: string
 * }} LogLine
 */

// --- stato orchestratore e ring buffer log console Process ---
/** @type {RepoServicesStatus} */
const state = {
  running   : false
, startedAt : null
, pid       : null
, error     : null
, lastMode  : null
};

/** @type {LogLine[]} */
let logLines = [];

/** @type {number} */
let logSeq = 0;

let stdoutBuf = "";
let stderrBuf = "";

/** @type {import("node:child_process").ChildProcess | null} */
let child = null;

/** @type {boolean} */
let dbJobRunning = false;

// --- spawn processi detached da StartUnit (discovery.services.repo) ---
/**
 * Avvia un comando StartUnit in background; stdout/stderr finiscono nel ring buffer log.
 *
 * @param {import("../lib/discovery.services.repo.mjs").StartUnit} unit
 * @returns {import("node:child_process").ChildProcess}
 */
function spawnDetachedStartUnit(unit) {
  // 1. Log comando — visibile subito in console Process
  pushLogLine("system", `=== Avvio ${unit.label} [${unit.id}] ===`);
  pushLogLine("system", `cwd: ${unit.cwd}`);
  pushLogLine("system", `cmd: ${unit.cmd} ${unit.args.join(" ")}`);

  // 2. Spawn detached con PRODUCT_REPO_PATH nel product checkout
  const spawned = spawn(unit.cmd, unit.args, {
    cwd         : unit.cwd
  , stdio       : ["ignore", "pipe", "pipe"]
  , shell       : spawnShellOption(unit.cmd)
  , detached    : true
  , windowsHide : process.platform === "win32"
  , env         : {
      ...process.env
    , PRODUCT_REPO_PATH: getProductRepoPath()
    }
  });

  const prefix = `[${unit.id}] `;

  // 3. Pipe stdout/stderr nel ring buffer (prefisso id servizio)
  spawned.stdout?.on("data", (chunk) => {
    for (const line of String(chunk).split(/\r?\n/).filter((row) => row.length > 0)) {
      pushLogLine("stdout", `${prefix}${line}`);
    }
  });

  spawned.stderr?.on("data", (chunk) => {
    for (const line of String(chunk).split(/\r?\n/).filter((row) => row.length > 0)) {
      pushLogLine("stderr", `${prefix}${line}`);
    }
  });

  spawned.on("exit", (code, signal) => {
    if (code && code !== 0) {
      pushLogLine("stderr", `${prefix}terminato con codice ${code}`);
    } else if (signal) {
      pushLogLine("stderr", `${prefix}terminato per segnale ${signal}`);
    } else {
      pushLogLine("system", `${prefix}processo terminato`);
    }
  });

  spawned.unref();

  return spawned;
}

const PRISMA_DB_JOB_PORTS = [3000, 4000, 4001, 4080];

// --- kill stack product prima di job Prisma (evita EPERM su Windows) ---
/**
 * @param {number} ms
 */
function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {{
 *   portResults: ReturnType<typeof killListenersOnPorts>
 *   fragmentResults: { results: ReturnType<typeof killProcessesByCommandFragment>[] }
 * }} nestKill
 */
function pushNestKillLogs(nestKill) {
  for (const row of nestKill.portResults) {
    if (row.killed.length > 0) {
      pushLogLine("stdout", `Porta ${row.port}: pid ${row.killed.join(", ")} terminato`);
    }

    for (const fail of row.failed) {
      pushLogLine("stderr", `Porta ${row.port}: pid ${fail.pid} — ${fail.error ?? "kill fallito"}`);
    }

    if (row.killed.length === 0 && row.failed.length === 0) {
      pushLogLine("stdout", `Porta ${row.port}: nessun listener`);
    }
  }

  for (const outcome of nestKill.fragmentResults.results) {
    if (outcome.killed.length > 0) {
      pushLogLine("stdout", `Processi (${outcome.fragment}): terminati pid ${outcome.killed.join(", ")}`);
    }

    for (const fail of outcome.failed) {
      pushLogLine("stderr", `Processi (${outcome.fragment}): pid ${fail.pid} — ${fail.error ?? "kill fallito"}`);
    }
  }
}

/**
 * Ferma web/api/auth (e orchestratore stack) prima di db:generate — evita EPERM su Windows.
 */
async function stopProductStackForDatabaseJob() {
  const excludePids = [process.pid];
  const productRoot = getProductRepoPath();

  pushLogLine("system", "=== Stop servizi product (Prisma) prima operazione DB ===");

  if (child?.pid) {
    pushLogLine("system", `Orchestratore: termino pid ${child.pid}…`);
    const outcome = killProcessTree(child.pid);

    if (outcome.ok) {
      pushLogLine("stdout", `Orchestratore: pid ${child.pid} terminato`);
      child         = null;
      state.running = false;
    } else {
      pushLogLine("stderr", `Orchestratore: ${outcome.error ?? "kill fallito"}`);
    }
  }

  pushNestKillLogs(killProductNestStack(productRoot, {
    excludePids
  , ports     : [...PRISMA_DB_JOB_PORTS]
  }));

  const friendBotKill = killFriendBotProcesses(productRoot, { excludePids });
  const friendBotPids = [...new Set(friendBotKill.results.flatMap((row) => row.killed))];

  if (friendBotPids.length > 0) {
    pushLogLine("stdout", `friendBOT: terminati pid ${friendBotPids.join(", ")}`);
  }

  if (process.platform === "win32") {
    pushLogLine("system", "Attesa rilascio file Prisma (Windows)…");
    await sleepMs(2000);
    pushNestKillLogs(killProductNestStack(productRoot, {
      excludePids
    , ports     : [...PRISMA_DB_JOB_PORTS]
    }));
    await sleepMs(500);
  }
}

// --- job script PortalAdmin (init_Database_DEV, process.start.all.services, …) ---
/**
 * Esegue uno script node sotto PortalAdmin con cattura log; una sola operazione DB alla volta.
 *
 * @param {string[]} scriptArgs
 * @param {string} label
 */
function runPortalScriptJob(scriptArgs, label) {
  if (dbJobRunning) {
    return Promise.resolve({
      ok    : false
    , error : "operazione database già in corso"
    });
  }

  dbJobRunning = true;
  pushLogLine("system", `=== ${label} — avvio ===`);

  const portalRoot = getPortalRoot();

  return new Promise((resolve) => {
    // 1. Spawn script sotto PortalAdmin con env product
    const job = spawn(process.execPath, scriptArgs, {
      cwd   : portalRoot
    , stdio : ["ignore", "pipe", "pipe"]
    , env   : {
        ...process.env
      , PRODUCT_REPO_PATH: getProductRepoPath()
      }
    });

    job.stdout?.on("data", (chunk) => {
      appendLogChunk("stdout", chunk);
    });

    job.stderr?.on("data", (chunk) => {
      appendLogChunk("stderr", chunk);
    });

    job.on("exit", (code) => {
      // 2. Flush buffer parziali e risolvi esito
      if (stdoutBuf) {
        pushLogLine("stdout", stdoutBuf);
        stdoutBuf = "";
      }

      if (stderrBuf) {
        pushLogLine("stderr", stderrBuf);
        stderrBuf = "";
      }

      dbJobRunning = false;
      const ok      = code === 0;

      pushLogLine("system", ok ? `=== ${label} — completato ===` : `=== ${label} — errore (codice ${code}) ===`);

      resolve({
        ok
      , error : ok ? undefined : `processo terminato con codice ${code ?? "?"}`
      , logCursor: logSeq
      , lines    : [...logLines]
      });
    });

    job.on("error", (err) => {
      dbJobRunning = false;
      pushLogLine("stderr", `${label}: ${err.message}`);
      resolve({
        ok    : false
      , error : err.message
      , logCursor: logSeq
      , lines    : [...logLines]
      });
    });
  });
}

/**
 * @param {"stdout" | "stderr" | "system"} stream
 * @param {string} text
 */
function pushLogLine(stream, text) {
  const trimmed = text.trimEnd();

  if (!trimmed) {
    return;
  }

  logSeq += 1;
  logLines.push({
    seq    : logSeq
  , stream
  , text   : trimmed
  , at     : new Date().toISOString()
  });

  if (logLines.length > MAX_LOG_LINES) {
    logLines = logLines.slice(-MAX_LOG_LINES);
  }
}

/**
 * @param {"stdout" | "stderr"} stream
 * @param {Buffer | string} chunk
 */
function appendLogChunk(stream, chunk) {
  const prev    = stream === "stdout" ? stdoutBuf : stderrBuf;
  const combined = prev + String(chunk);
  const parts    = combined.split(/\r?\n/);
  const remainder = parts.pop() ?? "";

  if (stream === "stdout") {
    stdoutBuf = remainder;
  } else {
    stderrBuf = remainder;
  }

  for (const line of parts) {
    pushLogLine(stream, line);
  }
}

// --- API log console Process (polling cursor) ---
/**
 * Svuota il ring buffer e reinserisce riga di sistema.
 */
export function clearRepoServicesLogs() {
  logLines  = [];
  logSeq    = 0;
  stdoutBuf = "";
  stderrBuf = "";
  pushLogLine("system", "— log console svuotata —");
}

/**
 * Righe log con seq > cursor; include stato orchestratore.
 *
 * @param {number} [cursor]
 */
export function getRepoServicesLogs(cursor = 0) {
  const since = Number(cursor) || 0;
  const lines = logLines.filter((row) => row.seq > since);
  const next  = logLines.length > 0 ? logLines[logLines.length - 1].seq : since;

  return {
    cursor  : next
  , lines
  , running : state.running
  , total   : logLines.length
  , status  : getRepoServicesStatus()
  };
}

// --- discovery e stato servizi (export per dashboard-server) ---
/**
 * Servizi e piano avvio dal product.manifest product (+ extras opzionali).
 *
 * @param {{
 *   extras?: string[]
 *   withPortal?: boolean
 * }} [options]
 */
export async function getRepoServicesDiscover(options = {}) {
  const { extras = [], withPortal = false } = options;
  const repoRoot                            = getProductRepoPath();
  const discovery                           = await discoverRepoServices(repoRoot, {
    extras
  , withPortal
  });

  return {
    repoRoot : discovery.repoRoot
  , manifest : discovery.manifest
  , services : discovery.services.map((svc) => ({
      id            : svc.id
    , label         : svc.label ?? svc.id
    , description   : svc.description ?? null
    , product       : svc.product ?? null
    , path          : svc.path ?? null
    , port          : svc.port ?? null
    , healthUrl     : svc.healthUrl ?? null
    , openUrl       : svc.openUrl ?? null
    , processScript : svc.processScript ?? null
    }))
  , planText : formatStartPlan(discovery.plan)
  , plan     : discovery.plan.map((unit) => ({
      id    : unit.id
    , label : unit.label
    , kind  : unit.kind
    }))
  };
}

/**
 * Snapshot stato orchestratore (running, pid, lastMode, error).
 *
 * @returns {RepoServicesStatus}
 */
export function getRepoServicesStatus() {
  return { ...state };
}

/**
 * @param {string[]} [extraArgv]
 */
async function runStartAllServicesJob(extraArgv = []) {
  return runPortalScriptJob(
    [START_ALL_SERVICES_SCRIPT, ...extraArgv]
  , "cruscotto.process.start.all.services"
  );
}

/**
 * @param {{
 *   extras?: string[]
 *   withPortal?: boolean
 *   allExtras?: boolean
 * }} options
 */
async function spawnExtraRepoServices(options = {}) {
  const {
    extras     = []
  , withPortal = false
  , allExtras  = false
  } = options;

  const productRoot = getProductRepoPath();
  const discovery   = await discoverRepoServices(productRoot, {
    extras     : allExtras ? [...REPO_EXTRAS_ALL] : extras
  , withPortal : allExtras || withPortal
  });

  /** @type {import("node:child_process").ChildProcess[]} */
  const spawned = [];

  for (const svc of discovery.services) {
    if (PRODUCT_CORE_SERVICE_IDS.includes(svc.id) || svc.id === "dashboard") {
      continue;
    }

    const unit = resolveServiceStartUnit(discovery.repoRoot, svc);

    if (!unit) {
      continue;
    }

    spawned.push(spawnDetachedStartUnit(unit));
  }

  return spawned;
}

// --- avvio stack (product, extras, stack-complete) ---
/**
 * Avvia stack dev secondo modalità: core product via cruscotto.process.start.all.services.mjs
 * oppure spawn singoli StartUnit per extras (api-documentation, friendBOT, …).
 *
 * @param {{
 *   extras?: string[]
 *   withPortal?: boolean
 *   noDb?: boolean
 *   allExtras?: boolean
 *   productOnly?: boolean
 *   productStackComplete?: boolean
 * }} [options]
 */
export async function startRepoServices(options = {}) {
  if (state.running && child) {
    return {
      started : false
    , error   : "avvio stack già in corso dal cruscotto"
    };
  }

  let {
    extras     = []
  , withPortal = false
  , noDb       = true
  , allExtras  = false
  , productOnly = false
  , productStackComplete = false
  } = options;

  if (productStackComplete) {
    extras              = [...PRODUCT_STACK_COMPLETE_EXTRAS];
    withPortal          = false;
    allExtras           = false;
    productOnly         = false;
  } else if (productOnly) {
    extras     = [...PRODUCT_REPO_EXTRAS];
    withPortal = false;
    allExtras  = false;
  }

  const productRoot = getProductRepoPath();
  const discovery   = await discoverRepoServices(productRoot, {
    extras     : allExtras ? [...REPO_EXTRAS_ALL] : extras
  , withPortal : allExtras || withPortal
  });

  const needsProductStack = productStackComplete
    || productOnly
    || allExtras
    || (!allExtras && !withPortal && extras.length === 0);

  const needsExtraServices = allExtras
    || withPortal
    || extras.length > 0;

  if (!needsProductStack && !needsExtraServices) {
    return {
      started : false
    , error   : "nessun servizio avviabile trovato"
    };
  }

  logLines  = [];
  logSeq    = 0;
  stdoutBuf = "";
  stderrBuf = "";

  state.running   = true;
  state.startedAt = new Date().toISOString();
  state.error     = null;
  state.lastMode  = productStackComplete
    ? "stack-complete"
    : productOnly
      ? "product"
      : allExtras
        ? "full"
        : withPortal || extras.length > 0
          ? "extended"
          : "core";

  pushLogLine("system", `=== Avvio stack (${state.lastMode}) — ${state.startedAt} ===`);
  pushLogLine("system", needsProductStack
    ? `node ${START_ALL_SERVICES_SCRIPT}`
    : formatStartPlan(discovery.plan));

  /** @type {number[]} */
  const spawnedPids = [];

  if (needsProductStack) {
    const startAllArgv = [];
    const startAll     = await runStartAllServicesJob(startAllArgv);

    if (!startAll.ok) {
      state.running = false;
      state.error   = startAll.error ?? "cruscotto.process.start.all.services fallito";

      return {
        started   : false
      , error     : state.error
      , logCursor : logSeq
      };
    }
  }

  if (needsExtraServices) {
    const extraChildren = await spawnExtraRepoServices({
      extras
    , withPortal
    , allExtras
    });

    for (const proc of extraChildren) {
      if (proc.pid) {
        spawnedPids.push(proc.pid);
      }
    }
  }

  state.running = false;
  child         = null;
  state.pid     = spawnedPids[0] ?? null;

  pushLogLine("system", "=== Avvio completato ===");

  return {
    started  : true
  , pid      : state.pid
  , planText : needsProductStack
      ? `node ${START_ALL_SERVICES_SCRIPT}`
      : formatStartPlan(discovery.plan)
  , services : discovery.services.map((svc) => svc.id)
  , logCursor: logSeq
  };
}

/** True se un avvio stack dal cruscotto è ancora marcato running. */
export function isRepoServicesActive() {
  return state.running;
}

// --- probe processi dev (tabella Process Servizi) ---
/**
 * Elenco servizi dal manifest con PID in ascolto sulle porte e metadati starter/startedAt.
 */
export async function listDevStackProcesses() {
  clearProcessStarterCache();
  clearProcessStartedAtCache();

  const discovery = await discoverRepoServices(getProductRepoPath(), {
    extras     : [...REPO_EXTRAS_ALL]
  , withPortal : true
  });

  const dashboardPid = process.pid;

  const portNumbers = discovery.services
    .map((svc) => svc.port)
    .filter((port) => typeof port === "number");
  const pidsByPort  = findListeningPidsByPorts(portNumbers);

  /**
   * @param {number} port
   * @returns {number[]}
   */
  function listenersOnPort(port) {
    return pidsByPort.get(port) ?? findListeningPids(port);
  }

  /** @type {number[]} */
  const pidBucket = [];

  for (const svc of discovery.services) {
    if (typeof svc.port === "number") {
      for (const pid of listenersOnPort(svc.port)) {
        if (pid !== dashboardPid || svc.port === DASHBOARD_PORT) {
          pidBucket.push(pid);
        }
      }
      continue;
    }

    const fragment = svc.processScript ?? (svc.id === "friendbot" ? FRIEND_BOT_PROCESS_FRAGMENT : null);

    if (fragment || svc.id === "friendbot") {
      const pids = svc.id === "friendbot"
        ? findFriendBotPids(getProductRepoPath(), { excludePids: [dashboardPid] })
        : findPidsByCommandFragment(fragment).filter((pid) => pid !== dashboardPid);

      for (const pid of pids) {
        pidBucket.push(pid);
      }
    }
  }

  warmProcessStarterCache(pidBucket, dashboardPid);
  warmProcessStartedAtCache(pidBucket);

  /**
   * @param {number} pid
   * @param {boolean} [isDashboard]
   */
  function mapListener(pid, isDashboard = false) {
    const starterInfo = resolveProcessStarter(pid, { dashboardPid });

    return {
      pid
    , isDashboard
    , user      : starterInfo.user
    , starter   : starterInfo.starter
    , label     : starterInfo.label
    , startedAt : getProcessStartedAt(pid)
    };
  }

  /** @type {Array<Record<string, unknown>>} */
  const rows = [];

  for (const svc of discovery.services) {
    if (typeof svc.port === "number") {
      const port      = svc.port;
      const listeners = listenersOnPort(port)
        .filter((pid) => pid !== dashboardPid || port === DASHBOARD_PORT)
        .map((pid) => mapListener(pid, pid === dashboardPid));

      rows.push({
        id          : svc.id
      , label       : svc.label ?? svc.id
      , description : svc.description ?? null
      , product     : svc.product ?? null
      , path      : svc.path ?? null
      , port
      , healthUrl : svc.healthUrl ?? null
      , openUrl   : svc.openUrl ?? null
      , listeners
      , listening : listeners.length > 0
      });
      continue;
    }

    const fragment = svc.processScript ?? (svc.id === "friendbot" ? FRIEND_BOT_PROCESS_FRAGMENT : null);

    if (!fragment && svc.id !== "friendbot") {
      continue;
    }

    const listeners = (svc.id === "friendbot"
      ? findFriendBotPids(getProductRepoPath(), { excludePids: [dashboardPid] })
      : findPidsByCommandFragment(fragment ?? ""))
      .filter((pid) => pid !== dashboardPid)
      .map((pid) => mapListener(pid));

    rows.push({
      id          : svc.id
    , label       : svc.label ?? svc.id
    , description : svc.description ?? null
    , product     : svc.product ?? null
    , path        : svc.path ?? null
    , port        : null
    , healthUrl : svc.healthUrl ?? null
    , openUrl   : svc.openUrl ?? null
    , listeners
    , listening : listeners.length > 0
    });
  }

  const productRoot = getProductRepoPath();
  const portalRoot  = getPortalRoot();
  const nodeProcs   = listProjectNodeProcesses({
    productRoot
  , portalRoot
  , excludePids : []
  });

  const extraPids = nodeProcs
    .map((row) => row.pid)
    .filter((pid) => !pidBucket.includes(pid));

  if (extraPids.length > 0) {
    warmProcessStarterCache(extraPids, dashboardPid);
    warmProcessStartedAtCache(extraPids);
  }

  /** @type {Set<number>} */
  const assignedPids = new Set();

  for (const row of rows) {
    for (const listener of row.listeners) {
      const pid = /** @type {{ pid?: number }} */ (listener).pid;

      if (typeof pid === "number") {
        assignedPids.add(pid);
      }
    }
  }

  const rowById = new Map(rows.map((row) => [String(row.id), row]));

  for (const np of nodeProcs) {
    if (assignedPids.has(np.pid)) {
      continue;
    }

    const serviceId = matchNodeProcessToServiceId(np.command);
    const target    = serviceId ? rowById.get(serviceId) : null;

    if (target) {
      target.listeners.push(mapListener(np.pid, np.pid === dashboardPid));
      target.listening = target.listeners.length > 0;
      assignedPids.add(np.pid);
    }
  }

  const portalName = basename(portalRoot);

  /** @type {Array<Record<string, unknown>>} */
  const nodeRows = nodeProcs
    .filter((np) => !assignedPids.has(np.pid))
    .map((np) => ({
      id          : `node-${np.pid}`
    , label       : "Node"
    , description : shortenNodeCommand(np.command)
    , product     : np.command.includes(portalName) ? "PortalAdmin" : "JustLastOne"
    , path        : shortenNodeCommand(np.command)
    , port        : null
    , healthUrl   : null
    , openUrl     : null
    , listeners   : [mapListener(np.pid, np.pid === dashboardPid)]
    , listening   : true
    , kind        : "node-process"
    , command     : np.command
    }));

  return {
    checkedAt : new Date().toISOString()
  , repoRoot  : discovery.repoRoot
  , rows
  , nodeRows
  };
}

// --- kill stack (Kill All, product-only, stack-complete) ---
/**
 * Termina orchestratore, listener sulle porte manifest e processi nest/turbo/friendBOT.
 *
 * @param {{ includeDashboard?: boolean, productOnly?: boolean, productStackComplete?: boolean }} [options]
 */
export async function stopRepoServices(options = {}) {
  const {
    includeDashboard     = false
  , productOnly          = false
  , productStackComplete = false
  } = options;

  logLines  = [];
  logSeq    = 0;
  stdoutBuf = "";
  stderrBuf = "";

  const startedAt = new Date().toISOString();
  const killLabel = productStackComplete
    ? "Kill stack completo"
    : productOnly
      ? "Kill product JustLastOne"
      : "Kill All";
  pushLogLine("system", `=== ${killLabel} — avvio ${startedAt} ===`);

  /** @type {Array<{ pid: number, ok: boolean, error?: string, source: string }>} */
  const stoppedPids = [];

  if (child?.pid) {
    pushLogLine("system", `Orchestratore: termino albero pid ${child.pid}…`);
    const outcome = killProcessTree(child.pid);
    stoppedPids.push({
      pid    : child.pid
    , ok     : outcome.ok
    , error  : outcome.error
    , source : "orchestrator"
    });

    if (outcome.ok) {
      pushLogLine("stdout", `Orchestratore: pid ${child.pid} terminato`);
    } else {
      pushLogLine("stderr", `Orchestratore: ${outcome.error ?? "errore sconosciuto"}`);
    }

    child         = null;
    state.running = false;
  } else {
    pushLogLine("stdout", "Orchestratore: nessun processo attivo dal cruscotto");
  }

  const discovery = await discoverRepoServices(getProductRepoPath(), {
    extras     : productStackComplete ? [...PRODUCT_STACK_COMPLETE_EXTRAS] : ["api-documentation", "dashboard"]
  , withPortal : productStackComplete ? false : true
  });

  const ports = discovery.services
    .filter((svc) => {
      if (!productStackComplete) {
        return true;
      }

      const stackIds = getDiscoveryConfig().stackStartServiceIds;

      if (stackIds.length > 0) {
        return stackIds.includes(String(svc.id ?? ""));
      }

      return svc.id !== "friendbot"
        && svc.id !== "dashboard"
        && svc.id !== "api-documentation";
    })
    .map((svc) => svc.port)
    .filter((port) => typeof port === "number")
    .filter((port) => includeDashboard || port !== DASHBOARD_PORT);

  pushLogLine("system", `Porte da liberare: ${ports.join(", ") || "—"}`);

  const excludePids = [process.pid];
  const excludeSet  = new Set(excludePids);
  const productRoot = getProductRepoPath();
  const nestPorts   = ports.filter((port) => PRODUCT_NEST_PORTS.includes(port));
  const otherPorts  = ports.filter((port) => !PRODUCT_NEST_PORTS.includes(port));

  /** @type {ReturnType<typeof killListenersOnPorts>} */
  let portResults = [];

  if (nestPorts.length > 0) {
    pushLogLine("system", `Kill nest/turbo (porte ${nestPorts.join(", ")}) + command line…`);
    const nestKill = killProductNestStack(productRoot, {
      excludePids
    , ports     : nestPorts
    });
    pushNestKillLogs(nestKill);

    for (const row of nestKill.portResults) {
      for (const pid of row.killed) {
        stoppedPids.push({
          pid
        , ok     : true
        , source : `port:${row.port}`
        });
      }

      for (const fail of row.failed) {
        stoppedPids.push({
          pid    : fail.pid
        , ok     : false
        , error  : fail.error
        , source : `port:${row.port}`
        });
      }
    }

    for (const outcome of nestKill.fragmentResults.results) {
      for (const pid of outcome.killed) {
        stoppedPids.push({
          pid
        , ok     : true
        , source : `fragment:${outcome.fragment}`
        });
      }

      for (const fail of outcome.failed) {
        stoppedPids.push({
          pid    : fail.pid
        , ok     : false
        , error  : fail.error
        , source : `fragment:${outcome.fragment}`
        });
      }
    }

    portResults = nestKill.portResults;
  }

  if (otherPorts.length > 0) {
    portResults = [
      ...portResults
    , ...killListenersOnPorts(otherPorts, { excludePids })
    ];
  }

  if (!productStackComplete) {
    const friendBotKill = killFriendBotProcesses(productRoot, { excludePids });
    const friendBotPids = [...new Set(friendBotKill.results.flatMap((row) => row.attempted))];

    if (friendBotPids.length > 0) {
      pushLogLine("system", `friendBOT JLO: pid ${friendBotPids.join(", ")}`);

      for (const outcome of friendBotKill.results) {
        for (const pid of outcome.killed) {
          if (stoppedPids.some((row) => row.pid === pid && row.ok)) {
            continue;
          }

          stoppedPids.push({
            pid
          , ok     : true
          , source : "friendbot"
          });
          pushLogLine("stdout", `friendBOT JLO: pid ${pid} terminato`);
        }

        for (const fail of outcome.failed) {
          stoppedPids.push({
            pid    : fail.pid
          , ok     : false
          , error  : fail.error
          , source : "friendbot"
          });
          pushLogLine("stderr", `friendBOT JLO: pid ${fail.pid} — ${fail.error ?? "kill fallito"}`);
        }
      }
    } else {
      pushLogLine("stdout", "friendBOT JLO: nessun processo attivo");
    }
  } else {
    pushLogLine("stdout", "friendBOT JLO: non incluso nello stack completo — skip");
  }

  for (const row of portResults) {
    const listeners = findListeningPids(row.port).filter((pid) => !excludeSet.has(pid));

    if (listeners.length === 0) {
      pushLogLine("stdout", `Porta ${row.port}: nessun listener`);
      continue;
    }

    pushLogLine("system", `Porta ${row.port}: listener pid ${listeners.join(", ")}`);

    for (const pid of row.killed) {
      stoppedPids.push({
        pid
      , ok     : true
      , source : `port:${row.port}`
      });
      pushLogLine("stdout", `Porta ${row.port}: pid ${pid} terminato`);
    }

    for (const fail of row.failed) {
      stoppedPids.push({
        pid    : fail.pid
      , ok     : false
      , error  : fail.error
      , source : `port:${row.port}`
      });
      pushLogLine("stderr", `Porta ${row.port}: pid ${fail.pid} — ${fail.error ?? "kill fallito"}`);
    }
  }

  const killedPorts = portResults
    .filter((row) => row.killed.length > 0)
    .map((row) => row.port);

  const okCount = stoppedPids.filter((row) => row.ok).length;
  const summary = killedPorts.length || okCount > 0
    ? `${killLabel} completato — porte liberate: ${killedPorts.join(", ") || "—"} · processi terminati: ${okCount}`
    : `${killLabel}: nessun processo dev attivo da terminare`;

  pushLogLine("system", `=== ${summary} ===`);
  state.error     = null;
  state.running   = false;

  return {
    ok           : true
  , summary
  , killedPorts
  , stoppedPids
  , stillRunning : state.running
  , logCursor    : logSeq
  , lines        : [...logLines]
  };
}

// --- database product SQLite dev (Process tab Database) ---
/**
 * Metadati file PRJ_DB_FILENAME: esistenza, dimensione, seed completato.
 */
export function getProductDatabaseStatus() {
  if (!HAS_PRODUCT_DATABASE) {
    return {
      enabled       : false
    , id            : "database"
    , label         : "Database"
    , product       : getProjectConfig().PRJ_NAME
    , description   : "Database product non configurato"
    , path          : ""
    , exists        : false
    , sizeBytes     : 0
    , createdAt     : null
    , seedCompletedAt : null
    , seedCompleted : false
    , filePath      : ""
    , checkedAt     : new Date().toISOString()
    };
  }

  const repoRoot = getProductRepoPath();
  const files    = resolveSqliteDbFiles();
  const mainFile = files[0] ?? "";
  const exists   = mainFile ? existsSync(mainFile) : false;
  let sizeBytes  = 0;
  let createdAt  = null;

  if (exists) {
    try {
      const stat = statSync(mainFile);
      sizeBytes  = stat.size;
      const when = stat.birthtimeMs > 0 ? stat.birthtime : stat.mtime;
      createdAt  = when.toISOString();
    } catch {
      sizeBytes = 0;
      createdAt = null;
    }
  }

  const relPath = mainFile
    ? relative(repoRoot, mainFile).replace(/\\/g, "/")
    : `${PRJ_DB_PRISMA_DIR}/${PRJ_DB_FILENAME}`;
  const { seedCompletedAt } = readDbSeedState();

  return {
    enabled       : true
  , id          : "database"
  , label       : "Database"
  , product     : "JustLastOne"
  , description : "SQLite Prisma — schema e seed dev"
  , path        : relPath
  , exists
  , sizeBytes
  , createdAt
  , seedCompletedAt
  , seedCompleted : seedCompletedAt != null
  , filePath    : mainFile
  , checkedAt   : new Date().toISOString()
  };
}

/**
 * @param {string} label
 * @returns {string | undefined}
 */
function hintDatabaseJobError(label) {
  const recent = logLines.slice(-80).map((row) => row.text).join("\n");

  if (/EPERM|operation not permitted/i.test(recent)) {
    return `${label}: prisma generate bloccato (file in uso). Usa Kill All, attendi 1–2 s e riprova.`;
  }

  return undefined;
}

/**
 * Allinea schema Prisma (db:push) senza eliminare JLO_DEV.db.
 */
export async function pushProductDatabase() {
  if (!HAS_PRODUCT_DATABASE) {
    return productDatabaseDisabledResult();
  }

  await stopProductStackForDatabaseJob();

  const result = await runPortalScriptJob(
    [INIT_DATABASE_DEV_SCRIPT, "--push"]
  , "Database db:push"
  );

  if (!result.ok) {
    const hint = hintDatabaseJobError("Database db:push");

    if (hint) {
      return { ...result, error: hint };
    }
  }

  return result;
}

/**
 * Elimina JLO_DEV.db (e journal/wal/shm) e ricrea schema (generate + push).
 */
export async function resetProductDatabase() {
  if (!HAS_PRODUCT_DATABASE) {
    return productDatabaseDisabledResult();
  }

  await stopProductStackForDatabaseJob();

  const result = await runPortalScriptJob(
    [INIT_DATABASE_DEV_SCRIPT, "--reset"]
  , "Database delete & create"
  );

  if (!result.ok) {
    const hint = hintDatabaseJobError("Database delete & create");

    if (hint) {
      return { ...result, error: hint };
    }
  }

  if (result.ok) {
    clearDbSeedState();
  }

  return result;
}

/**
 * Esegue npm run db:seed (righe host/player).
 */
export async function seedProductDatabase() {
  if (!HAS_PRODUCT_DATABASE) {
    return productDatabaseDisabledResult();
  }

  const result = await runPortalScriptJob(
    [INIT_DATABASE_DEV_SCRIPT, "--seed"]
  , "Database inizializza (seed)"
  );

  if (result.ok) {
    markDbSeedCompleted();
  }

  const { seedCompletedAt } = readDbSeedState();

  return {
    ...result
  , seedCompletedAt
  , seedCompleted : seedCompletedAt != null
  };
}

/**
 * @param {string} serviceId
 * @returns {Promise<{ started: boolean, serviceId?: string, pid?: number | null, error?: string, logCursor?: number }>}
 */
export async function startSingleRepoService(serviceId) {
  if (serviceId === "dashboard") {
    const discovery = await discoverRepoServices(getProductRepoPath(), {
      extras     : [...REPO_EXTRAS_ALL]
    , withPortal : true
    });

    const service    = discovery.services.find((svc) => svc.id === "dashboard");
    const targetPort = Number(service?.port ?? DASHBOARD_PORT);

    if (!Number.isFinite(targetPort) || targetPort <= 0) {
      return {
        started : false
      , error   : "porta cruscotto non valida nel manifest"
      };
    }

    logLines  = [];
    logSeq    = 0;
    stdoutBuf = "";
    stderrBuf = "";

    if (await isFullDashboardUp(targetPort)) {
      pushLogLine("stdout", `Cruscotto già attivo su :${targetPort} (/api/scripts OK)`);

      return {
        started   : true
      , serviceId : "dashboard"
      , pid       : null
      , logCursor : logSeq
      };
    }

    if (targetPort === DASHBOARD_PORT) {
      pushLogLine(
        "system"
      , `Avvio cruscotto su :${targetPort} (sessione corrente non risponde — spawn portal.dashboard.launch)…`
      );
    } else {
      pushLogLine(
        "system"
      , `Avvio cruscotto su :${targetPort} (istanza separata da :${DASHBOARD_PORT})…`
      );
    }

    const overlay = process.env.PRJ_NAME?.trim() || undefined;
    const spawned = spawnDashboardLauncher({
      port            : targetPort
    , overlay
    , productRepoPath : getProductRepoPath()
    , openBrowser     : false
    });

    pushLogLine(
      "stdout"
    , `Spawn admin.portal/portal.dashboard.launch.mjs — pid ${spawned.pid ?? "—"}`
    );

    return {
      started   : true
    , serviceId : "dashboard"
    , pid       : spawned.pid ?? null
    , logCursor : logSeq
    };
  }

  if (serviceId === "database") {
    return {
      started : false
    , error   : "usa Delete & create o Inizializza per il database"
    };
  }

  if (PRODUCT_CORE_SERVICE_IDS.includes(serviceId)) {
    logLines  = [];
    logSeq    = 0;
    stdoutBuf = "";
    stderrBuf = "";

    pushLogLine("system", `=== Avvio stack product (${serviceId}) via cruscotto.process.start.all.services ===`);

    const result = await runStartAllServicesJob([]);

    return {
      started   : result.ok
    , serviceId
    , pid       : null
    , error     : result.ok ? undefined : result.error
    , logCursor : logSeq
    };
  }

  const discovery = await discoverRepoServices(getProductRepoPath(), {
    extras     : [...REPO_EXTRAS_ALL]
  , withPortal : true
  });

  const service = discovery.services.find((svc) => svc.id === serviceId);

  if (!service) {
    return {
      started : false
    , error   : `servizio sconosciuto: ${serviceId}`
    };
  }

  const unit = resolveServiceStartUnit(discovery.repoRoot, service);

  if (!unit) {
    return {
      started : false
    , error   : `nessun comando di avvio per ${serviceId}`
    };
  }

  const spawned = spawnDetachedStartUnit(unit);

  return {
    started   : true
  , serviceId : serviceId
  , pid       : spawned.pid ?? null
  , logCursor : logSeq
  };
}

/**
 * Kill mirato su porta o fragment del servizio; non termina il cruscotto dashboard.
 *
 * @param {string} serviceId
 */
export async function stopSingleRepoService(serviceId) {
  if (serviceId === "dashboard") {
    const discovery = await discoverRepoServices(getProductRepoPath(), {
      extras     : [...REPO_EXTRAS_ALL]
    , withPortal : true
    });

    const service    = discovery.services.find((svc) => svc.id === "dashboard");
    const targetPort = Number(service?.port ?? DASHBOARD_PORT);

    if (!Number.isFinite(targetPort) || targetPort <= 0) {
      return {
        ok    : false
      , error : "porta cruscotto non valida nel manifest"
      };
    }

    if (targetPort === DASHBOARD_PORT) {
      return {
        ok    : false
      , error : "non puoi terminare il cruscotto di questa sessione — usa un altro overlay/porta o chiudi il terminale"
      };
    }

    logLines  = [];
    logSeq    = 0;
    stdoutBuf = "";
    stderrBuf = "";

    pushLogLine("system", `=== Kill cruscotto su :${targetPort} ===`);

    const killResult = killDashboardOnPort(targetPort);

    for (const pid of killResult.killed) {
      pushLogLine("stdout", `Terminato pid ${pid} (porta ${targetPort})`);
    }

    for (const fail of killResult.failed) {
      pushLogLine("stderr", `Kill pid ${fail.pid}: ${fail.error ?? "errore"}`);
    }

    return {
      ok      : killResult.killed.length > 0 || killResult.failed.length === 0
    , summary : killResult.killed.length > 0
        ? `Kill cruscotto :${targetPort} — ${killResult.killed.length} processo/i`
        : `Nessun listener su :${targetPort}`
    , logCursor : logSeq
    };
  }

  if (serviceId === "database") {
    return {
      ok    : false
    , error : "il database non è un processo — usa Delete & create"
    };
  }

  logLines  = [];
  logSeq    = 0;
  stdoutBuf = "";
  stderrBuf = "";

  pushLogLine("system", `=== Kill servizio ${serviceId} ===`);

  const discovery = await discoverRepoServices(getProductRepoPath(), {
    extras     : [...REPO_EXTRAS_ALL]
  , withPortal : true
  });

  const service     = discovery.services.find((svc) => svc.id === serviceId);
  const excludePids = [process.pid];
  /** @type {Array<{ pid: number, ok: boolean, source: string, error?: string }>} */
  const stoppedPids = [];

  if (!service) {
    return {
      ok    : false
    , error : `servizio sconosciuto: ${serviceId}`
    };
  }

  if (serviceId === "web" || serviceId === "api" || serviceId === "auth") {
    const nestKill = killProductNestService(
      /** @type {"web" | "api" | "auth"} */ (serviceId)
    , getProductRepoPath()
    , { excludePids }
    );

    pushNestKillLogs(nestKill);

    for (const row of nestKill.portResults) {
      for (const pid of row.killed) {
        stoppedPids.push({
          pid
        , ok     : true
        , source : `port:${row.port}`
        });
      }

      for (const fail of row.failed) {
        stoppedPids.push({
          pid    : fail.pid
        , ok     : false
        , error  : fail.error
        , source : `port:${row.port}`
        });
      }
    }

    for (const outcome of nestKill.fragmentResults.results) {
      for (const pid of outcome.killed) {
        stoppedPids.push({
          pid
        , ok     : true
        , source : `fragment:${outcome.fragment}`
        });
      }

      for (const fail of outcome.failed) {
        stoppedPids.push({
          pid    : fail.pid
        , ok     : false
        , error  : fail.error
        , source : `fragment:${outcome.fragment}`
        });
      }
    }

    if (process.platform === "win32" && nestKill.port) {
      await sleepMs(400);
      const retryPorts = killListenersOnPorts([nestKill.port], { excludePids });
      pushNestKillLogs({
        portResults     : retryPorts
      , fragmentResults : { results: [] }
      });

      for (const row of retryPorts) {
        for (const pid of row.killed) {
          stoppedPids.push({
            pid
          , ok     : true
          , source : `port-retry:${row.port}`
          });
        }
      }
    }
  } else if (typeof service.port === "number") {
    const portResults = killListenersOnPorts([service.port], { excludePids });

    for (const row of portResults) {
      for (const pid of row.killed) {
        stoppedPids.push({
          pid
        , ok     : true
        , source : `port:${row.port}`
        });
        pushLogLine("stdout", `Porta ${row.port}: pid ${pid} terminato`);
      }

      for (const fail of row.failed) {
        stoppedPids.push({
          pid    : fail.pid
        , ok     : false
        , error  : fail.error
        , source : `port:${row.port}`
        });
        pushLogLine("stderr", `Porta ${row.port}: pid ${fail.pid} — ${fail.error ?? "kill fallito"}`);
      }

      if (row.killed.length === 0 && row.failed.length === 0) {
        pushLogLine("stdout", `Porta ${row.port}: nessun listener`);
      }
    }
  } else if (serviceId === "friendbot") {
    const fragmentResults = killFriendBotProcesses(getProductRepoPath(), { excludePids });

    for (const outcome of fragmentResults.results) {
      for (const pid of outcome.killed) {
        stoppedPids.push({
          pid
        , ok     : true
        , source : `fragment:${outcome.fragment}`
        });
        pushLogLine("stdout", `${serviceId}: pid ${pid} terminato`);
      }

      for (const fail of outcome.failed) {
        stoppedPids.push({
          pid    : fail.pid
        , ok     : false
        , error  : fail.error
        , source : `fragment:${outcome.fragment}`
        });
        pushLogLine("stderr", `${serviceId}: pid ${fail.pid} — ${fail.error ?? "kill fallito"}`);
      }
    }

    if (fragmentResults.attemptedPids.length === 0) {
      pushLogLine("stdout", `${serviceId}: nessun processo attivo`);
    }
  } else {
    const fragment = typeof service.processScript === "string" ? service.processScript : null;

    if (!fragment) {
      return {
        ok    : false
      , error : `nessuna porta o processo per ${serviceId}`
      };
    }

    const outcome = killProcessesByCommandFragment(fragment, { excludePids });

    for (const pid of outcome.killed) {
      stoppedPids.push({
        pid
      , ok     : true
      , source : "process"
      });
      pushLogLine("stdout", `${serviceId}: pid ${pid} terminato`);
    }

    for (const fail of outcome.failed) {
      stoppedPids.push({
        pid    : fail.pid
      , ok     : false
      , error  : fail.error
      , source : "process"
      });
      pushLogLine("stderr", `${serviceId}: pid ${fail.pid} — ${fail.error ?? "kill fallito"}`);
    }

    if (outcome.attempted.length === 0) {
      pushLogLine("stdout", `${serviceId}: nessun processo attivo`);
    }
  }

  const okCount = stoppedPids.filter((row) => row.ok).length;
  const summary = okCount > 0
    ? `Kill ${serviceId}: ${okCount} processo/i terminato/i`
    : `Kill ${serviceId}: nessun processo attivo`;

  pushLogLine("system", `=== ${summary} ===`);

  return {
    ok        : true
  , summary
  , serviceId
  , stoppedPids
  , logCursor : logSeq
  , lines     : [...logLines]
  };
}
