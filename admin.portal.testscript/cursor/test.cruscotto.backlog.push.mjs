#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TESTSCRIPT ** -- commentato il: 2026-06-23 21:30
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:30   by: IbyEll
 * modificato il: 2026-06-23 21:30   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Testscript step 8 PUSH — regole WIP, moduli Jira, API cruscotto e markup backlog.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Workflow database PUSH deve essere verificato end-to-end senza push reale su Jira.
 *
 *   A cosa serve:
 *   - Assert su parseVeveCheckboxSection, API wip, buildPushCommand e integrazione portalFetch.
 *
 * Generalizzazione:
 *   Si — --overlay e DASHBOARD_URL per contesto cruscotto multi-istanza.
 *
 * Input:
 *   - DASHBOARD_URL — base HTTP cruscotto sotto test
 *   - argv --overlay — PRJ_NAME per resolveCruscottoContext
 *
 * Uso:
 *   - node admin.portal.testscript/cursor/test.cruscotto.backlog.push.mjs
 *
 * Exit code:
 *   0 — tutti i runTest passati
 *   1 — almeno un assert fallito
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { markdownToAdfDoc } from "../../admin.portal.JiraCORE/jiraCORE.jira.live.mjs";
import { parseVeveCheckboxSection } from "../../cruscotto.frontend/cruscotto.jira.backlog.wip.mjs";
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
  buildPushCommand
, isAwaitingPushWip
, isValidPushIssueKey
, parsePushApiRequest
, resolveRowWorkflowControl
, resolveWipPrUrl
} from "./test.cruscotto.backlog.push.rules.mjs";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const PUSH_CLI = resolve(ROOT, "admin.portal.JiraCORE/jiraCORE.wip.push.mjs");
const PUSH_TEST_KEY = String(process.env.WIP_PUSH_TEST_KEY ?? "").trim().toUpperCase();

/** @type {import("../admin.portal.lib/http.mjs").TestResult[]} */
const results = [];

