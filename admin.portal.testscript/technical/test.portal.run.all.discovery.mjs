#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TESTSCRIPT ** -- commentato il: 2026-07-11 06:55
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-07-11 06:55   by: Cursor
 * ticket refirement: ADMIN-198 / ADMIN-227 Discovery run-all
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              GET /api/tecnici/run-all — discovery run-all (script list + smoke path).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Regressione su payload discovery run-all esposto dal cruscotto e condiviso con smoke-run-all.
 *
 *   A cosa serve:
 *   - Verifica GET /api/tecnici/run-all e coerenza con admin.portal.lib/portal.run.all.discovery.mjs.
 *
 * Generalizzazione:
 *   Si — overlay e base URL da env o argv.
 *
 * Input:
 *   - DASHBOARD_URL — base HTTP cruscotto
 *   - PRJ_NAME / --overlay — overlay per risoluzione porta
 *
 * Scenari verificati:
 *   - Modulo discovery — orchestrator, reportsDir, scriptCount coerente con discoverTestScripts
 *   - GET /api/tecnici/run-all — HTTP 200, scripts array, orchestrator e npmScript
 *
 * Uso:
 *   - node admin.portal.testscript/technical/test.portal.run.all.discovery.mjs
 *   - node admin.portal.testscript/technical/test.portal.run.all.discovery.mjs --overlay AdminDashBoard
 *
 * Exit code:
 *   0 — scenari passati
 *   1 — assert fallito o errore
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  getRunAllDiscoveryPayload
, RUN_ALL_ORCHESTRATOR
} from "../../admin.portal.lib/portal.run.all.discovery.mjs";
import {
  assert
, logSection
, logUnlessJson
, portalFetch
, printSummary
, resolveScriptMeta
, runTest
} from "../lib/http.mjs";
import {
  parseOverlayCli
, printOverlayCliHelp
, resolveCruscottoContext
} from "../lib/portal-context.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** @type {import("../admin.portal.lib/http.mjs").TestResult[]} */
const results = [];

async function main() {
  const cli = parseOverlayCli(process.argv);

  if (cli.help) {
    printOverlayCliHelp("portal-run-all-discovery");
    return;
  }

  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  const modulePayload = await getRunAllDiscoveryPayload();

  logSection("Run-all discovery — modulo");

  await runTest("portal.run.all.discovery — orchestrator e scriptCount", async () => {
    assert(modulePayload.readOnly === true, "readOnly atteso true");
    assert(modulePayload.orchestrator === RUN_ALL_ORCHESTRATOR, "orchestrator incoerente");
    assert(typeof modulePayload.reportsDir === "string" && modulePayload.reportsDir.length > 0, "reportsDir mancante");
    assert(Array.isArray(modulePayload.scripts), "scripts non array");
    assert(modulePayload.scriptCount === modulePayload.scripts.length, "scriptCount incoerente");
    assert(modulePayload.scriptCount >= 1, "discovery vuota");

    const aliasAbs = join(PORTAL_ROOT, RUN_ALL_ORCHESTRATOR);
    assert(existsSync(aliasAbs), `alias orchestrator assente: ${RUN_ALL_ORCHESTRATOR}`);

    const first = /** @type {Record<string, unknown>} */ (modulePayload.scripts[0]);
    assert(typeof first.rel === "string" && first.rel.length > 0, "rel mancante");
    assert(typeof first.suite === "string", "suite mancante");
    assert(typeof first.file === "string", "file mancante");
  }, results);

  logSection("Run-all discovery — API");

  await runTest("GET /api/tecnici/run-all — payload read-only", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/tecnici/run-all");
    assert(res.ok, `HTTP ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(data.readOnly === true, "readOnly atteso true");
    assert(data.orchestrator === RUN_ALL_ORCHESTRATOR, "orchestrator API incoerente");
    assert(data.npmScript === "test:run-all", "npmScript atteso test:run-all");
    assert(typeof data.ciSmoke === "string" && data.ciSmoke.includes("smoke-run-all"), "ciSmoke mancante");
    assert(Array.isArray(data.scripts) && data.scripts.length > 0, "scripts vuoto");
    assert(data.scriptCount === data.scripts.length, "scriptCount API incoerente");
    assert(data.scriptCount === modulePayload.scriptCount, "scriptCount diverso da modulo condiviso");
    assert(
      JSON.stringify(data.scripts) === JSON.stringify(modulePayload.scripts)
    , "scripts API diverso da modulo condiviso"
    );
  }, results);

  printSummary(results, { title: "Run-all discovery", meta: resolveScriptMeta(import.meta.url) });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
