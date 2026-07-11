/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:30
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:30   by: IbyEll
 * modificato il: 2026-06-23 21:30   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Orchestrazione Cursor Agent — spawn worker SDK, log incrementali e stato persistente.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Tab Cursor agent cruscotto deve avviare agent SDK senza bloccare il server HTTP.
 *
 *   A cosa serve:
 *   - Spawn worker figlio, stream log JSON, persistenza stato job su file admin.portal.
 *
 * Generalizzazione:
 *   Si — prompt e runtime da body API; repo da getCursorLocalCwd e cloud repos config.
 *
 * Input:
 *   - CURSOR_API_KEY — autenticazione SDK
 *   - body HTTP prompt — testo agent e opzionale resume agent id
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.server.mjs — POST /api/cursor/agent/run
 *
 * Export principali:
 *   - startCursorAgent — avvia worker SDK e job id
 *   - getCursorAgentStatus, getCursorAgentLogs — stato e log incrementali per UI
 *
 * ------------------------------------------------------------------------------------------------------------------------
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
, checkNoOpenPullRequests
, parseWorkflowPrompt
} from "./portal.cursor.agent.workflow.mjs";
import { finalizeWipAfterGogo, enrollIssueInWip } from "../admin.portal.JiraCORE/jiraCORE.wip.enroll.mjs";
import { syncWipSubtasksFromGitCommits } from "../admin.portal.JiraCORE/jiraCORE.wip.close-subtask.mjs";
import { getPortalRoot } from "../admin.portal.lib/portal.paths.resolver.mjs";
import { clearLogs, createLogger, getLogs } from "../admin.portal.lib/portal.log.mjs";

const agentLog = createLogger("agent");

const ADMIN_PORTAL_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * @param {number | null | undefined} pid
 * @returns {boolean}
 */
