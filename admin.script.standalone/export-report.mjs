#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-23 21:30
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:30   by: IbyEll
 * modificato il: 2026-06-23 21:30   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Generatore export Excel e JSON da cruscotto.frontend/reports/latest.json.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Report test run-all serve anche in formato Excel per condivisione fuori dal cruscotto.
 *
 *   A cosa serve:
 *   - Legge latest.json normalizzato e scrive xlsx e json in data/exports con timestamp.
 *
 * Generalizzazione:
 *   Si — input da LATEST_JSON reporter; formato indipendente da overlay product.
 *
 * Input:
 *   - argv --json-only — salta generazione Excel
 *   - file latest.json — report normalizzato da admin.portal.lib/reporter.mjs
 *
 * Uso:
 *   - node admin.script.standalone/export-report.mjs
 *
 * Exit code:
 *   0 — export scritti
 *   1 — latest.json assente o parse fallito
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";

import {
  historyStamp
, LATEST_JSON
, normalizeReport
} from "../admin.portal.lib/reporter.mjs";

const EXPORT_DIR = join(
  dirname(fileURLToPath(import.meta.url))
, ".."
, "data"
, "exports"
);

/**
 * @param {string} iso
 */
export function exportFilenameStamp(iso) {
  return historyStamp(iso);
}

/**
 * @param {ReturnType<typeof normalizeReport>} report
 * @param {string} [stamp]
 * @param {string | null} [suite]
 */
export function buildExportBasename(report, stamp = exportFilenameStamp(report.generatedAt), suite = null) {
  return suite ? `report-${suite}-${stamp}` : `report-${stamp}`;
}

/**
 * @param {unknown} status
 */
function scriptStatusLabel(status) {
  if (status === "passed") {
    return "passed";
  }

  if (status === "skipped") {
    return "skipped";
  }

  return "failed";
}

/**
 * @param {ReturnType<typeof normalizeReport>} report
 */
export async function buildExportWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "JustLastOne Admin";
  workbook.created = new Date(report.generatedAt);

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Campo", key: "field", width: 28 }
  , { header: "Valore", key: "value", width: 48 }
  ];

  /** @type {{ field: string, value: string | number | boolean }[]} */
  const summaryRows = [
    { field: "generatedAt", value: report.generatedAt }
  , { field: "totalScripts", value: report.totalScripts }
  , { field: "passed", value: report.passed }
  , { field: "failed", value: report.failed }
  , { field: "skipped", value: report.skipped }
  , { field: "services.auth", value: report.services.auth }
  , { field: "services.api", value: report.services.api }
  , { field: "services.web", value: report.services.web }
  , { field: "tests.total", value: report.summary.tests.total }
  , { field: "tests.passed", value: report.summary.tests.passed }
  , { field: "tests.failed", value: report.summary.tests.failed }
  , { field: "tests.skipped", value: report.summary.tests.skipped }
  , { field: "totalDurationMs", value: report.summary.totalDurationMs }
  ];

  summarySheet.addRows(summaryRows);
  summarySheet.getRow(1).font = { bold: true };

  const scriptsSheet = workbook.addWorksheet("Scripts");
  scriptsSheet.columns = [
    { header: "Script", key: "script", width: 42 }
  , { header: "Suite", key: "suite", width: 18 }
  , { header: "Status", key: "status", width: 12 }
  , { header: "Exit Code", key: "exitCode", width: 12 }
  , { header: "Duration (ms)", key: "durationMs", width: 16 }
  , { header: "Tests Passed", key: "testsPassed", width: 14 }
  , { header: "Tests Failed", key: "testsFailed", width: 14 }
  , { header: "Tests Skipped", key: "testsSkipped", width: 14 }
  , { header: "Reason", key: "reason", width: 36 }
  ];

  for (const row of report.scripts) {
    const nested = row.report;
    let testsPassed  = 0;
    let testsFailed  = 0;
    let testsSkipped = 0;

    if (nested) {
      for (const test of nested.tests) {
        if (test.skipped) {
          testsSkipped += 1;
        } else if (test.ok) {
          testsPassed += 1;
        } else {
          testsFailed += 1;
        }
      }
    }

    scriptsSheet.addRow({
      script       : row.script
    , suite        : row.suite
    , status       : scriptStatusLabel(row.status)
    , exitCode     : row.exitCode
    , durationMs   : row.durationMs
    , testsPassed
    , testsFailed
    , testsSkipped
    , reason       : row.reason ?? ""
    });
  }

  scriptsSheet.getRow(1).font = { bold: true };

  const testsSheet = workbook.addWorksheet("Tests");
  testsSheet.columns = [
    { header: "Script", key: "script", width: 42 }
  , { header: "Suite", key: "suite", width: 18 }
  , { header: "Test", key: "test", width: 40 }
  , { header: "Result", key: "result", width: 12 }
  , { header: "Duration (ms)", key: "durationMs", width: 16 }
  , { header: "Started At", key: "startedAt", width: 28 }
  , { header: "Detail", key: "detail", width: 48 }
  ];

  for (const row of report.scripts) {
    const nested = row.report;

    if (!nested || nested.tests.length === 0) {
      testsSheet.addRow({
        script     : row.script
      , suite      : row.suite
      , test       : row.script
      , result     : scriptStatusLabel(row.status)
      , durationMs : row.durationMs
      , startedAt  : ""
      , detail     : row.reason ?? row.stderr ?? ""
      });
      continue;
    }

    for (const test of nested.tests) {
      const result = test.skipped
        ? "skipped"
        : test.ok
          ? "passed"
          : "failed";

      testsSheet.addRow({
        script     : row.script
      , suite      : row.suite
      , test       : test.name
      , result
      , durationMs : test.durationMs ?? ""
      , startedAt  : test.startedAt ?? ""
      , detail     : test.detail ?? ""
      });
    }
  }

  testsSheet.getRow(1).font = { bold: true };

  return workbook;
}

