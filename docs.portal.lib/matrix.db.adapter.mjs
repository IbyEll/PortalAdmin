/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-07-09 06:00
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-07-09 06:00   by: IbyEll
 * modificato il: 2026-07-09 06:00   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * Bridge scan MatrixSection[] ↔ persistence matrix.db — story ADMIN-174 / subtask ADMIN-186.
 *
 * Export principali:
 *   - buildUnifiedMatrixSectionsWithDb — scan + persist + load enriched
 *   - persistUnifiedMatrixSections — upsert run/righe da scan
 *   - loadUnifiedMatrixSectionsFromDb — sezioni da DB con link Jira
 *   - syncMatrixRowsFromJiraDone — post-sync hook jira_issue.is_done → fatto
 */

import { cruscottoDbFileExists, openCruscottoDb } from "../cruscotto.database/cruscotto.db.config.mjs";
import {
  MATRIX_EVENT_TYPES
, MATRIX_KIND_PORTAL_GAP
, MATRIX_KIND_TEST_COVERAGE
, dbRowToMatrixRow
, startMatrixRun
, upsertMatrixRows
} from "../cruscotto.database/matrix.db.mjs";
import { MATRIX_SECTION_TITLES } from "./matrix.finding.sections.mjs";
import { enrichMatrixRowsWithIssueRefinement } from "./matrix.finding.issues.mjs";
import {
  isMatrixDbPrimary
, shouldWriteMatrixDb
} from "./matrix.persist.config.mjs";
import { buildUnifiedMatrixSections } from "./matrix.unified.mjs";
import {
  TEST_COVERAGE_COLUMNS
, TEST_COVERAGE_PRIORITY_SECTION
, TEST_COVERAGE_SECTION_BY_ID
, TEST_COVERAGE_SECTION_DEFS
, TEST_COVERAGE_SECTION_ORDER
} from "./matrix.test-coverage.meta.mjs";

/** @typedef {import("./matrix.render.mjs").MatrixRow} MatrixRow */
/** @typedef {import("./matrix.render.mjs").MatrixSection} MatrixSection */

export { MATRIX_KIND_PORTAL_GAP, MATRIX_KIND_TEST_COVERAGE };

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
 * Ordine sezioni matrice — operativo/audit per portal_gap; ordine catalogo per test_coverage.
 *
 * @param {MatrixSection[]} sections
 * @param {string} [matrixKind]
 * @returns {MatrixSection[]}
 */
function sortMatrixSectionsForDisplay(sections, matrixKind = MATRIX_KIND_PORTAL_GAP) {
  if (matrixKind === MATRIX_KIND_TEST_COVERAGE) {
    const orderMap = new Map(TEST_COVERAGE_SECTION_ORDER.map((id, index) => [id, index]));

    return [...sections].sort((a, b) => {
      const ai = orderMap.get(a.id) ?? 999;
      const bi = orderMap.get(b.id) ?? 999;

      if (ai !== bi) {
        return ai - bi;
      }

      return a.id.localeCompare(b.id);
    });
  }

  const op    = [];
  const audit = [];
  const rest  = [];

  for (const sec of sections) {
    if (sec.id.startsWith("op-")) {
      op.push(sec);
    } else if (sec.id.startsWith("audit-")) {
      audit.push(sec);
    } else {
      rest.push(sec);
    }
  }

  op.sort((a, b) => a.id.localeCompare(b.id));
  audit.sort((a, b) => a.id.localeCompare(b.id));
  rest.sort((a, b) => a.id.localeCompare(b.id));

  return [...op, ...audit, ...rest];
}

/**
 * Part heading, badge, colonne e apertura card per kind.
 *
 * @param {MatrixSection[]} sections
 * @param {string} [matrixKind]
 * @returns {MatrixSection[]}
 */
