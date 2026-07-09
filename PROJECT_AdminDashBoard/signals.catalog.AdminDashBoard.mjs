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
      "cruscotto.database/Jira.backlog.sync.mjs"
    , "cruscotto.database/load-backlog.mjs"
    , "admin.portal.JiraCORE/jiraCORE.backlog.sync.mjs"
    ]
  }
, {
    key   : "ADMIN-100"
  , label : "E2E portal smoke + go-live checklist"
  , paths : [
      "scripts/smoke-portal-e2e.mjs"
    , "docs/go-live-admin-88.md"
    , "docs/cruscotto-manual-checklist-it.md"
    ]
  , tests : ["admin/test-portal-smoke.mjs"]
  }
, {
    key   : "ADMIN-96"
  , label : "smoke test:workflow + README workflow Cursor"
  , paths : [
      "lib"
    , "scripts"
    , "server"
    ]
  }
, {
    key   : "ADMIN-95"
  , label : "Badge README build status"
  , paths : [
      "lib"
    , "scripts"
    , "server"
    ]
  }
, {
    key   : "ADMIN-97"
  , label : "cursor rule"
  , paths : [
      "lib"
    , "scripts"
    , "server"
    ]
  }
, {
    key   : "ADMIN-82"
  , label : "fix portal.paths import in pillar-matrix-targeted"
  , paths : [
      "lib"
      , "scripts"
      , "server"
      , "admin.portal.testscript"
    ]
  }

, {
    key   : "ADMIN-154"
  , label : "bACKLOG + iSSUE vIEW"
  , paths : [
      "lib"
      , "scripts"
      , "server"
      , "admin.portal.testscript"
    ]
  }

, {
    key   : "ADMIN-155"
  , label : "allinea commenti al path canonico cruscotto.server.mjs"
  , paths : [
      "lib"
      , "scripts"
      , "server"
      , "admin.portal.testscript"
    ]
  }

, {
    key   : "ADMIN-98"
  , label : "ok"
  , paths : [
      "lib"
      , "admin.portal.JiraCORE"
      , "scripts"
      , "admin.portal.lib"
      , "admin.script.standalone"
      , "test.smoke"
    ]
  }

, {
    key   : "ADMIN-157"
  , label : "Fix WIP resync commitHash da main..branch e parent branch tip."
  , paths : [
      "lib"
      , "admin.portal.JiraCORE"
      , "scripts"
      , "admin.portal.lib"
      , "admin.script.standalone"
      , "test.smoke"
    ]
  }

, {
    key   : "ADMIN-156"
  , label : "elimina consumer residui portal-paths shim"
  , paths : [
      "lib"
      , "admin.portal.JiraCORE"
      , "scripts"
      , "admin.portal.lib"
      , "test.smoke"
      , "admin.script.standalone"
    ]
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
  , paths : [
      "lib"
      , "admin.portal.JiraCORE"
      , "scripts"
      , "admin.portal.lib"
      , "test.smoke"
      , "admin.script.standalone"
    ]
  }

, {
    key   : "ADMIN-171"
  , label : "fix mybacklog"
  , paths : [
      "lib"
      , "admin.portal.JiraCORE"
      , "admin.portal.lib"
      , "test.smoke"
      , "admin.script.standalone"
      , "cruscotto.database"
    ]
  }

];
