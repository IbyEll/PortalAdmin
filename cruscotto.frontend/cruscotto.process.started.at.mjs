/**
 * Data/ora avvio processo (per colonna Stato tabella process).
 */

import { spawnSync } from "node:child_process";

/** @type {Map<number, string | null>} */
const cache = new Map();

/**
 * @param {number} pid
 * @param {string | null} startedAt
 */
function cacheSet(pid, startedAt) {
  cache.set(pid, startedAt);
}

/**
 * @param {number[]} pids
 */
function resolveWindowsBatch(pids) {
  const unique  = [...new Set(pids.filter((pid) => Number.isInteger(pid) && pid > 0))];

  if (unique.length === 0) {
    return;
  }

  const pidList = unique.join(",");
  const script  = `
$ErrorActionPreference = 'SilentlyContinue'
$pids = @(${pidList})
$out = foreach ($procId in $pids) {
  $created = $null
  try {
    $proc = Get-Process -Id $procId -ErrorAction Stop
    if ($proc.StartTime) {
      $created = $proc.StartTime.ToUniversalTime().ToString('o')
    }
  } catch {}
  @{ pid = [int]$procId; startedAt = $created }
}
$out | ConvertTo-Json -Compress
`.trim();

  const result = spawnSync(
    "powershell"
  , ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script]
  , { encoding: "utf8", timeout: 20000 }
  );

  const raw = (result.stdout ?? "").trim();

  if (!raw) {
    for (const pid of unique) {
      cacheSet(pid, null);
    }

    return;
  }

  try {
    const parsed  = JSON.parse(raw);
    const entries = Array.isArray(parsed) ? parsed : [parsed];

    for (const row of entries) {
      const pid = Number(row.pid);

      if (!Number.isInteger(pid) || pid <= 0) {
        continue;
      }

      const startedAt = typeof row.startedAt === "string" && row.startedAt
        ? row.startedAt
        : null;

      cacheSet(pid, startedAt);
    }
  } catch {
    for (const pid of unique) {
      cacheSet(pid, null);
    }
  }

  for (const pid of unique) {
    if (!cache.has(pid)) {
      cacheSet(pid, null);
    }
  }
}

/**
 * @param {number} pid
 * @returns {string | null}
 */
function resolveUnix(pid) {
  const result = spawnSync("ps", ["-p", String(pid), "-o", "lstart="], { encoding: "utf8" });
  const text   = (result.stdout ?? "").trim();

  if (!text) {
    return null;
  }

  const when = new Date(text);

  return Number.isNaN(when.getTime()) ? null : when.toISOString();
}

export function clearProcessStartedAtCache() {
  cache.clear();
}

/**
 * @param {number[]} pids
 */
export function warmProcessStartedAtCache(pids) {
  const pending = [...new Set(
    pids.filter((pid) => Number.isInteger(pid) && pid > 0 && !cache.has(pid))
  )];

  if (pending.length === 0) {
    return;
  }

  if (process.platform === "win32") {
    resolveWindowsBatch(pending);
    return;
  }

  for (const pid of pending) {
    cacheSet(pid, resolveUnix(pid));
  }
}

/**
 * @param {number} pid
 * @returns {string | null}
 */
export function getProcessStartedAt(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return null;
  }

  if (cache.has(pid)) {
    return cache.get(pid) ?? null;
  }

  if (process.platform === "win32") {
    resolveWindowsBatch([pid]);
  } else {
    cacheSet(pid, resolveUnix(pid));
  }

  return cache.get(pid) ?? null;
}

/**
 * @param {Array<Record<string, unknown>>} listeners
 * @returns {string | null}
 */
export function earliestListenerStartedAt(listeners) {
  /** @type {string | null} */
  let best = null;

  for (const row of listeners) {
    const startedAt = typeof row.startedAt === "string" ? row.startedAt : null;

    if (!startedAt) {
      continue;
    }

    if (!best || startedAt < best) {
      best = startedAt;
    }
  }

  return best;
}
