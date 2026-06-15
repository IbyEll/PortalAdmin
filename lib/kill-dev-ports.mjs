/**
 * Termina processi in ascolto su porte TCP locali (dev stack).
 */

import { spawnSync } from "node:child_process";

/**
 * @param {string} output
 * @param {number} port
 * @returns {number[]}
 */
function parseWindowsNetstatPids(output, port) {
  const portPattern = new RegExp(`:${port}\\s`, "i");
  /** @type {Set<number>} */
  const pids = new Set();

  for (const line of output.split(/\r?\n/)) {
    if (!portPattern.test(line) || !/LISTENING/i.test(line)) {
      continue;
    }

    const parts = line.trim().split(/\s+/);
    const pid   = Number(parts[parts.length - 1]);

    if (Number.isInteger(pid) && pid > 0) {
      pids.add(pid);
    }
  }

  return [...pids];
}

/**
 * @param {string} output
 * @returns {number[]}
 */
function parseUnixLsofPids(output) {
  return output
    .split(/\r?\n/)
    .map((line) => Number(line.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

/**
 * @param {number} port
 * @returns {number[]}
 */
export function findListeningPids(port) {
  if (process.platform === "win32") {
    const result = spawnSync("netstat", ["-ano"], {
      encoding : "utf8"
    , shell    : true
    });

    if (result.status !== 0 || !result.stdout) {
      return [];
    }

    return parseWindowsNetstatPids(result.stdout, port);
  }

  const result = spawnSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], {
    encoding : "utf8"
  });

  if (!result.stdout) {
    return [];
  }

  return parseUnixLsofPids(result.stdout);
}

/**
 * @param {number} pid
 * @returns {{ ok: boolean, error?: string }}
 */
export function killProcessTree(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return { ok: false, error: "pid invalido" };
  }

  if (pid === process.pid) {
    return { ok: false, error: "rifiutato: pid corrente dashboard" };
  }

  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      encoding : "utf8"
    , shell    : true
    });

    if (result.status === 0) {
      return { ok: true };
    }

    const message = (result.stderr || result.stdout || "").trim();
    return {
      ok    : false
    , error : message || `taskkill exit ${result.status ?? 1}`
    };
  }

  const result = spawnSync("kill", ["-TERM", `-${pid}`], { encoding: "utf8" });

  if (result.status === 0) {
    return { ok: true };
  }

  const single = spawnSync("kill", ["-TERM", String(pid)], { encoding: "utf8" });

  if (single.status === 0) {
    return { ok: true };
  }

  return {
    ok    : false
  , error : (single.stderr || single.stdout || "").trim() || "kill fallito"
  };
}

/**
 * @param {number} port
 * @param {{ excludePids?: number[] }} [options]
 */
export function killListenersOnPort(port, options = {}) {
  const exclude = new Set(options.excludePids ?? []);
  const pids    = findListeningPids(port).filter((pid) => !exclude.has(pid));

  /** @type {Array<{ pid: number, ok: boolean, error?: string }>} */
  const results = [];

  for (const pid of pids) {
    const outcome = killProcessTree(pid);
    results.push({
      pid
    , ok    : outcome.ok
    , error : outcome.error
    });
  }

  return {
    port
  , attempted : pids
  , killed    : results.filter((row) => row.ok).map((row) => row.pid)
  , failed    : results.filter((row) => !row.ok)
  };
}

/**
 * @param {number[]} ports
 * @param {{ excludePids?: number[] }} [options]
 */
export function killListenersOnPorts(ports, options = {}) {
  const unique = [...new Set(ports.filter((port) => Number.isInteger(port) && port > 0))];

  return unique.map((port) => killListenersOnPort(port, options));
}

/**
 * @param {string} fragment
 * @returns {number[]}
 */
function findWindowsPidsByCommandFragment(fragment) {
  const escaped = fragment.replace(/'/g, "''");
  const script  = `
$ErrorActionPreference = 'SilentlyContinue'
$needle = '${escaped}'
$names = @('node.exe', 'turbo.exe')
$pids = Get-CimInstance Win32_Process | Where-Object { $names -contains $_.Name } | ForEach-Object {
  $cmd = [string]$_.CommandLine
  if (-not $cmd) { return }
  if ($cmd -like "*$needle*") { [int]$_.ProcessId }
}
if ($pids) { $pids | Sort-Object -Unique | ConvertTo-Json -Compress }
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
    const parsed = JSON.parse(raw);

    return (Array.isArray(parsed) ? parsed : [parsed])
      .map((pid) => Number(pid))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

/**
 * @param {string} fragment
 * @returns {number[]}
 */
export function findPidsByCommandFragment(fragment) {
  if (!fragment || typeof fragment !== "string") {
    return [];
  }

  if (process.platform === "win32") {
    return findWindowsPidsByCommandFragment(fragment);
  }

  const result = spawnSync("pgrep", ["-f", fragment], { encoding: "utf8" });

  if (!result.stdout) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => Number(line.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

/**
 * @param {string} fragment
 * @param {{ excludePids?: number[] }} [options]
 */
export function killProcessesByCommandFragment(fragment, options = {}) {
  const exclude = new Set(options.excludePids ?? []);
  const pids    = findPidsByCommandFragment(fragment).filter((pid) => !exclude.has(pid));

  /** @type {Array<{ pid: number, ok: boolean, error?: string }>} */
  const results = [];

  for (const pid of pids) {
    const outcome = killProcessTree(pid);
    results.push({
      pid
    , ok    : outcome.ok
    , error : outcome.error
    });
  }

  return {
    fragment
  , attempted : pids
  , killed    : results.filter((row) => row.ok).map((row) => row.pid)
  , failed    : results.filter((row) => !row.ok)
  };
}
