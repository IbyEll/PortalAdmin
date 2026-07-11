/**
 * Metadata sezioni matrice copertura test — ordine, titoli e colonne (senza DATA righe).
 */

export { MATRIX_TABLE_COLUMNS as TEST_COVERAGE_COLUMNS } from "./matrix.columns.mjs";

export const TEST_COVERAGE_SECTION_DEFS = [
  { id: "orch", title: "Orchestrazione", open: true }
, { id: "config", title: "Config, path, workflow (offline)" }
, { id: "db", title: "Cruscotto DB" }
, { id: "spa", title: "HTTP statico / SPA shell", open: true }
, { id: "apiHealth", title: "API — health / bootstrap" }
, { id: "apiDev", title: "API — dev / meta" }
, { id: "apiRepo", title: "API — repo services / Process", open: true }
, { id: "apiRun", title: "API — run / report" }
, { id: "apiJira", title: "API — Jira", open: true }
, { id: "apiPortal", title: "API — portal instance" }
, { id: "apiCursor", title: "API — Cursor agent" }
, { id: "apiHome", title: "Portal HOME" }
, { id: "funz", title: "Funzionali (fuori CI default)" }
];

export const TEST_COVERAGE_PRIORITY_SECTION = {
  id    : "priority"
, title : "Priorità backlog test"
, open  : true
};

export const TEST_COVERAGE_SECTION_ORDER = [
  ...TEST_COVERAGE_SECTION_DEFS.map((def) => def.id)
, TEST_COVERAGE_PRIORITY_SECTION.id
];

/** @type {Record<string, { id: string, title: string, open?: boolean }>} */
export const TEST_COVERAGE_SECTION_BY_ID = Object.fromEntries([
  ...TEST_COVERAGE_SECTION_DEFS.map((def) => [def.id, def])
, [TEST_COVERAGE_PRIORITY_SECTION.id, TEST_COVERAGE_PRIORITY_SECTION]
]);
