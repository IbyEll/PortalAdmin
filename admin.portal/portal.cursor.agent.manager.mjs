/**
 * Orchestrazione Cursor Agent — spawn worker SDK, log incrementali e stato persistente.
 */

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import {
  getCursorAgentModel
, getCursorAgentPublicConfig
, getCursorAgentStatePath
, getCursorAgentWorkerPath
, getCursorApiKey
, getCursorCloudRepos
, getCursorDefaultRuntime
, getCursorLocalCwd
, isCursorAgentConfigured
} from "./portal.cursor.agent.config.mjs";
import {
  buildWorkflowEndBlock
, buildWorkflowStartBlock
, parseWorkflowPrompt
} from "./portal.cursor.agent.workflow.mjs";
import { getPortalRoot } from "../lib/portal-paths.mjs";

const ADMIN_PORTAL_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * @typedef {{
 *   seq: number
 *   stream: "stdout" | "stderr" | "system" | "assistant" | "workflow"
 *   text: string
 *   at: string
 * }} CursorAgentLogLine
 */

/**
 * @typedef {{
 *   running: boolean
 *   startedAt: string | null
 *   finishedAt: string | null
 *   runtime: "local" | "cloud" | null
 *   prompt: string | null
 *   agentId: string | null
 *   runId: string | null
 *   status: "idle" | "running" | "finished" | "error"
 *   error: string | null
 *   pid: number | null
 *   workflowKey: string | null
 *   workflowKind: "gogo" | "procedi" | null
 * }} CursorAgentStatus
 */

/** @type {CursorAgentStatus} */
const state = {
  running    : false
, startedAt  : null
, finishedAt : null
, runtime    : null
, prompt     : null
, agentId    : null
, runId      : null
, status     : "idle"
, error      : null
, pid        : null
, workflowKey: null
, workflowKind: null
};

/** @type {CursorAgentLogLine[]} */
let logLines = [];

/** @type {number} */
let logSeq = 0;

/** @type {import("node:child_process").ChildProcess | null} */
let child = null;

/**
 * @param {"stdout" | "stderr" | "system" | "assistant" | "workflow"} stream
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

  if (logLines.length > 4000) {
    logLines = logLines.slice(-3000);
  }
}

/**
 * @returns {Promise<void>}
 */
