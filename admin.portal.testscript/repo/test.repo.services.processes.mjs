#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TESTSCRIPT ** -- commentato il: 2026-06-25 22:00
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-25 22:00   by: IbyEll
 * modificato il: 2026-06-25 22:00   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *        GET /api/repo/services/processes — tabella Process (PID, porte, nodeRows).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - La tab Process in app.html#process usa listDevStackProcesses; serve regressione shape API.
 *
 *   A cosa serve:
 *   - Assert HTTP 200, checkedAt, rows array e campi minimi prima riga servizio.
 *
 * Generalizzazione:
 *   Si — base URL e overlay da env o argv come altri test repo/.
 *
 * Input:
 *   - DASHBOARD_URL — base HTTP cruscotto
 *   - PRJ_NAME / --overlay — overlay PROJECT_Nome
 *
 * Scenari verificati:
 *   - GET /api/repo/services/processes — shape tab Process
 *
 * Uso:
 *   - node admin.portal.testscript/repo/test.repo.services.processes.mjs
 *
 * Exit code:
 *   0 — scenario passato
 *   1 — assert fallito
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

/** @type {import("../admin.portal.lib/http.mjs").TestResult[]} */
const results = [];

async function main() {
  const cli = parseOverlayCli(process.argv);

  if (cli.help) {
    printOverlayCliHelp("repo/processes");
    return;
  }

  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  logSection("Repo services processes (tab Process)");

  await runTest("GET /api/repo/services/processes — shape tab Process", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/repo/services/processes", {
      timeoutMs: 90_000
    });

    assert(res.ok, `HTTP ${res.status}`);
    assert(body && typeof body === "object", "body non JSON");
    assert(typeof body.checkedAt === "string" && body.checkedAt.length > 0, "checkedAt");
    assert(Array.isArray(body.rows), "rows array");
    assert(Array.isArray(body.nodeRows), "nodeRows array");

    if (body.rows.length > 0) {
      const row = body.rows[0];
      assert(typeof row.id === "string", "row.id string");
      assert(Array.isArray(row.listeners), "row.listeners array");
      assert(typeof row.listening === "boolean", "row.listening boolean");
    }
  }, results);

  printSummary(results, { title: "Repo processes", meta: resolveScriptMeta(import.meta.url) });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
