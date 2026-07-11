/**
 * Sezioni matrice docs — titoli card, categorie ed etichetta Jira per pulsante Crea.
 */

import {
  MATRIX_KIND_PORTAL_GAP
, MATRIX_KIND_TEST_COVERAGE
} from "../cruscotto.database/matrix.db.mjs";

/** Etichetta visibile pulsante CREA per matrix_kind. */
export const MATRIX_KIND_CREATE_LABELS = {
  [MATRIX_KIND_PORTAL_GAP]    : "[Matrix GAP]"
, [MATRIX_KIND_TEST_COVERAGE] : "[Matrix TEST]"
};

/**
 * @param {string | null | undefined} matrixKind
 * @returns {string}
 */
export function formatMatrixKindCreateLabel(matrixKind) {
  const kind = String(matrixKind ?? MATRIX_KIND_PORTAL_GAP).trim();

  return MATRIX_KIND_CREATE_LABELS[kind] ?? "[Matrix]";
}

/** @type {Record<string, string>} */
export const MATRIX_SECTION_TITLES = {
  arch         : "Architettura e avanzamento"
, gap          : "Gap analysis"
, bug          : "Bug"
, deprecation  : "Deprecation / drift"
, feature      : "Feature completate"
, miglioramento: "Miglioramenti suggeriti"
};

/** @deprecated usare MATRIX_SECTION_TITLES */
export const ADVANCEMENT_SECTION_TITLES = MATRIX_SECTION_TITLES;

/**
 * @param {string} sectionTitle
 * @returns {string}
 */
export function formatMatrixSectionLabel(sectionTitle) {
  const t = String(sectionTitle ?? "Matrice").trim();

  return `[ ${t} ]`;
}

/** @deprecated */
export const formatAdvancementSectionLabel = formatMatrixSectionLabel;

/**
 * Etichetta Jira (no spazi) dalla sezione — es. `[ Bug ]` → `[Bug]`.
 *
 * @param {string} sectionTitleOrLabel
 * @returns {string}
 */
export function jiraLabelForMatrixSection(sectionTitleOrLabel) {
  let inner = String(sectionTitleOrLabel ?? "Matrice").trim();
  const bracketed = /^\[(.*)\]$/s.exec(inner);

  if (bracketed) {
    inner = bracketed[1].trim();
  }

  const slug = inner
    .replace(/\s+/g, "-")
    .replace(/\//g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `[${slug || "Matrice"}]`;
}

/** @deprecated */
export const jiraLabelForAdvancementSection = jiraLabelForMatrixSection;

/**
 * @param {string} category
 * @returns {string}
 */
export function sectionTitleForCategory(category) {
  /** @type {Record<string, string>} */
  const byCategory = {
    avanzamento  : MATRIX_SECTION_TITLES.arch
  , architettura : MATRIX_SECTION_TITLES.arch
  , gap          : MATRIX_SECTION_TITLES.gap
  , bug          : MATRIX_SECTION_TITLES.bug
  , deprecation  : MATRIX_SECTION_TITLES.deprecation
  , feature      : MATRIX_SECTION_TITLES.feature
  , miglioramento: MATRIX_SECTION_TITLES.miglioramento
  };

  return byCategory[category] ?? "Matrice";
}

/**
 * @param {string} sectionKey
 * @returns {string}
 */
export function sectionTitleForKey(sectionKey) {
  return MATRIX_SECTION_TITLES[sectionKey] ?? "Matrice";
}

/**
 * @param {string} [sectionTitleOrLabel]
 * @returns {string}
 */
export function categoryFromSectionTitle(sectionTitleOrLabel) {
  let inner = String(sectionTitleOrLabel ?? "").trim();
  const bracketed = /^\[(.*)\]$/s.exec(inner);

  if (bracketed) {
    inner = bracketed[1].trim();
  }

  const key = inner.toLowerCase();

  if (key === "bug") {
    return "bug";
  }

  if (key.includes("gap")) {
    return "gap";
  }

  if (key.includes("deprecation") || key.includes("drift")) {
    return "deprecation";
  }

  if (key.includes("migliorament")) {
    return "miglioramento";
  }

  if (key.includes("architettura") || key.includes("avanzamento")) {
    return "architettura";
  }

  if (key.includes("feature")) {
    return "feature";
  }

  if (key.includes("test") || key.includes("copertura")) {
    return "gap";
  }

  return "gap";
}
