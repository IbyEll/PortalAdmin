#!/usr/bin/env node
/**
 * Smoke test matrix.db.mjs — startMatrixRun, upsertMatrixRows, appendMatrixEvent, obsoleto.
 *
 * Uso:
 *   node admin.portal.testscript/technical/test.matrix.db.mjs
 */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  closeCruscottoDb
, openCruscottoDb
, prepareCruscottoDatabaseUrl
} from "../../cruscotto.database/cruscotto.db.config.mjs";
import {
  MATRIX_EVENT_TYPES
, MATRIX_KIND_PORTAL_GAP
, appendMatrixEvent
, startMatrixRun
, upsertMatrixRows
, upsertFindingIssueLink
, loadMatrixRowEvents
} from "../../cruscotto.database/matrix.db.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const tempDir = mkdtempSync(join(tmpdir(), "portal-admin-matrix-db-"));
const tempDb  = join(tempDir, "matrix-db.db");

process.env.CRUSCOTTO_DB_PATH = tempDb;

/** @type {import("../../docs.portal.lib/matrix.render.mjs").MatrixSection[]} */
const SECTIONS_V1 = [
  {
    id    : "op-bug"
  , title : "Bug"
  , rows  : [
      {
        id       : "bug-tree-regenerate"
      , sev      : "P1"
      , status   : "gap"
      , project  : "PortalAdmin"
      , voce     : "Tree regenerate"
      , dettaglio: "Test ADMIN-180"
      , paths    : ["docs.portal/matrix.portal.gap.analysis.mjs"]
      }
    , {
        id       : "audit-park-myproject"
      , sev      : "info"
      , status   : "fatto"
      , project  : "PortalAdmin"
      , voce     : "PARKING myproject"
      , dettaglio: "Voce che diventerà obsoleta"
      , paths    : ["PARKING_tocheck/"]
      }
    ]
  }
];

/** @type {import("../../docs.portal.lib/matrix.render.mjs").MatrixSection[]} */
const SECTIONS_V2 = [
  {
    id    : "op-bug"
  , title : "Bug"
  , rows  : [
      {
        id       : "bug-tree-regenerate"
      , sev      : "P1"
      , status   : "parziale"
      , project  : "PortalAdmin"
      , voce     : "Tree regenerate"
      , dettaglio: "Test ADMIN-180 aggiornato"
      , paths    : ["docs.portal/matrix.portal.gap.analysis.mjs"]
      }
    ]
  }
];

try {
  prepareCruscottoDatabaseUrl();
  execFileSync(process.execPath, ["cruscotto.database/migrate.mjs"], {
    cwd   : ROOT
  , stdio : "pipe"
  , env   : { ...process.env, CRUSCOTTO_DB_PATH: tempDb }
  });

  if (!existsSync(tempDb)) {
    throw new Error(`migrate non ha creato ${tempDb}`);
  }

  const run1 = await startMatrixRun({
    matrixKind: MATRIX_KIND_PORTAL_GAP
  , source    : "test.matrix.db"
  , metrics   : { total: 2 }
  });

  const stats1 = await upsertMatrixRows({
    matrixKind  : MATRIX_KIND_PORTAL_GAP
  , matrixRunId : run1.id
  , sections    : SECTIONS_V1
  });

  if (stats1.inserted !== 2) {
    throw new Error(`v1 insert: attesi 2, ottenuti ${stats1.inserted}`);
  }

  await upsertFindingIssueLink("bug-tree-regenerate", MATRIX_KIND_PORTAL_GAP, {
    key       : "ADMIN-169"
  , issueType : "Bug"
  });

  const run2 = await startMatrixRun({
    matrixKind: MATRIX_KIND_PORTAL_GAP
  , source    : "test.matrix.db.v2"
  });

  const stats2 = await upsertMatrixRows({
    matrixKind  : MATRIX_KIND_PORTAL_GAP
  , matrixRunId : run2.id
  , sections    : SECTIONS_V2
  });

  if (stats2.updated !== 1 || stats2.markedObsolete !== 1) {
    throw new Error(`v2 upsert: atteso 1 update + 1 obsoleto, ottenuto ${JSON.stringify(stats2)}`);
  }

  const db = await openCruscottoDb();

  const obsoleteRow = await db.matrixRow.findUnique({
    where: {
      findingId_matrixKind: {
        findingId  : "audit-park-myproject"
      , matrixKind : MATRIX_KIND_PORTAL_GAP
      }
    }
  });

  if (obsoleteRow?.status !== "obsoleto") {
    throw new Error(`obsoleto status: ${obsoleteRow?.status}`);
  }

  const events = await loadMatrixRowEvents("audit-park-myproject", MATRIX_KIND_PORTAL_GAP);
  const obsoleteEvent = events.find((e) => e.eventType === MATRIX_EVENT_TYPES.marked_obsolete);

  if (!obsoleteEvent) {
    throw new Error("evento marked_obsolete assente");
  }

  await appendMatrixEvent({
    findingId   : "bug-tree-regenerate"
  , matrixKind  : MATRIX_KIND_PORTAL_GAP
  , matrixRunId : run2.id
  , eventType   : MATRIX_EVENT_TYPES.issue_resolved
  , note        : "Test manuale"
  });

  const link = await db.matrixFindingIssue.findUnique({
    where: {
      findingId_matrixKind: {
        findingId  : "bug-tree-regenerate"
      , matrixKind : MATRIX_KIND_PORTAL_GAP
      }
    }
  });

  if (link?.jiraKey !== "ADMIN-169") {
    throw new Error(`link jira: ${link?.jiraKey}`);
  }

  console.log("OK test-matrix-db");
  console.log(`  db: ${tempDb}`);
  console.log(`  v1: ${JSON.stringify(stats1)}`);
  console.log(`  v2: ${JSON.stringify(stats2)}`);
} catch (err) {
  console.error("FAIL test-matrix-db:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await closeCruscottoDb();
  delete process.env.CRUSCOTTO_DB_PATH;

  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Windows lock best-effort
  }
}