function enrichMatrixSectionsForDisplay(sections, matrixKind = MATRIX_KIND_PORTAL_GAP) {
  if (matrixKind === MATRIX_KIND_TEST_COVERAGE) {
    return sections.map((sec) => {
      const meta     = TEST_COVERAGE_SECTION_BY_ID[sec.id];
      const gapCount = sec.rows.filter((row) => row.status === "gap").length;

      return {
        ...sec
      , title  : meta?.title ?? sec.title
      , open   : meta?.open ?? sec.open ?? false
      , badge  : sec.id === "priority"
          ? `${gapCount} aperti · ${sec.rows.length} voci`
          : `${sec.rows.length} voci`
      , columns: TEST_COVERAGE_COLUMNS
      };
    });
  }

  let opPart    = false;
  let auditPart = false;

  return sections.map((sec) => {
    const enriched = { ...sec };

    if (sec.id.startsWith("op-") && !opPart) {
      enriched.partHeading = "Avanzamento operativo";
      opPart               = true;
    }

    if (sec.id.startsWith("audit-") && !auditPart) {
      enriched.partHeading = "Audit migrazione, ridondanze e storico";
      auditPart            = true;
    }

    if (["op-bug", "op-deprecation", "op-miglioramento", "op-gap"].includes(sec.id)) {
      enriched.open = true;
    }

    return enriched;
  });
}

/**
 * @param {import("@prisma/client").MatrixRow[]} dbRows
 * @returns {MatrixSection[]}
 */
export function matrixSectionsFromDbRows(dbRows) {
  /** @type {Map<string, MatrixSection>} */
  const bySection = new Map();
  const matrixKind  = String(dbRows[0]?.matrixKind ?? MATRIX_KIND_PORTAL_GAP).trim();

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

  const sections = [...bySection.values()];

  return enrichMatrixSectionsForDisplay(
    sortMatrixSectionsForDisplay(sections, matrixKind)
  , matrixKind
  );
}

/**
 * @param {string} matrixKind
 * @returns {Promise<MatrixSection[]>}
 */
export async function loadUnifiedMatrixSectionsFromDb(matrixKind = MATRIX_KIND_PORTAL_GAP) {
  if (!cruscottoDbFileExists()) {
    return [];
  }

  const db = await openCruscottoDb();

  const rows = await db.matrixRow.findMany({
    where  : { matrixKind }
  , include: { findingIssue: true }
  , orderBy: [{ sectionId: "asc" }, { findingId: "asc" }]
  });

  return matrixSectionsFromDbRows(rows);
}

/**
 * @param {{
 *   matrixKind?: string
 *   sections: MatrixSection[]
 *   report?: object
 *   source?: string
 *   syncRunId?: string | null
 * }} opts
 */
export async function persistUnifiedMatrixSections(opts) {
  const matrixKind = String(opts.matrixKind ?? MATRIX_KIND_PORTAL_GAP).trim();
  const sections   = opts.sections ?? [];
  const source     = String(opts.source ?? "matrix.db.adapter").trim();

  if (!shouldWriteMatrixDb() || !cruscottoDbFileExists()) {
    return { run: null, stats: null, skipped: true };
  }

  const run = await startMatrixRun({
    matrixKind
  , source
  , metrics: {
      gap     : opts.report?.metrics?.gap ?? opts.report?.metrics?.openGaps ?? null
    , partial : opts.report?.metrics?.partial ?? null
    , sections: sections.length
    , rows    : sections.reduce((acc, sec) => acc + sec.rows.length, 0)
    }
  , syncRunId: opts.syncRunId ?? null
  });

  const stats = await upsertMatrixRows({
    matrixKind
  , matrixRunId: run.id
  , sections
  });

  return { run, stats, skipped: false };
}

/**
 * @param {MatrixSection[]} sections
 * @param {string} portalRoot
 * @param {{ matrixKind?: string }} [opts]
 */
export async function enrichMatrixSectionsFromJira(sections, portalRoot, opts = {}) {
  const rows = sections.flatMap((sec) => sec.rows);

  if (rows.length === 0) {
    return;
  }

  await enrichMatrixRowsWithIssueRefinement(rows, portalRoot, opts);
}

/**
 * Scan unificato con persistenza DB e caricamento enriched quando DB primary.
 *
 * @param {string} portalRoot
 * @param {{
 *   matrixKind?: string
 *   source?: string
 *   legacyJsonPaths?: string[]
 *   report?: Awaited<ReturnType<import("./matrix.gap.scan.mjs").analyzePortalAdvancement>>
 *   previousJsonPath?: string
 *   auditJsonPath?: string
 *   readFromDb?: boolean
 *   skipPersist?: boolean
 * }} [opts]
 */
