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
 *           GET /api/repo/services/status — stato processi stack avviati da cruscotto (PortalAdmin).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - regressione sul payload stato processi product avviati o gestiti dal cruscotto
 *
 *   A cosa serve:
 *   - esito pass/fail da CLI; verifica HTTP 200 con body JSON oggetto
 *
 * Generalizzazione:
 *   Si — base URL e overlay da env o argv; stato processi dipende da istanza overlay attiva
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - DASHBOARD_URL — base HTTP cruscotto
 *   - PRJ_NAME / --overlay — overlay PROJECT_Nome
 *   - argv — --help, --base, --port, --json
 *
 * Scenari verificati:
 *   - GET /api/repo/services/status — payload stato — HTTP ok e body JSON oggetto
 *
 * Uso:
 *   - node admin.portal.testscript/repo/test.repo.services.status.mjs
 *   - node admin.portal.testscript/repo/test.repo.services.status.mjs --overlay AdminDashBoard
 *   - node admin.portal.testscript/repo/test.repo.services.status.mjs --base http://127.0.0.1:3999
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
 *   - admin.portal.testscript/repo/test.repo.services.status.mjs
 *   - area TestTecnici — stato processi stack product da cruscotto
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
    printOverlayCliHelp("repo");
    return;
  }

  // 2. Risolvi contesto cruscotto — base da DASHBOARD_URL, --base o overlay + porta
  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  // 3. Intestazione sezione — delimita scenario repo services status
  logSection("Repo services status");

  // 4. Scenario — GET /api/repo/services/status e assert body JSON
  await runTest("GET /api/repo/services/status — payload stato", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/repo/services/status");
    assert(res.ok, `HTTP ${res.status}`);
    assert(body && typeof body === "object", "body non JSON");
  }, results);

  // 5. Riepilogo — printSummary con meta script
  printSummary(results, { title: "Repo status", meta: resolveScriptMeta(import.meta.url) });
}

// 6. Errori non gestiti — messaggio su stderr e exit code 1
main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
