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
 *                               Bottone gogo backlog Sprint — regole, HTML e API story-like
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Il bottone gogo in backlog vista Sprint avvia workflow via Cursor Agent o copia comando clipboard.
 *
 *   A cosa serve:
 *   - Verifica regole modulo rules, markup backlog.html e presenza story-like su API backlog.
 *
 * Generalizzazione:
 *   Si — overlay e base da parseOverlayCli; skip parziale se Jira non configurato (502).
 *
 * Input:
 *   - DASHBOARD_URL — base cruscotto
 *   - --overlay, --base — contesto
 *   - test.cruscotto.backlog.gogo.rules.mjs — regole importate
 *
 * Scenari verificati:
 *   - buildGogoCommand — formato gogo KEY
 *   - shouldShowGogoButton — solo sprint + story-like task
 *   - GET /backlog.html — classi e funzioni gogo in markup
 *   - GET /api/jira/backlog — almeno una story-like candidata gogo (o skip 502)
 *
 * Uso:
 *   - node admin.portal.testscript/funzionali/test.cruscotto.backlog.gogo.mjs
 *   - npm run test:backlog-gogo
 *
 * Flag CLI:
 *   --help, -h     riepilogo funzionale/backlog-gogo
 *   --overlay, --base — contesto cruscotto
 *   --json         report JSON
 *
 * Variabili d'ambiente:
 *   DASHBOARD_URL  base cruscotto
 *
 * Integrazione cruscotto:
 *   - admin.portal.testscript/funzionali/test.cruscotto.backlog.gogo.mjs
 *   - package.json — npm run test:backlog-gogo
 *
 * Prerequisiti:
 *   - cruscotto avviato; Jira opzionale (502 → skip conteggio righe)
 *
 * Exit code:
 *   0 — scenari passati o skip documentati
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
import {
  buildGogoCommand
, isStoryLikeRow
, shouldShowGogoButton
} from "./test.cruscotto.backlog.gogo.rules.mjs";

/** Accumulatore esiti runTest per riepilogo finale. */
/** @type {import("../lib/http.mjs").TestResult[]} */
const results = [];

async function main() {
  // 1. Help / parse argv — esci 0
  const cli = parseOverlayCli(process.argv);

  if (cli.help) {
    printOverlayCliHelp("funzionale/backlog-gogo");
    return;
  }

  // 2. Contesto cruscotto
  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  logSection("Regole gogo");

  // 3. Scenari unit — regole modulo gogo (senza HTTP)
  await runTest("buildGogoCommand — formato workflow", async () => {
    assert(buildGogoCommand("JLO-507") === "gogo JLO-507", "comando atteso");
    assert(buildGogoCommand(" ADMIN-96 ") === "gogo ADMIN-96", "trim key");
  }, results);

  await runTest("shouldShowGogoButton — solo sprint + story-like task", async () => {
    const storyRow = { tier: "task", type: "Story", key: "JLO-100" };
    const subRow   = { tier: "subtask", type: "Sub-task", key: "JLO-101" };
    const bugRow   = { tier: "task", type: "Bug", key: "JLO-102" };

    assert(shouldShowGogoButton("sprint", storyRow), "story in sprint");
    assert(shouldShowGogoButton("epic", storyRow), "story in epic");
    assert(shouldShowGogoButton("sprint", bugRow), "bug in sprint");
    assert(!shouldShowGogoButton("epic", subRow), "no su subtask");
    assert(!shouldShowGogoButton("sprint", { tier: "sprint", key: "__sprint__1" }), "no su header sprint");
  }, results);

  logSection("Backlog HTML");

  // 4. Scenari HTML — markup bottone gogo in backlog.html
  await runTest("GET /backlog.html — markup bottone gogo", async () => {
    const { res, text } = await portalFetch(ctx.base, "/backlog.html", { timeoutMs: 20_000 });
    assert(res.ok, `HTTP ${res.status}`);

    const html = String(text ?? "");
    assert(html.includes("btn-gogo-row"), "classe btn-gogo-row");
    assert(html.includes("createGogoRowButton"), "factory bottone");
    assert(html.includes("launchGogoAgent"), "avvio Cursor Agent interno");
    assert(html.includes("/api/cursor/agent"), "endpoint agent cruscotto");
    assert(html.includes("copyGogoCmd"), "fallback clipboard");
    assert(html.includes("shouldShowWorkflowButton"), "helper visibilità workflow");
    assert(html.includes("isStoryLikeRow(row)"), "vincolo story-like");
  }, results);

  logSection("Backlog API");

  // 5. Scenari API — story-like nel backlog (skip se Jira 502)
  await runTest("GET /api/jira/backlog — story-like in sprint view", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/jira/backlog", { timeoutMs: 45_000 });

    if (res.status === 502) {
      return ["Jira non configurato — skip conteggio righe"];
    }

    assert(res.ok, `HTTP ${res.status}`);

    const data   = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    const issues = /** @type {Array<Record<string, unknown>>} */ (
      Array.isArray(data.issues) ? data.issues : []
    );

    const storyLikeTasks = issues.filter((row) => isStoryLikeRow({
      tier        : String(row.tier ?? "task")
    , type        : String(row.type ?? "")
    , isStoryLike : row.isStoryLike === true ? true : row.isStoryLike === false ? false : undefined
    }));

    const gogoCandidates = storyLikeTasks.filter((row) => shouldShowGogoButton("sprint", {
      tier        : String(row.tier ?? "task")
    , type        : String(row.type ?? "")
    , key         : String(row.key ?? "")
    , isStoryLike : row.isStoryLike === true ? true : row.isStoryLike === false ? false : undefined
    }));

    assert(gogoCandidates.length > 0, "nessuna story-like task nel backlog");

  }, results);

  // 6. Riepilogo esiti
  printSummary(results, {
    title : "Backlog gogo"
  , meta  : resolveScriptMeta(import.meta.url)
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
