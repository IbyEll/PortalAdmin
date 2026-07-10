/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-07-09 04:10
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-07-09 04:10   by: IbyEll
 * modificato il: 2026-07-09 04:10   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Persistence layer matrici PortalAdmin — run snapshot, righe, eventi, link issue.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Le matrici gap/audit/test devono persistere su SQLite cruscotto con storico append-only,
 *     sostituendo JSON come sorgente di verità (story ADMIN-172).
 *
 *   A cosa serve:
 *   - startMatrixRun, upsertMatrixRows, appendMatrixEvent e helper link finding↔Jira.
 *   - Marcatura obsoleto per righe assenti dallo scan (mai DELETE).
 *
 * Generalizzazione:
 *   Si — matrix_kind parametrico (portal_gap, test_coverage, …).
 *
 * Input:
 *   - matrixKind — tipo matrice (portal_gap | test_coverage)
 *   - sections — MatrixSection[] dal renderer unified
 *   - CRUSCOTTO_DB_PATH — file SQLite overlay
 *
 * Consumatori:
 *   - cruscotto.database/matrix.db.import.mjs — import JSON legacy
 *   - docs.portal.lib/matrix.finding-issues.store.mjs — persist link Crea
 *   - docs.portal.lib/matrix.db.adapter.mjs — bridge scan ↔ DB (story ADMIN-174)
 *
 * Export principali:
 *   - startMatrixRun — crea snapshot run
 *   - upsertMatrixRows — upsert righe + obsoleto automatico
 *   - appendMatrixEvent — storico append-only
 *   - upsertFindingIssueLink, loadFindingIssueLinks — link finding↔Jira
 *   - loadMatrixRows, loadMatrixRowEvents — query righe ed eventi
 *   - matrixRowToDbPayload, dbRowToMatrixRow — conversione renderer ↔ DB
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { openCruscottoDb } from "./cruscotto.db.config.mjs";

/** @typedef {import("../docs.portal.lib/matrix.render.mjs").MatrixRow} MatrixRow */
/** @typedef {import("../docs.portal.lib/matrix.render.mjs").MatrixSection} MatrixSection */

export const MATRIX_KIND_PORTAL_GAP    = "portal_gap";
export const MATRIX_KIND_TEST_COVERAGE = "test_coverage";

/** @type {Record<string, string>} */
export const MATRIX_EVENT_TYPES = {
  scan_detected  : "scan_detected"
, status_change  : "status_change"
, marked_obsolete: "marked_obsolete"
, issue_linked   : "issue_linked"
, issue_resolved : "issue_resolved"
};

/**
 * @typedef {{
 *   id: string
 *   matrixKind: string
 *   generatedAt: Date
 *   source: string
 *   metricsJson: string | null
 *   syncRunId: string | null
 * }} MatrixRunRecord
 */

/**
 * @typedef {{ key: string, issueType: string, createdAt?: string, linkedSource?: string }} FindingIssueLink
 */

/**
 * Firma contenuto riga per rilevare delta scan.
 *
 * @param {MatrixRow} row
 * @returns {string}
 */
export function matrixRowContentSig(row) {
  return JSON.stringify({
    status    : row.status
  , sev       : row.sev
  , voce      : row.voce
  , dettaglio : row.dettaglio
  , paths     : row.paths ?? []
  });
}

/**
 * Converte MatrixRow renderer → payload Prisma matrix_row.
 *
 * @param {MatrixRow} row
 * @param {string} matrixKind
 * @param {string} matrixRunId
 * @param {string | null | undefined} sectionId
 * @returns {object}
 */
export function matrixRowToDbPayload(row, matrixKind, matrixRunId, sectionId) {
  return {
    findingId    : row.id
  , matrixKind
  , matrixRunId
  , sectionId    : sectionId ?? null
  , status       : row.status
  , sev          : row.sev ?? null
  , project      : row.project ?? null
  , voce         : row.voce ?? null
  , dettaglio    : row.dettaglio ?? null
  , pathsJson    : JSON.stringify(row.paths ?? [])
  , resolvedNote : row.resolvedNote ?? null
  , contentSig   : matrixRowContentSig(row)
  , lastSeenAt   : new Date()
  };
}

/**
 * Converte riga DB → MatrixRow renderer.
 *
 * @param {object} dbRow
 * @param {{ jiraKey?: string, issueType?: string | null } | null | undefined} findingIssue
 * @returns {MatrixRow}
 */
