#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TESTSCRIPT ** -- commentato il: 2026-06-18 16:10
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 16:10   by: IbyEll
 * modificato il: 2026-06-18 16:10   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                          Progetti portal su home — GET /api/portal/projects contratto cruscotto
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - La home portal deve elencare gli overlay con lo stesso contratto JSON del cruscotto full.
 *
 *   A cosa serve:
 *   - Verifica GET /api/portal/projects su portal.home.server: array projects non vuoto.
 *
 * Generalizzazione:
 *   Si — base home da resolveHomeBase / env PORTAL_HOME_URL.
 *
 * Input:
 *   - PORTAL_HOME_URL — URL portal home
 *   - HOME_PORT         — porta alternativa
 *
 * Scenari verificati:
 *   - GET /api/portal/projects — lista overlay — HTTP 200 e projects array con elementi
 *
 * Uso:
 *   - node admin.portal.testscript/home/test.portal.home.projects.mjs
 *
 * Flag CLI:
 *   --help, -h     riepilogo ed exit 0
 *   --json         report JSON
 *
 * Variabili d'ambiente:
 *   PORTAL_HOME_URL  base portal home
 *   HOME_PORT        porta home-only
 *
 * Integrazione cruscotto:
 *   - admin.portal.testscript/home/test.portal.home.projects.mjs
 *   - run-portal-api.mjs — suite home
 *
 * Prerequisiti:
 *   - portal.home.server avviato
 *
 * Exit code:
 *   0 — scenario passato
 *   1 — fallimento o errore
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import {
  assert
, logSection
, logUnlessJson
, portalFetch
, printSummary
, resolveScriptMeta
, runTest
} from "../lib/http.mjs";
import { printOverlayCliHelp, resolveHomeBase } from "../lib/portal-context.mjs";

/** Accumulatore esiti runTest per riepilogo finale. */
/** @type {import("../admin.portal.lib/http.mjs").TestResult[]} */
const results = [];

async function main() {
  // 1. Help — esci 0 senza fetch
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printOverlayCliHelp("home");
    return;
  }

  // 2. Base home — resolveHomeBase
  const base = resolveHomeBase();
  logUnlessJson(`HOME: ${base}`);

  logSection("Home portal projects");

  // 3. Scenari — GET /api/portal/projects su home
  await runTest("GET /api/portal/projects — lista overlay", async () => {
    const { res, body } = await portalFetch(base, "/api/portal/projects");
    assert(res.ok, `HTTP ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(Array.isArray(data.projects), "projects non array");
    assert(data.projects.length > 0, "projects vuoto");
  }, results);

  // 4. Riepilogo esiti
  printSummary(results, { title: "Home projects", meta: resolveScriptMeta(import.meta.url) });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
