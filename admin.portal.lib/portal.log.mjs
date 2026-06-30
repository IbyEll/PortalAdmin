/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** — admin.portal.lib/portal.log.mjs (ADMIN-159)
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * Ring buffer log condiviso con livelli, source e filtro PORTAL_LOG_LEVEL.
 * Persistenza opzionale su file rotante (ADMIN-167, PORTAL_LOG_FILE=1).
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @typedef {"debug" | "info" | "warn" | "error"} LogLevel */
/** @typedef {"stdout" | "stderr" | "system" | "assistant" | "workflow"} LogStream */

/**
 * @typedef {{
 *   seq    : number
 *   at     : string
 *   source : string
 *   stream : LogStream | string
 *   level  : LogLevel
 *   text   : string
 * }} PortalLogLine
 */

const LEVEL_RANK = /** @type {Record<LogLevel, number>} */ ({
  debug : 0
, info  : 1
, warn  : 2
, error : 3
});

const DEFAULT_MAX_LINES = Number(process.env.PORTAL_LOG_MAX_LINES ?? "5000") || 5000;

/** @type {PortalLogLine[]} */
let lines = [];

/** @type {number} */
let seq = 0;

/** @type {LogLevel} */
let minLevel = resolveMinLevel();

/** @type {boolean | null} */
let fileLogEnabled = null;

/** @type {string | null} */
let fileLogPath = null;

/**
 * @returns {LogLevel}
 */
function resolveMinLevel() {
  const raw = String(process.env.PORTAL_LOG_LEVEL ?? "info").trim().toLowerCase();

  if (raw in LEVEL_RANK) {
    return /** @type {LogLevel} */ (raw);
  }

  return "info";
}

/**
 * @param {LogLevel} level
 * @returns {boolean}
 */
function levelPasses(level) {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel];
}

/**
 * @param {LogStream | string} stream
 * @returns {LogLevel}
 */
function levelFromStream(stream) {
  if (stream === "stderr") {
    return "error";
  }

  if (stream === "system" || stream === "workflow") {
    return "info";
  }

  return "info";
}

/**
 * @returns {boolean}
 */
function isFileLogEnabled() {
  if (fileLogEnabled != null) {
    return fileLogEnabled;
  }

  const raw = String(process.env.PORTAL_LOG_FILE ?? "").trim().toLowerCase();
  fileLogEnabled = raw === "1" || raw === "true" || raw === "yes";
  return fileLogEnabled;
}

/**
 * @returns {string}
 */
function resolveFileLogPath() {
  if (fileLogPath) {
    return fileLogPath;
  }

  const day = new Date().toISOString().slice(0, 10);
  fileLogPath = join(PORTAL_ROOT, "admin.portal", "logs", `portal-${day}.log`);
  return fileLogPath;
}

/**
 * @param {PortalLogLine} row
 */
function appendFileRow(row) {
  if (!isFileLogEnabled()) {
    return;
  }

  try {
    const path = resolveFileLogPath();
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(
      path
    , `${row.at}\t${row.source}\t${row.stream}\t${row.level}\t${row.text.replace(/\r?\n/g, "\\n")}\n`
    , "utf8"
    );
  } catch {
    // best-effort — non bloccare il bus in-memory
  }
}

/**
 * @param {{
 *   source : string
 *   stream?: LogStream | string
 *   level? : LogLevel
 *   text   : string
 * }} entry
 * @returns {PortalLogLine | null}
 */
function pushEntry(entry) {
  const trimmed = entry.text.trimEnd();

  if (!trimmed) {
    return null;
  }

  const level = entry.level ?? levelFromStream(entry.stream ?? "stdout");

  if (!levelPasses(level)) {
    return null;
  }

  seq += 1;

  /** @type {PortalLogLine} */
  const row = {
    seq
  , at     : new Date().toISOString()
  , source : entry.source
  , stream : entry.stream ?? "stdout"
  , level
  , text   : trimmed
  };

  lines.push(row);

  if (lines.length > DEFAULT_MAX_LINES) {
    lines = lines.slice(-DEFAULT_MAX_LINES);
  }

  appendFileRow(row);
  return row;
}

