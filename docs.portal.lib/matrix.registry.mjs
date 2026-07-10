/**
 * Registry matrici PortalAdmin — kind, tab, rigenera e metadata sezioni.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MATRIX_KIND_PORTAL_GAP
, MATRIX_KIND_TEST_COVERAGE
} from "../cruscotto.database/matrix.db.mjs";
import { cruscottoDbFileExists, openCruscottoDb } from "../cruscotto.database/cruscotto.db.config.mjs";
import { buildUnifiedMatrixSectionsWithDb } from "./matrix.db.adapter.mjs";
import { resolveUnifiedHistoryPaths } from "./matrix.unified.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS_DIR    = join(PORTAL_ROOT, "docs.portal");

/** @typedef {import("./matrix.render.mjs").MatrixSection} MatrixSection */

/**
 * @typedef {{
 *   kind: string
 *   label: string
 *   shortLabel: string
 *   tabId: string
 *   docsHtmlFile: string
 *   regenerateScript: string
 *   regenerate: (opts?: {
 *     saveHtml?: boolean
 *     fullRender?: boolean
 *     source?: string
 *   }) => Promise<object>
 * }} MatrixRegistryEntry
 */

/** @type {MatrixRegistryEntry[]} */
export const MATRIX_REGISTRY_LIST = [
  {
    kind              : MATRIX_KIND_PORTAL_GAP
  , label             : "Avanzamento / gap / audit"
  , shortLabel        : "Gap / audit"
  , tabId             : "matrix"
  , docsHtmlFile      : "matrix.portal.gap.html"
  , regenerateScript  : "docs.portal/matrix.portal.gap.analysis.mjs"
  , regenerate        : regeneratePortalGapMatrix
  }
, {
    kind              : MATRIX_KIND_TEST_COVERAGE
  , label             : "Matrice copertura test"
  , shortLabel        : "Copertura test"
  , tabId             : "matrixcoverage"
  , docsHtmlFile      : "matrix.test.coverage.html"
  , regenerateScript  : "docs.portal/matrix.test.coverage.mjs"
  , regenerate        : regenerateTestCoverageMatrix
  }
];

/** @type {Record<string, MatrixRegistryEntry>} */
export const MATRIX_REGISTRY = Object.fromEntries(
  MATRIX_REGISTRY_LIST.map((entry) => [entry.kind, entry])
);

/**
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function resolveMatrixKind(raw) {
  const kind = String(raw ?? MATRIX_KIND_PORTAL_GAP).trim();

  if (!MATRIX_REGISTRY[kind]) {
    throw new Error(`matrix_kind sconosciuto: ${kind}`);
  }

  return kind;
}

/**
 * @param {string} kind
 * @returns {MatrixRegistryEntry}
 */
export function getMatrixRegistryEntry(kind) {
  return MATRIX_REGISTRY[resolveMatrixKind(kind)];
}

/**
 * @param {{
 *   saveHtml?: boolean
 *   fullRender?: boolean
 *   source?: string
 * }} [opts]
 */
async function regeneratePortalGapMatrix(opts = {}) {
  const matrixKind = MATRIX_KIND_PORTAL_GAP;
  const saveHtml   = opts.saveHtml !== false;
  const fullRender = Boolean(opts.fullRender);
  const source     = String(opts.source ?? "api.matrix.regenerate").trim();

  if (!cruscottoDbFileExists()) {
    throw new Error("Database cruscotto assente — eseguire npm run db:migrate");
  }

  await openCruscottoDb();

  const history = resolveUnifiedHistoryPaths(DOCS_DIR);
  const built   = await buildUnifiedMatrixSectionsWithDb(PORTAL_ROOT, {
    auditJsonPath   : history.auditJsonPath
  , legacyJsonPaths : history.legacyJsonPaths
  , previousJsonPath: join(DOCS_DIR, "matrix.portal.gap.json")
  , matrixKind
  , source
  , readFromDb      : true
  });

  const db        = await openCruscottoDb();
  const latestRun = await db.matrixRun.findFirst({
    where  : { matrixKind }
  , orderBy: { generatedAt: "desc" }
  });

  /** @type {{ merge?: boolean } | null} */
  let htmlResult = null;

  if (saveHtml) {
    const { runFullGapAnalysis } = await import("../docs.portal/matrix.portal.gap.analysis.mjs");

    htmlResult = await runFullGapAnalysis({ fullRender });
  }

  return {
    ok          : true
  , matrixKind
  , runId       : latestRun?.id ?? null
  , generatedAt : latestRun?.generatedAt?.toISOString() ?? new Date().toISOString()
  , fromDb      : built.fromDb ?? false
  , sectionCount: built.sections.length
  , htmlSaved   : saveHtml
  , htmlMerge   : htmlResult?.merge ?? null
  , rowCount    : built.sections.reduce((acc, sec) => acc + sec.rows.length, 0)
  };
}

/**
 * @param {{
 *   saveHtml?: boolean
 *   fullRender?: boolean
 *   source?: string
 * }} [opts]
 */
async function regenerateTestCoverageMatrix(opts = {}) {
  const matrixKind = MATRIX_KIND_TEST_COVERAGE;
  const saveHtml   = opts.saveHtml !== false;
  const fullRender = Boolean(opts.fullRender);
  const source     = String(opts.source ?? "api.matrix.regenerate").trim();

  if (!cruscottoDbFileExists()) {
    throw new Error("Database cruscotto assente — eseguire npm run db:migrate");
  }

  const { runTestCoverageMatrix } = await import("../docs.portal/matrix.test.coverage.mjs");
  const result = await runTestCoverageMatrix({
    fullRender: fullRender || saveHtml
  , source
  });

  const db        = await openCruscottoDb();
  const latestRun = await db.matrixRun.findFirst({
    where  : { matrixKind }
  , orderBy: { generatedAt: "desc" }
  });

  return {
    ok          : true
  , matrixKind
  , runId       : latestRun?.id ?? null
  , generatedAt : latestRun?.generatedAt?.toISOString() ?? new Date().toISOString()
  , fromDb      : result.fromDb ?? false
  , sectionCount: result.sections.length
  , htmlSaved   : saveHtml
  , htmlMerge   : result.merge ?? null
  , rowCount    : result.sections.reduce((acc, sec) => acc + sec.rows.length, 0)
  , source
  };
}

/**
 * @param {string} kind
 * @param {{
 *   saveHtml?: boolean
 *   fullRender?: boolean
 *   source?: string
 * }} [opts]
 */
export async function regenerateMatrixByKind(kind, opts = {}) {
  const entry = getMatrixRegistryEntry(kind);

  return entry.regenerate(opts);
}
