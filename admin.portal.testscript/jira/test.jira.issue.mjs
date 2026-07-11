#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TESTSCRIPT ** -- commentato il: 2026-07-11 08:00
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-07-11 08:00   by: Cursor
 * ticket refirement: ADMIN-200 / ADMIN-229 issue.html e API issue
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *        GET /issue.html · GET /api/jira/issue/:KEY[/db] — pagina issue e API cache/live.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Regressione su pagina issue display e API dettaglio issue (cache DB e Jira live).
 *
 *   A cosa serve:
 *   - Verifica markup /issue.html e contratto JSON GET /api/jira/issue/:KEY e /db.
 *
 * Generalizzazione:
 *   Si — overlay e base URL da env o argv; tolleranza 502 live senza credenziali Jira.
 *
 * Input:
 *   - DASHBOARD_URL — base HTTP cruscotto
 *   - PRJ_NAME / --overlay — prefisso Jira (default ADMIN)
 *   - ISSUE_DB_TEST_KEY — key in cache DB (default ADMIN-200)
 *
 * Scenari verificati:
 *   - GET /issue.html — markup form ricerca e bootstrap issue display
 *   - GET /api/jira/issue/:KEY/db — 200 con shape issue o 404 se assente in cache
 *   - GET /api/jira/issue/:KEY — 200 o 502 senza credenziali Jira
 *
 * Uso:
 *   - node admin.portal.testscript/jira/test.jira.issue.mjs
 *   - node admin.portal.testscript/jira/test.jira.issue.mjs --overlay AdminDashBoard
 *
 * Exit code:
 *   0 — scenari passati
 *   1 — assert fallito o errore
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

/**
 * @param {import("../../admin.portal.lib/project.config.mjs").ProjectConfig | null} config
 * @returns {string}
 */
function resolveJiraPrefix(config) {
  const prefix = config?.PRJ_JIRA_PREFIX ?? process.env.PRJ_JIRA_PREFIX ?? "ADMIN";

  return String(prefix).trim().toUpperCase();
}

async function main() {
  const cli = parseOverlayCli(process.argv);

  if (cli.help) {
    printOverlayCliHelp("jira");
    return;
  }

  const ctx = await resolveCruscottoContext(cli);
  const jiraPrefix = resolveJiraPrefix(ctx.config);
  const dbKey = String(process.env.ISSUE_DB_TEST_KEY ?? `${jiraPrefix}-200`).trim().toUpperCase();
  const liveKey = dbKey;

  logUnlessJson(`Cruscotto: ${ctx.base}`);

  logSection("Issue HTML");

  await runTest("GET /issue.html — markup issue display", async () => {
    const { res, text } = await portalFetch(ctx.base, "/issue.html", { timeoutMs: 20_000 });
    assert(res.ok, `HTTP ${res.status}`);

    const html = String(text ?? "");
    assert(html.includes("issue-search-form"), "form ricerca issue");
    assert(html.includes("issue-key-input"), "input numero issue");
    assert(html.includes("btn-load"), "pulsante Apri da Jira");
    assert(html.includes("btn-load-db"), "pulsante Apri da DB");
    assert(html.includes("issue-view"), "contenitore vista issue");
    assert(html.includes("/jira-issue-display.js"), "script issue display");
    assert(html.includes("/cruscotto.project.bootstrap.js"), "bootstrap progetto");
    assert(html.includes("loadIssue"), "funzione loadIssue inline");
  }, results);

  logSection("Issue API — cache DB");

  await runTest(`GET /api/jira/issue/${dbKey}/db — shape issue cache`, async () => {
    const { res, body } = await portalFetch(
      ctx.base
    , `/api/jira/issue/${encodeURIComponent(dbKey)}/db`
    , { timeoutMs: 45_000 }
    );

    if (res.status === 404) {
      return [`Issue ${dbKey} assente in cache DB — skip shape (esegui npm run db:sync)`];
    }

    assert(res.ok, `HTTP ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(data.key === dbKey, "key attesa");
    assert(typeof data.summary === "string" && data.summary.length > 0, "summary attesa");
    assert(data.viewSource === "db", "viewSource db");
    assert(typeof data.status === "string", "status atteso");
    assert(typeof data.issueType === "string", "issueType atteso");
    assert(Array.isArray(data.subtasks), "subtasks array");
    assert(data.dbMeta != null && typeof data.dbMeta === "object", "dbMeta atteso");
  }, results);

  await runTest(`GET /api/jira/issue/${jiraPrefix}-0/db — 404 key assente`, async () => {
    const missingKey = `${jiraPrefix}-0`;
    const { res, body } = await portalFetch(
      ctx.base
    , `/api/jira/issue/${encodeURIComponent(missingKey)}/db`
    , { timeoutMs: 20_000 }
    );

    assert(res.status === 404, `HTTP ${res.status} atteso 404`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(typeof data.error === "string" && data.error.length > 0, "messaggio errore atteso");
  }, results);

  logSection("Issue API — Jira live");

  await runTest(`GET /api/jira/issue/${liveKey} — 200 o 502`, async () => {
    const { res, body } = await portalFetch(
      ctx.base
    , `/api/jira/issue/${encodeURIComponent(liveKey)}`
    , { timeoutMs: 45_000 }
    );
    assert(res.status === 200 || res.status === 502, `HTTP ${res.status}`);

    if (res.status === 502) {
      return ["Jira non configurato o errore upstream — accettato"];
    }

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(data.key === liveKey, "key attesa");
    assert(typeof data.summary === "string", "summary attesa");
    assert(data.viewSource === "jira" || data.viewSource == null, "viewSource jira o assente");
  }, results);

  printSummary(results, { title: "Jira issue", meta: resolveScriptMeta(import.meta.url) });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
