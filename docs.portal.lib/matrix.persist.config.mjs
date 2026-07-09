/**
 * Configurazione modalità persistenza matrici — MATRIX_PERSIST env.
 *
 * Valori:
 *   json — solo file JSON/HTML (retrocompatibile esplicito)
 *   db   — solo database cruscotto SQLite (default post-migrazione se DB presente)
 *   dual — scrive DB + JSON (transizione story ADMIN-172)
 */

import { cruscottoDbFileExists } from "../cruscotto.database/cruscotto.db.config.mjs";

/** @type {Set<string>} */
const VALID_MODES = new Set(["json", "db", "dual"]);

/**
 * @returns {"json" | "db" | "dual"}
 */
export function resolveMatrixPersistMode() {
  const envRaw = String(process.env.MATRIX_PERSIST ?? "").trim().toLowerCase();

  if (envRaw && VALID_MODES.has(envRaw)) {
    return /** @type {"json" | "db" | "dual"} */ (envRaw);
  }

  if (cruscottoDbFileExists()) {
    return "db";
  }

  return "json";
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
