/**
 * Intestazioni colonne tabella matrice — condivise tra portal_gap e test_coverage.
 *
 * Consumatori:
 *   - docs.portal.lib/matrix.render.mjs
 *   - docs.portal.lib/matrix.test-coverage.meta.mjs
 *   - docs.portal.lib/matrix.db.adapter.mjs
 */

/** Colonne standard righe MatrixRow (Sev → Stato). */
export const MATRIX_TABLE_COLUMNS = [
  "Sev"
, "Issue refinement"
, "Project"
, "Voce"
, "Dettaglio"
, "Path"
, "Stato"
];

/** @deprecated alias — usare MATRIX_TABLE_COLUMNS */
export const MATRIX_DEFAULT_COLUMNS = MATRIX_TABLE_COLUMNS;

/** @deprecated alias test coverage — stesse colonne di portal_gap */
export const TEST_COVERAGE_COLUMNS = MATRIX_TABLE_COLUMNS;
