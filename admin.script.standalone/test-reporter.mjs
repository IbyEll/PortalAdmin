#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-18 04:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 04:42   by: IbyEll
 * modificato il: 2026-06-18 04:42   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                         Smoke fixture — admin.portal.lib/reporter.mjs parse, normalize e HTML report.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - admin.portal.lib/reporter.mjs alimenta latest.json e latest.html dopo run-all; serve regressione senza stack live.
 *   - JLO-860 richiede assert su parse stdout misto, fallback report script falliti e HTML offline.
 *
 *   A cosa serve:
 *   - Esegue assert su parseScriptJsonReport, normalizeReport, computeSummary e generateHtml con fixture fissa.
 *   - Exit 0 e messaggio «reporter fixture test: OK» se tutti i check passano.
 *
 * Generalizzazione:
 *   No — fixture statica in file; nessun argv né env product.
 *
 * Input:
 *   - Input: —
 *
 * Uso:
 *   - node admin.script.standalone/test-reporter.mjs
 *
 * Flag CLI:
 *   - nessuno
 *
 * Variabili d'ambiente:
 *   - Input: —
 *
 * npm (se applicabile):
 *   - Input: —
 *
 * Prerequisiti:
 *   - admin.portal.lib/reporter.mjs presente (nessun API :4000 né run-all richiesto)
 *
 * Consumatori:
 *   - PROJECT_JustLastOne/signals.catalog.JustLastOne.mjs — path segnale implementazione
 *
 * Dipendenze:
 *   - admin.portal.lib/reporter.mjs — parseScriptJsonReport, normalizeReport, computeSummary, generateHtml
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { strict as assert } from "node:assert";

import {
  computeSummary
, generateHtml
, normalizeReport
, parseScriptJsonReport
} from "../admin.portal.lib/reporter.mjs";

// --- fixture report run-all (passed / failed / skipped) ---
const FIXTURE = {
  generatedAt  : "2026-06-08T10:30:45.123Z"
, totalScripts : 3
, passed       : 1
, failed       : 1
, skipped      : 1
, services     : { auth: true, api: true, web: false }
, scripts      : [
    {
      script     : "auth/test-login.mjs"
    , suite      : "auth"
    , status     : "passed"
    , exitCode   : 0
    , durationMs : 1200
    , report     : {
        script     : "auth/test-login.mjs"
      , suite      : "auth"
      , durationMs : 1200
      , exitCode   : 0
      , tests      : [
          { name: "login ok", ok: true }
        , { name: "logout ok", ok: true }
        ]
      }
    }
  , {
      script     : "match/test-broken.mjs"
    , suite      : "match"
    , status     : "failed"
    , exitCode   : 1
    , durationMs : 400
    , stderr     : "JSON parse error"
    }
  , {
      script     : "web/test-ui.mjs"
    , suite      : "web"
    , status     : "skipped"
    , exitCode   : 0
    , durationMs : 0
    , reason     : "web :3000 non raggiungibile"
    }
  ]
};

// 1. parseScriptJsonReport — estrae JSON da stdout con banner testuale sopra
const mixedStdout = `=== Test banner ===
Auth: http://localhost:4001/api/v1

{"script":"auth/test-login.mjs","suite":"auth","durationMs":100,"exitCode":0,"tests":[{"name":"ok","ok":true}]}`;

const parsed = parseScriptJsonReport(mixedStdout);
assert(parsed && parsed.script === "auth/test-login.mjs", "parseScriptJsonReport mixed stdout");

// 2. normalizeReport — conteggi e fallback report per script failed
const normalized = normalizeReport(FIXTURE);

assert.equal(normalized.scripts.length, 3);
assert.equal(normalized.passed, 1);
assert.equal(normalized.failed, 1);
assert.equal(normalized.skipped, 1);

const failedRow = normalized.scripts.find((row) => row.script === "match/test-broken.mjs");
assert(failedRow?.report, "failed script should have fallback report");
assert.equal(failedRow.report.tests[0].ok, false);

// 3. computeSummary — aggregato test passed/failed/skipped
const summary = computeSummary(normalized.scripts);
assert.equal(summary.scripts.passed, 1);
assert.equal(summary.tests.passed, 2);
assert.equal(summary.tests.failed, 1);
assert.equal(summary.tests.skipped, 1);

// 4. generateHtml — documento offline, classi status, nessun CDN esterno
const html = generateHtml(normalized);
assert(html.includes("<!DOCTYPE html>"), "HTML document expected");
assert(html.includes("test-broken.mjs"), "script name in HTML");
assert(html.includes("JSON parse error"), "error detail in HTML");
assert(html.includes("<details"), "expandable script detail expected");
assert(html.includes("status-pass"), "pass status styling expected");
assert(html.includes("status-fail"), "fail status styling expected");
assert(!html.includes("cdn"), "no external CDN");

console.log("reporter fixture test: OK");