/**
 * @param {ReturnType<typeof normalizeReport>} report
 */
export async function generateXlsxBuffer(report) {
  const workbook = await buildExportWorkbook(report);
  return workbook.xlsx.writeBuffer();
}

/**
 * @param {ReturnType<typeof normalizeReport>} report
 * @param {{ save?: boolean }} [options]
 */
export async function writeXlsxExport(report, options = {}) {
  const save     = options.save !== false;
  const stamp    = exportFilenameStamp(report.generatedAt);
  const basename = buildExportBasename(report, stamp);
  const filename = `${basename}.xlsx`;
  const buffer   = await generateXlsxBuffer(report);

  /** @type {{ filename: string, path?: string, buffer: Buffer }} */
  const result = {
    filename
  , buffer: Buffer.from(buffer)
  };

  if (save) {
    await mkdir(EXPORT_DIR, { recursive: true });
    const path = join(EXPORT_DIR, filename);
    await writeFile(path, result.buffer);
    result.path = path;
  }

  return result;
}

/**
 * @param {ReturnType<typeof normalizeReport>} report
 * @param {{ save?: boolean }} [options]
 */
export async function writeJsonExport(report, options = {}) {
  const save     = options.save !== false;
  const stamp    = exportFilenameStamp(report.generatedAt);
  const basename = buildExportBasename(report, stamp);
  const filename = `${basename}.json`;
  const body     = `${JSON.stringify(report, null, 2)}\n`;

  /** @type {{ filename: string, path?: string, body: string }} */
  const result = { filename, body };

  if (save) {
    await mkdir(EXPORT_DIR, { recursive: true });
    const path = join(EXPORT_DIR, filename);
    await writeFile(path, body, "utf8");
    result.path = path;
  }

  return result;
}

/**
 * @param {string} [jsonPath]
 */
export async function loadReportFromLatest(jsonPath = LATEST_JSON) {
  if (!existsSync(jsonPath)) {
    return null;
  }

  const body = await readFile(jsonPath, "utf8");
  return normalizeReport(JSON.parse(body));
}

/**
 * @param {string} format
 * @param {{ save?: boolean, jsonPath?: string }} [options]
 */
export async function exportLatestReport(format = "xlsx", options = {}) {
  const report = await loadReportFromLatest(options.jsonPath);

  if (!report) {
    return { ok: false, error: "no report available" };
  }

  if (format === "json") {
    const json = await writeJsonExport(report, { save: options.save });
    return { ok: true, format: "json", report, ...json };
  }

  const xlsx = await writeXlsxExport(report, { save: options.save });
  return { ok: true, format: "xlsx", report, ...xlsx };
}

async function main() {
  const jsonOnly = process.argv.includes("--json-only");
  const format   = jsonOnly ? "json" : "xlsx";
  const result   = await exportLatestReport(format);

  if (!result.ok) {
    console.error(result.error ?? "export failed");
    process.exitCode = 1;
    return;
  }

  console.log(`Export ${format}: ${result.filename}`);

  if (result.path) {
    console.log(`Saved: ${result.path}`);
  }
}

const entry = process.argv[1]
  ? fileURLToPath(import.meta.url)
  : "";

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("export/export-report.mjs")) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
