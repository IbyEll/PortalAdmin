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
 *              GET /api/dev/requirements — prerequisiti stack dev PortalAdmin (cruscotto).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - regressione sull'endpoint che espone i requisiti dello stack dev per l'overlay attivo
 *
 *   A cosa serve:
 *   - esito pass/fail da CLI; verifica risposta HTTP 200 con body JSON oggetto
 *
 * Generalizzazione:
 *   Si — base URL e overlay da env o argv; requisiti dipendono da config progetto istanziato
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - DASHBOARD_URL — base HTTP cruscotto
 *   - PRJ_NAME / --overlay — overlay PROJECT_Nome
 *   - argv — --help, --base, --port, --json
 *
 * Scenari verificati:
 *   - GET /api/dev/requirements — struttura requisiti — HTTP ok e body JSON oggetto
 *
 * Uso:
 *   - node admin.portal.testscript/dev/test.dev.requirements.mjs
 *   - node admin.portal.testscript/dev/test.dev.requirements.mjs --overlay AdminDashBoard
 *   - node admin.portal.testscript/dev/test.dev.requirements.mjs --base http://127.0.0.1:3999
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
 *   - admin.portal.testscript/dev/test.dev.requirements.mjs
 *   - area TestTecnici — prerequisiti stack dev da pannello cruscotto
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
/** @type {import("../admin.portal.lib/http.mjs").TestResult[]} */
const results = [];

async function main() {
  // 1. Parse argv overlay — help stampa usage ed exit 0 senza fetch
  const cli = parseOverlayCli(process.argv);

  if (cli.help) {
    printOverlayCliHelp("dev");
    return;
  }

  // 2. Risolvi contesto cruscotto — base da DASHBOARD_URL, --base o overlay + porta
  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  // 3. Intestazione sezione — delimita scenario dev requirements
  logSection("Dev requirements");

  // 4. Scenario — GET /api/dev/requirements e assert body JSON
  await runTest("GET /api/dev/requirements — struttura requisiti", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/dev/requirements");
    assert(res.ok, `HTTP ${res.status}`);
    assert(body && typeof body === "object", "body non JSON");
  }, results);

  // 5. Riepilogo — printSummary con meta script
  printSummary(results, { title: "Dev requirements", meta: resolveScriptMeta(import.meta.url) });
}

// 6. Errori non gestiti — messaggio su stderr e exit code 1
main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
