#!/usr/bin/env node
/**
 * Seed idempotente matrix_catalog da AUDIT_CATALOG + AUDIT_SECTION_DEFS.
 *
 * Uso:
 *   node cruscotto.database/matrix.catalog.seed.mjs
 *   node cruscotto.database/matrix.catalog.seed.mjs --matrix-kind portal_gap
 */

import { AUDIT_CATALOG } from "../docs.portal.lib/matrix.repo.audit.mjs";
import { openCruscottoDb } from "./cruscotto.db.config.mjs";

const DEFAULT_MATRIX_KIND = "portal_gap";

/**
 * @param {string[]} argv
 * @returns {string}
 */
function parseMatrixKind(argv) {
  const idx = argv.indexOf("--matrix-kind");

  if (idx === -1 || !argv[idx + 1]) {
    return DEFAULT_MATRIX_KIND;
  }

  return String(argv[idx + 1]).trim();
}

/**
 * @param {import("@prisma/client").PrismaClient} db
 * @param {string} matrixKind
 * @returns {Promise<{ inserted: number, updated: number, total: number }>}
 */
export async function seedMatrixCatalog(db, matrixKind = DEFAULT_MATRIX_KIND) {
  let inserted = 0;
  let updated  = 0;

  for (const entry of AUDIT_CATALOG) {
    const defaultVoce = entry.fallback?.voce ?? entry.id;
    const auditEntryJson = JSON.stringify({
      section  : entry.section
    , scanIds  : entry.scanIds ?? []
    , fallback : entry.fallback ?? null
    , create   : entry.create ?? null
    });

    const data = {
      matrixKind
    , sectionId      : entry.section
    , defaultVoce    : defaultVoce
    , scanIdsJson    : JSON.stringify(entry.scanIds ?? [])
    , auditEntryJson
    };

    const existing = await db.matrixCatalog.findUnique({
      where: { findingId: entry.id }
    });

    if (existing) {
      await db.matrixCatalog.update({
        where: { findingId: entry.id }
      , data
      });
      updated += 1;
    } else {
      await db.matrixCatalog.create({
        data: {
          findingId: entry.id
        , ...data
        }
      });
      inserted += 1;
    }
  }

  return {
    inserted
  , updated
  , total: AUDIT_CATALOG.length
  };
}

/**
 * @param {string} [matrixKind]
 */
export async function runMatrixCatalogSeed(matrixKind = DEFAULT_MATRIX_KIND) {
  const db     = await openCruscottoDb();
  const result = await seedMatrixCatalog(db, matrixKind);

  return result;
}

const isMain = process.argv[1]
  && process.argv[1].replace(/\\/g, "/").endsWith("matrix.catalog.seed.mjs");

if (isMain) {
  const matrixKind = parseMatrixKind(process.argv.slice(2));

  try {
    const result = await runMatrixCatalogSeed(matrixKind);

    console.log("OK matrix-catalog-seed");
    console.log(`  matrix_kind: ${matrixKind}`);
    console.log(`  catalog: ${result.total} voci (${result.inserted} insert, ${result.updated} update)`);
  } catch (err) {
    console.error("FAIL matrix-catalog-seed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
