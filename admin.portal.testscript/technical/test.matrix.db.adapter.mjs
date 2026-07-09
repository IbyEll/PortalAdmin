#!/usr/bin/env node
/**
 * Test bridge matrix.db.adapter.mjs — persist, load, post-sync hook (ADMIN-186 / ADMIN-184).
 *
 * Uso:
 *   node admin.portal.testscript/technical/test.matrix.db.adapter.mjs
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
, upsertFindingIssueLink
} from "../../cruscotto.database/matrix.db.mjs";
import {
  loadUnifiedMatrixSectionsFromDb
, persistUnifiedMatrixSections
, syncMatrixRowsFromJiraDone
} from "../../docs.portal.lib/matrix.db.adapter.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const tempDir = mkdtempSync(join(tmpdir(), "portal-admin-matrix-adapter-"));
const tempDb  = join(tempDir, "matrix-adapter.db");

process.env.CRUSCOTTO_DB_PATH = tempDb;
process.env.MATRIX_PERSIST      = "db";

/** @type {import("../../docs.portal.lib/matrix.render.mjs").MatrixSection[]} */
const SECTIONS = [
  {
    id    : "op-bug"
  , title : "Bug"
  , rows  : [
      {
        id       : "bug-adapter-test"
      , sev      : "P2"
      , status   : "gap"
      , project  : "PortalAdmin"
      , voce     : "Adapter test"
      , dettaglio: "ADMIN-186 smoke"
      , paths    : ["docs.portal.lib/matrix.db.adapter.mjs"]
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

  const persist = await persistUnifiedMatrixSections({
    matrixKind: MATRIX_KIND_PORTAL_GAP
  , sections  : SECTIONS
  , source    : "test.matrix.db.adapter"
  });

  if (persist.skipped || !persist.run) {
    throw new Error("persistUnifiedMatrixSections non ha scritto su DB");
  }

  const count = await countMatrixRows(MATRIX_KIND_PORTAL_GAP);

  if (count !== 1) {
    throw new Error(`row count atteso 1, got ${count}`);
  }

  const loaded = await loadUnifiedMatrixSectionsFromDb(MATRIX_KIND_PORTAL_GAP);

  if (loaded.length !== 1 || loaded[0].rows[0]?.id !== "bug-adapter-test") {
    throw new Error(`load sections errato: ${JSON.stringify(loaded)}`);
  }

  await upsertFindingIssueLink("bug-adapter-test", MATRIX_KIND_PORTAL_GAP, {
    key      : "ADMIN-156"
  , issueType: "Bug"
  });

  const db = await openCruscottoDb();
  const syncRun = await db.syncRun.create({
    data: {
      status    : "success"
    , source    : "test"
    , issueCount: 1
    , finishedAt: new Date()
    }
  });

  await db.jiraIssue.create({
    data: {
      jiraKey      : "ADMIN-156"
    , issueType    : "Bug"
    , summary      : "Test closed"
    , status       : "Fatto"
    , isDone       : true
    , tier         : "bug"
    , syncRunId    : syncRun.id
    , relatedKeys  : "[]"
    }
  });

  const hook = await syncMatrixRowsFromJiraDone({ syncRunId: syncRun.id });

  if (hook.updated !== 1) {
    throw new Error(`post-sync hook atteso updated=1, got ${hook.updated}`);
  }

  const row = await db.matrixRow.findUnique({
    where: {
      findingId_matrixKind: { findingId: "bug-adapter-test", matrixKind: MATRIX_KIND_PORTAL_GAP }
    }
  });

  if (row?.status !== "fatto") {
    throw new Error(`status atteso fatto, got ${row?.status}`);
  }

  const events = await db.matrixRowEvent.findMany({
    where: { findingId: "bug-adapter-test", eventType: "issue_resolved" }
  });

  if (events.length < 1) {
    throw new Error("issue_resolved event mancante");
  }

  console.log("OK test-matrix-db-adapter");
  console.log(`  persist run: ${persist.run.id}`);
  console.log(`  hook updated: ${hook.updated}`);
}

try {
  await main();
} catch (err) {
  console.error("FAIL test-matrix-db-adapter:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await closeCruscottoDb();
  delete process.env.CRUSCOTTO_DB_PATH;
  delete process.env.MATRIX_PERSIST;

  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Windows lock best-effort
  }
}
