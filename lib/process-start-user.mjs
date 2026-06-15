/**
 * Risolve utente Windows/Unix e provenienza avvio (Cursor, cruscotto, terminale).
 */

import { spawnSync } from "node:child_process";

/** @typedef {"cursor" | "dashboard" | "user" | "unknown"} ProcessStarterKind */

/**
 * @typedef {{
 *   user: string | null
 *   starter: ProcessStarterKind
 *   label: string
 * }} ProcessStarterInfo
 */

/** @type {Map<number, ProcessStarterInfo>} */
const cache = new Map();

/**
 * @param {ProcessStarterKind} starter
 * @param {string | null} [user]
 * @returns {ProcessStarterInfo}
 */
function pack(starter, user = null) {
  const label = starter === "cursor"
    ? "Cursor"
    : starter === "dashboard"
      ? "Cruscotto"
      : starter === "user"
        ? "Utente"
        : "—";

  return { user, starter, label };
}

/**
 * @param {string} name
 * @param {string} cmd
 * @returns {boolean}
 */
function isCursorProcess(name, cmd) {
  const hay = `${name} ${cmd}`.toLowerCase();

  return hay.includes("cursor")
    || /cursor\.exe/i.test(name)
    || /cursor helper/i.test(name);
}

/**
 * @param {string} cmd
 * @returns {boolean}
 */
function isDashboardProcess(cmd) {
  return /dashboard-server|start-repo-services\.mjs|portaladmin/i.test(cmd);
}

/**
 * @param {number} pid
 * @param {number} dashboardPid
 * @returns {ProcessStarterInfo}
 */
function resolveWindows(pid, dashboardPid) {
  warmProcessStarterCache([pid], dashboardPid);

  return cache.get(pid) ?? pack("unknown");
}

/**
 * @param {number[]} pids
 * @param {number} dashboardPid
 */
function resolveWindowsBatch(pids, dashboardPid) {
  const unique = [...new Set(pids.filter((pid) => Number.isInteger(pid) && pid > 0))];

  if (unique.length === 0) {
    return;
  }

  const pidList = unique.join(",");
  const script  = `
$ErrorActionPreference = 'SilentlyContinue'
$dashboardPid = ${dashboardPid}
$pids = @(${pidList})
function Get-Starter([int]$targetPid) {
  if ($targetPid -eq $dashboardPid) {
    return @{ pid = $targetPid; user = $env:USERNAME; starter = 'dashboard' }
  }
  $cursor = $false
  $dashboard = $false
  $user = $null
  $node = Get-CimInstance Win32_Process -Filter "ProcessId=$targetPid"
  if ($node) {
    $owner = Invoke-CimMethod -InputObject $node -MethodName GetOwner
    if ($owner.User) { $user = $owner.User }
  }
  $seen = @{}
  while ($node -and -not $seen.ContainsKey($node.ProcessId)) {
    $seen[$node.ProcessId] = $true
    $name = [string]$node.Name
    $cmd = [string]$node.CommandLine
    if ($node.ProcessId -eq $dashboardPid -or ($cmd -match 'dashboard-server|start-repo-services\\.mjs')) {
      $dashboard = $true
    }
    if ($name -match 'Cursor' -or $cmd -match '\\\\cursor\\\\|/cursor/|Cursor\\.exe') {
      $cursor = $true
    }
    $parentId = [int]$node.ParentProcessId
    if ($parentId -le 0) { break }
    $node = Get-CimInstance Win32_Process -Filter "ProcessId=$parentId"
  }
  $starter = if ($dashboard) { 'dashboard' } elseif ($cursor) { 'cursor' } else { 'user' }
  @{ pid = $targetPid; user = $user; starter = $starter }
}
$results = foreach ($procId in $pids) { Get-Starter $procId }
$results | ConvertTo-Json -Compress
`.trim();

  const result = spawnSync(
    "powershell"
  , ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script]
  , { encoding: "utf8", timeout: 20000 }
  );

  const raw = (result.stdout ?? "").trim();

  if (!raw) {
    for (const pid of unique) {
      cache.set(pid, pack("unknown"));
    }

    return;
  }

  try {
    const parsed   = JSON.parse(raw);
    const entries  = Array.isArray(parsed) ? parsed : [parsed];

    for (const row of entries) {
      const pid = Number(row.pid);

      if (!Number.isInteger(pid) || pid <= 0) {
        continue;
      }

      const starter = /** @type {ProcessStarterKind} */ (
        row.starter === "cursor" || row.starter === "dashboard" || row.starter === "user"
          ? row.starter
          : "user"
      );
      const user = typeof row.user === "string" && row.user ? row.user : null;

      cache.set(pid, pack(starter, user));
    }
  } catch {
    for (const pid of unique) {
      cache.set(pid, pack("unknown"));
    }
  }

  for (const pid of unique) {
    if (!cache.has(pid)) {
      cache.set(pid, pack("unknown"));
    }
  }
}

