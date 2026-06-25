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
 *                               Istanza overlay attiva — GET /api/portal/instance e PRJ_NAME
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - L'istanza portal (PRJ_NAME, PRODUCT_REPO_PATH) deve essere esposta e allineata all'overlay attivo.
 *
 *   A cosa serve:
 *   - Verifica GET /api/portal/instance: envPrjName, aligned boolean e match overlay CLI.
 *
 * Generalizzazione:
 *   Si — base e overlay da parseOverlayCli / DASHBOARD_URL; validazione condizionale su --overlay.
 *
 * Input:
 *   - DASHBOARD_URL — base cruscotto
 *   - --overlay, --port, --base — contesto via portal-context.mjs
 *   - --json — report JSON
 *
 * Scenari verificati:
 *   - GET /api/portal/instance — env e aligned — campi envPrjName e aligned presenti
 *   - overlay CLI — envPrjName coincide con --overlay se specificato
 *
 * Uso:
 *   - node admin.portal.testscript/portal/test.portal.instance.mjs
 *   - node admin.portal.testscript/portal/test.portal.instance.mjs --overlay AdminDashBoard
 *
 * Flag CLI:
 *   --help, -h     riepilogo ed exit 0
 *   --overlay      overlay atteso in envPrjName
 *   --port         porta dashboard
 *   --base         URL base esplicito
 *   --json         report JSON
 *
 * Variabili d'ambiente:
 *   DASHBOARD_URL  base cruscotto (default http://127.0.0.1:3999)
 *
 * Integrazione cruscotto:
 *   - admin.portal.testscript/portal/test.portal.instance.mjs
 *   - run-portal-api.mjs — suite portal smoke
 *
 * Prerequisiti:
 *   - cruscotto server avviato con istanza portal configurata
 *
 * Exit code:
 *   0 — tutti gli scenari passati
 *   1 — assert fallito o errore runtime
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
  // 1. Help / parse argv — esci 0 senza side effect
  const cli = parseOverlayCli(process.argv);

  if (cli.help) {
    printOverlayCliHelp("portal");
    return;
  }

  // 2. Contesto cruscotto — base URL e overlay opzionale
  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  logSection("Portal instance");

  // 3. Scenari — GET /api/portal/instance e allineamento overlay
  await runTest("GET /api/portal/instance — env e aligned", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/portal/instance");
    assert(res.ok, `HTTP ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert("envPrjName" in data, "envPrjName mancante");
    assert(typeof data.aligned === "boolean", "aligned mancante");

    if (ctx.overlay) {
      assert(data.envPrjName === ctx.overlay, `envPrjName atteso ${ctx.overlay}`);
    }
  }, results);

  // 4. Riepilogo esiti
  printSummary(results, { title: "Portal instance", meta: resolveScriptMeta(import.meta.url) });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