export function dbRowToMatrixRow(dbRow, findingIssue) {
  /** @type {string[]} */
  let paths = [];

  try {
    const parsed = JSON.parse(dbRow.pathsJson ?? "[]");

    paths = Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    paths = [];
  }

  return {
    id           : dbRow.findingId
  , sev          : dbRow.sev ?? "info"
  , status       : dbRow.status
  , project      : dbRow.project ?? ""
  , voce         : dbRow.voce ?? ""
  , dettaglio    : dbRow.dettaglio ?? ""
  , paths
  , issueKey     : findingIssue?.jiraKey ?? null
  , issueType    : findingIssue?.issueType ?? null
  , resolvedNote : dbRow.resolvedNote ?? ""
  };
}

/**
 * Crea snapshot run matrice.
 *
 * @param {{ matrixKind: string, source: string, metrics?: object, syncRunId?: string | null }} opts
 * @returns {Promise<MatrixRunRecord>}
 */
export async function startMatrixRun(opts) {
  const db = await openCruscottoDb();

  return db.matrixRun.create({
    data: {
      matrixKind  : opts.matrixKind
    , source      : opts.source
    , metricsJson : opts.metrics ? JSON.stringify(opts.metrics) : null
    , syncRunId   : opts.syncRunId ?? null
    }
  });
}

/**
 * Append evento storico riga matrice (append-only).
 *
 * @param {{
 *   findingId: string
 *   matrixKind: string
 *   matrixRunId: string
 *   eventType: string
 *   oldStatus?: string | null
 *   newStatus?: string | null
 *   note?: string | null
 * }} opts
 */
export async function appendMatrixEvent(opts) {
  const db = await openCruscottoDb();

  return db.matrixRowEvent.create({
    data: {
      findingId   : opts.findingId
    , matrixKind  : opts.matrixKind
    , matrixRunId : opts.matrixRunId
    , eventType   : opts.eventType
    , oldStatus   : opts.oldStatus ?? null
    , newStatus   : opts.newStatus ?? null
    , note        : opts.note ?? null
    }
  });
}

/**
 * Upsert righe matrice da scan; marca obsoleto le righe assenti.
 *
 * @param {{
 *   matrixKind: string
 *   matrixRunId: string
 *   sections: MatrixSection[]
 * }} opts
 * @returns {Promise<{ inserted: number, updated: number, unchanged: number, markedObsolete: number }>}
 */
export async function upsertMatrixRows(opts) {
  const db = await openCruscottoDb();
  const { matrixKind, matrixRunId, sections } = opts;

  /** @type {Map<string, { row: MatrixRow, sectionId: string }>} */
  const incoming = new Map();

  for (const sec of sections) {
    for (const row of sec.rows) {
      incoming.set(row.id, { row, sectionId: sec.id });
    }
  }

  const existing = await db.matrixRow.findMany({
    where: { matrixKind }
  });

  const stats = {
    inserted       : 0
  , updated        : 0
  , unchanged      : 0
  , markedObsolete : 0
  };

  await db.$transaction(async (tx) => {
    for (const [findingId, { row, sectionId }] of incoming) {
      const prev    = existing.find((r) => r.findingId === findingId);
      const payload = matrixRowToDbPayload(row, matrixKind, matrixRunId, sectionId);

      if (!prev) {
        await tx.matrixRow.create({
          data: {
            ...payload
          , firstSeenAt: new Date()
          }
        });

        await tx.matrixRowEvent.create({
          data: {
            findingId
          , matrixKind
          , matrixRunId
          , eventType: MATRIX_EVENT_TYPES.scan_detected
          , newStatus: row.status
          , note     : "Prima occorrenza scan"
          }
        });

        stats.inserted += 1;
        continue;
      }

      const statusChanged = prev.status !== row.status;
      const sigChanged    = prev.contentSig !== payload.contentSig;

      if (statusChanged || sigChanged) {
        await tx.matrixRow.update({
          where: {
            findingId_matrixKind: { findingId, matrixKind }
          }
        , data: {
            ...payload
          , firstSeenAt: prev.firstSeenAt
          }
        });

        if (statusChanged) {
          await tx.matrixRowEvent.create({
            data: {
              findingId
            , matrixKind
            , matrixRunId
            , eventType: MATRIX_EVENT_TYPES.status_change
            , oldStatus: prev.status
            , newStatus: row.status
            }
          });
        }

        stats.updated += 1;
      } else {
        await tx.matrixRow.update({
          where: {
            findingId_matrixKind: { findingId, matrixKind }
          }
        , data: {
            matrixRunId
          , lastSeenAt: new Date()
          }
        });

        stats.unchanged += 1;
      }
    }

    const incomingIds = new Set(incoming.keys());

    for (const prev of existing) {
      if (incomingIds.has(prev.findingId) || prev.status === "obsoleto") {
        continue;
      }

      await tx.matrixRow.update({
        where: {
          findingId_matrixKind: { findingId: prev.findingId, matrixKind }
        }
      , data: {
          status      : "obsoleto"
        , matrixRunId
        , lastSeenAt  : new Date()
        }
      });

      await tx.matrixRowEvent.create({
        data: {
          findingId: prev.findingId
        , matrixKind
        , matrixRunId
        , eventType: MATRIX_EVENT_TYPES.marked_obsolete
        , oldStatus: prev.status
        , newStatus: "obsoleto"
        , note     : "Voce assente dall'ultimo scan"
        }
      });

      stats.markedObsolete += 1;
    }
  });

  return stats;
}

