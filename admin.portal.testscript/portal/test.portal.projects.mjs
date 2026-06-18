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
 *                    Elenco overlay PROJECT_Nome — GET /api/portal/projects cruscotto
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Smoke API portal: home e cruscotto espongono la stessa lista overlay (es. JustLastOne).
 *
 *   A cosa serve:
 *   - Verifica GET /api/portal/projects (array non vuoto, overlay opzionale presente) con exit 0/1.
 *
 * Generalizzazione:
 *   Si — base URL e overlay da parseOverlayCli, DASHBOARD_URL o --base.
 *
 * Input:
 *   - DASHBOARD_URL — base cruscotto (default http://127.0.0.1:3999)
 *   - --overlay, --port, --base — contesto cruscotto via portal-context.mjs
 *   - --json — report JSON via http.mjs (printSummary)
 *
 * Scenari verificati:
 *   - GET /api/portal/projects — lista progetti — HTTP 200, projects array non vuoto
 *   - overlay CLI — se --overlay, la riga corrispondente è presente in projects
 *
 * Uso:
 *   - node admin.portal.testscript/portal/test.portal.projects.mjs
 *   - node admin.portal.testscript/portal/test.portal.projects.mjs --overlay JustLastOne
 *
 * Flag CLI:
 *   --help, -h     riepilogo ed exit 0
 *   --overlay      overlay atteso in lista (es. AdminDashBoard)
 *   --port         porta dashboard alternativa
 *   --base         URL base cruscotto esplicito
 *   --json         report JSON senza log testuale
 *
 * Variabili d'ambiente:
 *   DASHBOARD_URL  base cruscotto (default http://127.0.0.1:3999)
 *
 * Integrazione cruscotto:
 *   - admin.portal.testscript/portal/test.portal.projects.mjs
 *   - run-portal-api.mjs — suite portal smoke
 *
 * Prerequisiti:
 *   - cruscotto.frontend/cruscotto.server.mjs avviato sulla porta attesa
 *
 * Exit code:
 *   0 — tutti gli scenari runTest passati
 *   1 — fallimento assert, errore fetch o eccezione non gestita
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
  // 1. Help / parse argv — esci 0 senza side effect né spawn
  const cli = parseOverlayCli(process.argv);

  if (cli.help) {
    printOverlayCliHelp("portal");
    return;
  }

  // 2. Contesto cruscotto — base URL, overlay opzionale e config overlay
  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  logSection("Portal projects");

  // 3. Scenari — GET /api/portal/projects e presenza overlay se richiesto
  await runTest("GET /api/portal/projects — lista progetti", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/portal/projects");
    assert(res.ok, `HTTP ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(Array.isArray(data.projects), "projects non array");
    assert(data.projects.length > 0, "projects vuoto");

    if (ctx.overlay) {
      const found = data.projects.some(
        (row) => typeof row === "object" && row && /** @type {{ overlay?: string }} */ (row).overlay === ctx.overlay
      );
      assert(found, `overlay ${ctx.overlay} assente da projects`);
    }
  }, results);

  // 4. Riepilogo — printSummary; exit 1 se almeno un fail (gestito da http.mjs)
  printSummary(results, { title: "Portal projects", meta: resolveScriptMeta(import.meta.url) });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
