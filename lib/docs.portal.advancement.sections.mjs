/**
 * Sezioni pagina Avanzamento — titoli card e etichetta Jira.
 */

/** @type {Record<string, string>} */
export const ADVANCEMENT_SECTION_TITLES = {
  arch         : "Architettura e avanzamento"
, gap          : "Gap analysis"
, bug          : "Bug"
, deprecation  : "Deprecation / drift"
, feature      : "Feature completate"
, miglioramento: "Miglioramenti suggeriti"
};

/**
 * @param {string} sectionTitle
 * @returns {string}
 */
export function formatAdvancementSectionLabel(sectionTitle) {
  const t = String(sectionTitle ?? "Avanzamento").trim();

  return `[ ${t} ]`;
}

/**
 * @param {string} category
 * @returns {string}
 */
export function sectionTitleForCategory(category) {
  /** @type {Record<string, string>} */
  const byCategory = {
    avanzamento  : ADVANCEMENT_SECTION_TITLES.arch
  , architettura : ADVANCEMENT_SECTION_TITLES.arch
  , gap          : ADVANCEMENT_SECTION_TITLES.gap
  , bug          : ADVANCEMENT_SECTION_TITLES.bug
  , deprecation  : ADVANCEMENT_SECTION_TITLES.deprecation
  , feature      : ADVANCEMENT_SECTION_TITLES.feature
  , miglioramento: ADVANCEMENT_SECTION_TITLES.miglioramento
  };

  return byCategory[category] ?? "Avanzamento";
}

/**
 * @param {string} sectionKey
 * @returns {string}
 */
export function sectionTitleForKey(sectionKey) {
  return ADVANCEMENT_SECTION_TITLES[sectionKey] ?? "Avanzamento";
}
