#!/usr/bin/env node
/**
 * Orchestratore testScript — discovery, prerequisiti, run sequenziale, report JSON.
 *
 * Uso:
 *   node runner/run-all.mjs
 *   node runner/run-all.mjs --list
 *   node runner/run-all.mjs --no-html
 *   node runner/run-all.mjs --script auth/test-login.mjs
 *   node runner/run-all.mjs --suite auth
 *   node runner/run-all.mjs --script auth/test-login.mjs --test "login seed host"
 *
 * Env: .env — AUTH_URL, API_URL, WEB_BASE
 */

import "../lib/load-env.mjs";

import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";

import {
  BLOCKED_REASONS
, BLOCKED_SCRIPTS
, discoverTestScripts
, REPO_ROOT
, requireTestScriptDir
} from "../lib/catalog.mjs";
import {
  discoverTestNamesInScript
, resolveTestChain
} from "../lib/test-deps.mjs";
import { checkServices } from "../lib/prereqs.mjs";
import {
  mergeWithLatestReport
, parseScriptJsonReport
, writeRunReports
} from "../lib/reporter.mjs";
import { importTestScriptModule, WINDOWS_UV_CRASH_EXIT } from "../lib/test-script-http.mjs";

const LIST_ONLY = process.argv.includes("--list");
const NO_HTML   = process.argv.includes("--no-html");

/**
 * @returns {string | null}
 */
function parseScriptArg() {
  const idx = process.argv.indexOf("--script");

  if (idx === -1 || !process.argv[idx + 1]) {
    return null;
  }

  return process.argv[idx + 1].replace(/\\/g, "/");
}

const SINGLE_SCRIPT = parseScriptArg();

/**
 * @returns {string | null}
 */
function parseSuiteArg() {
  const idx = process.argv.indexOf("--suite");

  if (idx === -1 || !process.argv[idx + 1]) {
    return null;
  }

  return process.argv[idx + 1].replace(/\\/g, "/");
}

const SUITE_FILTER = parseSuiteArg();

/**
 * @returns {string | null}
 */
function parseTestArg() {
  const idx = process.argv.indexOf("--test");

  if (idx === -1 || !process.argv[idx + 1]) {
    return null;
  }

  return process.argv[idx + 1];
}

const TEST_ONLY = parseTestArg();

/**
 * @param {import("../lib/catalog.mjs").ScriptEntry} entry
 * @param {{ auth: boolean, api: boolean, web: boolean }} services
 */
function resolveSkip(entry, services) {
  if (BLOCKED_SCRIPTS.has(entry.rel)) {
    return { skip: true, reason: BLOCKED_REASONS[entry.rel] ?? "blocked" };
  }

  if (entry.suite === "web" && !services.web) {
    return { skip: true, reason: "web :3000 non raggiungibile" };
  }

  return { skip: false };
}

/**
 * @param {string} absPath
 * @returns {Promise<{ exitCode: number, durationMs: number, report: Record<string, unknown> | null, stderr: string }>}
 */
