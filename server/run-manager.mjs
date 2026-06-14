import { spawn } from "node:child_process";
import { join } from "node:path";

import {
  BLOCKED_REASONS
, BLOCKED_SCRIPTS
, discoverTestScripts
} from "../lib/catalog.mjs";

/**
 * @typedef {{
 *   running       : boolean
 *   startedAt     : string | null
 *   currentScript : string | null
 *   progress      : { current: number, total: number }
 *   exitCode      : number | null
 *   error         : string | null
 *   mode          : "all" | "single" | "suite" | "case" | "funzionali" | null
 *   targetScript  : string | null
 *   targetTestCase: string | null
 * }} RunStatus
 */

/** @type {RunStatus} */
const state = {
  running       : false
, startedAt     : null
, currentScript : null
, progress      : { current: 0, total: 0 }
, exitCode      : null
, error         : null
,   mode          : null
, targetScript  : null
, targetTestCase: null
};

/** @type {import("node:child_process").ChildProcess | null} */
let child = null;

/**
 * @param {string} chunk
 * @param {string[]} scriptOrder
 */
function parseStdout(chunk, scriptOrder) {
  const lines = chunk.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith("− skip ") || trimmed.startsWith("- skip ")) {
      const rel = trimmed.replace(/^− skip |^- skip /, "").split(" (")[0];
      state.currentScript = rel;
      state.progress.current = Math.min(state.progress.current + 1, state.progress.total);
      continue;
    }

    for (const rel of scriptOrder) {
      if (trimmed.startsWith(`${rel} `) || trimmed === rel || trimmed.startsWith(`${rel}...`)) {
        state.currentScript = rel;
        break;
      }

      if (trimmed === "✓" || trimmed === "✗") {
        state.progress.current = Math.min(state.progress.current + 1, state.progress.total);
        state.currentScript = null;
      }
    }
  }
}

/**
 * @returns {RunStatus}
 */
export function getRunStatus() {
  return {
    running       : state.running
  , startedAt     : state.startedAt
  , currentScript : state.currentScript
  , progress      : { ...state.progress }
  , exitCode      : state.exitCode
  , error         : state.error
  , mode          : state.mode
  , targetScript  : state.targetScript
  , targetTestCase: state.targetTestCase
  };
}

/**
 * @param {string} repoRoot
 * @returns {Promise<{ started: boolean, error?: string }>}
 */
/**
 * @param {string} repoRoot
 * @param {{ scriptRel?: string, suite?: string, testCase?: string }} [options]
 */
