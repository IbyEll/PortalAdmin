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
, dbRowToMatrixRow
, loadMatrixRowEvents
, startMatrixRun
, upsertMatrixRows
} from "./matrix.db.mjs";
import { persistFindingIssueLink } from "../docs.portal.lib/matrix.finding-issues.store.mjs";
import { MATRIX_SECTION_TITLES } from "../docs.portal.lib/matrix.finding.sections.mjs";
import { summarizeMatrixSections } from "../docs.portal.lib/matrix.render.mjs";
import {
  buildUnifiedMatrixSections
, resolveUnifiedHistoryPaths
} from "../docs.portal.lib/matrix.unified.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS_DIR    = join(PORTAL_ROOT, "docs.portal");

/** @typedef {import("../docs.portal.lib/matrix.render.mjs").MatrixSection} MatrixSection */

/**
 * @param {string | null | undefined} sectionId
 * @returns {string}
 */
export function matrixSectionTitleFromId(sectionId) {
  const raw = String(sectionId ?? "unknown").trim();

  if (!raw || raw === "unknown") {
    return "Matrice";
  }

  const stripped = raw.replace(/^(op-|audit-)/, "");
  const titled   = MATRIX_SECTION_TITLES[stripped];

  if (titled) {
    return raw.startsWith("audit-") ? `Audit — ${titled}` : titled;
  }

  return raw.replace(/-/g, " ");
}

/**
 * @param {import("@prisma/client").MatrixRow[]} dbRows
 * @returns {MatrixSection[]}
 */
export function matrixSectionsFromDbRows(dbRows) {
  /** @type {Map<string, MatrixSection>} */
  const bySection = new Map();

  for (const dbRow of dbRows) {
    const sectionId = dbRow.sectionId ?? "unknown";
    const row       = dbRowToMatrixRow(dbRow, dbRow.findingIssue ?? null);

    if (!bySection.has(sectionId)) {
      bySection.set(sectionId, {
        id    : sectionId
      , title : matrixSectionTitleFromId(sectionId)
      , open  : false
      , rows  : []
      });
    }

    bySection.get(sectionId).rows.push(row);
  }

  return [...bySection.values()].sort((a, b) => a.id.localeCompare(b.id));
}

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
  const built   = await buildUnifiedMatrixSections(PORTAL_ROOT, {
    auditJsonPath   : history.auditJsonPath
  , legacyJsonPaths : history.legacyJsonPaths
  , previousJsonPath: join(DOCS_DIR, "matrix.portal.gap.json")
  });

  const run = await startMatrixRun({
    matrixKind
  , source
  , metrics: {
      gap     : built.report.metrics?.gap ?? null
    , partial : built.report.metrics?.partial ?? null
    , sections: built.sections.length
    }
  });

  const upsertStats = await upsertMatrixRows({
    matrixKind
  , matrixRunId: run.id
  , sections   : built.sections
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
  , runId       : run.id
  , generatedAt : run.generatedAt.toISOString()
  , upsertStats
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
