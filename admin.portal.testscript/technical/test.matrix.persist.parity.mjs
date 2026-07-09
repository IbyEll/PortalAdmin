#!/usr/bin/env node
/**
 * Test parità JSON ↔ DB per MATRIX_PERSIST=dual (ADMIN-182).
 *
 * Uso:
 *   node admin.portal.testscript/technical/test.matrix.persist.parity.mjs
 */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  closeCruscottoDb
, prepareCruscottoDatabaseUrl
} from "../../cruscotto.database/cruscotto.db.config.mjs";
import { importMatrixFromJson, summarizeImportSections, parseUnifiedMatrixJson } from "../../cruscotto.database/matrix.db.import.mjs";
import { countMatrixRows } from "../../cruscotto.database/matrix.db.mjs";
import {
  resolveMatrixPersistMode
, shouldWriteMatrixDb
, shouldWriteMatrixJson
} from "../../docs.portal.lib/matrix.persist.config.mjs";

const ROOT      = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const JSON_PATH = join(ROOT, "docs.portal", "matrix.portal.gap.json");

const tempDir = mkdtempSync(join(tmpdir(), "portal-admin-matrix-parity-"));
const tempDb  = join(tempDir, "matrix-parity.db");

process.env.CRUSCOTTO_DB_PATH = tempDb;
process.env.MATRIX_PERSIST      = "dual";

try {
  if (resolveMatrixPersistMode() !== "dual") {
    throw new Error(`MATRIX_PERSIST mode: ${resolveMatrixPersistMode()}`);
  }

  if (!shouldWriteMatrixDb() || !shouldWriteMatrixJson()) {
    throw new Error("dual mode: write flags errati");
  }

  const payload = parseUnifiedMatrixJson(JSON_PATH);
  const summary = summarizeImportSections(payload.sections);

  prepareCruscottoDatabaseUrl();
  execFileSync(process.execPath, ["cruscotto.database/migrate.mjs"], {
    cwd   : ROOT
  , stdio : "pipe"
  , env   : { ...process.env, CRUSCOTTO_DB_PATH: tempDb }
  });

  if (!existsSync(tempDb)) {
    throw new Error(`migrate non ha creato ${tempDb}`);
  }

  await importMatrixFromJson({ jsonPath: JSON_PATH });

  const dbCount = await countMatrixRows("portal_gap");

  if (dbCount !== summary.total) {
    throw new Error(`parità count: JSON ${summary.total} vs DB ${dbCount}`);
  }

  /** @type {Set<string>} */
  const jsonIds = new Set();

  for (const sec of payload.sections) {
    for (const row of sec.rows ?? []) {
      jsonIds.add(row.id);
    }
  }

  const db = await (await import("../../cruscotto.database/cruscotto.db.config.mjs")).openCruscottoDb();
  const dbRows = await db.matrixRow.findMany({ where: { matrixKind: "portal_gap" } });
  const dbIds  = new Set(dbRows.map((r) => r.findingId));

  const missingInDb = [...jsonIds].filter((id) => !dbIds.has(id));
  const extraInDb   = [...dbIds].filter((id) => !jsonIds.has(id));

  if (missingInDb.length > 0 || extraInDb.length > 0) {
    throw new Error(`finding_id mismatch: missing=${missingInDb.length} extra=${extraInDb.length}`);
  }

  const jsonObsolete = summary.obsolete;
  const dbObsolete   = dbRows.filter((r) => r.status === "obsoleto").length;

  if (dbObsolete !== jsonObsolete) {
    throw new Error(`obsolete: JSON ${jsonObsolete} vs DB ${dbObsolete}`);
  }

  console.log("OK test-matrix-persist-parity");
  console.log(`  mode: ${resolveMatrixPersistMode()}`);
  console.log(`  rows: ${summary.total}`);
  console.log(`  obsolete: ${jsonObsolete}`);
} catch (err) {
  console.error("FAIL test-matrix-persist-parity:", err instanceof Error ? err.message : err);
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
