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
 *                          UI tab Cursor Agent — app.html, cruscotto.js, backlog gogo e deep-link
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - La tab Cursor Agent nel cruscotto e il deep-link /cursor devono restare integrati con API e gogo backlog.
 *
 *   A cosa serve:
 *   - Verifica HTML tab, companion JS, collegamento gogo in backlog e redirect /cursor → app.html#cursor.
 *
 * Generalizzazione:
 *   Si — base cruscotto da parseOverlayCli / DASHBOARD_URL.
 *
 * Input:
 *   - DASHBOARD_URL — base cruscotto
 *   - --overlay, --base — contesto fetch statici e redirect
 *
 * Scenari verificati:
 *   - GET /app.html — tab e sezione Cursor Agent
 *   - GET /cruscotto.js — renderCursorAgent e fetch API cursor
 *   - GET /backlog.html — launchGogoAgent verso /api/cursor/agent
 *   - GET /cursor — redirect 301/302 a app.html#cursor
 *
 * Uso:
 *   - node admin.portal.testscript/funzionali/test.cursor.agent.ui.mjs
 *   - npm run test:cursor-funzionale
 *
 * Flag CLI:
 *   --help, -h     riepilogo funzionale/cursor-agent
 *   --overlay, --base — contesto
 *   --json         report JSON
 *
 * Variabili d'ambiente:
 *   DASHBOARD_URL  base cruscotto
 *
 * Integrazione cruscotto:
 *   - admin.portal.testscript/funzionali/test.cursor.agent.ui.mjs
 *   - package.json — npm run test:cursor-funzionale
 *
 * Prerequisiti:
 *   - cruscotto server avviato con asset statici frontend
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

/** Accumulatore esiti runTest per riepilogo finale. */
/** @type {import("../admin.portal.lib/http.mjs").TestResult[]} */
const results = [];

async function main() {
  // 1. Help / parse argv — esci 0
  const cli = parseOverlayCli(process.argv);

  if (cli.help) {
    printOverlayCliHelp("funzionale/cursor-agent");
    return;
  }

  // 2. Contesto cruscotto
  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  logSection("Cruscotto home — tab Cursor");

  // 3. Scenari UI — app.html tab Cursor Agent
  await runTest("GET /app.html — tab e sezione Cursor Agent", async () => {
    const { res, text } = await portalFetch(ctx.base, "/app.html", { timeoutMs: 20_000 });
    assert(res.ok, `HTTP ${res.status}`);

    const html = String(text ?? "");
    assert(html.includes('data-tab="cursor"'), "pulsante tab cursor");
    assert(html.includes('id="section-cursor"'), "sezione cursor");
    assert(html.includes("Cursor Agent"), "etichetta tab");
  }, results);

  await runTest("GET /cruscotto.js — renderCursorAgent e API cursor", async () => {
    const { res, text } = await portalFetch(ctx.base, "/cruscotto.js", { timeoutMs: 20_000 });
    assert(res.ok, `HTTP ${res.status}`);

    const js = String(text ?? "");
    assert(js.includes("renderCursorAgent"), "renderCursorAgent");
    assert(js.includes("/api/cursor/config"), "fetch config");
    assert(js.includes("/api/cursor/agent"), "fetch agent");
    assert(js.includes("cursor-agent-prompt"), "textarea prompt");
    assert(js.includes("cursor-agent-send"), "bottone invia");
    assert(js.includes("cursor-agent-template-gogo"), "template gogo");
    assert(js.includes('"cursor"'), "tab cursor in TABS");
  }, results);

  logSection("Backlog — gogo → Cursor Agent");

  // 4. Scenari backlog — integrazione gogo con agent API
  await runTest("GET /backlog.html — launchGogoAgent verso /api/cursor/agent", async () => {
    const { res, text } = await portalFetch(ctx.base, "/backlog.html", { timeoutMs: 20_000 });
    assert(res.ok, `HTTP ${res.status}`);

    const html = String(text ?? "");
    assert(html.includes("launchGogoAgent"), "launchGogoAgent");
    assert(html.includes("/api/cursor/agent"), "endpoint agent");
    assert(html.includes('"local"'), "runtime local gogo");
    assert(html.includes("gogo "), "prompt gogo");
    assert(html.includes("copyGogoCmd"), "fallback clipboard");
  }, results);

  logSection("Deep-link tab");

  // 5. Scenari redirect — deep-link /cursor
  await runTest("GET /cursor — redirect a /app.html#cursor", async () => {
    const res = await fetch(`${ctx.base.replace(/\/$/, "")}/cursor`, {
      method : "GET"
    , redirect : "manual"
    , signal   : AbortSignal.timeout(12_000)
    });

    assert(res.status === 302 || res.status === 301, `HTTP redirect atteso, got ${res.status}`);
    const location = res.headers.get("location") ?? "";
    assert(location.includes("app.html#cursor"), `Location attesa #cursor, got ${location}`);
  }, results);

  // 6. Riepilogo esiti
  printSummary(results, {
    title : "Cursor Agent UI"
  , meta  : resolveScriptMeta(import.meta.url)
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
