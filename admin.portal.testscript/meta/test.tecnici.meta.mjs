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
 *              GET /api/tecnici/meta — meta TestTecnici (prerequisites, architecture, runOrder).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - regressione sul catalogo meta TestTecnici servito dal cruscotto per overlay attivo
 *
 *   A cosa serve:
 *   - esito pass/fail da CLI; verifica struttura prerequisites, architecture e runOrder
 *
 * Generalizzazione:
 *   Si — overlay e base URL da env o argv; meta dipende da PROJECT_Nome istanziato
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - DASHBOARD_URL — base HTTP cruscotto
 *   - PRJ_NAME / --overlay — overlay per risoluzione porta e config progetto
 *   - argv — --help, --base, --port, --json
 *
 * Scenari verificati:
 *   - GET /api/tecnici/meta — prerequisites e architecture — HTTP 200, prerequisites,
 *     architecture e runOrder array
 *
 * Uso:
 *   - node admin.portal.testscript/meta/test.tecnici.meta.mjs
 *   - node admin.portal.testscript/meta/test.tecnici.meta.mjs --overlay JustLastOne
 *   - node admin.portal.testscript/meta/test.tecnici.meta.mjs --base http://127.0.0.1:3999
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
 *   - admin.portal.testscript/meta/test.tecnici.meta.mjs
 *   - area TestTecnici — endpoint meta catalogo script tecnici
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
/** @type {import("../lib/http.mjs").TestResult[]} */
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

  // 3. Intestazione sezione — delimita scenario meta TestTecnici
  logSection("Tecnici meta");

  // 4. Scenario — GET /api/tecnici/meta e assert su array catalogo
  await runTest("GET /api/tecnici/meta — prerequisites e architecture", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/tecnici/meta");
    assert(res.ok, `HTTP ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(Array.isArray(data.prerequisites), "prerequisites non array");
    assert(Array.isArray(data.architecture), "architecture non array");
    assert(Array.isArray(data.runOrder), "runOrder non array");
  }, results);

  // 5. Riepilogo — printSummary con meta script
  printSummary(results, { title: "Tecnici meta", meta: resolveScriptMeta(import.meta.url) });
}

// 6. Errori non gestiti — messaggio su stderr e exit code 1
main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
