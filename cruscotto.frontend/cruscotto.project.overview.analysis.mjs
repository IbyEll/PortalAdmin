/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:30
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:30   by: IbyEll
 * modificato il: 2026-06-23 21:30   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Project Overview — analisi sintetica repo vs Jira (6 sezioni fisse per overlay).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Vista dashboard più leggera di My Project: avanzamento, backlog embed, sintesi e gap.
 *
 *   A cosa serve:
 *   - buildProjectOverviewPayload filtra e rinomina sezioni da payload analyzeMyProject.
 *
 * Generalizzazione:
 *   Si — titoli e backlog embed parametrizzati su PRJ_NAME overlay attivo.
 *
 * Input:
 *   - Payload analyzeMyProject — da admin.portal.lib/dashboard.project.mjs overlay-aware
 *
 * Consumatori:
 *   - admin.portal.lib/dashboard.project.mjs — GET /api/project-overview/analyze
 *   - PROJECT_Base/page.project.overview.mjs — re-export overlay Base
 *   - cruscotto.frontend/cruscotto.project.overview.html — render sezioni
 *
 * Export principali:
 *   - buildProjectOverviewPayload — payload JSON overview a 6 sezioni
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

/** Ordine canonico sezioni overview. */
const OVERVIEW_SECTION_ORDER = [
  "jira-status"
, "backlog-full"
, "intro"
, "repo-summary"
, "last-test-run"
, "gap-open-no-repo"
];

/** @type {Record<string, string>} */
const SECTION_TITLE_BY_ID = {
  "jira-status"      : "Avanzamento Lavori"
, "intro"            : "Sintesi"
, "repo-summary"     : "Sintesi by repo"
, "last-test-run"    : "lastTestrun"
, "gap-open-no-repo" : "Gap"
};

/**
 * @param {Record<string, unknown>} section
 * @param {string} projectName
 * @returns {Record<string, unknown>}
 */
function mapOverviewSection(section, projectName) {
  const id = String(section.id ?? "");

  if (id === "backlog-full") {
    return {
      ...section
    , title : `backlogCompleta_${projectName}`
    };
  }

  const title = SECTION_TITLE_BY_ID[id] ?? String(section.title ?? id);

  return { ...section, title };
}

/**
 * @param {Record<string, unknown>} full
 * @returns {Record<string, unknown>}
 */
export function buildProjectOverviewPayload(full) {
  if (full.configured === false) {
    return full;
  }

  const projectName = String(full.overlay ?? "project");
  /** @type {Map<string, Record<string, unknown>>} */
  const byId = new Map(
    (Array.isArray(full.sections) ? full.sections : []).map((section) => [
      String(section.id ?? "")
    , section
    ])
  );

  const sections = OVERVIEW_SECTION_ORDER
    .map((id) => byId.get(id))
    .filter((section) => section != null)
    .map((section) => mapOverviewSection(section, projectName));

  return {
    ...full
  , pageKind : "project-overview"
  , sections
  };
}