function runScript(absPath) {
  return new Promise((resolve) => {
    const started = Date.now();
    /** @type {string[]} */
    let stdout = "";
    /** @type {string[]} */
    let stderr = "";

    /** @type {NodeJS.ProcessEnv} */
    const childEnv = { ...process.env };

    if (TEST_ONLY) {
      childEnv.JLO_TEST_ONLY = TEST_ONLY;
    }

    if (process.env.JLO_TEST_CHAIN) {
      childEnv.JLO_TEST_CHAIN = process.env.JLO_TEST_CHAIN;
    }

    /** @type {string[]} */
    const childArgs = [absPath, "--json"];

    if (TEST_ONLY) {
      childArgs.push("--test", TEST_ONLY);
    }

    const child = spawn(process.execPath, childArgs, {
      cwd    : REPO_ROOT
    , env    : childEnv
    , stdio  : ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("close", (code) => {
      const durationMs = Date.now() - started;
      const report     = parseScriptJsonReport(stdout);

      resolve({
        exitCode   : code ?? 1
      , durationMs
      , report
      , stderr     : stderr.trim()
      });
    });
  });
}

async function main() {
  try {
    requireTestScriptDir();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
    return;
  }

  let scripts = await discoverTestScripts();

  if (SINGLE_SCRIPT && SUITE_FILTER) {
    console.error("Usa --script o --suite, non entrambi");
    process.exitCode = 1;
    return;
  }

  if (TEST_ONLY && !SINGLE_SCRIPT) {
    console.error("--test richiede --script");
    process.exitCode = 1;
    return;
  }

  if (SINGLE_SCRIPT) {
    const entry = scripts.find((s) => s.rel === SINGLE_SCRIPT);

    if (!entry) {
      console.error(`Script non trovato: ${SINGLE_SCRIPT}`);
      process.exitCode = 1;
      return;
    }

    scripts = [entry];
  } else if (SUITE_FILTER) {
    const filtered = scripts.filter((s) => s.suite === SUITE_FILTER);

    if (filtered.length === 0) {
      console.error(`Nessuno script per suite: ${SUITE_FILTER}`);
      process.exitCode = 1;
      return;
    }

    scripts = filtered;
  }

  if (LIST_ONLY) {
    console.log(`Script test-*.mjs (${scripts.length}):`);
    for (const s of scripts) {
      const tag = BLOCKED_SCRIPTS.has(s.rel) ? " [blocked]" : "";
      console.log(`  ${s.suite}/${s.file}${tag}`);
    }
    return;
  }

  const fixtures = await importTestScriptModule("lib/match-fixtures.mjs");
  const { resetHostTestState, setupDefaultDatabaseUrl } = fixtures;

  const services = await checkServices();

  setupDefaultDatabaseUrl();
  const loopPrisma = new PrismaClient();

  try {
    const reset = await resetHostTestState(loopPrisma);
    if (reset.cancelled > 0 || reset.inGameCleared > 0) {
      console.log(
        `Pre-flight: host schedule pulito (${reset.cancelled} recruiting, ${reset.inGameCleared} in_game)`
      );
    }
  } catch (err) {
    await loopPrisma.$disconnect();
    throw err;
  }

  if (!services.auth || !services.api) {
    console.error("Prerequisiti mancanti:");
    if (!services.auth) {
      console.error(`  auth non raggiungibile: ${services.authUrl}/health`);
    }
    if (!services.api) {
      console.error(`  api non raggiungibile: ${services.apiUrl}/health`);
    }
    process.exitCode = 1;
    return;
  }

  const runTitle = TEST_ONLY
    ? "=== Admin run-case ==="
    : SINGLE_SCRIPT
      ? "=== Admin run-one ==="
      : SUITE_FILTER
        ? "=== Admin run-suite ==="
        : "=== Admin run-all ===";

  console.log(runTitle);

  if (TEST_ONLY) {
    console.log(`Script: ${SINGLE_SCRIPT}`);
    console.log(`Test:   ${TEST_ONLY}`);
  } else if (SINGLE_SCRIPT) {
    console.log(`Script: ${SINGLE_SCRIPT}`);
  } else if (SUITE_FILTER) {
    console.log(`Suite: ${SUITE_FILTER} (${scripts.length} script)`);
  } else {
    console.log(`Script: ${scripts.length}`);
  }
  console.log(`Auth: ${services.authUrl} · API: ${services.apiUrl}`);
  if (!services.web) {
    console.log("Web :3000 non raggiungibile — script web/ verranno skippati");
  }

  if (TEST_ONLY && SINGLE_SCRIPT && scripts.length === 1) {
    const names    = await discoverTestNamesInScript(scripts[0].abs);
    const resolved = resolveTestChain(names, TEST_ONLY);

    if (!resolved.found) {
      console.error(`Test case non trovato in ${scripts[0].rel}: ${TEST_ONLY}`);
      process.exitCode = 1;
      return;
    }

    process.env.JLO_TEST_CHAIN = JSON.stringify(resolved.chain);

    if (resolved.dependencies.length > 0) {
      console.log(`Dipendenze (${resolved.dependencies.length} test precedenti):`);

      for (const dep of resolved.dependencies) {
        console.log(`  · ${dep}`);
      }
    }
  }

  const generatedAt = new Date().toISOString();
  /** @type {Record<string, unknown>[]} */
  const scriptResults = [];
  let failed = 0;
  let skipped = 0;
  let passed = 0;

  try {
  for (const entry of scripts) {
    const skipInfo = resolveSkip(entry, services);

    if (skipInfo.skip) {
      skipped += 1;
      scriptResults.push({
        script     : entry.rel
      , suite      : entry.suite
      , status     : "skipped"
      , reason     : skipInfo.reason
      , exitCode   : 0
      , durationMs : 0
      });
      console.log(`− skip ${entry.rel} (${skipInfo.reason})`);
      continue;
    }

    if (
      entry.suite === "match"
      || entry.suite === "social"
      || entry.rel === "auth/test-api-forbidden-responses.mjs"
      || entry.rel === "auth/test-auth-email-verified-state.mjs"
    ) {
      await resetHostTestState(loopPrisma);
    }

    process.stdout.write(`${entry.rel} ... `);
    const result = await runScript(entry.abs);
    const reportTests = /** @type {{ ok?: boolean }[] | undefined} */ (
      result.report?.tests
    );
    const reportAllOk = Array.isArray(reportTests)
      && reportTests.length > 0
      && reportTests.every((t) => t.ok !== false);
    const ok = result.exitCode === 0
      || (
        result.exitCode === WINDOWS_UV_CRASH_EXIT
        && result.report?.exitCode === 0
        && reportAllOk
      );

    if (ok) {
      passed += 1;
      console.log("✓");
    } else {
      failed += 1;
      console.log("✗");
    }

    scriptResults.push({
      script     : entry.rel
    , suite      : entry.suite
    , status     : ok ? "passed" : "failed"
    , exitCode   : result.exitCode
    , durationMs : result.durationMs
    , report     : result.report
    , stderr     : result.stderr || undefined
    });
  }
  } finally {
    await loopPrisma.$disconnect();
  }

  const aggregate = {
    generatedAt
  , totalScripts : scripts.length
  , passed
  , failed
  , skipped
  , services     : {
      auth : services.auth
    , api  : services.api
    , web  : services.web
    }
  , scripts: scriptResults
  };

  const finalAggregate = SINGLE_SCRIPT || SUITE_FILTER
    ? await mergeWithLatestReport({
        ...aggregate
      , testCaseRun: Boolean(TEST_ONLY)
      })
    : aggregate;

  const paths = await writeRunReports(finalAggregate, { html: !NO_HTML });

  console.log("");
  console.log(`Report: data/reports/latest.json`);
  if (paths.html) {
    console.log(`HTML:   ${paths.html}`);
  }
  console.log(`Totale: ${scripts.length} — ${passed} passati, ${failed} falliti, ${skipped} skipped`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