async function main() {
  const cli = parseOverlayCli(process.argv);

  if (cli.help) {
    printOverlayCliHelp("cursor/backlog-push");
    return;
  }

  const ctx = await resolveCruscottoContext(cli);
  logUnlessJson(`Cruscotto: ${ctx.base}`);

  logSection("Regole PUSH");

  await runTest("buildPushCommand — formato step 8", async () => {
    assert(buildPushCommand("ADMIN-96") === "PUSH ADMIN-96", "comando atteso");
    assert(buildPushCommand(" JLO-507 ") === "PUSH JLO-507", "trim key");
  }, results);

  await runTest("isValidPushIssueKey — ADMIN/JLO", async () => {
    assert(isValidPushIssueKey("ADMIN-1"), "ADMIN ok");
    assert(isValidPushIssueKey("jlo-99"), "JLO ok case");
    assert(!isValidPushIssueKey("FOO-1"), "prefisso invalido");
    assert(!isValidPushIssueKey(""), "vuoto");
  }, results);

  await runTest("resolveRowWorkflowControl — push vs gogo vs PR", async () => {
    const row = { tier: "task", key: "ADMIN-96", isStoryLike: true };

    assert(resolveRowWorkflowControl("sprint", row, { awaitingPush: true }) === "push", "push");
    assert(resolveRowWorkflowControl("epic", row, { awaitingPush: true }) === "push", "push epic");
    assert(resolveRowWorkflowControl("sprint", row, { prUrl: "https://github.com/x/y/pull/1" }) === "pr", "pr");
    assert(resolveRowWorkflowControl("sprint", row, null) === "gogo", "gogo default");
    assert(resolveRowWorkflowControl("epic", row, null) === "gogo", "gogo epic");
    assert(isAwaitingPushWip({ awaitingPush: true }), "awaiting");
    assert(!isAwaitingPushWip({ awaitingPush: false }), "not awaiting");
    assert(
      resolveWipPrUrl({ prUrl: "https://github.com/o/r/pull/2" }) === "https://github.com/o/r/pull/2"
    , "pr url"
    );
  }, results);

  await runTest("parsePushApiRequest — validazione body API", async () => {
    assert(parsePushApiRequest({ key: "ADMIN-96" }).ok === true, "ok");
    assert(parsePushApiRequest({}).ok === false, "missing");
    assert(parsePushApiRequest({ key: "BAD" }).ok === false, "invalid");
  }, results);

  logSection("Moduli step 8");

  await runTest("parseVeveCheckboxSection — AC/DoD da markdown veve", async () => {
    const md = [
      "## Acceptance Criteria"
    , "- [x] Primo criterio"
    , "- [ ] Secondo criterio"
    , "## Definition of Done"
    , "- [x] Test verdi"
    ].join("\n");

    const ac = parseVeveCheckboxSection(md, "Acceptance Criteria");
    const dod = parseVeveCheckboxSection(md, "Definition of Done");

    assert(ac.length === 2 && ac[0].checked && !ac[1].checked, "AC checkbox");
    assert(dod.length === 1 && dod[0].checked, "DoD checkbox");
  }, results);

  await runTest("markdownToAdfDoc — heading e bullet", async () => {
    const adf = markdownToAdfDoc("## Obiettivo\n- [x] Voce\nTesto");
    assert(adf.type === "doc" && adf.version === 1, "doc root");
    assert(Array.isArray(adf.content) && adf.content.length >= 2, "content blocks");
    assert(adf.content[0].type === "heading", "heading");
  }, results);

  await runTest("CLI jiraCORE.wip.push.mjs — file presente", async () => {
    assert(existsSync(PUSH_CLI), `assente: ${PUSH_CLI}`);
  }, results);

  logSection("Backlog HTML");

  for (const page of ["/backlog.html", "/my-backlog.html"]) {
    await runTest(`GET ${page} — markup PUSH step 8`, async () => {
      const { res, text } = await portalFetch(ctx.base, page, { timeoutMs: 20_000 });
      assert(res.ok, `HTTP ${res.status}`);

      const html = String(text ?? "");
      assert(html.includes("btn-push-row"), "classe btn-push-row");
      assert(html.includes("push-tooltip"), "tooltip AC/DoD");
      assert(html.includes("launchWipPush"), "avvio API push");
      assert(html.includes("/api/jira/wip/push"), "endpoint push");
      assert(html.includes("/api/jira/wip/status"), "endpoint status WIP");
      assert(html.includes("populatePushTooltip"), "parser tooltip");
      assert(html.includes("shouldShowWorkflowButton"), "helper visibilità workflow");
    }, results);
  }

  logSection("API WIP PUSH");

  /**
   * @param {Response} res
   * @returns {string[] | null}
   */
  function skipIfWipRouteMissing(res) {
    if (res.status === 404) {
      return ["Route /api/jira/wip/* assente — riavvia cruscotto.server.mjs"];
    }

    return null;
  }

  await runTest("GET /api/jira/wip/status?keys=ADMIN-0 — shape byKey", async () => {
    const { res, body } = await portalFetch(
      ctx.base
    , "/api/jira/wip/status?keys=ADMIN-0,JLO-0"
    , { timeoutMs: 20_000 }
    );
    const skip = skipIfWipRouteMissing(res);

    if (skip) {
      return skip;
    }

    assert(res.ok, `HTTP ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(data.byKey && typeof data.byKey === "object", "byKey object");
  }, results);

  await runTest("POST /api/jira/wip/push — key mancante → 400", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/jira/wip/push", {
      method : "POST"
    , body   : {}
    , timeoutMs: 20_000
    });
    const skip = skipIfWipRouteMissing(res);

    if (skip) {
      return skip;
    }

    assert(res.status === 400, `HTTP atteso 400, got ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(typeof data.error === "string", "error string");
  }, results);

  await runTest("POST /api/jira/wip/push — key invalida → 400", async () => {
    const { res } = await portalFetch(ctx.base, "/api/jira/wip/push", {
      method : "POST"
    , body   : { key: "INVALID" }
    , timeoutMs: 20_000
    });
    const skip = skipIfWipRouteMissing(res);

    if (skip) {
      return skip;
    }

    assert(res.status === 400, `HTTP atteso 400, got ${res.status}`);
  }, results);

  await runTest("POST /api/jira/wip/push — WIP assente/non pronto → 409", async () => {
    const { res, body } = await portalFetch(ctx.base, "/api/jira/wip/push", {
      method : "POST"
    , body   : { key: "ADMIN-999999" }
    , timeoutMs: 45_000
    });
    const skip = skipIfWipRouteMissing(res);

    if (skip) {
      return skip;
    }

    assert(res.status === 409, `HTTP atteso 409, got ${res.status}`);

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));
    assert(data.ok === false, "ok false");
    assert(typeof data.error === "string", "error message");
  }, results);

  await runTest("POST /api/jira/wip/push — dry-run opzionale WIP_PUSH_TEST_KEY", async () => {
    if (!PUSH_TEST_KEY || !isValidPushIssueKey(PUSH_TEST_KEY)) {
      return ["WIP_PUSH_TEST_KEY non impostata — skip dry-run live"];
    }

    const { res, body } = await portalFetch(ctx.base, "/api/jira/wip/push", {
      method : "POST"
    , body   : { key: PUSH_TEST_KEY, dryRun: true }
    , timeoutMs: 120_000
    });

    const skip = skipIfWipRouteMissing(res);

    if (skip) {
      return skip;
    }

    const data = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (body));

    if (res.status === 409) {
      assert(typeof data.error === "string", "errore prerequisito WIP");
      return [`WIP ${PUSH_TEST_KEY} non pronto per PUSH — skip: ${data.error}`];
    }

    assert(res.ok, `HTTP ${res.status}`);
    assert(data.ok === true, "ok true");
    assert(data.dryRun === true, "dryRun true");
    assert(data.jira && typeof data.jira === "object", "jira sync block");
    assert(data.close && typeof data.close === "object", "close-story block");
  }, results);

  printSummary(results, {
    title : "Backlog PUSH step 8"
  , meta  : resolveScriptMeta(import.meta.url)
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
