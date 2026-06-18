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
 *                            Bootstrap UI cruscotto — GET /api/cruscotto/project overlay e Jira
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - La UI cruscotto bootstrap da GET /api/cruscotto/project (overlay, repo, Jira prefix, porta).
 *
 *   A cosa serve:
 *   - Verifica payload project coerente con overlay CLI e project.config overlay.
 *
 * Generalizzazione:
 *   Si — richiede --overlay (o base esplicito) per validazione piena del payload.
 *
 * Input:
 *   - DASHBOARD_URL — base cruscotto
 *   - --overlay     — overlay obbligatorio se assente DASHBOARD_URL custom
 *   - --port, --base — contesto URL
 *
 * Scenari verificati:
 *   - GET /api/cruscotto/project — overlay e Jira prefix — campi overlayName, repoName, jiraPrefix
 *   - match config — se ctx.config presente, valori allineati a PRJ_NAME e PRJ_JIRA_PREFIX
 *
 * Uso:
 *   - node admin.portal.testscript/cruscotto/test.cruscotto.project.mjs --overlay AdminDashBoard
 *
 * Flag CLI:
 *   --help, -h     riepilogo ed exit 0
 *   --overlay      overlay atteso (richiesto senza --base/DASHBOARD_URL)
 *   --port, --base URL cruscotto
 *   --json         report JSON
 *
 * Variabili d'ambiente:
 *   DASHBOARD_URL  base cruscotto
 *
 * Integrazione cruscotto:
 *   - admin.portal.testscript/cruscotto/test.cruscotto.project.mjs
 *   - run-portal-api.mjs
 *
 * Prerequisiti:
 *   - cruscotto avviato con overlay istanziato
 *
 * Exit code:
 *   0 — scenario passato
 *   1 — overlay mancante, assert o errore
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
  // 1. Help / parse argv — esci 0
  const cli = parseOverlayCli(process.argv);

  if (cli.help) {
    printOverlayCliHelp("cruscotto");
    return;
  }

  // 2. Validazione overlay — richiesto per assert payload progetto
  if (!cli.overlay && !cli.base && !process.env.DASHBOARD_URL?.trim()) {
    throw new Error("Richiesto --overlay per validare payload progetto");
  }

  // 3. Contesto cruscotto e config overlay
  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  logSection("Cruscotto project");

  // 4. Scenari — GET /api/cruscotto/project
  await runTest("GET /api/cruscotto/project — overlay e Jira prefix", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/cruscotto/project");
    assert(res.ok, `HTTP ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(typeof data.overlayName === "string" && data.overlayName, "overlayName mancante");
    assert(typeof data.repoName === "string" && data.repoName, "repoName mancante");
    assert(typeof data.jiraPrefix === "string" && data.jiraPrefix, "jiraPrefix mancante");
    assert(Number(data.dashboardPort) > 0, "dashboardPort invalido");

    if (ctx.overlay && ctx.config) {
      assert(data.overlayName === ctx.overlay, `overlayName atteso ${ctx.overlay}`);
      assert(data.repoName === ctx.config.PRJ_NAME, `repoName atteso ${ctx.config.PRJ_NAME}`);
      assert(data.jiraPrefix === ctx.config.PRJ_JIRA_PREFIX, "jiraPrefix mismatch");
    }
  }, results);

  // 5. Riepilogo esiti
  printSummary(results, { title: "Cruscotto project", meta: resolveScriptMeta(import.meta.url) });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
