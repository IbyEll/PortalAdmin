/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:05   by: IbyEll
 * modificato il: 2026-06-23 21:05   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Segnali implementazione repo — overlay AdminDashBoard (ticket ADMIN-*).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Chiudi story e gap analysis richiedono catalogo path/test per ticket ADMIN nel repo host.
 *
 *   A cosa serve:
 *   - Elenco PRODUCT_REPO_SIGNALS aggregato in jira.project.config overlay per close-story.
 *
 * Generalizzazione:
 *   No — segnali path fissi su codebase PortalAdmin e ticket ADMIN.
 *
 * Input:
 *   - —
 *
 * Consumatori:
 *   - admin.portal.JiraCORE/jira.project.config.overlay.mjs — REPO_IMPLEMENTATION_SIGNALS
 *   - admin.portal.JiraCORE/jiraCORE.close.story.mjs — aggiornamento catalogo in chiusura
 *
 * Export principali:
 *   - PRODUCT_REPO_SIGNALS — array key, label, paths, tests opzionali
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */
export const PRODUCT_REPO_SIGNALS = [
  {
    key   : "ADMIN-81"
  , label : "Schema SQLite cruscotto"
  , paths : [
      "cruscotto.database/prisma/schema.prisma"
    , "cruscotto.database/cruscotto.db.config.mjs"
    ]
  }
, {
    key   : "ADMIN-99"
  , label : "Cruscotto DB sync + loadJiraBacklog"
  , paths : [
      "admin.portal.JiraCORE/jiraCORE.backlog.load.mjs"
      , "test.smoke/smoke-cruscotto-db.mjs"
      , "cruscotto.database/Jira.backlog.sync.mjs"
      , "admin.portal.JiraCORE/jiraCORE.backlog.sync.mjs"
    ]
  }
, {
    key   : "ADMIN-100"
  , label : "E2E portal smoke + go-live checklist"
  , paths : ["test.smoke/smoke-portal-e2e.mjs"]
  , tests : ["admin/test-portal-smoke.mjs"]
  }
, {
    key   : "ADMIN-96"
  , label : "smoke test:workflow + README workflow Cursor"
  , paths : [
      "admin.portal.JiraCORE/jiraCORE.wip.close-subtask.mjs"
      , "admin.portal.JiraCORE/jiraCORE.wip.push.mjs"
      , "admin.portal.testscript/cursor/test.cruscotto.backlog.push.mjs"
      , "admin.portal.testscript/funzionali/test.cruscotto.backlog.gogo.mjs"
    ]
  }
, {
    key   : "ADMIN-95"
  , label : "Badge README build status"
  , paths : ["test.smoke/smoke-ci.mjs"]
  }
, {
    key   : "ADMIN-97"
  , label : "cursor rule"
  , paths : ["admin.portal.testscript/lib/http.mjs"]
  }
, {
    key   : "ADMIN-82"
  , label : "fix portal.paths import in pillar-matrix-targeted"
  , paths : ["admin.portal.JiraCORE/jiraCORE.backlog.sync.mjs"]
  }

, {
    key   : "ADMIN-154"
  , label : "bACKLOG + iSSUE vIEW"
  , paths : ["test.smoke/smoke-paths-resolver.mjs"]
  }

, {
    key   : "ADMIN-155"
  , label : "allinea commenti al path canonico cruscotto.server.mjs"
  , paths : ["admin.portal.JiraCORE/jiraCORE.workflow.description.mjs"]
  }

, {
    key   : "ADMIN-98"
  , label : "ok"
  , paths : ["test.smoke/smoke-pillar-matrix-paths.mjs"]
  }

, {
    key   : "ADMIN-157"
  , label : "Fix WIP resync commitHash da main..branch e parent branch tip."
  , paths : ["admin.portal.JiraCORE/jiraCORE.veve.sync.log.backlog.mjs"]
  }

, {
    key   : "ADMIN-156"
  , label : "elimina consumer residui portal-paths shim"
  , paths : [
      "admin.portal.testscript/cursor/test.cruscotto.backlog.push.mjs"
      , "admin.portal.testscript/technical/test.matrix.db.adapter.mjs"
    ]
  , tests : ["cursor/test.cruscotto.backlog.push.mjs"]
  }

, {
    key   : "ADMIN-168"
  , label : "CI job AdminDashBoard + smoke admin:home"
  , paths : [
      ".github/workflows/portal-smoke.yml"
    , "test.smoke/smoke-home.mjs"
    , "package.json"
    ]
  , tests : ["test.smoke/smoke-home.mjs"]
  }

, {
    key   : "ADMIN-169"
  , label : "fix"
  , paths : ["admin.portal.testscript/technical/test.matrix.db.mjs"]
  }

, {
    key   : "ADMIN-171"
  , label : "fix mybacklog"
  , paths : [
      "cruscotto.database/prisma/schema.prisma"
    , "cruscotto.database/prisma/migrations/20260709030000_matrix_tables/migration.sql"
    ]
  }

, {
    key   : "ADMIN-172"
  , label : "matrix.db persistence layer"
  , paths : [
      "cruscotto.database/matrix.db.mjs"
    , "cruscotto.database/matrix.db.import.mjs"
    , "docs.portal.lib/matrix.finding-issues.store.mjs"
    , "docs.portal.lib/matrix.persist.config.mjs"
    ]
  , tests : [
      "admin.portal.testscript/technical/test.matrix.db.mjs"
    , "admin.portal.testscript/technical/test.matrix.db.import.mjs"
    , "admin.portal.testscript/technical/test.matrix.persist.parity.mjs"
    ]
  }

, {
    key   : "ADMIN-173"
  , label : "Wire matrix finding-issue and regenerate routes to cruscotto.database service."
  , paths : [
      "admin.portal.testscript/technical/test.matrix.api.e2e.mjs"
      , "cruscotto.database/matrix.api.service.mjs"
    ]
  , tests : ["technical/test.matrix.api.e2e.mjs"]
  }

, {
    key   : "ADMIN-174"
  , label : "fix"
  , paths : ["cruscotto.database/matrix.db.mjs"]
  }

, {
    key   : "ADMIN-195"
  , label : "OTRERS"
  , paths : ["admin.portal.JiraCORE/jira.project.config.mjs"]
  }

, {
    key   : "ADMIN-196"
  , label : "Guard Jira scan config against phantom server/ and scripts/ paths"
  , paths : [
      "admin.portal.JiraCORE/jira.project.config.mjs"
    , "admin.portal.JiraCORE/jira.function.repo.refs.mjs"
    ]
  }

, {
    key   : "ADMIN-197"
  , label : "Add technical test for portal API read-only suite endpoint."
  , paths : [
      "admin.portal.lib/portal.api.suite.mjs"
    , "admin.portal.testscript/technical/test.portal.api.suite.mjs"
    , "admin.portal.testscript/run-portal-api.mjs"
    , "test.smoke/smoke-portal-api.mjs"
    ]
  , tests : ["technical/test.portal.api.suite.mjs"]
  }

];
