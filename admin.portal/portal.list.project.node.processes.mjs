/**
 * Elenco processi node.exe legati al product repo e a PortalAdmin.
 */

import { spawnSync } from "node:child_process";
import { basename } from "node:path";

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
 * @param {string[]} markers
 * @param {Set<number>} exclude
 * @returns {ProjectNodeProcess[]}
 */
function listWindowsNodeProcesses(markers, exclude) {
  const tags = [...new Set(markers.map((path) => basename(path)).filter(Boolean))];

  if (tags.length === 0) {
    return [];
  }

  const tagList = tags.map((tag) => `'${tag.replace(/'/g, "''")}'`).join(",");
  const script  = `
$ErrorActionPreference = 'SilentlyContinue'
$tags = @(${tagList})
$exclude = @(${[...exclude].join(",")})
$out = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object {
  $procId = [int]$_.ProcessId
  if ($exclude -contains $procId) { return }
  $cmd = [string]$_.CommandLine
  if (-not $cmd) { return }
  $hit = $false
  foreach ($tag in $tags) {
    if ($cmd -like "*$tag*") { $hit = $true; break }
  }
  if (-not $hit) { return }
  @{ pid = $procId; command = $cmd }
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
      .filter((row) => Number.isInteger(row.pid) && row.pid > 0 && row.command);
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
