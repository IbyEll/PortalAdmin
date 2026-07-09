#!/usr/bin/env node
/**
 * Test seed idempotente matrix_catalog da AUDIT_CATALOG.
 *
 * Uso:
 *   node admin.portal.testscript/technical/test.matrix.catalog.seed.mjs
 */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { AUDIT_CATALOG } from "../../docs.portal.lib/matrix.repo.audit.mjs";
import {
  closeCruscottoDb
, openCruscottoDb
, prepareCruscottoDatabaseUrl
} from "../../cruscotto.database/cruscotto.db.config.mjs";
import { seedMatrixCatalog } from "../../cruscotto.database/matrix.catalog.seed.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const tempDir = mkdtempSync(join(tmpdir(), "portal-admin-matrix-seed-"));
const tempDb  = join(tempDir, "matrix-seed.db");

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

  const first = await seedMatrixCatalog(db, "portal_gap");

  if (first.inserted !== AUDIT_CATALOG.length) {
    throw new Error(`primo seed: attesi ${AUDIT_CATALOG.length} insert, ottenuti ${first.inserted}`);
  }

  const countAfterFirst = await db.matrixCatalog.count();

  if (countAfterFirst < AUDIT_CATALOG.length) {
    throw new Error(`count catalogo ${countAfterFirst} < ${AUDIT_CATALOG.length}`);
  }

  const second = await seedMatrixCatalog(db, "portal_gap");

  if (second.inserted !== 0 || second.updated !== AUDIT_CATALOG.length) {
    throw new Error(`re-run seed: attesi 0 insert e ${AUDIT_CATALOG.length} update`);
  }

  const countAfterSecond = await db.matrixCatalog.count();

  if (countAfterSecond !== countAfterFirst) {
    throw new Error(`duplicati dopo re-run: ${countAfterFirst} → ${countAfterSecond}`);
  }

  console.log("OK test-matrix-catalog-seed");
  console.log(`  db: ${tempDb}`);
  console.log(`  catalog: ${countAfterSecond} voci (idempotente)`);
} catch (err) {
  console.error("FAIL test-matrix-catalog-seed:", err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await closeCruscottoDb();
  delete process.env.CRUSCOTTO_DB_PATH;

  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Windows: cleanup best-effort
  }
}
