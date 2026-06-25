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
 *                              Catalogo testScript overlay — GET /api/scripts con suite e rel
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Il cruscotto espone il catalogo testScript del product overlay per TestTecnici e runner UI.
 *
 *   A cosa serve:
 *   - Verifica GET /api/scripts: array scripts con campi rel, suite =suite e file.
 *
 * Generalizzazione:
 *   Si — catalogo dipende da overlay attivo e PRODUCT_REPO_PATH del cruscotto.
 *
 * Input:
 *   - DASHBOARD_URL — base cruscotto
 *   - --overlay, --port, --base — contesto overlay
 *   - PRJ_NAME — overlay istanziato sul server (env runtime cruscotto)
 *
 * Scenari verificati:
 *   - GET /api/scripts — array scripts con suite — catalogo non vuoto, shape primo elemento
 *
 * Uso:
 *   - node admin.portal.testscript/scripts/test.scripts.catalog.mjs
 *   - node admin.portal.testscript/scripts/test.scripts.catalog.mjs --overlay JustLastOne
 *
 * Flag CLI:
 *   --help, -h     riepilogo ed exit 0
 *   --overlay      overlay atteso sul server
 *   --port, --base contesto URL
 *   --json         report JSON
 *
 * Variabili d'ambiente:
 *   DASHBOARD_URL  base cruscotto
 *
 * Integrazione cruscotto:
 *   - admin.portal.testscript/scripts/test.scripts.catalog.mjs
 *   - run-portal-api.mjs — suite scripts
 *
 * Prerequisiti:
 *   - cruscotto avviato con overlay e product repo validi
 *
 * Exit code:
 *   0 — scenario passato
 *   1 — fallimento assert o errore
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
import {
  parseOverlayCli
, printOverlayCliHelp
, resolveCruscottoContext
} from "../lib/portal-context.mjs";

/** Accumulatore esiti runTest per riepilogo finale. */
/** @type {import("../admin.portal.lib/http.mjs").TestResult[]} */
const results = [];

async function main() {
  // 1. Help / parse argv — esci 0
  const cli = parseOverlayCli(process.argv);

  if (cli.help) {
    printOverlayCliHelp("scripts");
    return;
  }

  // 2. Contesto cruscotto
  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  logSection("Scripts catalog");

  // 3. Scenari — GET /api/scripts e shape catalogo
  await runTest("GET /api/scripts — array scripts con suite", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/scripts");
    assert(res.ok, `HTTP ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(Array.isArray(data.scripts), "scripts non array");
    assert(data.scripts.length > 0, "catalogo vuoto");

    const first = /** @type {Record<string, unknown>} */ (data.scripts[0]);
    assert(typeof first.rel === "string", "rel mancante su script");
    assert(typeof first.suite === "string", "suite mancante su script");
    assert(typeof first.file === "string", "file mancante su script");
  }, results);

  // 4. Riepilogo esiti
  printSummary(results, { title: "Scripts catalog", meta: resolveScriptMeta(import.meta.url) });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
