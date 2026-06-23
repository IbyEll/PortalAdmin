/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:30
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:30   by: IbyEll
 * modificato il: 2026-06-23 21:30   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Elenco processi node.exe legati al product repo e a PortalAdmin (HOME diagnostica).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - HOME PortalAdmin offre kill mirato processi node legati al checkout senza Task Manager.
 *
 *   A cosa serve:
 *   - Scansiona WMI/ps, filtra command line su portal e product path, kill PID singolo o tutti.
 *
 * Generalizzazione:
 *   Si — portalRoot e productRoot passati dal caller HOME server.
 *
 * Input:
 *   - portalRoot — root checkout PortalAdmin
 *   - productRoot — PRODUCT_REPO_PATH corrente
 *
 * Consumatori:
 *   - admin.portal/portal.home.server.mjs — API GET/DELETE node processes
 *
 * Export principali:
 *   - listProjectNodeProcesses — elenco ProjectNodeProcess pid e command
 *   - shortenNodeCommand, formatProjectNodeProcessesText — etichette UI console HOME
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

/**
 * @typedef {{
 *   pid: number
 *   command: string
 * }} ProjectNodeProcess
 */

/**
 * @param {string} command
 * @returns {string}
 */
export function shortenNodeCommand(command) {
  const text = command.trim();

  if (!text) {
    return "node";
  }

  const normalized = text.replace(/\\/g, "/");
  const nodeIdx    = normalized.toLowerCase().indexOf("node");

  if (nodeIdx >= 0) {
    const tail = normalized.slice(nodeIdx).replace(/\s+/g, " ");

    return tail.length > 120 ? `${tail.slice(0, 117)}…` : tail;
  }

  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

/**
 * @param {string} command
 * @returns {string | null}
 */
export function matchNodeProcessToServiceId(command) {
  const lower = command.toLowerCase().replace(/\\/g, "/");

  if (/friend-bot|friendbot/.test(lower)) {
    return "friendbot";
  }

  if (/cruscotto.api.documentation.server.mjs|api-documentation/.test(lower)) {
    return "api-documentation";
  }

  if (/dashboard-server|admin:dashboard/.test(lower)) {
    return "dashboard";
  }

  if (
    /apps\/authentication/.test(lower)
    || /@justlastone\/auth/.test(lower)
    || /#dev.*@justlastone\/auth/.test(lower)
  ) {
    return "auth";
  }

  if (
    /apps\/api[^a-z-]/.test(lower)
    || /apps\/api$/.test(lower)
    || /@justlastone\/api[^a-z-]/.test(lower)
    || /#dev.*@justlastone\/api/.test(lower)
  ) {
    return "api";
  }

  if (
    /apps\/web/.test(lower)
    || /@justlastone\/web/.test(lower)
    || /#dev.*@justlastone\/web/.test(lower)
  ) {
    return "web";
  }

  if (/init_Database_DEV\.mjs|db-dev\.mjs|db:seed|db:generate|db:push|prisma/.test(lower)) {
    return "database";
  }

  return null;
}

/**
 * @param {ProjectNodeProcess[]} processes
 * @returns {string}
 */
export function formatProjectNodeProcessesText(processes) {
  if (processes.length === 0) {
    return "Nessun processo node.exe trovato per i marker configurati.";
  }

  const lines = processes.map((row) => {
    const service = matchNodeProcessToServiceId(row.command) ?? "—";
    const short   = shortenNodeCommand(row.command);

    return `PID ${String(row.pid).padStart(6)}  ${service.padEnd(18)}  ${short}`;
  });

  return ["PID      servizio            comando", "─".repeat(72), ...lines].join("\n");
}

/**
 * @param {string} command
 * @returns {boolean}
 */
function isIgnoredGlobalNodeProcess(command) {
  const lower = command.replace(/\\/g, "/").toLowerCase();

  return (
    /cursor\/resources\//.test(lower)
    || /vscode\/extensions\//.test(lower)
    || /typescript\/lib\/(tsserver|typingsinstaller)/.test(lower)
    || /\btsserver\.js\b/.test(lower)
    || /\btypingsinstaller\.js\b/.test(lower)
  );
}

/**
 * @param {string} name
 * @param {string} subPath
 * @returns {boolean}
 */
function shouldIndexRepoSubdir(name, subPath) {
  if (/^(admin\.portal|cruscotto\.|runner|apps|PROJECT_)/i.test(name)) {
    return true;
  }

  try {
    for (const child of readdirSync(subPath, { withFileTypes: true })) {
      if (!child.isDirectory() && /\.mjs$/i.test(child.name)) {
        return true;
      }
    }
  } catch {
    // sottocartella non listabile
  }

  return false;
}

/**
 * Aghi di ricerca per command line: path completo, basename e script relativi dalla root repo.
 *
 * @param {string[]} markers
 * @returns {string[]}
 */
function buildMarkerNeedles(markers) {
  /** @type {Set<string>} */
  const needles = new Set();

  for (const marker of markers) {
    if (typeof marker !== "string" || !marker.trim()) {
      continue;
    }

    const trimmed = marker.trim();
    const norm    = trimmed.replace(/\\/g, "/").replace(/\/+$/, "");

    needles.add(norm);
    needles.add(trimmed.replace(/[\\/]+$/, ""));

    const base = basename(norm);

    if (base.length >= 3) {
      needles.add(base);
    }

    if (!existsSync(trimmed)) {
      continue;
    }

    try {
      for (const entry of readdirSync(trimmed, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue;
        }

        const name = entry.name;

        if (name.startsWith(".") || name === "node_modules") {
          continue;
        }

        const sub = join(trimmed, name);

        if (!shouldIndexRepoSubdir(name, sub)) {
          continue;
        }

        needles.add(`${name}/`);
        needles.add(`${name}\\`);

        try {
          for (const child of readdirSync(sub, { withFileTypes: true })) {
            if (child.isDirectory()) {
              continue;
            }

            if (/\.mjs$|\.cjs$|\.js$/i.test(child.name)) {
              needles.add(`${name}/${child.name}`);
              needles.add(`${name}\\${child.name}`);
            }
          }
        } catch {
          // sottocartella non listabile
        }
      }
    } catch {
      // marker non listabile
    }
  }

  return [...needles].filter((needle) => needle.length >= 3);
}

/**
 * @param {string} command
 * @param {string[]} needles
 * @returns {boolean}
 */
function commandMatchesNeedles(command, needles) {
  const cmd = command.replace(/\\/g, "/").toLowerCase();

  for (const needle of needles) {
    const n = needle.replace(/\\/g, "/").toLowerCase();

    if (n.length < 3) {
      continue;
    }

    if (cmd.includes(n)) {
      return true;
    }
  }

  return false;
}

/**
 * @param {string[]} markers
 * @param {Set<number>} exclude
 * @returns {ProjectNodeProcess[]}
 */
function listWindowsNodeProcesses(markers, exclude) {
  const needles = buildMarkerNeedles(markers);

  if (needles.length === 0) {
    return [];
  }

  const script = `
$ErrorActionPreference = 'SilentlyContinue'
$out = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object {
  @{ pid = [int]$_.ProcessId; command = [string]$_.CommandLine }
}
if ($out) { $out | ConvertTo-Json -Compress }
`.trim();

  const result = spawnSync(
    "powershell"
  , ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script]
  , { encoding: "utf8", timeout: 25000 }
  );

  const raw = (result.stdout ?? "").trim();

  if (!raw) {
    return [];
  }

  try {
    const parsed  = JSON.parse(raw);
    const entries = Array.isArray(parsed) ? parsed : [parsed];

    return entries
      .map((row) => ({
        pid     : Number(row.pid)
      , command : typeof row.command === "string" ? row.command : ""
      }))
      .filter((row) => Number.isInteger(row.pid) && row.pid > 0 && row.command)
      .filter((row) => !exclude.has(row.pid))
      .filter((row) => !isIgnoredGlobalNodeProcess(row.command))
      .filter((row) => commandMatchesNeedles(row.command, needles));
  } catch {
    return [];
  }
}

