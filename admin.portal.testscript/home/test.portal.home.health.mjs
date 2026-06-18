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
 *                              Health home-only — GET /api/health su portal.home.server :3990
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - portal.home.server espone API ridotte (mode home-only) separate dal cruscotto full dashboard.
 *
 *   A cosa serve:
 *   - Verifica GET /api/health su HOME_BASE: ok true, mode home-only e port valida.
 *
 * Generalizzazione:
 *   Si — base da resolveHomeBase / HOME_PORT / PORTAL_HOME_URL.
 *
 * Input:
 *   - PORTAL_HOME_URL — override URL home (default http://127.0.0.1:3990)
 *   - HOME_PORT         — porta alternativa portal home
 *
 * Scenari verificati:
 *   - GET /api/health — mode home-only — payload ok, mode e port attesi
 *
 * Uso:
 *   - node admin.portal.testscript/home/test.portal.home.health.mjs
 *
 * Flag CLI:
 *   --help, -h     riepilogo ed exit 0
 *   --json         report JSON (http.mjs)
 *
 * Variabili d'ambiente:
 *   PORTAL_HOME_URL  base portal home
 *   HOME_PORT        porta home-only
 *
 * Integrazione cruscotto:
 *   - admin.portal.testscript/home/test.portal.home.health.mjs
 *   - run-portal-api.mjs — suite home smoke
 *
 * Prerequisiti:
 *   - admin.portal/portal.home.server.mjs avviato (npm run portal:home o equivalente)
 *
 * Exit code:
 *   0 — scenario passato
 *   1 — assert fallito o fetch errore
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
/** @type {import("../lib/http.mjs").TestResult[]} */
const results = [];

async function main() {
  // 1. Help — esci 0 senza chiamate HTTP
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printOverlayCliHelp("home");
    return;
  }

  // 2. Base home-only — resolveHomeBase da env
  const base = resolveHomeBase();
  logUnlessJson(`HOME: ${base}`);

  logSection("Home health");

  // 3. Scenari — GET /api/health mode home-only
  await runTest("GET /api/health — mode home-only", async () => {
    const { res, body } = await portalFetch(base, "/api/health");
    assert(res.ok, `HTTP ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(data.ok === true, "ok !== true");
    assert(data.mode === "home-only", `mode atteso home-only, ricevuto ${String(data.mode)}`);
    assert(Number(data.port) > 0, "port mancante");
  }, results);

  // 4. Riepilogo esiti
  printSummary(results, { title: "Home health", meta: resolveScriptMeta(import.meta.url) });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
