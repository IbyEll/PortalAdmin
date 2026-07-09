#!/usr/bin/env node
/**
 * Test import JSON legacy → DB matrix (ADMIN-179).
 *
 * Uso:
 *   node admin.portal.testscript/technical/test.matrix.db.import.mjs
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
import {
  importMatrixFromJson
, parseUnifiedMatrixJson
, summarizeImportSections
} from "../../cruscotto.database/matrix.db.import.mjs";
import { countMatrixRows } from "../../cruscotto.database/matrix.db.mjs";

const ROOT     = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const JSON_PATH = join(ROOT, "docs.portal", "matrix.portal.gap.json");

const tempDir = mkdtempSync(join(tmpdir(), "portal-admin-matrix-import-"));
const tempDb  = join(tempDir, "matrix-import.db");

process.env.CRUSCOTTO_DB_PATH = tempDb;

try {
  const payload = parseUnifiedMatrixJson(JSON_PATH);
  const summary = summarizeImportSections(payload.sections);

  if (summary.total < 40) {
    throw new Error(`JSON troppo piccolo: ${summary.total} righe`);
  }

  if (summary.obsolete < 10) {
    throw new Error(`obsolete attese ≥10, ottenute ${summary.obsolete}`);
  }

  const dryRun = await importMatrixFromJson({
    jsonPath: JSON_PATH
  , dryRun  : true
  });

  if (dryRun.rowCount !== summary.total) {
    throw new Error(`dry-run count: ${dryRun.rowCount} !== ${summary.total}`);
  }

  prepareCruscottoDatabaseUrl();
  execFileSync(process.execPath, ["cruscotto.database/migrate.mjs"], {
    cwd   : ROOT
  , stdio : "pipe"
  , env   : { ...process.env, CRUSCOTTO_DB_PATH: tempDb }
  });

  if (!existsSync(tempDb)) {
    throw new Error(`migrate non ha creato ${tempDb}`);
  }

  const first = await importMatrixFromJson({ jsonPath: JSON_PATH });
  const second = await importMatrixFromJson({ jsonPath: JSON_PATH });

  if (first.rowCount !== summary.total) {
    throw new Error(`import rowCount: ${first.rowCount} !== ${summary.total}`);
  }

  if (first.linksImported < 5) {
    throw new Error(`links importati: ${first.linksImported}`);
  }

  const rowCountAfter = await countMatrixRows("portal_gap");

  if (rowCountAfter !== summary.total) {
    throw new Error(`DB count: ${rowCountAfter} !== ${summary.total}`);
  }

  if (second.rowStats?.inserted !== 0) {
    throw new Error(`re-import non idempotente: ${second.rowStats?.inserted} insert`);
  }

  console.log("OK test-matrix-db-import");
  console.log(`  json rows: ${summary.total} (${summary.obsolete} obsolete)`);
  console.log(`  db rows: ${rowCountAfter}`);
  console.log(`  links: ${first.linksImported}`);
} catch (err) {
  console.error("FAIL test-matrix-db-import:", err instanceof Error ? err.message : err);
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
