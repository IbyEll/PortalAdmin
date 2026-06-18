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
 *                  GET /api/status — stato run testScript in corso sul cruscotto.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - regressione sul payload del run manager esposto dal cruscotto durante esecuzione test
 *
 *   A cosa serve:
 *   - esito pass/fail da CLI o TestTecnici; verifica campi running, currentScript e progress
 *
 * Generalizzazione:
 *   Si — base URL e overlay da env o argv; nessun hardcode su un solo progetto
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - DASHBOARD_URL — base HTTP cruscotto già avviato
 *   - PRJ_NAME / --overlay — overlay opzionale per risoluzione base da config progetto
 *   - argv — --help, --base, --port, --json
 *
 * Scenari verificati:
 *   - GET /api/status — payload run manager — HTTP 200, body JSON con running boolean,
 *     currentScript e progress presenti
 *
 * Uso:
 *   - node admin.portal.testscript/health/test.api.status.mjs
 *   - node admin.portal.testscript/health/test.api.status.mjs --overlay AdminDashBoard
 *   - node admin.portal.testscript/health/test.api.status.mjs --base http://127.0.0.1:3999
 *
 * Flag CLI:
 *   --help, -h     riepilogo overlay/base ed exit 0
 *   --overlay      overlay PROJECT_Nome
 *   --base         base URL cruscotto
 *   --port         porta se si risolve base da overlay
 *   --json         report JSON su stdout
 *
 * Variabili d'ambiente:
 *   DASHBOARD_URL  base cruscotto (alternativa a --base)
 *   PRJ_NAME       overlay implicito se non passato --overlay
 *
 * Integrazione cruscotto:
 *   - admin.portal.testscript/health/test.api.status.mjs
 *   - area TestTecnici — stato run manager testScript
 *
 * Prerequisiti:
 *   - cruscotto HTTP raggiungibile (DASHBOARD_URL, --base o --overlay)
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
/** @type {import("../lib/http.mjs").TestResult[]} */
const results = [];

async function main() {
  // 1. Parse argv overlay — help stampa usage ed exit 0 senza fetch
  const cli = parseOverlayCli(process.argv);

  if (cli.help) {
    printOverlayCliHelp("health");
    return;
  }

  // 2. Risolvi contesto cruscotto — base da DASHBOARD_URL, --base o overlay + porta
  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  // 3. Intestazione sezione — delimita scenario in log TestTecnici
  logSection("API status run");

  // 4. Scenario — GET /api/status e assert su campi run manager
  await runTest("GET /api/status — payload run manager", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/status");
    assert(res.ok, `HTTP ${res.status}`);
    assert(body && typeof body === "object", "body non JSON");

    const data = /** @type {Record<string, unknown>} */ (body);
    assert(typeof data.running === "boolean", "running mancante");
    assert("currentScript" in data, "currentScript mancante");
    assert("progress" in data, "progress mancante");
  }, results);

  // 5. Riepilogo — printSummary con meta script
  printSummary(results, { title: "Status API", meta: resolveScriptMeta(import.meta.url) });
}

// 6. Errori non gestiti — messaggio su stderr e exit code 1
main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
