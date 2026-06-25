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
 *              GET /api/dev/services — servizi stack con probe health (PortalAdmin cruscotto).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - regressione sulla lista servizi dev con timestamp probe esposti dal cruscotto
 *
 *   A cosa serve:
 *   - esito pass/fail da CLI; verifica checkedAt stringa e services array nel payload
 *
 * Generalizzazione:
 *   Si — base URL e overlay da env o argv; elenco servizi dipende da stack overlay
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - DASHBOARD_URL — base HTTP cruscotto
 *   - PRJ_NAME / --overlay — overlay PROJECT_Nome
 *   - argv — --help, --base, --port, --json
 *
 * Scenari verificati:
 *   - GET /api/dev/services — lista servizi — HTTP 200, checkedAt stringa, services array
 *     (timeout 30s per probe paralleli)
 *
 * Uso:
 *   - node admin.portal.testscript/dev/test.dev.services.mjs
 *   - node admin.portal.testscript/dev/test.dev.services.mjs --overlay JustLastOne
 *   - node admin.portal.testscript/dev/test.dev.services.mjs --base http://127.0.0.1:3999
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
 *   - admin.portal.testscript/dev/test.dev.services.mjs
 *   - area TestTecnici — probe health servizi stack dev
 *
 * Prerequisiti:
 *   - cruscotto HTTP raggiungibile; servizi dev opzionali (probe può segnalare down nel body)
 *
 * Exit code:
 *   0 — scenario runTest passato
 *   1 — assert fallito, timeout fetch o errore non gestito
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

  // 3. Intestazione sezione — delimita scenario dev services
  logSection("Dev services");

  // 4. Scenario — GET /api/dev/services con timeout probe e assert struttura
  await runTest("GET /api/dev/services — lista servizi", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/dev/services", { timeoutMs: 30_000 });
    assert(res.ok, `HTTP ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(typeof data.checkedAt === "string", "checkedAt mancante");
    assert(Array.isArray(data.services), "services non array");
  }, results);

  // 5. Riepilogo — printSummary con meta script
  printSummary(results, { title: "Dev services", meta: resolveScriptMeta(import.meta.url) });
}

// 6. Errori non gestiti — messaggio su stderr e exit code 1
main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
