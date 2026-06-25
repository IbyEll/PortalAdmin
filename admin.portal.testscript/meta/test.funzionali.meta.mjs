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
 *            GET /api/funzionali/meta — scenari TestFunzionali per overlay attivo (cruscotto).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - regressione sul catalogo meta TestFunzionali esposto dal cruscotto per l'overlay corrente
 *
 *   A cosa serve:
 *   - esito pass/fail da CLI; verifica scenarios non vuoto con id e cases per ogni scenario
 *
 * Generalizzazione:
 *   Si — overlay e base URL da env o argv; scenari dipendono da config overlay
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - DASHBOARD_URL — base HTTP cruscotto
 *   - PRJ_NAME / --overlay — overlay PROJECT_Nome per meta funzionali
 *   - argv — --help, --base, --port, --json
 *
 * Scenari verificati:
 *   - GET /api/funzionali/meta — scenarios — HTTP 200, scenarios array non vuoto; primo
 *     elemento con id stringa e cases array
 *
 * Uso:
 *   - node admin.portal.testscript/meta/test.funzionali.meta.mjs
 *   - node admin.portal.testscript/meta/test.funzionali.meta.mjs --overlay AdminDashBoard
 *   - node admin.portal.testscript/meta/test.funzionali.meta.mjs --base http://127.0.0.1:3999
 *
 * Flag CLI:
 *   --help, -h     riepilogo overlay/base ed exit 0
 *   --overlay      overlay PROJECT_Nome
 *   --base         base URL cruscotto
 *   --port         porta se si risolve base da overlay
 *   --json         report JSON su stdout
 *
 * Variabili d'ambiente:
 *   DASHBOARD_URL  base cruscotto
 *   PRJ_NAME       overlay implicito
 *
 * Integrazione cruscotto:
 *   - admin.portal.testscript/meta/test.funzionali.meta.mjs
 *   - area TestFunzionali — endpoint meta scenari UI e funzionali
 *
 * Prerequisiti:
 *   - cruscotto HTTP raggiungibile con overlay o base esplicita
 *
 * Exit code:
 *   0 — scenario runTest passato
 *   1 — assert fallito, contesto non risolvibile o errore non gestito
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
  // 1. Parse argv overlay — help stampa usage ed exit 0 senza fetch
  const cli = parseOverlayCli(process.argv);

  if (cli.help) {
    printOverlayCliHelp("meta");
    return;
  }

  // 2. Risolvi contesto cruscotto — base da DASHBOARD_URL, --base o overlay + porta
  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  // 3. Intestazione sezione — delimita scenario meta TestFunzionali
  logSection("Funzionali meta");

  // 4. Scenario — GET /api/funzionali/meta e assert su scenarios
  await runTest("GET /api/funzionali/meta — scenarios", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/funzionali/meta");
    assert(res.ok, `HTTP ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(Array.isArray(data.scenarios), "scenarios non array");
    assert(data.scenarios.length > 0, "scenarios vuoto");

    const first = /** @type {Record<string, unknown>} */ (data.scenarios[0]);
    assert(typeof first.id === "string", "scenario.id mancante");
    assert(Array.isArray(first.cases), "scenario.cases non array");
  }, results);

  // 5. Riepilogo — printSummary con meta script
  printSummary(results, { title: "Funzionali meta", meta: resolveScriptMeta(import.meta.url) });
}

// 6. Errori non gestiti — messaggio su stderr e exit code 1
main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