/**
 * @param {string[]} markers
 * @param {Set<number>} exclude
 * @returns {ProjectNodeProcess[]}
 */
function listUnixNodeProcesses(markers, exclude) {
  /** @type {Map<number, ProjectNodeProcess>} */
  const found = new Map();

  for (const marker of markers) {
    const result = spawnSync("pgrep", ["-af", marker], { encoding: "utf8" });

    if (!result.stdout) {
      continue;
    }

    for (const line of result.stdout.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || !/node/i.test(trimmed)) {
        continue;
      }

      const match = trimmed.match(/^(\d+)\s+(.*)$/);

      if (!match) {
        continue;
      }

      const pid = Number(match[1]);

      if (!Number.isInteger(pid) || pid <= 0 || exclude.has(pid)) {
        continue;
      }

      found.set(pid, {
        pid
      , command : match[2] ?? ""
      });
    }
  }

  return [...found.values()];
}

/**
 * @param {{
 *   productRoot?: string
 *   portalRoot?: string
 *   markers?: string[]
 *   excludePids?: number[]
 * }} options
 * @returns {ProjectNodeProcess[]}
 */
export function listProjectNodeProcesses(options) {
  const { productRoot, portalRoot, markers: markerOverride, excludePids = [] } = options;
  const exclude = new Set(excludePids.filter((pid) => Number.isInteger(pid) && pid > 0));
  const markers = markerOverride?.length
    ? markerOverride.filter((path) => typeof path === "string" && path.length > 0)
    : [productRoot, portalRoot].filter((path) => typeof path === "string" && path.length > 0);

  if (markers.length === 0) {
    return [];
  }

  if (process.platform === "win32") {
    return listWindowsNodeProcesses(markers, exclude);
  }

  return listUnixNodeProcesses(markers, exclude);
}