export async function buildUnifiedMatrixSectionsWithDb(portalRoot, opts = {}) {
  const matrixKind = String(opts.matrixKind ?? MATRIX_KIND_PORTAL_GAP).trim();
  const built      = await buildUnifiedMatrixSections(portalRoot, opts);

  if (!opts.skipPersist && shouldWriteMatrixDb()) {
    await persistUnifiedMatrixSections({
      matrixKind
    , sections: built.sections
    , report  : built.report
    , source  : opts.source ?? "matrix.unified.scan"
    });
  }

  const useDbSections = opts.readFromDb ?? isMatrixDbPrimary();

  if (useDbSections && cruscottoDbFileExists()) {
    const fromDb = await loadUnifiedMatrixSectionsFromDb(matrixKind);

    if (fromDb.length > 0) {
      await enrichMatrixSectionsFromJira(fromDb, portalRoot, { matrixKind });

      return {
        ...built
      , sections     : fromDb
      , fromDb       : true
      , matrixKind
      };
    }
  }

  await enrichMatrixSectionsFromJira(built.sections, portalRoot, { matrixKind });

  return {
    ...built
  , fromDb    : false
  , matrixKind
  };
}

/**
 * Post-sync Jira: righe linkate con jira_issue.is_done → status fatto + evento issue_resolved.
 *
 * @param {{ syncRunId?: string, matrixKinds?: string[] }} [opts]
 */
export async function syncMatrixRowsFromJiraDone(opts = {}) {
  if (!cruscottoDbFileExists()) {
    return { updated: 0, syncRunId: null };
  }

  const db          = await openCruscottoDb();
  const matrixKinds = opts.matrixKinds ?? [MATRIX_KIND_PORTAL_GAP, MATRIX_KIND_TEST_COVERAGE];

  let syncRunId = opts.syncRunId ?? null;

  if (!syncRunId) {
    const syncRun = await db.syncRun.findFirst({
      where  : { status: "success", issueCount: { gt: 0 } }
    , orderBy: { finishedAt: "desc" }
    });

    syncRunId = syncRun?.id ?? null;
  }

  if (!syncRunId) {
    return { updated: 0, syncRunId: null };
  }

  let updated = 0;

  for (const matrixKind of matrixKinds) {
    const links = await db.matrixFindingIssue.findMany({ where: { matrixKind } });

    if (!links.length) {
      continue;
    }

    const latestRun = await db.matrixRun.findFirst({
      where  : { matrixKind }
    , orderBy: { generatedAt: "desc" }
    });

    for (const link of links) {
      const jiraRow = await db.jiraIssue.findFirst({
        where : { jiraKey: link.jiraKey, syncRunId }
      , select: { isDone: true, status: true }
      });

      if (!jiraRow?.isDone) {
        continue;
      }

      const matrixRow = await db.matrixRow.findUnique({
        where: {
          findingId_matrixKind: { findingId: link.findingId, matrixKind }
        }
      });

      if (!matrixRow) {
        continue;
      }

      const closedStatuses = new Set(["fatto", "done", "coperto", "obsoleto"]);

      if (closedStatuses.has(matrixRow.status)) {
        continue;
      }

      await db.$transaction(async (tx) => {
        await tx.matrixRow.update({
          where: {
            findingId_matrixKind: { findingId: link.findingId, matrixKind }
          }
        , data: {
            status      : "fatto"
          , resolvedNote: `✅ Jira ${link.jiraKey} — ${jiraRow.status ?? "Fatto"}`
          , lastSeenAt  : new Date()
          }
        });

        if (latestRun) {
          await tx.matrixRowEvent.create({
            data: {
              findingId   : link.findingId
            , matrixKind
            , matrixRunId : latestRun.id
            , eventType   : MATRIX_EVENT_TYPES.issue_resolved
            , oldStatus   : matrixRow.status
            , newStatus   : "fatto"
            , note        : link.jiraKey
            }
          });
        }
      });

      updated += 1;
    }
  }

  return { updated, syncRunId };
}
