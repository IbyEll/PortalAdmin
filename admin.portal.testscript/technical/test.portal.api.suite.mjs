#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TESTSCRIPT ** -- commentato il: 2026-07-10 22:00
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-07-10 22:00   by: Cursor
 * ticket refirement: ADMIN-197 / ADMIN-225 API read-only suite
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              GET /api/tecnici/suite — suite read-only run-portal-api (script list + CI smoke).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Regressione su catalogo suite API read-only esposto dal cruscotto e condiviso con run-portal-api.
 *
 *   A cosa serve:
 *   - Verifica payload GET /api/tecnici/suite e coerenza con admin.portal.lib/portal.api.suite.mjs.
 *
 * Generalizzazione:
 *   Si — overlay e base URL da env o argv.
 *
 * Input:
 *   - DASHBOARD_URL — base HTTP cruscotto
 *   - PRJ_NAME / --overlay — overlay per risoluzione porta
 *
 * Scenari verificati:
 *   - GET /api/tecnici/suite — HTTP 200, cruscotto/home array, orchestrator e npmScript
 *   - Modulo suite — scriptCount coerente con elenco cruscotto + home
 *
 * Uso:
 *   - node admin.portal.testscript/technical/test.portal.api.suite.mjs
 *   - node admin.portal.testscript/technical/test.portal.api.suite.mjs --overlay AdminDashBoard
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
  getPortalApiSuitePayload
, PORTAL_API_CRUSCOTTO_SCRIPTS
, PORTAL_API_HOME_SCRIPTS
} from "../../admin.portal.lib/portal.api.suite.mjs";
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

const TESTSCRIPT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @type {import("../admin.portal.lib/http.mjs").TestResult[]} */
const results = [];

async function main() {
  const cli = parseOverlayCli(process.argv);

  if (cli.help) {
    printOverlayCliHelp("portal-api-suite");
    return;
  }

  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  logSection("Portal API suite — modulo");

  await runTest("portal.api.suite — scriptCount e path esistenti", async () => {
    const payload = getPortalApiSuitePayload();

    assert(payload.readOnly === true, "readOnly atteso true");
    assert(Array.isArray(payload.cruscotto), "cruscotto non array");
    assert(Array.isArray(payload.home), "home non array");
    assert(payload.scriptCount === PORTAL_API_CRUSCOTTO_SCRIPTS.length + PORTAL_API_HOME_SCRIPTS.length, "scriptCount incoerente");
    assert(payload.cruscotto.length >= 10, "cruscotto troppo corto");

    for (const rel of [...PORTAL_API_CRUSCOTTO_SCRIPTS, ...PORTAL_API_HOME_SCRIPTS]) {
      const abs = join(TESTSCRIPT_ROOT, rel);
      assert(existsSync(abs), `script assente: ${rel}`);
    }
  }, results);

  logSection("Portal API suite — API");

  await runTest("GET /api/tecnici/suite — payload read-only", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/tecnici/suite");
    assert(res.ok, `HTTP ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(data.readOnly === true, "readOnly atteso true");
    assert(typeof data.orchestrator === "string" && data.orchestrator.includes("run-portal-api"), "orchestrator mancante");
    assert(data.npmScript === "test:portal-api", "npmScript atteso test:portal-api");
    assert(Array.isArray(data.cruscotto) && data.cruscotto.length > 0, "cruscotto vuoto");
    assert(Array.isArray(data.home), "home non array");
    assert(
      JSON.stringify(data.cruscotto) === JSON.stringify(PORTAL_API_CRUSCOTTO_SCRIPTS)
    , "cruscotto API diverso da modulo condiviso"
    );
  }, results);

  printSummary(results, { title: "Portal API suite", meta: resolveScriptMeta(import.meta.url) });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