async function persistState() {
  const path = getCursorAgentStatePath();

  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify({
      state
    , lastAgentId : state.agentId
    , lastRunId   : state.runId
    , savedAt     : new Date().toISOString()
    }, null, 2)}\n`, "utf8");
  } catch {
    // persistenza best-effort
  }
}

/**
 * @returns {Promise<void>}
 */
async function loadPersistedState() {
  const path = getCursorAgentStatePath();

  try {
    const raw  = await readFile(path, "utf8");
    const data = JSON.parse(raw);

    if (data?.lastAgentId && !state.agentId) {
      state.agentId = data.lastAgentId;
    }

    if (data?.lastRunId && !state.runId) {
      state.runId = data.lastRunId;
    }
  } catch {
    // nessuno stato precedente
  }
}

await loadPersistedState();

/**
 * @returns {CursorAgentStatus}
 */
export function getCursorAgentStatus() {
  return { ...state };
}

/**
 * @returns {boolean}
 */
export function isCursorAgentActive() {
  return state.running;
}

/**
 * @param {number} [cursor]
 */
export function getCursorAgentLogs(cursor = 0) {
  const since = Number(cursor) || 0;
  const lines = logLines.filter((line) => line.seq > since);
  const next  = lines.length > 0 ? lines[lines.length - 1].seq : since;

  return {
    cursor : next
  , lines
  , status: getCursorAgentStatus()
  };
}

export function getCursorAgentConfigPayload() {
  return getCursorAgentPublicConfig();
}

/**
 * Emette blocco END workflow se il run corrente è gogo/procedi.
 *
 * @param {"finished" | "error"} status
 */
function emitWorkflowEndIfNeeded(status) {
  if (!state.workflowKey || !state.workflowKind) {
    return;
  }

  const block = buildWorkflowEndBlock({
    kind      : state.workflowKind
  , parentKey : state.workflowKey
  , status
  , error     : state.error
  });

  pushLogLine("workflow", block);
  state.workflowKey    = null;
  state.workflowKind   = null;
}

/**
 * @param {Record<string, unknown>} line
 */
function handleWorkerLine(line) {
  if (line.type === "log" && typeof line.text === "string") {
    const stream = /** @type {CursorAgentLogLine["stream"]} */ (
      line.stream === "assistant" || line.stream === "stderr" || line.stream === "system" || line.stream === "workflow"
        ? line.stream
        : "system"
    );
    pushLogLine(stream, line.text);
    return;
  }

  if (line.type === "meta") {
    if (typeof line.agentId === "string") {
      state.agentId = line.agentId;
    }

    if (typeof line.runId === "string") {
      state.runId = line.runId;
    }

    if (line.runtime === "local" || line.runtime === "cloud") {
      state.runtime = line.runtime;
    }

    void persistState();
    return;
  }

  if (line.type === "done") {
    state.running    = false;
    state.finishedAt = new Date().toISOString();
    state.status     = line.status === "finished" ? "finished" : "error";
    state.pid        = null;
    child            = null;

    if (typeof line.agentId === "string") {
      state.agentId = line.agentId;
    }

    if (typeof line.runId === "string") {
      state.runId = line.runId;
    }

    emitWorkflowEndIfNeeded(state.status === "finished" ? "finished" : "error");
    void persistState();
  }
}

/**
 * @param {{
 *   prompt: string
 *   runtime?: "local" | "cloud"
 *   resume?: boolean
 * }} options
 */
export async function startCursorAgent(options) {
  const prompt = options.prompt?.trim();

  if (!prompt) {
    return { started: false, error: "prompt obbligatorio" };
  }

  if (!isCursorAgentConfigured()) {
    return { started: false, error: "CURSOR_API_KEY non configurata in .env" };
  }

  if (state.running) {
    return { started: false, error: "agent già in esecuzione" };
  }

  const runtime = options.runtime === "cloud" || options.runtime === "local"
    ? options.runtime
    : getCursorDefaultRuntime();

  const apiKey = getCursorApiKey();

  if (!apiKey) {
    return { started: false, error: "CURSOR_API_KEY mancante" };
  }

  const portalRoot = getPortalRoot();
  const jobPath    = join(ADMIN_PORTAL_DIR, `.cursor-agent-job.${randomUUID()}.json`);
  const job        = {
    runtime       : runtime
  , prompt
  , apiKey
  , model         : getCursorAgentModel()
  , localCwd      : getCursorLocalCwd()
  , cloudRepos    : getCursorCloudRepos()
  , autoCreatePR  : process.env.CURSOR_CLOUD_AUTO_PR !== "0"
  , resumeAgentId : options.resume && state.agentId ? state.agentId : null
  , name          : `PortalAdmin cruscotto ${runtime}`
  };

  try {
    await mkdir(dirname(jobPath), { recursive: true });
    await writeFile(jobPath, `${JSON.stringify(job)}\n`, { mode: 0o600 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { started: false, error: message };
  }

  state.running    = true;
  state.startedAt  = new Date().toISOString();
  state.finishedAt = null;
  state.runtime    = runtime;
  state.prompt     = prompt;
  state.status     = "running";
  state.error      = null;
  state.runId      = null;
  state.workflowKey  = null;
  state.workflowKind = null;

  const workflow = parseWorkflowPrompt(prompt);

  if (workflow) {
    state.workflowKey  = workflow.parentKey;
    state.workflowKind = workflow.kind;

    try {
      const startBlock = await buildWorkflowStartBlock(workflow);
      pushLogLine("workflow", startBlock);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      pushLogLine("workflow", [
        "─".repeat(72)
      , `START — ${workflow.kind} ${workflow.parentKey}`
      , "─".repeat(72)
      , ""
      , `⚠ Step 0 parziale: ${message}`
      , ""
      , "─".repeat(72)
      ].join("\n"));
    }
  }

  pushLogLine("system", `=== Avvio worker Cursor (${runtime}) ===`);

  const workerPath = getCursorAgentWorkerPath();

  child = spawn(process.execPath, [workerPath, "--job", jobPath], {
    cwd   : portalRoot
  , env   : { ...process.env }
  , stdio : ["ignore", "pipe", "pipe"]
  });

  state.pid = child.pid ?? null;

  let stdoutBuf = "";

  child.stdout?.on("data", (chunk) => {
    stdoutBuf += String(chunk);

    /** @type {string[]} */
    const parts = stdoutBuf.split("\n");
    stdoutBuf = parts.pop() ?? "";

    for (const part of parts) {
      const trimmed = part.trim();

      if (!trimmed) {
        continue;
      }

      try {
        handleWorkerLine(JSON.parse(trimmed));
      } catch {
        pushLogLine("stdout", trimmed);
      }
    }
  });

  child.stderr?.on("data", (chunk) => {
    const text = String(chunk).trim();

    if (text) {
      pushLogLine("stderr", text);
      state.error = text;
    }
  });

  child.on("close", (code) => {
    if (stdoutBuf.trim()) {
      try {
        handleWorkerLine(JSON.parse(stdoutBuf.trim()));
      } catch {
        pushLogLine("stdout", stdoutBuf.trim());
      }

      stdoutBuf = "";
    }

    if (state.running) {
      state.running    = false;
      state.finishedAt = new Date().toISOString();
      state.status     = code === 0 ? "finished" : "error";
      state.pid        = null;
      child            = null;
      pushLogLine("system", `=== Worker terminato (codice ${code ?? "?"}) ===`);
      emitWorkflowEndIfNeeded(state.status === "finished" ? "finished" : "error");
      void persistState();
    }
  });

  child.on("error", (err) => {
    state.running    = false;
    state.status     = "error";
    state.error      = err.message;
    state.pid        = null;
    child            = null;
    pushLogLine("stderr", err.message);
    void persistState();
  });

  await persistState();

  return {
    started   : true
  , runtime
  , startedAt : state.startedAt
  , logCursor : logSeq
  };
}

/**
 * @returns {{ ok: boolean, error?: string }}
 */
export function cancelCursorAgent() {
  if (!state.running || !child) {
    return { ok: false, error: "nessun agent in esecuzione" };
  }

  try {
    child.kill("SIGTERM");
    pushLogLine("system", "=== Cancel richiesto — SIGTERM worker ===");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }

  return { ok: true };
}

/**
 * @returns {{ ok: boolean }}
 */
export function clearCursorAgentLogs() {
  logLines = [];
  logSeq   = 0;
  pushLogLine("system", "=== Log agent svuotati ===");

  return { ok: true };
}