export async function startRun(repoRoot, options = {}) {
  if (state.running) {
    return { started: false, error: "run already in progress" };
  }

  const scriptRel = options.scriptRel?.replace(/\\/g, "/") ?? null;
  const suite     = options.suite?.replace(/\\/g, "/") ?? null;
  const testCase  = options.testCase?.trim() ?? null;
  const scripts   = await discoverTestScripts();
  const runAll    = join(repoRoot, "Admin", "runner", "run-all.mjs");

  if (testCase && !scriptRel) {
    return { started: false, error: "testCase requires scriptRel" };
  }

  if (scriptRel && suite) {
    return { started: false, error: "use scriptRel or suite, not both" };
  }

  if (testCase && suite) {
    return { started: false, error: "testCase cannot be combined with suite" };
  }

  if (scriptRel) {
    const entry = scripts.find((s) => s.rel === scriptRel);

    if (!entry) {
      return { started: false, error: `script not found: ${scriptRel}` };
    }

    if (BLOCKED_SCRIPTS.has(scriptRel)) {
      return {
        started : false
      , error   : BLOCKED_REASONS[scriptRel] ?? "script blocked"
      };
    }
  }

  if (suite) {
    const suiteScripts = scripts.filter((s) => s.suite === suite);

    if (suiteScripts.length === 0) {
      return { started: false, error: `suite not found: ${suite}` };
    }
  }

  /** @type {string[]} */
  let scriptOrder;

  if (scriptRel) {
    scriptOrder = [scriptRel];
  } else if (suite) {
    scriptOrder = scripts.filter((s) => s.suite === suite).map((s) => s.rel);
  } else {
    scriptOrder = scripts.map((s) => s.rel);
  }

  state.running       = true;
  state.startedAt     = new Date().toISOString();
  state.currentScript = scriptRel ?? suite;
  state.progress      = { current: 0, total: scriptOrder.length };
  state.exitCode      = null;
  state.error         = null;
  state.mode           = testCase ? "case" : scriptRel ? "single" : suite ? "suite" : "all";
  state.targetScript   = scriptRel ?? suite;
  state.targetTestCase = testCase;

  /** @type {string[]} */
  const args = [runAll];

  if (scriptRel) {
    args.push("--script", scriptRel);
  } else if (suite) {
    args.push("--suite", suite);
  }

  if (testCase) {
    args.push("--test", testCase);
  }

  child = spawn(process.execPath, args, {
    cwd   : repoRoot
  , env   : process.env
  , stdio : ["ignore", "pipe", "pipe"]
  });

  child.stdout?.on("data", (chunk) => {
    parseStdout(String(chunk), scriptOrder);
  });

  child.stderr?.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) {
      state.error = text;
    }
  });

  child.on("close", (code) => {
    state.running       = false;
    state.exitCode      = code ?? 1;
    state.currentScript = null;
    state.progress.current = state.progress.total;
    state.mode           = null;
    state.targetScript   = null;
    state.targetTestCase = null;
    child = null;
  });

  child.on("error", (err) => {
    state.running        = false;
    state.error          = err.message;
    state.mode           = null;
    state.targetScript   = null;
    state.targetTestCase = null;
    child = null;
  });

  return {
    started  : true
  , script   : scriptRel ?? undefined
  , suite    : suite ?? undefined
  , testCase : testCase ?? undefined
  };
}

/**
 * @param {string} repoRoot
 * @param {string} scriptRel
 */
export function startRunOne(repoRoot, scriptRel) {
  return startRun(repoRoot, { scriptRel });
}

/**
 * @param {string} repoRoot
 * @param {string} suite
 */
export function startRunSuite(repoRoot, suite) {
  return startRun(repoRoot, { suite });
}

/**
 * Avvia l'orchestratore testScript/funzionali/run-funzionali.mjs (ordine seed→amici→match→flusso).
 *
 * @param {string} repoRoot
 */
export async function startRunFunzionali(repoRoot) {
  if (state.running) {
    return { started: false, error: "run already in progress" };
  }

  const scriptRel    = "funzionali/run-funzionali.mjs";
  const scriptPath   = join(repoRoot, "testScript", scriptRel);
  const scriptOrder  = [
    "funzionali/test-seed-utenti.mjs"
  , "funzionali/test-friend-bot.mjs"
  , "funzionali/test-amici-multiutente.mjs"
  , "funzionali/test-match-multiutente.mjs"
  , "funzionali/test-flusso-completo.mjs"
  ];

  state.running        = true;
  state.startedAt      = new Date().toISOString();
  state.currentScript  = scriptOrder[0];
  state.progress       = { current: 0, total: scriptOrder.length };
  state.exitCode       = null;
  state.error          = null;
  state.mode           = "funzionali";
  state.targetScript   = scriptRel;
  state.targetTestCase = null;

  child = spawn(process.execPath, [scriptPath], {
    cwd   : repoRoot
  , env   : process.env
  , stdio : ["ignore", "pipe", "pipe"]
  });

  child.stdout?.on("data", (chunk) => {
    parseStdout(String(chunk), scriptOrder);
  });

  child.stderr?.on("data", (chunk) => {
    const text = String(chunk).trim();
    if (text) {
      state.error = text;
    }
  });

  child.on("close", (code) => {
    state.running          = false;
    state.exitCode         = code ?? 1;
    state.currentScript    = null;
    state.progress.current = state.progress.total;
    state.mode             = null;
    state.targetScript     = null;
    state.targetTestCase   = null;
    child                  = null;
  });

  child.on("error", (err) => {
    state.running        = false;
    state.error          = err.message;
    state.mode           = null;
    state.targetScript   = null;
    state.targetTestCase = null;
    child                = null;
  });

  return { started: true, script: scriptRel };
}

export function isRunActive() {
  return state.running;
}
