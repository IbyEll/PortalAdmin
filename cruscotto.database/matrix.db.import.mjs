#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-07-09 04:15
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-07-09 04:15   by: IbyEll
 * modificato il: 2026-07-09 04:15   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * Import one-shot JSON legacy → database cruscotto matrix_*.
 *
 * Uso:
 *   node cruscotto.database/matrix.db.import.mjs
 *   node cruscotto.database/matrix.db.import.mjs --dry-run
 *   node cruscotto.database/matrix.db.import.mjs --from docs.portal/matrix.portal.gap.json
 *
 * Flag:
 *   --dry-run       conta righe senza scrivere DB
 *   --from <path>   JSON unificato (default docs.portal/matrix.portal.gap.json)
 *   --matrix-kind   default portal_gap
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MATRIX_KIND_PORTAL_GAP
, startMatrixRun
, upsertFindingIssueLink
, upsertMatrixRows
, countMatrixRows
} from "./matrix.db.mjs";
import { openCruscottoDb } from "./cruscotto.db.config.mjs";
import { seedMatrixCatalog } from "./matrix.catalog.seed.mjs";

const SCRIPT_DIR  = dirname(fileURLToPath(import.meta.url));
const PORTAL_ROOT = join(SCRIPT_DIR, "..");
const DOCS_DIR    = join(PORTAL_ROOT, "docs.portal");
const DEFAULT_JSON = join(DOCS_DIR, "matrix.portal.gap.json");
const FINDING_ISSUES_JSON = join(PORTAL_ROOT, "docs.portal.lib", "matrix.finding-issues.json");

/** @typedef {import("../docs.portal.lib/matrix.render.mjs").MatrixSection} MatrixSection */

/**
 * @param {string[]} argv
 * @returns {{ dryRun: boolean, jsonPath: string, matrixKind: string }}
 */
function parseArgs(argv) {
  let dryRun     = false;
  let jsonPath   = DEFAULT_JSON;
  let matrixKind = MATRIX_KIND_PORTAL_GAP;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--from" && argv[i + 1]) {
      jsonPath = resolve(argv[i + 1]);
      i += 1;
    } else if (arg === "--matrix-kind" && argv[i + 1]) {
      matrixKind = String(argv[i + 1]).trim();
      i += 1;
    }
  }

  return { dryRun, jsonPath, matrixKind };
}

/**
 * @param {string} jsonPath
 * @returns {{ sections: MatrixSection[], metrics: object, generatedAt: string, source: string }}
 */
export function parseUnifiedMatrixJson(jsonPath) {
  if (!existsSync(jsonPath)) {
    throw new Error(`JSON matrice assente: ${jsonPath}`);
  }

  const raw = JSON.parse(readFileSync(jsonPath, "utf8"));

  /** @type {MatrixSection[]} */
  let sections = [];

  if (Array.isArray(raw.sections) && raw.sections.length > 0) {
    sections = raw.sections;
  } else {
    const operational = Array.isArray(raw.operational) ? raw.operational : [];
    const audit       = Array.isArray(raw.audit) ? raw.audit : [];

    sections = [...operational, ...audit];
  }

  return {
    sections
  , metrics     : raw.metrics ?? {}
  , generatedAt : String(raw.generatedAt ?? new Date().toISOString())
  , source      : String(raw.source ?? "import")
  };
}

/**
 * @param {string} [filePath]
 * @returns {Record<string, { key: string, issueType: string, createdAt?: string }>}
 */
export function parseFindingIssuesJson(filePath = FINDING_ISSUES_JSON) {
  if (!existsSync(filePath)) {
    return {};
  }

  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8"));

    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return {};
    }

    return raw;
  } catch {
    return {};
  }
}

/**
 * @param {MatrixSection[]} sections
 * @returns {{ total: number, obsolete: number, byStatus: Record<string, number> }}
 */
export function summarizeImportSections(sections) {
  const byStatus = /** @type {Record<string, number>} */ ({});
  let total      = 0;
  let obsolete   = 0;

  for (const sec of sections) {
    for (const row of sec.rows ?? []) {
      total += 1;
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;

      if (row.status === "obsoleto") {
        obsolete += 1;
      }
    }
  }

  return { total, obsolete, byStatus };
}

/**
 * @param {{
 *   jsonPath?: string
 *   matrixKind?: string
 *   dryRun?: boolean
 *   findingIssuesPath?: string
 * }} [opts]
 */
export async function importMatrixFromJson(opts = {}) {
  const jsonPath          = opts.jsonPath ?? DEFAULT_JSON;
  const matrixKind        = opts.matrixKind ?? MATRIX_KIND_PORTAL_GAP;
  const dryRun            = opts.dryRun ?? false;
  const findingIssuesPath = opts.findingIssuesPath ?? FINDING_ISSUES_JSON;

  const payload  = parseUnifiedMatrixJson(jsonPath);
  const summary  = summarizeImportSections(payload.sections);
  const linksRaw = parseFindingIssuesJson(findingIssuesPath);
  const linkCount = Object.keys(linksRaw).length;

  if (dryRun) {
    return {
      dryRun   : true
    , jsonPath
    , matrixKind
    , summary
    , linkCount
    , rowCount : summary.total
    };
  }

  const db = await openCruscottoDb();

  await seedMatrixCatalog(db, matrixKind);

  const run = await startMatrixRun({
    matrixKind
  , source  : `import:${payload.source}`
  , metrics : payload.metrics
  });

  const rowStats = await upsertMatrixRows({
    matrixKind
  , matrixRunId: run.id
  , sections   : payload.sections
  });

  let linksImported = 0;

  for (const [findingId, entry] of Object.entries(linksRaw)) {
    const key = String(entry?.key ?? "").trim().toUpperCase();

    if (!findingId || !key) {
      continue;
    }

    await upsertFindingIssueLink(findingId, matrixKind, {
      key
    , issueType    : String(entry?.issueType ?? "").trim() || "Bug"
    , createdAt    : typeof entry?.createdAt === "string" ? entry.createdAt : undefined
    , linkedSource : "import_json"
    });

    linksImported += 1;
  }

  const rowCount = await countMatrixRows(matrixKind);

  return {
    dryRun        : false
  , jsonPath
  , matrixKind
  , runId         : run.id
  , summary
  , rowStats
  , linksImported
  , rowCount
  };
}

const isMain = process.argv[1]
  && process.argv[1].replace(/\\/g, "/").endsWith("matrix.db.import.mjs");

if (isMain) {
  const { dryRun, jsonPath, matrixKind } = parseArgs(process.argv.slice(2));

  try {
    const result = await importMatrixFromJson({ jsonPath, matrixKind, dryRun });

    console.log(dryRun ? "OK matrix-db-import (dry-run)" : "OK matrix-db-import");
    console.log(`  json: ${result.jsonPath}`);
    console.log(`  matrix_kind: ${result.matrixKind}`);
    console.log(`  rows: ${result.summary.total} (${result.summary.obsolete} obsolete)`);
    console.log(`  status: ${JSON.stringify(result.summary.byStatus)}`);

    if (result.linkCount !== undefined) {
      console.log(`  finding-issues: ${result.linkCount}`);
    }

    if (!dryRun && result.rowCount !== undefined) {
      console.log(`  db rows: ${result.rowCount}`);
      console.log(`  run: ${result.runId}`);
      console.log(`  upsert: ${JSON.stringify(result.rowStats)}`);
      console.log(`  links imported: ${result.linksImported}`);
    }
  } catch (err) {
    console.error("FAIL matrix-db-import:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