/**
 * Upsert link finding ↔ Jira su matrix_finding_issue.
 *
 * @param {string} findingId
 * @param {string} matrixKind
 * @param {FindingIssueLink} link
 * @returns {Promise<FindingIssueLink>}
 */
export async function upsertFindingIssueLink(findingId, matrixKind, link) {
  const id      = String(findingId ?? "").trim();
  const jiraKey = String(link.key ?? "").trim().toUpperCase();

  if (!id || !jiraKey) {
    throw new Error("findingId e key obbligatori per upsert link matrice");
  }

  const db    = await openCruscottoDb();
  const entry = {
    key          : jiraKey
  , issueType    : String(link.issueType ?? "").trim() || "Bug"
  , createdAt    : link.createdAt ?? new Date().toISOString()
  , linkedSource : link.linkedSource ?? "create_button"
  };

  await db.$transaction(async (tx) => {
    await tx.matrixFindingIssue.upsert({
      where: {
        findingId_matrixKind: { findingId: id, matrixKind }
      }
    , create: {
        findingId    : id
      , matrixKind
      , jiraKey
      , issueType    : entry.issueType
      , linkedSource : entry.linkedSource
      , linkedAt     : new Date(entry.createdAt)
      }
    , update: {
        jiraKey
      , issueType    : entry.issueType
      , linkedSource : entry.linkedSource
      }
    });

    const rowExists = await tx.matrixRow.findUnique({
      where: { findingId_matrixKind: { findingId: id, matrixKind } }
    });

    if (rowExists) {
      const latestRun = await tx.matrixRun.findFirst({
        where  : { matrixKind }
      , orderBy: { generatedAt: "desc" }
      });

      if (latestRun) {
        await tx.matrixRowEvent.create({
          data: {
            findingId   : id
          , matrixKind
          , matrixRunId : latestRun.id
          , eventType   : MATRIX_EVENT_TYPES.issue_linked
          , note        : jiraKey
          }
        });
      }
    }
  });

  return entry;
}

/**
 * Rimuove link finding ↔ Jira obsoleto (issue cancellata su Jira).
 *
 * @param {string} findingId
 * @param {string} [matrixKind]
 * @returns {Promise<boolean>}
 */
export async function deleteFindingIssueLink(findingId, matrixKind = MATRIX_KIND_PORTAL_GAP) {
  const id   = String(findingId ?? "").trim();
  const kind = String(matrixKind ?? MATRIX_KIND_PORTAL_GAP).trim();

  if (!id) {
    return false;
  }

  const db     = await openCruscottoDb();
  const result = await db.matrixFindingIssue.deleteMany({
    where: { findingId: id, matrixKind: kind }
  });

  return result.count > 0;
}

/**
 * @param {string} [matrixKind]
 * @returns {Promise<Map<string, FindingIssueLink>>}
 */
export async function loadFindingIssueLinks(matrixKind = MATRIX_KIND_PORTAL_GAP) {
  const db   = await openCruscottoDb();
  const rows = await db.matrixFindingIssue.findMany({ where: { matrixKind } });

  /** @type {Map<string, FindingIssueLink>} */
  const map = new Map();

  for (const row of rows) {
    map.set(row.findingId, {
      key       : row.jiraKey
    , issueType : row.issueType ?? "Bug"
    , createdAt : row.linkedAt.toISOString()
    });
  }

  return map;
}

/**
 * @param {string} matrixKind
 * @returns {Promise<MatrixRow[]>}
 */
export async function loadMatrixRows(matrixKind) {
  const db   = await openCruscottoDb();
  const rows = await db.matrixRow.findMany({
    where  : { matrixKind }
  , include: { findingIssue: true }
  });

  return rows.map((r) => dbRowToMatrixRow(r, r.findingIssue));
}

/**
 * @param {string} findingId
 * @param {string} matrixKind
 */
export async function loadMatrixRowEvents(findingId, matrixKind) {
  const db = await openCruscottoDb();

  return db.matrixRowEvent.findMany({
    where  : { findingId, matrixKind }
  , orderBy: { at: "asc" }
  });
}

/**
 * @param {string} matrixKind
 */
export async function countMatrixRows(matrixKind) {
  const db = await openCruscottoDb();

  return db.matrixRow.count({ where: { matrixKind } });
}