/**
 * @param {string} source
 * @returns {{
 *   debug  : (text: string, stream?: LogStream | string) => PortalLogLine | null
 *   info   : (text: string, stream?: LogStream | string) => PortalLogLine | null
 *   warn   : (text: string, stream?: LogStream | string) => PortalLogLine | null
 *   error  : (text: string, stream?: LogStream | string) => PortalLogLine | null
 *   write  : (stream: LogStream | string, text: string, level?: LogLevel) => PortalLogLine | null
 * }}
 */
export function createLogger(source) {
  return {
    debug(text, stream = "stdout") {
      return pushEntry({ source, stream, level: "debug", text });
    }
  , info(text, stream = "stdout") {
      return pushEntry({ source, stream, level: "info", text });
    }
  , warn(text, stream = "stderr") {
      return pushEntry({ source, stream, level: "warn", text });
    }
  , error(text, stream = "stderr") {
      return pushEntry({ source, stream, level: "error", text });
    }
  , write(stream, text, level) {
      return pushEntry({ source, stream, level, text });
    }
  };
}

/**
 * Compatibilità consumer legacy — omette source/level se non richiesti.
 *
 * @param {PortalLogLine} row
 * @param {boolean} [extended]
 */
function serializeLine(row, extended = false) {
  const base = {
    seq    : row.seq
  , stream : row.stream
  , text   : row.text
  , at     : row.at
  };

  if (!extended) {
    return base;
  }

  return {
    ...base
  , source : row.source
  , level  : row.level
  };
}

/**
 * @param {{
 *   cursor? : number
 *   source? : string | null
 *   level?  : LogLevel | null
 *   extended?: boolean
 * }} [options]
 */
export function getLogs(options = {}) {
  const since    = Number(options.cursor) || 0;
  const source   = options.source?.trim().toLowerCase() || null;
  const minRank  = options.level && options.level in LEVEL_RANK
    ? LEVEL_RANK[/** @type {LogLevel} */ (options.level)]
    : null;
  const extended = options.extended === true;

  const filtered = lines.filter((row) => {
    if (row.seq <= since) {
      return false;
    }

    if (source && source !== "all" && row.source !== source) {
      return false;
    }

    if (minRank != null && LEVEL_RANK[row.level] < minRank) {
      return false;
    }

    return true;
  });

  const next = lines.length > 0 ? lines[lines.length - 1].seq : since;

  return {
    cursor : next
  , lines  : filtered.map((row) => serializeLine(row, extended))
  , total  : lines.length
  };
}

/**
 * @param {{ source?: string | null, systemMessage?: string | null, silent?: boolean }} [options]
 */
export function clearLogs(options = {}) {
  const source = options.source?.trim() || null;

  if (!source) {
    lines = [];
    seq   = 0;
  } else {
    lines = lines.filter((row) => row.source !== source);
  }

  if (!options.silent) {
    const message = options.systemMessage !== undefined
      ? options.systemMessage
      : (source ? `— log ${source} svuotati —` : "— log console svuotata —");

    if (message) {
      const logger = createLogger(source ?? "system");
      logger.write("system", message, "info");
    }
  }

  return getLogs({ cursor: 0, source, extended: true });
}

/**
 * Ingest chunk testuale multi-riga (prepare/dashboard tail).
 *
 * @param {string} source
 * @param {string} chunk
 * @param {LogStream | string} [stream]
 */
export function ingestTextChunk(source, chunk, stream = "stdout") {
  const parts = String(chunk).split(/\r?\n/);

  for (const part of parts) {
    if (part.length > 0) {
      pushEntry({ source, stream, text: part });
    }
  }
}

/**
 * @param {LogLevel} [level]
 */
export function setPortalLogLevel(level) {
  if (level in LEVEL_RANK) {
    minLevel = level;
  }
}

export function getPortalLogLevel() {
  return minLevel;
}
