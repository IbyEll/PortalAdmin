/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-07-09 05:00
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-07-09 05:00   by: IbyEll
 * modificato il: 2026-07-09 05:00   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * Servizio API matrice cruscotto — portal-gap, runs, events, regenerate, finding-issue.
 * Story ADMIN-173 · consumer cruscotto.server.mjs route /api/matrix/*
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  cruscottoDbFileExists
, openCruscottoDb
} from "./cruscotto.db.config.mjs";
import {
  MATRIX_KIND_PORTAL_GAP
, loadMatrixRowEvents
} from "./matrix.db.mjs";
import {
  buildUnifiedMatrixSectionsWithDb
, matrixSectionsFromDbRows
, persistUnifiedMatrixSections
} from "../docs.portal.lib/matrix.db.adapter.mjs";
import { persistFindingIssueLink } from "../docs.portal.lib/matrix.finding-issues.store.mjs";
import { summarizeMatrixSections } from "../docs.portal.lib/matrix.render.mjs";
import { resolveUnifiedHistoryPaths } from "../docs.portal.lib/matrix.unified.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS_DIR    = join(PORTAL_ROOT, "docs.portal");

/** @typedef {import("../docs.portal.lib/matrix.render.mjs").MatrixSection} MatrixSection */

export { matrixSectionsFromDbRows, matrixSectionTitleFromId } from "../docs.portal.lib/matrix.db.adapter.mjs";

/**
 * @param {{ matrixKind?: string }} [opts]
 */
export async function loadMatrixPortalGap(opts = {}) {
  const matrixKind = String(opts.matrixKind ?? MATRIX_KIND_PORTAL_GAP).trim();

  if (!cruscottoDbFileExists()) {
    throw new Error("Database cruscotto assente — eseguire npm run db:migrate");
  }

  const db = await openCruscottoDb();

  const rows = await db.matrixRow.findMany({
    where  : { matrixKind }
  , include: { findingIssue: true }
  , orderBy: [{ sectionId: "asc" }, { findingId: "asc" }]
  });

  const latestRun = await db.matrixRun.findFirst({
    where  : { matrixKind }
  , orderBy: { generatedAt: "desc" }
  });

  const sections = matrixSectionsFromDbRows(rows);
  const summary  = summarizeMatrixSections(sections);

  return {
    ok          : true
  , matrixKind
  , generatedAt : latestRun?.generatedAt?.toISOString() ?? null
  , runId       : latestRun?.id ?? null
  , runSource   : latestRun?.source ?? null
  , sections
  , metrics     : summary
  , rowCount    : rows.length
  };
}

/**
 * @param {{ matrixKind?: string, limit?: number }} [opts]
 */
export async function loadMatrixRuns(opts = {}) {
  const matrixKind = String(opts.matrixKind ?? MATRIX_KIND_PORTAL_GAP).trim();
  const limit      = Math.min(Math.max(Number(opts.limit ?? 20) || 20, 1), 100);

  if (!cruscottoDbFileExists()) {
    throw new Error("Database cruscotto assente — eseguire npm run db:migrate");
  }

  const db  = await openCruscottoDb();
  const runs = await db.matrixRun.findMany({
    where  : { matrixKind }
  , orderBy: { generatedAt: "desc" }
  , take   : limit
  });

  return {
    ok         : true
  , matrixKind
  , runs: runs.map((run) => ({
      id          : run.id
    , matrixKind  : run.matrixKind
    , generatedAt : run.generatedAt.toISOString()
    , source      : run.source
    , syncRunId   : run.syncRunId
    , metrics     : run.metricsJson ? JSON.parse(run.metricsJson) : null
    }))
  };
}

/**
 * @param {{ findingId: string, matrixKind?: string }} opts
 */
export async function loadMatrixRowEventsApi(opts) {
  const findingId  = String(opts.findingId ?? "").trim();
  const matrixKind = String(opts.matrixKind ?? MATRIX_KIND_PORTAL_GAP).trim();

  if (!findingId) {
    throw new Error("findingId obbligatorio");
  }

  if (!cruscottoDbFileExists()) {
    throw new Error("Database cruscotto assente — eseguire npm run db:migrate");
  }

  await openCruscottoDb();
  const events = await loadMatrixRowEvents(findingId, matrixKind);

  return {
    ok         : true
  , findingId
  , matrixKind
  , events: events.map((ev) => ({
      id          : ev.id
    , at          : ev.at.toISOString()
    , eventType   : ev.eventType
    , matrixRunId : ev.matrixRunId
    , oldStatus   : ev.oldStatus
    , newStatus   : ev.newStatus
    , note        : ev.note
    }))
  };
}

/**
 * @param {{
 *   findingId: string
 *   key: string
 *   issueType?: string
 *   matrixKind?: string
 *   linkedSource?: string
 * }} body
 */
export async function persistMatrixFindingIssueApi(body) {
  const findingId = String(body.findingId ?? "").trim();
  const key       = String(body.key ?? "").trim().toUpperCase();
  const issueType = String(body.issueType ?? "Bug").trim() || "Bug";

  if (!findingId || !key) {
    throw new Error("findingId e key obbligatori");
  }

  if (!/^(ADMIN|JLO)-\d+$/.test(key)) {
    throw new Error("key Jira non valida (ADMIN-xxx o JLO-xxx)");
  }

  const entry = await persistFindingIssueLink(findingId, {
    key
  , issueType
  });

  return {
    ok        : true
  , findingId
  , link      : entry
  , matrixKind: String(body.matrixKind ?? MATRIX_KIND_PORTAL_GAP).trim()
  };
}

/**
 * @param {{
 *   matrixKind?: string
 *   saveHtml?: boolean
 *   fullRender?: boolean
 *   source?: string
 * }} [opts]
 */
export async function regenerateMatrixPortalGap(opts = {}) {
  const matrixKind = String(opts.matrixKind ?? MATRIX_KIND_PORTAL_GAP).trim();
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

  /** @type {{ html?: string, merge?: boolean } | null} */
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
 * Richiesta da localhost — gate dev-only per regenerate.
 *
 * @param {import("node:http").IncomingMessage} req
 * @returns {boolean}
 */
export function isLocalDevMatrixRequest(req) {
  const addr = String(req.socket?.remoteAddress ?? "");

  return (
    addr === "127.0.0.1"
    || addr === "::1"
    || addr === "::ffff:127.0.0.1"
    || addr.endsWith("127.0.0.1")
  );
}
