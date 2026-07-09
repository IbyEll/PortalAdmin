#!/usr/bin/env node
/**
 * Test funzionale API matrice DB end-to-end — ADMIN-192 / ADMIN-173.
 *
 * Uso:
 *   node admin.portal.testscript/technical/test.matrix.api.e2e.mjs
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
  MATRIX_KIND_PORTAL_GAP
, countMatrixRows
, startMatrixRun
, upsertMatrixRows
} from "../../cruscotto.database/matrix.db.mjs";
import {
  loadMatrixPortalGap
, loadMatrixRowEventsApi
, loadMatrixRuns
, persistMatrixFindingIssueApi
, regenerateMatrixPortalGap
} from "../../cruscotto.database/matrix.api.service.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const tempDir = mkdtempSync(join(tmpdir(), "portal-admin-matrix-api-"));
const tempDb  = join(tempDir, "matrix-api.db");

process.env.CRUSCOTTO_DB_PATH = tempDb;

/** @type {import("../../docs.portal.lib/matrix.render.mjs").MatrixSection[]} */
const SEED_SECTIONS = [
  {
    id    : "op-bug"
  , title : "Bug"
  , rows  : [
      {
        id       : "bug-api-e2e"
      , sev      : "P2"
      , status   : "gap"
      , project  : "PortalAdmin"
      , voce     : "Matrix API e2e"
      , dettaglio: "Voce test ADMIN-192"
      , paths    : ["cruscotto.database/matrix.api.service.mjs"]
      }
    ]
  }
];

async function migrateTempDb() {
  prepareCruscottoDatabaseUrl(tempDb);

  execFileSync(process.execPath, ["cruscotto.database/migrate.mjs"], {
    cwd  : ROOT
  , stdio: "pipe"
  , env  : { ...process.env, CRUSCOTTO_DB_PATH: tempDb }
  });

  if (!existsSync(tempDb)) {
    throw new Error(`migrate non ha creato ${tempDb}`);
  }

  await openCruscottoDb();
}

async function main() {
  await migrateTempDb();

  const run = await startMatrixRun({
    matrixKind: MATRIX_KIND_PORTAL_GAP
  , source    : "test.matrix.api.e2e"
  });

  const upsert = await upsertMatrixRows({
    matrixKind : MATRIX_KIND_PORTAL_GAP
  , matrixRunId: run.id
  , sections   : SEED_SECTIONS
  });

  if (upsert.inserted < 1) {
    throw new Error(`upsert atteso inserted>=1, got ${JSON.stringify(upsert)}`);
  }

  const gap = await loadMatrixPortalGap({ matrixKind: MATRIX_KIND_PORTAL_GAP });

  if (!gap.ok || gap.rowCount < 1) {
    throw new Error(`portal-gap atteso rowCount>=1, got ${gap.rowCount}`);
  }

  const runs = await loadMatrixRuns({ matrixKind: MATRIX_KIND_PORTAL_GAP, limit: 5 });

  if (!runs.runs.length) {
    throw new Error("runs atteso almeno 1 snapshot");
  }

  const eventsBefore = await loadMatrixRowEventsApi({
    findingId : "bug-api-e2e"
  , matrixKind: MATRIX_KIND_PORTAL_GAP
  });

  if (!eventsBefore.events.length) {
    throw new Error("events atteso almeno scan_detected");
  }

  const link = await persistMatrixFindingIssueApi({
    findingId: "bug-api-e2e"
  , key      : "ADMIN-9999"
  , issueType: "Bug"
  });

  if (link.link.key !== "ADMIN-9999") {
    throw new Error(`link key atteso ADMIN-9999, got ${link.link.key}`);
  }

  const regen = await regenerateMatrixPortalGap({
    matrixKind: MATRIX_KIND_PORTAL_GAP
  , saveHtml  : false
  });

  if (!regen.ok || regen.rowCount < 1) {
    throw new Error(`regenerate atteso rowCount>=1, got ${regen.rowCount}`);
  }

  const count = await countMatrixRows(MATRIX_KIND_PORTAL_GAP);

  if (count < 1) {
    throw new Error(`countMatrixRows atteso >=1, got ${count}`);
  }

  const eventsAfter = await loadMatrixRowEventsApi({
    findingId : "bug-api-e2e"
  , matrixKind: MATRIX_KIND_PORTAL_GAP
  });

  if (eventsAfter.events.length < eventsBefore.events.length) {
    throw new Error("events dopo regenerate non deve diminuire");
  }

  console.log("OK test-matrix-api-e2e");
  console.log(`  rows=${count} runs=${runs.runs.length} regen=${regen.runId}`);
}

main()
  .catch((err) => {
    console.error("FAIL test-matrix-api-e2e:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeCruscottoDb().catch(() => {});

    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup
    }
  });
