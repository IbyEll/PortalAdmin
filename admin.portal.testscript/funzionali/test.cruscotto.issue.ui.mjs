#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TESTSCRIPT ** -- commentato il: 2026-07-11 08:00
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-07-11 08:00   by: Cursor
 * ticket refinement: ADMIN-200 / ADMIN-230 issue.html UI funzionale
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              UI pagina issue.html — form, deep-link, WIP advancement e asset issue display.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - La pagina standalone /issue.html e il deep-link ?key=&source=db devono restare integrati col cruscotto.
 *
 *   A cosa serve:
 *   - Verifica HTML issue page, script companion e contratti fetch verso API issue cache/live.
 *
 * Generalizzazione:
 *   Si — base cruscotto da parseOverlayCli / DASHBOARD_URL.
 *
 * Input:
 *   - DASHBOARD_URL — base cruscotto
 *   - --overlay, --base — contesto fetch statici
 *
 * Scenari verificati:
 *   - GET /issue.html — toolbar, pannelli description/subtask, banner fonte DB
 *   - GET /jira-issue-display.js — helper JiraIssueDisplay con badge tipo issue
 *   - GET /cruscotto.project.bootstrap.js — evento cruscotto:project-ready
 *
 * Uso:
 *   - node admin.portal.testscript/funzionali/test.cruscotto.issue.ui.mjs
 *   - npm run test:issue-funzionale
 *
 * Exit code:
 *   0 — tutti gli scenari passati
 *   1 — assert o fetch fallito
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
    printOverlayCliHelp("funzionale/issue-ui");
    return;
  }

  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  logSection("Issue page — markup");

  await runTest("GET /issue.html — struttura pagina issue", async () => {
    const { res, text } = await portalFetch(ctx.base, "/issue.html", { timeoutMs: 20_000 });
    assert(res.ok, `HTTP ${res.status}`);

    const html = String(text ?? "");
    assert(html.includes('class="issue-page"'), "wrapper issue-page");
    assert(html.includes('id="issue-search-form"'), "form ricerca");
    assert(html.includes('id="issue-key-prefix"'), "prefisso Jira dinamico");
    assert(html.includes('id="issue-state"'), "box stato iniziale");
    assert(html.includes('id="issue-view"'), "vista issue");
    assert(html.includes('id="issue-description"'), "pannello description");
    assert(html.includes('id="issue-subtasks"'), "tabella subtask");
    assert(html.includes('id="issue-wip-advancement"'), "avanzamento WIP");
    assert(html.includes('id="issue-source-banner"'), "banner fonte DB/Jira");
    assert(html.includes('searchParams.set("source"'), "deep-link source param in loadIssue");
    assert(html.includes("/api/jira/issue/"), "endpoint API issue inline");
  }, results);

  logSection("Asset companion");

  await runTest("GET /jira-issue-display.js — JiraIssueDisplay", async () => {
    const { res, text } = await portalFetch(ctx.base, "/jira-issue-display.js", { timeoutMs: 20_000 });
    assert(res.ok, `HTTP ${res.status}`);

    const js = String(text ?? "");
    assert(js.includes("JiraIssueDisplay"), "namespace JiraIssueDisplay");
    assert(js.includes("createIssueTypeBadge"), "badge tipo issue");
  }, results);

  await runTest("GET /cruscotto.project.bootstrap.js — project-ready", async () => {
    const { res, text } = await portalFetch(ctx.base, "/cruscotto.project.bootstrap.js", { timeoutMs: 20_000 });
    assert(res.ok, `HTTP ${res.status}`);

    const js = String(text ?? "");
    assert(js.includes("cruscotto:project-ready"), "evento project-ready");
    assert(js.includes("__CRUSCOTTO_PROJECT__"), "config progetto globale");
  }, results);

  printSummary(results, { title: "Issue UI funzionale", meta: resolveScriptMeta(import.meta.url) });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
