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
 *                GET /api/health — snapshot progetto e servizi stack dev (cruscotto).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - regressione automatica sul contratto health del cruscotto PortalAdmin (progetto attivo e servizi)
 *
 *   A cosa serve:
 *   - esito pass/fail da CLI o catalogo TestTecnici; verifica JSON checkedAt, project e services
 *
 * Generalizzazione:
 *   Si — base URL e overlay da env o argv; assert su project.name opzionale se config overlay risolta
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - DASHBOARD_URL — base HTTP cruscotto già avviato (alternativa a --base o --overlay)
 *   - PRJ_NAME / --overlay — overlay PROJECT_Nome per confronto project.name e jiraPrefix
 *   - argv — --help, --base, --port, --json
 *
 * Scenari verificati:
 *   - GET /api/health — 200 e project — HTTP ok, checkedAt stringa, project oggetto, services array;
 *     se ctx.config presente: name e jiraPrefix allineati all'overlay
 *
 * Uso:
 *   - node admin.portal.testscript/health/test.api.health.mjs
 *   - node admin.portal.testscript/health/test.api.health.mjs --overlay AdminDashBoard
 *   - node admin.portal.testscript/health/test.api.health.mjs --base http://127.0.0.1:3999 --json
 *
 * Flag CLI:
 *   --help, -h     riepilogo overlay/base ed exit 0
 *   --overlay      overlay PROJECT_Nome (es. JustLastOne, AdminDashBoard)
 *   --base         base URL cruscotto (es. http://127.0.0.1:3999)
 *   --port         porta se si risolve base da overlay
 *   --json         report JSON su stdout (via lib/http.mjs)
 *
 * Variabili d'ambiente:
 *   DASHBOARD_URL  base cruscotto (default risolto da overlay o http://127.0.0.1:porta config)
 *   PRJ_NAME       overlay implicito se non passato --overlay
 *
 * Integrazione cruscotto:
 *   - admin.portal.testscript/health/test.api.health.mjs
 *   - area TestTecnici — smoke API health stack PortalAdmin
 *
 * Prerequisiti:
 *   - cruscotto HTTP raggiungibile (DASHBOARD_URL, --base o --overlay con istanza attiva)
 *
 * Exit code:
 *   0 — scenario runTest passato
 *   1 — assert fallito, contesto non risolvibile o errore non gestito in main
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
    printOverlayCliHelp("health");
    return;
  }

  // 2. Risolvi contesto cruscotto — base da DASHBOARD_URL, --base o overlay + porta
  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  // 3. Intestazione sezione — delimita scenario in log TestTecnici
  logSection("API health");

  // 4. Scenario — GET /api/health e assert su project e services
  await runTest("GET /api/health — 200 e project", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/health");
    assert(res.ok, `HTTP ${res.status}`);
    assert(body && typeof body === "object", "body non JSON");

    const data = /** @type {Record<string, unknown>} */ (body);
    assert(typeof data.checkedAt === "string", "checkedAt mancante");
    assert(data.project && typeof data.project === "object", "project mancante");

    const project = /** @type {Record<string, unknown>} */ (data.project);

    if (ctx.config) {
      assert(project.name === ctx.config.PRJ_NAME, `project.name atteso ${ctx.config.PRJ_NAME}`);
      assert(project.jiraPrefix === ctx.config.PRJ_JIRA_PREFIX, "jiraPrefix mismatch");
    }

    assert(Array.isArray(data.services), "services non array");
  }, results);

  // 5. Riepilogo — printSummary con meta script; exit 1 implicito se fail in lib
  printSummary(results, { title: "Health API", meta: resolveScriptMeta(import.meta.url) });
}

// 6. Errori non gestiti — messaggio su stderr e exit code 1
main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
