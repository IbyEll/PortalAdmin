#!/usr/bin/env node
/**
 * Orchestratore testScript — discovery, prerequisiti, run sequenziale, report JSON.
 *
 * Descrizione funzionale:
 *   Perché esiste: PortalAdmin serve un unico entrypoint per la suite del product repo
 *     attivo (PRJ_NAME) — dashboard POST /api/run, smoke CI, cruscotto.
 *   A cosa serve: catalogo overlay, check auth/api/web, reset DB seed (overlay fixtures),
 *     run sequenziale, merge report → data/reports/latest.json.
 *
 * Uso:
 *   node runner/run-all.mjs
 *   node runner/run-all.mjs --list
 *   node runner/run-all.mjs --no-html
 *   node runner/run-all.mjs --script auth/test-login.mjs
 *   node runner/run-all.mjs --suite auth
 *   node runner/run-all.mjs --script auth/test-login.mjs --test "login seed host"
 *
 * Flag CLI:
 *   --list       elenco script discovery, exit 0
 *   --no-html    salta generazione latest.html
 *   --script     run singolo script (path relativo in testScript/)
 *   --suite      run tutti gli script della suite
 *   --test       singolo test case (--script obbligatorio); imposta JLO_TEST_CHAIN
 *
 * Variabili d'ambiente:
 *   PRJ_NAME, PRODUCT_REPO_PATH  product attivo (project.config)
 *   AUTH_HEALTH_URL, API_HEALTH_URL, WEB_OPEN_URL / WEB_BASE  override probe stack
 *   DATABASE_URL                   override SQLite; default via test.match-fixtures overlay
 *   JLO_TEST_ONLY, JLO_TEST_CHAIN  propagati al child (--test; naming legacy JLO testScript)
 *
 * Prerequisiti:
 *   testScript/ nel product repo; auth e api raggiungibili (/health)
 */

import "./portal.load.env.mjs";

import { spawn } from "node:child_process";

import {
  BLOCKED_REASONS
, BLOCKED_SCRIPTS
, discoverTestScripts
, REPO_ROOT
, requireTestScriptDir
} from "./test.catalog.mjs";
import {
  discoverTestNamesInScript
, resolveTestChain
} from "./test.dipendenze.mjs";
import { checkProjectServices } from "../runner/cruscotto.runner.stack.probe.mjs";
import {
  mergeWithLatestReport
, parseScriptJsonReport
, writeRunReports
} from "./reporter.mjs";
import { WINDOWS_UV_CRASH_EXIT } from "./portal.utils.mjs";
import { resetHostTestState, setupDefaultDatabaseUrl } from "./test.match-fixtures.mjs";
import { PrismaClient } from "./product.prisma.mjs";

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
 * Skip blocked catalogo o suite web senza :3000.
 *
 * @param {{ rel: string, suite: string, file: string, abs: string }} entry
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
 * Esegue uno script testScript come child Node con --json e parse stdout.
 *
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
  // 1. Guard — testScript/ deve esistere nel product repo
  try {
    requireTestScriptDir();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
    return;
  }

  let scripts = await discoverTestScripts();

  // 2. Validazione flag CLI mutualmente esclusivi
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

  // 3. Prerequisiti stack + pre-flight DB seed host
  const services = await checkProjectServices();

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
      console.error(`  auth non raggiungibile: ${services.authHealthUrl}`);
    }
    if (!services.api) {
      console.error(`  api non raggiungibile: ${services.apiHealthUrl}`);
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
  console.log(`Auth: ${services.authHealthUrl} · API: ${services.apiHealthUrl}`);
  if (!services.web) {
    console.log(`Web non raggiungibile (${services.webUrl}) — script web/ verranno skippati`);
  }

  // 4. Modalità --test: catena dipendenze → JLO_TEST_CHAIN per il child
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

  // 5. Loop run sequenziale — skip, reset inter-script, aggregazione esiti
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

    // Reset host tra script che mutano match/social (stato isolato)
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

  // 6. Report — merge parziale run-one/suite; write JSON + HTML
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
