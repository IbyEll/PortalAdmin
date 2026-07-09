/**
 * Configurazione modalità persistenza matrici — MATRIX_PERSIST env.
 *
 * Valori:
 *   json — solo file JSON/HTML (default, retrocompatibile)
 *   db   — solo database cruscotto SQLite
 *   dual — scrive DB + JSON (transizione story ADMIN-172)
 */

/** @type {Set<string>} */
const VALID_MODES = new Set(["json", "db", "dual"]);

/**
 * @returns {"json" | "db" | "dual"}
 */
export function resolveMatrixPersistMode() {
  const raw = String(process.env.MATRIX_PERSIST ?? "json").trim().toLowerCase();

  return VALID_MODES.has(raw) ? /** @type {"json" | "db" | "dual"} */ (raw) : "json";
}

/**
 * @returns {boolean}
 */
export function shouldWriteMatrixJson() {
  const mode = resolveMatrixPersistMode();

  return mode === "json" || mode === "dual";
}

/**
 * @returns {boolean}
 */
export function shouldWriteMatrixDb() {
  const mode = resolveMatrixPersistMode();

  return mode === "db" || mode === "dual";
}

/**
 * @returns {boolean}
 */
export function isMatrixDbPrimary() {
  return resolveMatrixPersistMode() === "db";
}
