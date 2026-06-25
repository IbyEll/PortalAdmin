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
 *        GET /api/jira/backlog — backlog Jira via PortalAdmin (200 o 502 senza credenziali).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - regressione sull'integrazione Jira backlog del cruscotto con tolleranza ambienti senza credenziali
 *
 *   A cosa serve:
 *   - esito pass/fail da CLI; accetta 502 se Jira non configurato, altrimenti valida payload issues
 *
 * Generalizzazione:
 *   Si — base URL e overlay da env o argv; esito dipende da configurazione Jira dell'istanza
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - DASHBOARD_URL — base HTTP cruscotto
 *   - PRJ_NAME / --overlay — overlay per prefisso Jira e config progetto
 *   - argv — --help, --base, --port, --json
 *
 * Scenari verificati:
 *   - GET /api/jira/backlog — 200 o 502 — status 200 con issues o flat nel body; oppure 502
 *     accettato con messaggio skip se upstream Jira non disponibile
 *
 * Uso:
 *   - node admin.portal.testscript/jira/test.jira.backlog.mjs
 *   - node admin.portal.testscript/jira/test.jira.backlog.mjs --overlay AdminDashBoard
 *   - node admin.portal.testscript/jira/test.jira.backlog.mjs --base http://127.0.0.1:3999
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
 *   - admin.portal.testscript/jira/test.jira.backlog.mjs
 *   - area TestTecnici — proxy backlog Jira da cruscotto.server
 *
 * Prerequisiti:
 *   - cruscotto HTTP raggiungibile; credenziali Jira opzionali (502 ammesso senza config)
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
    printOverlayCliHelp("jira");
    return;
  }

  // 2. Risolvi contesto cruscotto — base da DASHBOARD_URL, --base o overlay + porta
  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  // 3. Intestazione sezione — delimita scenario backlog Jira
  logSection("Jira backlog");

  // 4. Scenario — GET /api/jira/backlog con timeout esteso; 200 o 502 ammessi
  await runTest("GET /api/jira/backlog — 200 o 502", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/jira/backlog", { timeoutMs: 45_000 });
    assert(res.status === 200 || res.status === 502, `HTTP ${res.status}`);

    if (res.status === 502) {
      return ["Jira non configurato o errore upstream — accettato"];
    }

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(Array.isArray(data.issues) || data.flat != null, "payload backlog inatteso");
  }, results);

  // 5. Riepilogo — printSummary con meta script
  printSummary(results, { title: "Jira backlog", meta: resolveScriptMeta(import.meta.url) });
}

// 6. Errori non gestiti — messaggio su stderr e exit code 1
main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
