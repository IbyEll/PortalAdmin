/**
 * Segnali implementazione repo — overlay AdminDashBoard (ADMIN-*).
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

];
