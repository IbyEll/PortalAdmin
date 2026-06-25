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
 *         GET /api/repo/services/discover — discovery servizi product da manifest overlay.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - regressione sulla discovery servizi del product repo tramite manifest overlay sul cruscotto
 *
 *   A cosa serve:
 *   - esito pass/fail da CLI; accetta 502 se product repo o manifest assenti, altrimenti services
 *
 * Generalizzazione:
 *   Si — overlay e PRODUCT_REPO_PATH guidano discovery; non hardcoded su un solo product
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - DASHBOARD_URL — base HTTP cruscotto
 *   - PRJ_NAME / --overlay — overlay per path product e manifest
 *   - PRODUCT_REPO_PATH — checkout product (risolto da overlay se assente)
 *   - argv — --help, --base, --port, --json
 *
 * Scenari verificati:
 *   - GET /api/repo/services/discover — servizi noti — HTTP 200 con services nel body; oppure
 *     502 accettato con skip se product repo o manifest non disponibili
 *
 * Uso:
 *   - node admin.portal.testscript/repo/test.repo.services.discover.mjs
 *   - node admin.portal.testscript/repo/test.repo.services.discover.mjs --overlay JustLastOne
 *   - node admin.portal.testscript/repo/test.repo.services.discover.mjs --base http://127.0.0.1:3999
 *
 * Flag CLI:
 *   --help, -h     riepilogo overlay/base ed exit 0
 *   --overlay      overlay PROJECT_Nome
 *   --base         base URL cruscotto
 *   --port         porta se si risolve base da overlay
 *   --json         report JSON su stdout
 *
 * Variabili d'ambiente:
 *   DASHBOARD_URL      base cruscotto
 *   PRJ_NAME           overlay implicito
 *   PRODUCT_REPO_PATH  path assoluto product repo per discovery
 *
 * Integrazione cruscotto:
 *   - admin.portal.testscript/repo/test.repo.services.discover.mjs
 *   - area TestTecnici — discovery servizi da product.manifest.json
 *
 * Prerequisiti:
 *   - cruscotto HTTP raggiungibile; product repo e manifest opzionali (502 ammesso)
 *
 * Exit code:
 *   0 — scenario runTest passato (200 validato o 502 accettato)
 *   1 — status HTTP inatteso, assert su body o errore non gestito
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
    printOverlayCliHelp("repo");
    return;
  }

  // 2. Risolvi contesto cruscotto — base da DASHBOARD_URL, --base o overlay + porta
  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  // 3. Intestazione sezione — delimita scenario repo discover
  logSection("Repo services discover");

  // 4. Scenario — GET discover; 200 con services o 502 skip se manifest assente
  await runTest("GET /api/repo/services/discover — servizi noti", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/repo/services/discover");
    assert(res.ok || res.status === 502, `HTTP ${res.status} inatteso`);

    if (!res.ok) {
      return ["skip: discovery 502 (product repo o manifest)"];
    }

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(Array.isArray(data.services) || data.services, "services mancante");
  }, results);

  // 5. Riepilogo — printSummary con meta script
  printSummary(results, { title: "Repo discover", meta: resolveScriptMeta(import.meta.url) });
}

// 6. Errori non gestiti — messaggio su stderr e exit code 1
main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
