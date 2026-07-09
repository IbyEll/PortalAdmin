#!/usr/bin/env node
/**
 * Test Prisma round-trip insert/select matrix_row su DB cruscotto temporaneo.
 *
 * Uso:
 *   node admin.portal.testscript/technical/test.matrix.row.roundtrip.mjs
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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MATRIX_KIND = "portal_gap";
const FINDING_ID  = "audit-arch-dashboard";

const tempDir = mkdtempSync(join(tmpdir(), "portal-admin-matrix-rt-"));
const tempDb  = join(tempDir, "matrix-roundtrip.db");

process.env.CRUSCOTTO_DB_PATH = tempDb;

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

  const db = await openCruscottoDb();

  const run = await db.matrixRun.create({
    data: {
      matrixKind : MATRIX_KIND
    , source     : "test.roundtrip"
    , metricsJson: JSON.stringify({ total: 1 })
    }
  });

  const rowPayload = {
    findingId   : FINDING_ID
  , matrixKind  : MATRIX_KIND
  , matrixRunId : run.id
  , sectionId   : "arch"
  , status      : "gap"
  , sev         : "warn"
  , project     : "PortalAdmin"
  , voce        : "Dashboard HTTP"
  , dettaglio   : "Round-trip test ADMIN-177"
  , pathsJson   : JSON.stringify(["cruscotto.frontend/cruscotto.server.mjs"])
  , contentSig  : "test-sig-001"
  };

  await db.matrixRow.create({ data: rowPayload });

  const loaded = await db.matrixRow.findUnique({
    where: {
      findingId_matrixKind: {
        findingId  : FINDING_ID
      , matrixKind : MATRIX_KIND
      }
    }
    , include: { matrixRun: true }
  });

  if (!loaded) {
    throw new Error("matrix_row non trovata dopo insert");
  }

  const checks = [
    ["matrixRunId", loaded.matrixRunId, run.id]
  , ["status", loaded.status, rowPayload.status]
  , ["voce", loaded.voce, rowPayload.voce]
  , ["pathsJson", loaded.pathsJson, rowPayload.pathsJson]
  , ["matrixRun.source", loaded.matrixRun?.source, "test.roundtrip"]
  ];

  for (const [label, actual, expected] of checks) {
    if (actual !== expected) {
      throw new Error(`${label}: atteso ${JSON.stringify(expected)}, ottenuto ${JSON.stringify(actual)}`);
    }
  }

  const updated = await db.matrixRow.update({
    where: {
      findingId_matrixKind: {
        findingId  : FINDING_ID
      , matrixKind : MATRIX_KIND
      }
    }
  , data: {
      status    : "fatto"
    , lastSeenAt: new Date()
    }
  });

  if (updated.status !== "fatto") {
    throw new Error(`update status fallito: ${updated.status}`);
  }

  console.log("OK test-matrix-row-roundtrip");
  console.log(`  db: ${tempDb}`);
  console.log(`  run: ${run.id}`);
  console.log(`  row: ${FINDING_ID} / ${MATRIX_KIND}`);
} catch (err) {
  console.error("FAIL test-matrix-row-roundtrip:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await closeCruscottoDb();
  delete process.env.CRUSCOTTO_DB_PATH;

  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Windows: query engine può tenere lock sul file .db — cleanup best-effort
  }
}
