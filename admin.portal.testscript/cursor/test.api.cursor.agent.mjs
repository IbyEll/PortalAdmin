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
 *                             API Cursor Agent — config, status, logs, POST agent e clear-logs
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Il cruscotto espone API Cursor Agent (config, avvio agent, log) usate da tab UI e gogo backlog.
 *
 *   A cosa serve:
 *   - Verifica modulo config locale, endpoint HTTP e comportamento senza CURSOR_API_KEY (503/skip).
 *
 * Generalizzazione:
 *   Si — base cruscotto da parseOverlayCli; skip avvio reale se CURSOR_API_KEY configurata.
 *
 * Input:
 *   - DASHBOARD_URL — base cruscotto
 *   - CURSOR_API_KEY  — se assente, POST agent deve rispondere 503
 *   - --overlay, --base — contesto fetch
 *
 * Scenari verificati:
 *   - portal.cursor.agent.config — payload pubblico senza apiKey esposta
 *   - GET /api/cursor/config, status, logs — shape JSON attesa
 *   - POST /api/cursor/agent — prompt mancante → 400; senza key → 503 o skip
 *   - POST /api/cursor/agent/clear-logs — 200 ok
 *
 * Uso:
 *   - node admin.portal.testscript/cursor/test.api.cursor.agent.mjs
 *
 * Flag CLI:
 *   --help, -h     riepilogo ed exit 0
 *   --overlay, --base — contesto cruscotto
 *   --json         report JSON
 *
 * Variabili d'ambiente:
 *   DASHBOARD_URL   base cruscotto
 *   CURSOR_API_KEY  chiave API Cursor (opzionale in CI)
 *
 * Integrazione cruscotto:
 *   - admin.portal.testscript/cursor/test.api.cursor.agent.mjs
 *   - admin.portal/portal.cursor.agent.config.mjs — assert modulo locale
 *
 * Prerequisiti:
 *   - cruscotto server avviato; worker script presente in admin.portal
 *
 * Exit code:
 *   0 — tutti gli scenari passati o skip documentati
 *   1 — assert fallito
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { existsSync } from "node:fs";

import {
  getCursorAgentPublicConfig
, getCursorAgentWorkerPath
, isCursorAgentConfigured
} from "../../admin.portal/portal.cursor.agent.config.mjs";
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
    printOverlayCliHelp("cursor");
    return;
  }

  // 2. Contesto cruscotto
  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  logSection("Modulo config");

  // 3. Scenari modulo — config pubblica senza leak apiKey
  await runTest("portal.cursor.agent.config — payload pubblico senza API key", async () => {
    const payload = getCursorAgentPublicConfig();

    assert(typeof payload.configured === "boolean", "configured non boolean");
    assert(payload.configured === isCursorAgentConfigured(), "configured mismatch env");
    assert(payload.defaultRuntime === "local" || payload.defaultRuntime === "cloud", "defaultRuntime");
    assert(payload.model && typeof payload.model.id === "string", "model.id");
    assert(typeof payload.localCwd === "string" && payload.localCwd.length > 0, "localCwd");
    assert(Array.isArray(payload.cloudRepos) && payload.cloudRepos.length > 0, "cloudRepos");
    assert(typeof payload.autoCreatePR === "boolean", "autoCreatePR");
    assert(!JSON.stringify(payload).includes("apiKey"), "API key esposta nel payload");
    assert(existsSync(getCursorAgentWorkerPath()), "worker script assente");
  }, results);

  logSection("API Cursor Agent");

  // 4. Scenari HTTP — config, status, logs, POST agent, clear-logs
  await runTest("GET /api/cursor/config — 200 e shape", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/cursor/config");
    assert(res.ok, `HTTP ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(typeof data.configured === "boolean", "configured");
    assert(data.defaultRuntime === "local" || data.defaultRuntime === "cloud", "defaultRuntime");
    assert(data.model && typeof /** @type {Record<string, unknown>} */ (data.model).id === "string", "model.id");
    assert(typeof data.localCwd === "string", "localCwd");
    assert(Array.isArray(data.cloudRepos), "cloudRepos");
    assert(typeof data.autoCreatePR === "boolean", "autoCreatePR");
  }, results);

  await runTest("GET /api/cursor/agent/status — 200 e campi stato", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/cursor/agent/status");
    assert(res.ok, `HTTP ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(typeof data.running === "boolean", "running");
    assert(typeof data.status === "string", "status");
    assert("agentId" in data, "agentId");
    assert("runId" in data, "runId");
    assert("runtime" in data, "runtime");
  }, results);

  await runTest("GET /api/cursor/agent/logs?cursor=0 — lines e cursor", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/cursor/agent/logs?cursor=0");
    assert(res.ok, `HTTP ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(typeof data.cursor === "number", "cursor numerico");
    assert(Array.isArray(data.lines), "lines array");
    assert(data.status && typeof data.status === "object", "status nested");
  }, results);

  await runTest("POST /api/cursor/agent — prompt mancante → 400", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/cursor/agent", {
      method : "POST"
    , body   : {}
    });
    assert(res.status === 400, `HTTP atteso 400, got ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(typeof data.error === "string" && data.error.includes("prompt"), "messaggio prompt");
  }, results);

  await runTest("POST /api/cursor/agent — avvio senza CURSOR_API_KEY → 503 o skip", async () => {
    const { body: configBody } = await portalFetch(ctx.base, "/api/cursor/config");
    const configured = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (configBody)).configured === true;

    if (configured) {
      return ["CURSOR_API_KEY configurata — skip avvio agent reale"];
    }

    const { res, body } = await portalFetch(ctx.base, "/api/cursor/agent", {
      method : "POST"
    , body   : { prompt: "gogo ADMIN-0-smoke", runtime: "local" }
    });
    assert(res.status === 503, `HTTP atteso 503, got ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(typeof data.error === "string", "error body");
    assert(String(data.error).toUpperCase().includes("CURSOR_API_KEY"), "errore API key");
  }, results);

  await runTest("POST /api/cursor/agent/clear-logs — 200", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/cursor/agent/clear-logs", {
      method : "POST"
    });
    assert(res.ok, `HTTP ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(data.ok === true, "ok true");
  }, results);

  // 5. Riepilogo esiti
  printSummary(results, { title: "Cursor Agent API", meta: resolveScriptMeta(import.meta.url) });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
