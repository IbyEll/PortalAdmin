/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:05   by: IbyEll
 * modificato il: 2026-06-23 21:05   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Segnali implementazione repo — product JustLastOne (ticket JLO-*).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Chiudi story e gap analysis nel product repo richiedono catalogo path per ticket JLO.
 *
 *   A cosa serve:
 *   - PRODUCT_REPO_SIGNALS aggregato in portal.config per close-story workflow JLO.
 *
 * Generalizzazione:
 *   No — segnali path fissi su codebase JustLastOne e prefisso JLO.
 *
 * Input:
 *   - —
 *
 * Consumatori:
 *   - admin.portal.JiraCORE/jira.project.config.overlay.mjs — merge segnali product
 *   - admin.portal.JiraCORE/jiraCORE.close.story.mjs — aggiornamento catalogo chiusura
 *
 * Export principali:
 *   - PRODUCT_REPO_SIGNALS — array key, label, paths, tests opzionali
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */
export const PRODUCT_REPO_SIGNALS = [
  {
    key   : "JLO-850"
  , label : "Runner run-all"
  , paths : ["runner/run-all.mjs"]
  , tests : ["dashboard/test-dev-cruscotto.mjs"]
  }
, {
    key   : "JLO-851"
  , label : "Report HTML/JSON"
  , paths : ["report/test-reporter.mjs", "lib/reporter.mjs"]
  }
, {
    key   : "JLO-852"
  , label : "Dashboard server"
  , paths : ["server/dashboard-server.mjs", "cruscotto/index.html"]
  }
, {
    key   : "JLO-913"
  , label : "Cruscotto Dev UI"
  , paths : [
      "server/dashboard-server.mjs"
      , "lib/product.manifest.mjs"
    ]
  , tests : ["dashboard/test-dev-cruscotto.mjs"]
  }
, {
    key   : "JLO-690"
  , label : "Cancel host match"
  , paths : ["apps/api/src/matches/match-lifecycle.service.ts"]
  , tests : ["match/test-match-host-cancel-recruiting.mjs"]
  }
, {
    key   : "JLO-97"
  , label : "Creazione torneo"
  , paths : [
      "apps/api/src/tournaments/tournaments.controller.ts"
    , "apps/web/src/components/Tournements/CreateTournamentForm.tsx"
    ]
  , tests : ["tournament/test-tournaments-api.mjs"]
  }
, {
    key   : "JLO-247"
  , label : "Lista tornei + filtri"
  , paths : [
      "apps/web/src/components/Tournements/TournamentsContent.tsx"
    , "apps/api/src/tournaments/tournaments.service.ts"
    ]
  , tests : ["tournament/test-tournaments-api.mjs"]
  }
, {
    key   : "JLO-637"
  , label : "Gamer profile epic"
  , paths : [
      "apps/api/src/game-profile/game-profile.controller.ts"
    , "apps/web/src/components/Profile/GamerWorldActivityPanel.tsx"
    ]
  , tests : ["profile/test-gamer-profile-api.mjs"]
  }
, {
    key   : "JLO-846"
  , label : "Gap test auth/API health"
  , paths : [
      "apps/api/src/health.controller.ts"
    , "testScript/auth/test-login.mjs"
    ]
  , tests : ["auth/test-login.mjs"]
  }
, {
    key   : "JLO-930"
  , label : "Export Excel report"
  , paths : ["export/export-report.mjs"]
  }
, {
    key   : "JLO-711"
  , label : "Notifiche match legacy FuoriScope"
  , paths : ["apps/api/src/notifications/match-notification.listener.ts"]
  , tests : [
      "notifications/test-notifications-cancel.mjs"
    , "notifications/test-notifications-lifecycle.mjs"
    ]
  }
, {
    key   : "JLO-769"
  , label : "Backend notifiche eventi match"
  , paths : [
      "apps/api/src/notifications/match-notification.listener.ts"
    , "apps/api/src/notifications/match-reminder-scheduler.service.ts"
    , "apps/api/src/notifications/notifications.service.ts"
    ]
  }
, {
    key   : "JLO-772"
  , label : "Test notifiche cancel match"
  , paths : ["testScript/notifications/test-notifications-cancel.mjs"]
  , tests : ["notifications/test-notifications-cancel.mjs"]
  }
, {
    key   : "JLO-771"
  , label : "Web preferenze notifiche"
  , paths : [
      "apps/web/src/components/Profile/NotificationPreferencesSection.tsx"
    , "apps/web/src/lib/notifications-api.ts"
    ]
  }
, {
    key   : "JLO-770"
  , label : "Infra SMTP mail match"
  , paths : ["packages/mail/src/mail.service.ts"]
  }
, {
    key   : "JLO-773"
  , label : "Notifiche P0 epic"
  , paths : ["packages/database/prisma/schema.prisma"]
  }
, {
    key   : "JLO-774"
  , label : "Schema Notification"
  , paths : ["packages/database/prisma/schema.prisma"]
  }
, {
    key   : "JLO-696"
  , label : "BracketMatch API"
  , paths : ["apps/api/src/tournaments"]
  }
, {
    key   : "JLO-552"
  , label : "API follow"
  , paths : ["apps/api/src/social"]
  }
, {
    key   : "JLO-3"
  , label : "Tornei Kill Race epic"
  , paths : ["apps/api/src/tournaments"]
  }

, {
    key   : "JLO-6"
  , label : "Merge pull request #37 from IbyEll/JLO-699-cancelled-vs-closed"
  , paths : [
      "apps/web/src"
      , "testScript"
      , "apps/api/src"
      , "packages/i18n/locales"
      , "packages/shared/src"
    ]
  , tests : ["match/test-matches-create-rules.mjs"]
  }

, {
    key   : "JLO-100"
  , label : "iscrizione torneo"
  , paths : [
      "apps/api/src/tournaments/tournaments.service.ts"
      , "apps/web/src/lib/tournaments-api.ts"
    ]
  , tests : ["tournament/test-tournament-join-api.mjs"]
  }

, {
    key   : "JLO-103"
  , label : "generazione bracket automatico"
  , paths : [
      "apps/api/src/tournaments/bracket.service.ts"
      , "apps/api/src/tournaments/bracket-matches.controller.ts"
    ]
  , tests : ["tournament/test-tournament-bracket-api.mjs"]
  }

, {
    key   : "JLO-256"
  , label : "avvio torneo"
  , paths : ["apps/api/src/tournaments/tournaments.service.ts"]
  , tests : ["tournament/test-tournament-start-api.mjs"]
  }

, {
    key   : "JLO-257"
  , label : "sicurezza permessi torneo"
  , paths : ["apps/api/src/tournaments/tournament-organizer.ts"]
  , tests : ["tournament/test-tournament-organizer-auth.mjs"]
  }

, {
    key   : "JLO-500"
  , label : "integrazione torneo kill race"
  , paths : [
      "apps/api/src/tournaments"
      , "testScript/tournament"
    ]
  }

, {
    key   : "JLO-775"
  , label : "notifica cancel match"
  , paths : [
      "apps/web/src"
      , "apps/api/src"
      , "apps/authentication/src"
      , "packages/shared/src"
      , "packages/database/prisma"
      , "Admin"
    ]
  }

, {
    key   : "JLO-776"
  , label : "notifiche fase 2 lifecycle"
  , paths : [
      "apps/web/src"
      , "apps/api/src"
      , "apps/authentication/src"
      , "packages/database/prisma"
      , "packages/shared/src"
      , "Admin"
    ]
  }

, {
    key   : "JLO-779"
  , label : "Prisma Notification model and Match.closedReason"
  , paths : ["packages/database/prisma"]
  }

, {
    key   : "JLO-780"
  , label : "closedReason in MatchLifecycleService and lifecycle tests"
  , paths : [
      "apps/api/src"
      , "testScript/match/test-match-cancelled-vs-closed.mjs"
      , "testScript/match/test-match-lifecycle.mjs"
    ]
  }

, {
    key   : "JLO-781"
  , label : "Extract packages/mail from apps/authentication"
  , paths : [
      "apps/authentication/src"
      , "packages/mail/src"
      , "apps/authentication/package.json"
      , "packages/mail/package.json"
      , "packages/mail/tsconfig.json"
    ]
  }

, {
    key   : "JLO-784"
  , label : "NotificationsModule and NotificationsService foundation"
  , paths : [
      "apps/api/src"
      , "apps/api/package.json"
      , "packages/shared/src"
    ]
  }

, {
    key   : "JLO-785"
  , label : "Listener match.cancelled_by_host on host cancel"
  , paths : ["apps/api/src"]
  }

, {
    key   : "JLO-786"
  , label : "REST API notifications list unread read"
  , paths : ["apps/api/src"]
  }

, {
    key   : "JLO-896"
  , label : "user testata logout body"
  , paths : [
      "apps/web/src"
      , "apps/api/src"
      , "packages/shared/src"
      , "testScript"
      , "packages/i18n/locales"
      , "packages/database/prisma"
    ]
  }

, {
    key   : "JLO-924"
  , label : "voice chat language create match"
  , paths : [
      "apps/web/src"
      , "apps/api/src"
      , "packages/shared/src"
      , "packages/database/prisma"
      , "Admin"
      , "packages/i18n/locales"
    ]
  }

, {
    key   : "JLO-931"
  , label : "Generatore xlsx export report da latest.json"
  , paths : ["export/export-report.mjs"]
  }

, {
    key   : "JLO-932"
  , label : "API endpoint export Excel e JSON"
  , paths : ["server/dashboard-server.mjs"]
  }

, {
    key   : "JLO-933"
  , label : "Bottone export Excel/JSON nel cruscotto"
  , paths : [
      "cruscotto/cruscotto.js"
      , "testScript/dashboard/test-dev-cruscotto.mjs"
    ]
  }

, {
    key   : "JLO-535"
  , label : "Jira Actio create sprint 9"
  , paths : [
      "apps/api/src"
      , "apps/web/src"
      , "packages/shared/src"
      , "apps/authentication/src"
      , "packages/database/prisma"
      , "packages/i18n/locales"
    ]
  }

, {
    key   : "JLO-536"
  , label : "cruscotto note"
  , paths : [
      "apps/api/src"
      , "apps/web/src"
      , "packages/shared/src"
      , "apps/authentication/src"
      , "packages/database/prisma"
      , "packages/i18n/locales"
    ]
  }

, {
    key   : "JLO-507"
  , label : "backlog page"
  , paths : [
      "apps/web/src"
      , "apps/api/src"
      , "packages/shared/src"
      , "packages/database/prisma"
      , "packages/i18n/locales"
      , "cruscotto.frontend/cruscotto.jira.backlog.insights.mjs"
    ]
  }

, {
    key   : "JLO-533"
  , label : "PostCard e SocialFeedSection"
  , paths : [
      "apps/web/src"
      , "apps/api/src"
      , "packages/shared/src"
      , "packages/database/prisma"
      , "packages/i18n/locales"
      , "cruscotto.frontend/cruscotto.jira.backlog.insights.mjs"
    ]
  }

, {
    key   : "JLO-952"
  , label : "gitignore file"
  , paths : [
      "apps/web/src"
      , "apps/api/src"
      , "packages/database/prisma"
      , "packages/shared/src"
      , "packages/i18n/locales"
      , "cruscotto.frontend/cruscotto.jira.backlog.insights.mjs"
    ]
  }

, {
    key   : "JLO-290"
  , label : "testScript chat DM API"
  , paths : [
      "apps/web/src"
      , "apps/api/src"
      , "packages/shared/src"
      , "packages/database/prisma"
      , "packages/i18n/locales"
      , "cruscotto.frontend/cruscotto.jira.backlog.insights.mjs"
    ]
  }

, {
    key   : "JLO-981"
  , label : "cruscotto TestFunzionali"
  , paths : [
      "apps/web/src"
      , "apps/api/src"
      , "packages/shared/src"
      , "packages/database/prisma"
      , "packages/i18n/locales"
      , "testScript/funzionali/lib"
    ]
  , tests : ["social/test-friends-page.mjs"]
  }

, {
    key   : "JLO-989"
  , label : "Verifica manuale run suite da cruscotto TestFunzionali"
  , paths : [
      "apps/web/src"
      , "apps/api/src"
      , "packages/shared/src"
      , "packages/database/prisma"
      , "packages/i18n/locales"
      , "testScript/funzionali/lib"
    ]
  }

, {
    key   : "JLO-998"
  , label : "Friend bot dev seed daemon test funzionale"
  , paths : [
      "testScript/funzionali/lib/friend-bot-user.mjs"
      , "testScript/funzionali/lib/friend-bot-actions.mjs"
      , "testScript/funzionali/friend-bot.mjs"
      , "testScript/funzionali/test-friend-bot.mjs"
      , "testScript/funzionali/run-funzionali.mjs"
      , "lib/JustLastOne___test-funzionali-meta.mjs"
      , "server/run-manager.mjs"
      , "cruscotto.frontend/cruscotto.runner.stack.base.mjs"
      , "cruscotto.frontend/cruscotto.runner.stack.mjs"
      , "cruscotto.frontend/cruscotto.process.start.service.mjs"
      , "cruscotto.frontend/cruscotto.process.start.service.ps1"
      , "runner/runner.config.stack.mjs"
      , "lib/seed-cli-args.mjs"
      , "cruscotto.database/script_seed/script_seed-lib.mjs"
      , "cruscotto.database/script_seed/init_Database_DEV.mjs"
      , "cruscotto.database/script_seed/run-data-seeds.mjs"
      , "cruscotto.frontend/cruscotto.api.documentation.server.mjs"
    ]
  , tests : ["funzionali/test-friend-bot.mjs"]
  }

, {
    key   : "JLO-299"
  , label : "…306 Lobby chat testo match — sync conversazione, permessi, API, UI, notifiche, testScript"
  , paths : [
      "apps/web/src"
      , "apps/api/src"
      , "packages/database/prisma"
      , "testScript/funzionali/lib"
      , "packages/shared/src"
      , "packages/i18n/locales"
    ]
  }

, {
    key   : "JLO-959"
  , label : "Confluence Piillar"
  , paths : [
      "apps/web/src"
      , "apps/api/src"
      , "packages/database/prisma"
      , "packages/shared/src"
      , "testScript/funzionali/lib"
      , "packages/i18n/locales"
    ]
  }

, {
    key   : "JLO-960"
  , label : "cursor rule"
  , paths : [
      "apps/web/src"
      , "apps/api/src"
      , "packages/shared/src"
      , "testScript/funzionali/lib"
      , "packages/database/prisma"
      , "packages/i18n/locales"
    ]
  }
];