/**
 * @param {number} pid
 * @returns {string | null}
 */
function readUnixUser(pid) {
  const result = spawnSync("ps", ["-o", "user=", "-p", String(pid)], { encoding: "utf8" });

  const user = (result.stdout ?? "").trim();

  return user || null;
}

/**
 * @param {number} pid
 * @returns {{ ppid: number, command: string } | null}
 */
function readUnixProcess(pid) {
  const result = spawnSync("ps", ["-o", "ppid=,command=", "-p", String(pid)], { encoding: "utf8" });
  const line   = (result.stdout ?? "").trim();

  if (!line) {
    return null;
  }

  const match = line.match(/^(\d+)\s+(.*)$/);

  if (!match) {
    return null;
  }

  return {
    ppid    : Number(match[1])
  , command : match[2] ?? ""
  };
}

/**
 * @param {number} pid
 * @param {number} dashboardPid
 * @returns {ProcessStarterInfo}
 */
function resolveUnix(pid, dashboardPid) {
  const user = readUnixUser(pid);
  let cursor    = false;
  let dashboard = false;
  let current   = pid;
  const seen    = new Set();

  for (let depth = 0; depth < 24; depth += 1) {
    if (!current || seen.has(current)) {
      break;
    }

    seen.add(current);

    if (current === dashboardPid) {
      dashboard = true;
      break;
    }

    const row = readUnixProcess(current);

    if (!row) {
      break;
    }

    if (isDashboardProcess(row.command)) {
      dashboard = true;
    }

    if (isCursorProcess("", row.command)) {
      cursor = true;
    }

    current = row.ppid;
  }

  if (dashboard) {
    return pack("dashboard", user);
  }

  if (cursor) {
    return pack("cursor", user);
  }

  return pack("user", user);
}

/**
 * @param {number} pid
 * @param {{ dashboardPid?: number, useCache?: boolean }} [options]
 * @returns {ProcessStarterInfo}
 */
export function resolveProcessStarter(pid, options = {}) {
  const dashboardPid = options.dashboardPid ?? process.pid;
  const useCache     = options.useCache !== false;

  if (!Number.isInteger(pid) || pid <= 0) {
    return pack("unknown");
  }

  if (useCache && cache.has(pid)) {
    return cache.get(pid);
  }

  let info = pack("unknown");

  if (pid === dashboardPid) {
    info = pack("dashboard", process.env.USER ?? process.env.USERNAME ?? null);
  } else if (process.platform === "win32") {
    info = resolveWindows(pid, dashboardPid);
  } else {
    info = resolveUnix(pid, dashboardPid);
  }

  if (useCache) {
    cache.set(pid, info);
  }

  return info;
}

/** Svuota cache (es. tra refresh processi). */
export function clearProcessStarterCache() {
  cache.clear();
}

/**
 * Precarica la cache per più PID (una sola shell su Windows).
 * @param {number[]} pids
 * @param {number} [dashboardPid]
 */
export function warmProcessStarterCache(pids, dashboardPid = process.pid) {
  const pending = [...new Set(
    pids.filter((pid) => Number.isInteger(pid) && pid > 0 && !cache.has(pid))
  )];

  if (pending.length === 0) {
    return;
  }

  if (process.platform === "win32") {
    resolveWindowsBatch(pending, dashboardPid);
    return;
  }

  for (const pid of pending) {
    cache.set(pid, resolveUnix(pid, dashboardPid));
  }
}