function isAgentPidAlive(pid) {
  const n = Number(pid);

  if (!Number.isFinite(n) || n <= 0) {
    return false;
  }

  try {
    process.kill(n, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ripulisce stato running orfano (worker morto / server riavviato con pid stale).
 */
function reconcileAgentRunningState() {
  if (!state.running) {
    return;
  }

  const childAlive = child != null;
  const pidAlive   = isAgentPidAlive(state.pid);

  if (childAlive || pidAlive) {
    return;
  }

  state.running    = false;
  state.finishedAt = state.finishedAt ?? new Date().toISOString();
  state.status     = state.status === "running" ? "error" : state.status;
  state.error      = state.error ?? "Processo agent non più attivo — stato ripulito";
  state.pid        = null;
  stopWipGitSyncPoll();
  void persistState();
}

/**
 * @param {string} workflowKey
 * @param {"finished" | "error"} status
 */
async function runFinalizeWipAfterAgent(workflowKey, status) {
  if (!workflowKey || status !== "finished") {
    return;
  }

  state.workflowFinalizing = true;
  setWorkflowStep("Step 7 — Chiudi parent WIP (awaitingPush)");

  try {
    await finalizeWipAfterGogo(workflowKey, { closeOpenSubtasks: true });
    setWorkflowStep("Pronto PUSH — step 8 (cruscotto)");
    pushLogLine("workflow", `WIP aggiornato — ${workflowKey} pronto per PUSH`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    state.status = "error";
    state.error  = message;
    setWorkflowStep("Step 7 — errore finalizzazione WIP");
    pushLogLine("stderr", `finalize WIP ${workflowKey} fallito: ${message}`);
  } finally {
    state.workflowFinalizing = false;
    void persistState();
  }
}

/**
 * WIP + blocco START dopo spawn worker — non blocca l'avvio agent.
 *
 * @param {{ kind: "gogo" | "procedi", parentKey: string }} workflow
 */
async function bootstrapWorkflowRun(workflow) {
  setWorkflowStep("Step 3 — Veve DB + Enroll WIP");

  try {
    await enrollIssueInWip(workflow.parentKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    pushLogLine("stderr", `WIP enroll ${workflow.parentKey}: ${message}`);
  }

  startWipGitSyncPoll(workflow.parentKey);
  setWorkflowStep("Step 0 — Piano WIP (START)");

  try {
    const startBlock = await buildWorkflowStartBlock(workflow);
    pushLogLine("workflow", startBlock);
    setWorkflowStep("Step 5 — Implementazione (agent)");
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
 *   workflowStepLabel: string | null
 *   workflowFinalizing: boolean
 *   uiPhase: "idle" | "running" | "finalizing" | "stopped" | "error"
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
, workflowStepLabel: null
, workflowFinalizing: false
};

/**
 * Aggiorna etichetta step workflow visibile in tab Cursor Agent.
 *
 * @param {string} label
 */
function setWorkflowStep(label) {
  const next = String(label ?? "").trim();

  if (!next) {
    return;
  }

  state.workflowStepLabel = next;
  void persistState();
}

/**
 * @returns {CursorAgentStatus["uiPhase"]}
 */
function resolveCursorAgentUiPhase() {
  if (state.running) {
    return "running";
  }

  if (state.workflowFinalizing) {
    return "finalizing";
  }

  if (state.status === "error") {
    return "error";
  }

  if (state.status === "finished") {
    return "stopped";
  }

  return "idle";
}

/** @type {import("node:child_process").ChildProcess | null} */
let child = null;

/** @type {ReturnType<typeof setInterval> | null} */
let wipGitSyncTimer = null;

/** @type {ReturnType<typeof setTimeout> | null} */
let wipGitSyncDebounceTimer = null;

/** Subtask già annunciate in log WIP sync — evita spam a ogni poll git. */
/** @type {Set<string>} */
let wipGitSyncLoggedClosed = new Set();

/**
 * @param {string} parentKey
 */
async function runWipGitSync(parentKey) {
  try {
    const result = await syncWipSubtasksFromGitCommits(parentKey);
    const newlyClosed = result.closed.filter((key) => !wipGitSyncLoggedClosed.has(key));

    if (newlyClosed.length > 0) {
      for (const key of newlyClosed) {
        wipGitSyncLoggedClosed.add(key);
      }

      setWorkflowStep("Step 6 — ok chiudi subtask (WIP)");
      pushLogLine("workflow", `WIP — ${newlyClosed.length} subtask: ${newlyClosed.join(", ")}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    pushLogLine("stderr", `WIP sync ${parentKey}: ${message}`);
  }
}

/**
 * @param {string} parentKey
 */
function scheduleWipGitSync(parentKey) {
  if (!parentKey) {
    return;
  }

  if (wipGitSyncDebounceTimer != null) {
    clearTimeout(wipGitSyncDebounceTimer);
  }

  wipGitSyncDebounceTimer = setTimeout(() => {
    wipGitSyncDebounceTimer = null;
    void runWipGitSync(parentKey);
  }, 2000);
}

/**
 * Durante gogo — allinea subtask WIP dai commit git (immediato + ogni 5s).
 *
 * @param {string} parentKey
 */
function startWipGitSyncPoll(parentKey) {
  stopWipGitSyncPoll();
  wipGitSyncLoggedClosed = new Set();
  void runWipGitSync(parentKey);

  wipGitSyncTimer = setInterval(() => {
    void runWipGitSync(parentKey);
  }, 5000);
}

function stopWipGitSyncPoll() {
  if (wipGitSyncTimer != null) {
    clearInterval(wipGitSyncTimer);
    wipGitSyncTimer = null;
  }

  if (wipGitSyncDebounceTimer != null) {
    clearTimeout(wipGitSyncDebounceTimer);
    wipGitSyncDebounceTimer = null;
  }
}

/**
 * @param {"stdout" | "stderr" | "system" | "assistant" | "workflow"} stream
 * @param {string} text
 */
function pushLogLine(stream, text) {
  agentLog.write(stream, text);
}

function currentAgentLogCursor() {
  return getLogs({ source: "agent" }).cursor;
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

    const persisted = data?.state;

    if (persisted?.running === true && !isAgentPidAlive(persisted.pid)) {
      state.status     = "error";
      state.error      = "Sessione agent precedente non più attiva";
      state.finishedAt = typeof data.savedAt === "string" ? data.savedAt : new Date().toISOString();
      void persistState();
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
  reconcileAgentRunningState();
  return {
    ...state
  , uiPhase: resolveCursorAgentUiPhase()
  };
}

/**
 * @returns {boolean}
 */
export function isCursorAgentActive() {
  reconcileAgentRunningState();
  return state.running === true && (child != null || isAgentPidAlive(state.pid));
}

/**
 * @param {number} [cursor]
 */
export function getCursorAgentLogs(cursor = 0) {
  const payload = getLogs({ cursor, source: "agent" });

  return {
    cursor : payload.cursor
  , lines  : payload.lines
  , status : getCursorAgentStatus()
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

    if (
      state.workflowKey
      && stream === "system"
      && /\[tool\]/i.test(line.text)
      && /\b(shell|bash|terminal|git|commit|write|edit|strreplace)\b/i.test(line.text)
    ) {
      scheduleWipGitSync(state.workflowKey);
    }

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
    stopWipGitSyncPoll();

    if (line.status !== "finished" && typeof line.error === "string" && line.error.trim()) {
      state.error = line.error.trim();
    }

    if (typeof line.agentId === "string") {
      state.agentId = line.agentId;
    }

    if (typeof line.runId === "string") {
      state.runId = line.runId;
    }

    if (typeof line.error === "string" && line.error.trim()) {
      state.error = line.error.trim();
    }

    const workflowKey = state.workflowKey;

    if (line.status === "finished" && workflowKey) {
      setWorkflowStep("Step 6–7 — Chiusura WIP");
      void runFinalizeWipAfterAgent(workflowKey, "finished");
    }

    emitWorkflowEndIfNeeded(state.status === "finished" ? "finished" : "error");
    void persistState();
  }
}

/**
 * @param {{
 *   resume?: boolean
 *   resumeAgentId?: string | null
 *   resumeRunId?: string | null
 * }} options
 * @returns {Promise<string | null>}
 */
async function resolveResumeAgentId(options) {
  const explicit = typeof options.resumeAgentId === "string"
    ? options.resumeAgentId.trim()
    : "";

  if (explicit) {
    return explicit;
  }

  const runId = typeof options.resumeRunId === "string"
    ? options.resumeRunId.trim()
    : "";

  if (runId) {
    const path = getCursorAgentStatePath();

    try {
      const raw  = await readFile(path, "utf8");
      const data = JSON.parse(raw);
      const savedRunId   = typeof data?.lastRunId === "string" ? data.lastRunId : data?.state?.runId;
      const savedAgentId = typeof data?.lastAgentId === "string"
        ? data.lastAgentId
        : data?.state?.agentId;

      if (savedRunId === runId && typeof savedAgentId === "string" && savedAgentId.trim()) {
        return savedAgentId.trim();
      }
    } catch {
      // stato assente
    }

    return null;
  }

  if (options.resume && state.agentId) {
    return state.agentId;
  }

  if (options.resume) {
    await loadPersistedState();

    return state.agentId;
  }

  return null;
}

/**
 * @param {{
 *   prompt: string
 *   runtime?: "local" | "cloud"
 *   resume?: boolean
 *   resumeAgentId?: string | null
 *   resumeRunId?: string | null
 * }} options
 */
export async function startCursorAgent(options) {
  const prompt = options.prompt?.trim();

  if (!prompt) {
    return { started: false, error: "prompt obbligatorio" };
  }

  reconcileAgentRunningState();

  if (!isCursorAgentConfigured()) {
    return { started: false, error: "CURSOR_API_KEY non configurata in .env" };
  }

  if (isCursorAgentActive()) {
    return { started: false, error: "agent già in esecuzione" };
  }

  const workflow = parseWorkflowPrompt(prompt);

  if (workflow) {
    const prGate = checkNoOpenPullRequests();

    if (!prGate.ok) {
      return {
        started : false
      , error   : prGate.error
      , openPrs : prGate.openPrs
      };
    }
  }

  const runtime = options.runtime === "cloud" || options.runtime === "local"
    ? options.runtime
    : getCursorDefaultRuntime();

  const apiKey = getCursorApiKey();

  if (!apiKey) {
    return { started: false, error: "CURSOR_API_KEY mancante" };
  }

  const portalRoot     = getPortalRoot();
  const resumeAgentId  = await resolveResumeAgentId(options);

  if ((options.resume || options.resumeRunId || options.resumeAgentId) && !resumeAgentId) {
    return {
      started : false
    , error   : "resume non disponibile — agentId assente o runId non trovato nello stato"
    };
  }

  const jobPath    = join(ADMIN_PORTAL_DIR, `.cursor-agent-job.${randomUUID()}.json`);
  const job        = {
    runtime       : runtime
  , prompt
  , apiKey
  , model         : getCursorAgentModel()
  , localCwd      : getCursorLocalCwd()
  , cloudRepos    : getCursorCloudRepos()
  , autoCreatePR  : process.env.CURSOR_CLOUD_AUTO_PR !== "0"
  , resumeAgentId
  , name          : `PortalAdmin cruscotto ${runtime}`
  };

  try {
    await mkdir(dirname(jobPath), { recursive: true });
    await writeFile(jobPath, `${JSON.stringify(job)}\n`, { mode: 0o600 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { started: false, error: message };
  }

  pushLogLine("system", `=== Avvio worker Cursor (${runtime}) ===`);

  const workerPath = getCursorAgentWorkerPath();

  child = spawn(process.execPath, [workerPath, "--job", jobPath], {
    cwd   : portalRoot
  , env   : { ...process.env }
  , stdio : ["ignore", "pipe", "pipe"]
  });

  if (!child || !child.pid) {
    child = null;
    return { started: false, error: "spawn worker fallito" };
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
  state.workflowStepLabel = null;
  state.workflowFinalizing = false;
  state.pid        = child.pid;

  if (workflow) {
    state.workflowKey  = workflow.parentKey;
    state.workflowKind = workflow.kind;
    setWorkflowStep("Step 1–2 — Pre-flight git + branch");
    void bootstrapWorkflowRun(workflow);
  }

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
      stopWipGitSyncPoll();

      const workflowKey = state.workflowKey;

      if (code === 0 && workflowKey) {
        setWorkflowStep("Step 6–7 — Chiusura WIP");
        void runFinalizeWipAfterAgent(workflowKey, "finished");
      }

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
    stopWipGitSyncPoll();
    pushLogLine("stderr", err.message);
    void persistState();
  });

  await persistState();

  return {
    started   : true
  , runtime
  , startedAt : state.startedAt
  , logCursor : currentAgentLogCursor()
  };
}

/**
 * @returns {{ ok: boolean, error?: string }}
 */
export function cancelCursorAgent() {
  reconcileAgentRunningState();

  if (!isCursorAgentActive() || !child) {
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
  clearLogs({ source: "agent", systemMessage: "=== Log agent svuotati ===" });

  return { ok: true };
}
