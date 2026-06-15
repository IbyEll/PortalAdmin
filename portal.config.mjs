/**
 * Configurazione PortalAdmin — segnali repo e progetti Jira (ADMIN-93).
 * Modifica questo file senza editare lib/jira-backlog-insights.mjs.
 */

/** @type {ReadonlyArray<string>} */
export const JIRA_PROJECT_KEYS = [
  "JLO"
, "ADMIN"
];

/**
 * Path noti per ticket JLO/ADMIN — estende scan citazioni nel product repo.
 */
export const REPO_IMPLEMENTATION_SIGNALS = [
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
      , "lib/dev-manifest.mjs"
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
      , "lib/jira-backlog-insights.mjs"
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
      , "lib/jira-backlog-insights.mjs"
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
      , "lib/jira-backlog-insights.mjs"
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
      , "lib/jira-backlog-insights.mjs"
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
      , "lib/test-funzionali-meta.mjs"
      , "server/run-manager.mjs"
      , "ellaStartScript/lib.mjs"
      , "ellaStartScript/start-dev.mjs"
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
, {
    key   : "ADMIN-81"
  , label : "Schema SQLite cruscotto"
  , paths : [
      "lib/cruscotto-db/prisma/schema.prisma"
    , "lib/cruscotto-db/index.mjs"
    ]
  }
, {
    key   : "ADMIN-99"
  , label : "Cruscotto DB sync + loadJiraBacklog"
  , paths : [
      "lib/cruscotto-db/sync-backlog.mjs"
    , "lib/cruscotto-db/load-backlog.mjs"
    , "scripts/sync-jira-backlog.mjs"
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

];

/**
 * @param {string} relPath
 * @returns {boolean}
 */
function repoPathExists(relPath) {
  const abs = join(REPO_ROOT, relPath);

  if (!existsSync(abs)) {
    return false;
  }

  try {
    const entries = readdirSync(abs);

    if (entries.length === 0) {
      return false;
    }

    const meaningful = entries.filter((name) => name !== ".gitkeep");

    return meaningful.length > 0;
  } catch {
    return true;
  }
}

/**
 * @param {{ paths: string[] }} signal
 * @returns {{ found: string[], missing: string[], complete: boolean }}
 */
function scanSignalPaths(signal) {
  const paths = signal.paths.filter(isMeaningfulCitationPath);

  /** @type {string[]} */
  const found = [];
  /** @type {string[]} */
  const missing = [];

  if (paths.length === 0) {
    return { found, missing, complete: false };
  }

  for (const rel of paths) {
    if (repoPathExists(rel)) {
      found.push(rel);
    } else {
      missing.push(rel);
    }
  }

  return {
    found,
    missing,
    complete: missing.length === 0 && found.length > 0,
  };
}

/**
 * @returns {{ generatedAt: string | null, passed: number, failed: number, scripts: Map<string, { ok: boolean, failed: number }> }}
 */
function loadTestReportSummary() {
  /** @type {Map<string, { ok: boolean, failed: number }>} */
  const scripts = new Map();

  if (!existsSync(LATEST_JSON)) {
    return { generatedAt: null, passed: 0, failed: 0, scripts };
  }

  try {
    const raw = JSON.parse(readFileSync(LATEST_JSON, "utf8"));
    const rows = Array.isArray(raw.scripts) ? raw.scripts : [];

    for (const row of rows) {
      const rel = String(row.script ?? "").replace(/\\/g, "/");

      if (!rel) {
        continue;
      }

      const failed = Number(row.failed ?? 0);
      scripts.set(rel, { ok: failed === 0 && row.ok !== false, failed });
    }

    return {
      generatedAt: raw.generatedAt ?? null,
      passed     : Number(raw.passed ?? 0),
      failed     : Number(raw.failed ?? 0),
      scripts,
    };
  } catch {
    return { generatedAt: null, passed: 0, failed: 0, scripts };
  }
}

/**
 * @param {string} status
 * @returns {boolean}
 */
function jiraRowDone(status) {
  return isJiraStatusDone(status);
}

/**
 * Task ancora aperte nello scope epic (albero parent) e nello stesso sprint del piano Working.
 *
 * @param {Array<{ key: string, type: string, status: string, parentKey?: string | null }>} issues
 * @param {string} epicKey
 * @returns {string[]}
 */
export function getCorrelatedOpenKeys(issues, epicKey) {
  /** @type {Map<string, typeof issues[number]>} */
  const byKey = new Map(issues.map((row) => [row.key, row]));
  /** @type {Set<string>} */
  const open = new Set();

  for (const row of issues) {
    if (row.key === epicKey) {
      continue;
    }

    let current = row;

    while (current) {
      if (current.key === epicKey) {
        if (!jiraRowDone(row.status)) {
          open.add(row.key);
        }

        break;
      }

      current = current.parentKey ? byKey.get(current.parentKey) ?? null : null;
    }
  }

  for (const block of JLO_WORKING_PLAN) {
    if (!block.keys.includes(epicKey)) {
      continue;
    }

    for (const key of block.keys) {
      if (key === epicKey) {
        continue;
      }

      const row = byKey.get(key);

      if (row && !jiraRowDone(row.status)) {
        open.add(key);
      }
    }
  }

  return [...open].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * @param {Array<{ key: string, type: string, status: string, parentKey?: string | null }>} issues
 * @param {string} epicKey
 * @returns {boolean}
 */
export function canSuggestEpicClosure(issues, epicKey) {
  return getCorrelatedOpenKeys(issues, epicKey).length === 0;
}

/**
 * @param {string} key
 * @param {Map<string, string[]>} repoRefs
 */
function issueRepoEvidence(key, repoRefs) {
  const refs = repoRefs.get(key) ?? [];
  const meaningfulRefs = refs.filter(isMeaningfulCitationPath);
  const signal = REPO_IMPLEMENTATION_SIGNALS.find((s) => s.key === key);
  const pathScan = signal ? scanSignalPaths(signal) : null;

  return {
    refs
  , meaningfulRefs
  , refCount     : meaningfulRefs.length
  , pathScan
  , pathComplete : Boolean(pathScan?.complete)
  , hasEvidence  : meaningfulRefs.length > 0 || Boolean(pathScan?.complete)
  , signal
  };
}

/**
 * @param {Map<string, string[]>} repoRefs
 * @param {string} key
 * @returns {{ hasRefs: boolean, refCount: number, pathComplete: boolean, complete: boolean, found: number, total: number }}
 */
function repoSnapForKey(repoRefs, key) {
  const evidence = issueRepoEvidence(key, repoRefs);
  const pathTotal = evidence.signal?.paths.length ?? 0;
  const pathFound = evidence.pathScan?.found.length ?? 0;

  return {
    hasRefs      : evidence.refCount > 0,
    refCount     : evidence.refCount,
    pathComplete : evidence.pathComplete,
    complete     : evidence.hasEvidence,
    found        : pathFound > 0 ? pathFound : evidence.refCount,
    total        : pathTotal > 0 ? pathTotal : (evidence.refCount > 0 ? evidence.refCount : 0),
  };
}

/**
 * @param {ReturnType<typeof issueRepoEvidence>} evidence
 * @param {boolean} jiraDone
 * @returns {"aligned" | "gap" | null}
 */
export function resolveRepoAlignStatus(evidence, jiraDone) {
  if (!jiraDone) {
    return null;
  }

  const pathOk = !evidence.pathScan || evidence.pathComplete;

  if (evidence.hasEvidence && pathOk) {
    return "aligned";
  }

  return "gap";
}

/**
 * @param {Array<{ key: string, type: string, status: string, isSynthetic?: boolean }>} issues
 * @param {Map<string, string[]>} [repoRefs]
 * @returns {Record<string, "aligned" | "gap">}
 */
export function buildRepoAlignMap(issues, repoRefs) {
  const refs = repoRefs ?? scanRepoJiraReferences();
  /** @type {Record<string, "aligned" | "gap">} */
  const align = {};

  for (const row of issues) {
    if (row.isSynthetic || isEpicType(row.type)) {
      continue;
    }

    const status = resolveRepoAlignStatus(
      issueRepoEvidence(row.key, refs)
    , jiraRowDone(row.status)
    );

    if (status) {
      align[row.key] = status;
    }
  }

  return align;
}

/**
 * Issue assegnata allo sprint Jira **active** (in corso sulla board).
 *
 * @param {{ jiraSprints?: Array<{ state?: string }> }} row
 */
export function isInActiveJiraSprint(row) {
  return (row.jiraSprints ?? []).some((sprint) => sprint.state === "active");
}

/**
 * @param {Array<{ key: string, type: string, status: string, parentKey?: string | null, summary: string, isSynthetic?: boolean }>} issues
 * @param {string} at
 * @param {{ repoRefs?: Map<string, string[]> }} [options]
 * @returns {BacklogInsight[]}
 */
export function buildBacklogInsights(issues, at = new Date().toISOString(), options = {}) {
  /** @type {BacklogInsight[]} */
  const insights = [];
  /** @type {Map<string, typeof issues[number]>} */
  const byKey = new Map(issues.map((row) => [row.key, row]));
  const repoRefs = options.repoRefs ?? scanRepoJiraReferences();
  const jiraKeys = new Set(issues.map((row) => row.key));

  const report = loadTestReportSummary();

  const citedInBacklog = [...repoRefs.keys()].filter((key) => jiraKeys.has(key)).length;

  insights.push({
    at,
    kind : "info",
    text : `Scansione repo · ${issues.length} issue nel backlog Jira · ${citedInBacklog} citate anche nel codice (JLO-xxx nei sorgenti)`,
  });

  if (report.generatedAt) {
    const runAt = new Date(report.generatedAt).toLocaleString("it-IT");

    insights.push({
      at,
      kind : report.failed > 0 ? "warning" : "ok",
      text : `Ultimo test report: ${report.passed} pass · ${report.failed} fail — run del ${runAt}`,
    });
  } else {
    insights.push({
      at,
      kind : "comment",
      text : "Nessun report test in data/reports/latest.json — esegui «node runner/run-all.mjs» per insight sui test",
    });
  }

  for (const [key, paths] of repoRefs) {
    if (jiraKeys.has(key)) {
      continue;
    }

    const fileLabel = paths.length === 1 ? "1 file" : `${paths.length} file`;

    insights.push({
      at,
      kind : "comment",
      key,
      text : `${key} compare nel repo (${fileLabel}) ma non è nel backlog scaricato da Jira — ticket chiuso, fuori scope o da riallineare`,
    });
  }

  for (const row of issues) {
    if (row.isSynthetic) {
      continue;
    }

    if (isEpicType(row.type)) {
      continue;
    }

    const evidence = issueRepoEvidence(row.key, repoRefs);
    const jiraStatus = row.status ?? "—";
    const jiraDone = jiraRowDone(row.status);
    const title = truncateIssueSummary(row.summary);

    if (!jiraDone && isInActiveJiraSprint(row)) {
      if (evidence.hasEvidence) {
        const refNote = evidence.refCount > 0
          ? `trovate ${evidence.refCount} citazioni JLO nel codice`
          : `trovati ${evidence.pathScan?.found.length ?? 0} path attesi nel catalogo repo`;

        insights.push({
          at,
          kind : "suggestion",
          key  : row.key,
          type : row.type,
          text : `${row.key} · ${title}: il lavoro sembra fatto in repo (${refNote}), ma Jira è ancora «${jiraStatus}» nello sprint attivo — valuta chiusura o aggiornamento ticket`,
        });
      } else {
        const partial = evidence.pathScan
          ? `solo ${evidence.pathScan.found.length}/${evidence.signal?.paths.length ?? 0} path attesi presenti`
          : "nessuna traccia JLO-xxx nel codice";

        insights.push({
          at,
          kind : "comment",
          key  : row.key,
          type : row.type,
          text : `${row.key} · ${title}: da implementare (${partial}) — ticket nello sprint attivo Jira («${jiraStatus}»)`,
        });
      }
    }

    if (evidence.signal?.tests?.length && (jiraDone || isInActiveJiraSprint(row))) {
      for (const testRel of evidence.signal.tests) {
        const testRow = report.scripts.get(testRel);

        if (!testRow && report.generatedAt) {
          insights.push({
            at,
            kind : "comment",
            key  : row.key,
            type : row.type,
            text : `${row.key}: il test ${testRel} non risulta nell'ultimo report — riesegui run-all o verifica lo script`,
          });
        } else if (testRow && !testRow.ok) {
          insights.push({
            at,
            kind : "warning",
            key  : row.key,
            type : row.type,
            text : `${row.key}: il test ${testRel} ha ${testRow.failed} asserzioni fallite nell'ultimo report`,
          });
        }
      }
    }
  }

  /** @type {Map<string, typeof issues>} */
  const childrenByParent = new Map();

  for (const row of issues) {
    const parent = row.parentKey;

    if (!parent) {
      continue;
    }

    const list = childrenByParent.get(parent) ?? [];
    list.push(row);
    childrenByParent.set(parent, list);
  }

  for (const [parentKey, children] of childrenByParent) {
    const parent = byKey.get(parentKey);

    if (!parent || children.length === 0) {
      continue;
    }

    const storyChildren = children.filter((c) => isStoryLikeType(c.type) || c.type.toLowerCase().includes("sub"));
    const relevant = storyChildren.length > 0 ? storyChildren : children;
    const allDone = relevant.every((c) => jiraRowDone(c.status));
    const parentDone = jiraRowDone(parent.status);
    const parentIsEpic = isEpicType(parent.type) || parent.type.toLowerCase().includes("epic");

    if (parentDone || parentIsEpic || !allDone) {
      continue;
    }

    insights.push({
      at,
      kind : "suggestion",
      key  : parentKey,
      type : parent.type,
      text : `${parentKey} · ${parent.summary}: tutte le ${relevant.length} issue figlie sono Fatto in Jira, ma la parent resta «${parent.status}» — puoi chiuderla`,
    });
  }

  for (const row of issues) {
    if (!isEpicType(row.type) || jiraRowDone(row.status)) {
      continue;
    }

    const correlatedOpen = getCorrelatedOpenKeys(issues, row.key);

    if (correlatedOpen.length === 0) {
      insights.push({
        at,
        kind : "suggestion",
        key  : row.key,
        type : row.type,
        text : `${row.key} · ${row.summary}: tutte le task correlate sono Fatto, epic ancora «${row.status}» — valuta chiusura epic`,
      });
    }
  }

  for (const block of JLO_WORKING_PLAN) {
    /** @type {typeof issues} */
    const inSprint = [];

    for (const key of block.keys) {
      const row = byKey.get(key);

      if (row) {
        inSprint.push(row);
      }
    }

    if (inSprint.length === 0) {
      continue;
    }

    const doneCount = inSprint.filter((r) => jiraRowDone(r.status)).length;
    const openKeys = inSprint.filter((r) => !jiraRowDone(r.status)).map((r) => r.key);

    if (openKeys.length > 0 && doneCount === inSprint.length - 1 && openKeys.length === 1) {
      const lastKey = openKeys[0];
      const lastRow = byKey.get(lastKey);
      const lastTitle = lastRow ? truncateIssueSummary(lastRow.summary) : lastKey;

      insights.push({
        at,
        kind : "suggestion",
        key  : lastKey,
        type : lastRow?.type,
        text : `${block.name}: manca solo ${lastKey} (${lastTitle}) per chiudere lo sprint nel piano — ${doneCount}/${inSprint.length} già Fatto in Jira`,
      });
    } else if (openKeys.length > 0 && block.sprint <= 2) {
      const withRepo = openKeys.filter((key) => {
        const row = byKey.get(key);

        if (row && isEpicType(row.type)) {
          return false;
        }

        return issueRepoEvidence(key, repoRefs).hasEvidence;
      });

      if (withRepo.length > 0) {
        insights.push({
          at,
          kind : "suggestion",
          text : `${block.name}: in repo c'è già codice per ${withRepo.join(", ")}, ma in Jira sono ancora aperti — priorità chiusura senza nuovo sviluppo`,
        });
      }
    }
  }

  return insights;
}

/**
 * @param {string} key
 * @param {Map<string, string[]>} [repoRefs]
 * @returns {{ signal: { key: string, label: string, paths: string[] }, scan: ReturnType<typeof scanSignalPaths> } | null}
 */
export function inspectRepoSignal(key, repoRefs) {
  const rawRefs = (repoRefs ?? scanRepoJiraReferences()).get(key) ?? [];
  const refs = rawRefs.filter(isMeaningfulCitationPath);
  const mapped = REPO_IMPLEMENTATION_SIGNALS.find((s) => s.key === key);

  if (mapped) {
    const scan = scanSignalPaths(mapped);

    if (scan.complete) {
      return { signal: mapped, scan };
    }
  }

  if (refs.length > 0) {
    return {
      signal : {
        key
      , label : key
      , paths : refs
      }
    , scan: {
        found    : refs
      , missing  : []
      , complete : true
      }
    };
  }

  return null;
}

/**
 * Valutazione repo per matrice pilastri — no «Repo ok» se citazione solo cruscotto Admin.
 * @param {string} key
 * @param {Map<string, string[]>} repoRefs
 * @returns {{ complete: boolean, found: number, total: number, metaOnly: boolean } | null}
 */
export function assessIssueRepoInspect(key, repoRefs) {
  const rawRefs = repoRefs.get(key) ?? [];
  const meaningfulRefs = rawRefs.filter(isMeaningfulCitationPath);
  const mapped = REPO_IMPLEMENTATION_SIGNALS.find((s) => s.key === key);
  const inspect = inspectRepoSignal(key, repoRefs);

  if (mapped && inspect?.scan.complete) {
    const productPaths = mapped.paths.filter(isMeaningfulCitationPath);

    return {
      complete : true
    , found    : inspect.scan.found.length
    , total    : productPaths.length
    , metaOnly : false
    };
  }

  if (meaningfulRefs.length > 0) {
    return {
      complete : true
    , found    : meaningfulRefs.length
    , total    : meaningfulRefs.length
    , metaOnly : false
    };
  }

  if (rawRefs.length > 0) {
    return {
      complete : false
    , found    : 0
    , total    : 0
    , metaOnly : true
    };
  }

  return null;
}

/** @type {string[]} */
const HOUSEKEEPING_KEYS = ["JLO-97", "JLO-247", "JLO-637"];

/**
 * @param {string[]} a
 * @param {string[]} b
 * @returns {boolean}
 */
function sameKeyList(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  const sa = [...a].sort().join(",");
  const sb = [...b].sort().join(",");

  return sa === sb;
}

/**
 * @param {Array<{ key: string, type: string, status: string, parentKey?: string | null }>} issues
 * @param {Record<string, string[]>} [boardSprintKeysByPlanName]
 * @param {Map<string, string[]>} [repoRefs]
 */
export function buildInsightSnapshot(issues, boardSprintKeysByPlanName = {}, repoRefs) {
  /** @type {Map<string, typeof issues[number]>} */
  const byKey = new Map(issues.map((row) => [row.key, row]));
  const refs = repoRefs ?? scanRepoJiraReferences();
  /** @type {Record<string, { status: string, done: boolean }>} */
  const issuesSnap = {};

  for (const row of issues) {
    issuesSnap[row.key] = {
      status         : row.status,
      done           : jiraRowDone(row.status),
      inActiveSprint : isInActiveJiraSprint(row),
    };
  }

  /** @type {Record<string, { hasRefs: boolean, refCount: number, pathComplete: boolean, complete: boolean, found: number, total: number }>} */
  const repoSnap = {};

  for (const row of issues) {
    repoSnap[row.key] = repoSnapForKey(refs, row.key);
  }

  for (const signal of REPO_IMPLEMENTATION_SIGNALS) {
    if (!repoSnap[signal.key]) {
      const pathScan = scanSignalPaths(signal);
      repoSnap[signal.key] = {
        hasRefs      : false
      , refCount     : 0
      , pathComplete : pathScan.complete
      , complete     : pathScan.complete
      , found        : pathScan.found.length
      , total        : pathScan.found.length + pathScan.missing.length
      };
    }
  }

  const report = loadTestReportSummary();
  /** @type {Record<string, { ok: boolean, failed: number }>} */
  const scriptsSnap = {};
  for (const [rel, row] of report.scripts) {
    scriptsSnap[rel] = row;
  }

  /** @type {Record<string, { done: number, total: number, openKeys: string[], keys: string[] }>} */
  const sprints = {};

  for (const block of JLO_WORKING_PLAN) {
    const keys = mergeWorkingSprintKeys(
      block.keys
    , boardKeysForWorkingPlanBlock(boardSprintKeysByPlanName, block.name)
    );
    /** @type {string[]} */
    const openKeys = [];
    let doneCount = 0;

    for (const key of keys) {
      const row = byKey.get(key);

      if (row && jiraRowDone(row.status)) {
        doneCount += 1;
      } else {
        openKeys.push(key);
      }
    }

    sprints[block.name] = {
      done     : doneCount,
      total    : keys.length,
      openKeys,
      keys,
    };
  }

  /** @type {string[]} */
  const hkOpen = HOUSEKEEPING_KEYS.filter((key) => {
    const row = byKey.get(key);

    return !row || !jiraRowDone(row.status);
  });

  /** @type {string | null} */
  let firstOpenKey = null;

  for (const block of JLO_WORKING_PLAN) {
    for (const key of block.keys) {
      const row = byKey.get(key);

      if (!row || !jiraRowDone(row.status)) {
        firstOpenKey = key;
        break;
      }
    }

    if (firstOpenKey) {
      break;
    }
  }

  /** @type {Map<string, typeof issues>} */
  const childrenByParent = new Map();

  for (const row of issues) {
    const parent = row.parentKey;

    if (!parent) {
      continue;
    }

    const list = childrenByParent.get(parent) ?? [];
    list.push(row);
    childrenByParent.set(parent, list);
  }

  /** @type {string[]} */
  const parentsPendingClose = [];

  for (const [parentKey, children] of childrenByParent) {
    const parent = byKey.get(parentKey);

    if (!parent || children.length === 0) {
      continue;
    }

    const storyChildren = children.filter((c) => isStoryLikeType(c.type) || c.type.toLowerCase().includes("sub"));
    const relevant = storyChildren.length > 0 ? storyChildren : children;
    const allDone = relevant.every((c) => jiraRowDone(c.status));
    const parentDone = jiraRowDone(parent.status);

    if (allDone && !parentDone && !isEpicType(parent.type)) {
      parentsPendingClose.push(parentKey);
    }
  }

  /** @type {Record<string, string[]>} */
  const epicCorrelatedOpen = {};

  for (const row of issues) {
    if (!isEpicType(row.type)) {
      continue;
    }

    epicCorrelatedOpen[row.key] = getCorrelatedOpenKeys(issues, row.key);
  }

  return {
    issueCount : issues.length,
    issues     : issuesSnap,
    repo       : repoSnap,
    repoAlign  : buildRepoAlignMap(issues, refs),
    report     : {
      generatedAt : report.generatedAt,
      passed      : report.passed,
      failed      : report.failed,
      scripts     : scriptsSnap,
    },
    sprints,
    housekeeping : { open: hkOpen },
    firstOpenKey,
    parentsPendingClose,
    epicCorrelatedOpen,
    exportPending: Boolean(
      issuesSnap["JLO-930"] && !issuesSnap["JLO-930"].done && !repoSnap["JLO-930"]?.complete
    ),
  };
}

/**
 * @param {BacklogInsight} insight
 * @param {ReturnType<typeof buildInsightSnapshot>} snapshot
 * @returns {boolean}
 */
export function isInsightStillValid(insight, snapshot) {
  const { text, key } = insight;

  if (text.includes("Ultimo test report")) {
    const match = text.match(/(\d+) pass · (\d+) fail/);

    if (!match || !snapshot.report.generatedAt) {
      return false;
    }

    return Number(match[1]) === snapshot.report.passed
      && Number(match[2]) === snapshot.report.failed;
  }

  if (text.includes("Nessun report test")) {
    return !snapshot.report.generatedAt;
  }

  if (text.startsWith("Piano Jira Working") || text.startsWith("Scansione repo")) {
    const backlogMatch = text.match(/(\d+) issue backlog/)
      ?? text.match(/(\d+) issue nel backlog Jira/);
    const legacyMatch = text.match(/(\d+) issue Jira/)
      ?? text.match(/backlog (\d+) issue/);

    if (backlogMatch) {
      return Number(backlogMatch[1]) === snapshot.issueCount;
    }

    return legacyMatch ? Number(legacyMatch[1]) === snapshot.issueCount : false;
  }

  if (
    (text.includes("citata nel repo") || text.includes("compare nel repo"))
    && (text.includes("assente dal backlog") || text.includes("non è nel backlog"))
  ) {
    const match = text.match(/^(JLO-\d+)/);

    if (!match) {
      return true;
    }

    return !snapshot.issues[match[1]];
  }

  for (const [name, sprint] of Object.entries(snapshot.sprints)) {
    if (!text.startsWith(`${name}:`)) {
      continue;
    }

    const countMatch = text.match(/(\d+)\/(\d+) Fatto/);

    if (!countMatch) {
      return true;
    }

    const openMatch = text.match(/ancora aperti (.+)$/)
      ?? text.match(/aperti (.+)$/);
    const openInText = openMatch
      ? openMatch[1].split(/,\s*/).filter(Boolean)
      : [];

    return Number(countMatch[1]) === sprint.done
      && Number(countMatch[2]) === sprint.total
      && sameKeyList(openInText, sprint.openKeys);
  }

  if (text.includes("Housekeeping Fase 0 completato")) {
    return snapshot.housekeeping.open.length === 0;
  }

  if (text.includes("Housekeeping parziale")) {
    const match = text.match(/restano(?: da chiudere)?: (.+)$/);

    return match ? sameKeyList(match[1].split(/,\s*/), snapshot.housekeeping.open) : false;
  }

  if (text.includes("Fase 0 housekeeping:")) {
    const match = text.match(/: ([A-Z]+-\d+(?:,\s*[A-Z]+-\d+)*) hanno/);

    if (!match) {
      return true;
    }

    const keys = match[1].split(/,\s*/);

    return keys.every((itemKey) => {
      const iss = snapshot.issues[itemKey];
      const rep = snapshot.repo[itemKey];

      return iss && !iss.done && rep?.complete;
    });
  }

  if (
    (text.includes("repo pronto per") && text.includes("Jira ancora aperto"))
    || text.includes("in repo c'è già codice per")
  ) {
    const match = text.match(/repo pronto per (.+?) —/)
      ?? text.match(/codice per (.+?), ma/);

    if (!match) {
      return true;
    }

    const keys = match[1].split(/,\s*/);

    return keys.some((itemKey) => {
      const iss = snapshot.issues[itemKey];
      const rep = snapshot.repo[itemKey];

      return iss && !iss.done && rep?.complete;
    });
  }

  if (
    text.includes("ultimo ticket aperto nel piano sprint")
    || (text.includes("manca solo") && text.includes("per chiudere lo sprint nel piano"))
  ) {
    const match = text.match(/manca solo (JLO-\d+)/)
      ?? text.match(/\(([A-Z]+-\d+)\)/);

    if (!match) {
      return true;
    }

    const itemKey = match[1];
    const iss = snapshot.issues[itemKey];

    return iss ? !iss.done : false;
  }

  if ((text.includes("Prossimo nel piano:") || text.includes("Prossimo ticket nel piano:")) && key) {
    return snapshot.firstOpenKey === key;
  }

  if (text.includes("Export Excel") && text.includes("export/")) {
    return snapshot.exportPending;
  }

  if (text.includes("test blocked") || text.includes("test restano blocked")) {
    return key ? !snapshot.issues[key]?.done : true;
  }

  if (key && snapshot.epicCorrelatedOpen?.[key]) {
    const correlated = snapshot.epicCorrelatedOpen[key];
    const isEpicClosureInsight = text.includes("valuta chiusura epic")
      || text.includes("tutte le task correlate sono Fatto");

    if (!isEpicClosureInsight) {
      return false;
    }

    if (text.includes("attendi task correlate") || text.includes("task correlate ancora aperte")) {
      const match = text.match(/\(([^)]+)\)\s*$/);

      return match ? sameKeyList(match[1].split(/,\s*/), correlated) : correlated.length > 0;
    }

    if (text.includes("valuta chiusura epic") || text.includes("task correlate Fatto")) {
      return correlated.length === 0 && !snapshot.issues[key]?.done;
    }
  }

  if (key && text.includes("tutte le task correlate sono Fatto")) {
    const correlated = snapshot.epicCorrelatedOpen?.[key] ?? [];

    return correlated.length === 0 && !snapshot.issues[key]?.done;
  }

  if (key && snapshot.issues[key]) {
    const iss = snapshot.issues[key];
    const rep = snapshot.repo[key];

    if (text.includes("repo e Jira allineati")) {
      return iss.done && Boolean(rep?.complete ?? rep?.hasRefs);
    }

    if (
      text.includes("citata nel repo")
      || text.includes("citaz. nel codice")
      || text.includes("citazioni JLO nel codice")
      || text.includes("implementazione in repo")
      || text.includes("il lavoro sembra fatto in repo")
      || text.includes("repo ok")
      || text.includes("codice presente in repo")
    ) {
      const correlated = snapshot.epicCorrelatedOpen?.[key];

      if (correlated?.length) {
        return text.includes("attendi task correlate")
          && sameKeyList(
            text.match(/\(([^)]+)\)\s*$/)?.[1]?.split(/,\s*/) ?? [],
            correlated,
          );
      }

      return !iss.done && Boolean(rep?.complete ?? rep?.hasRefs)
        && Boolean(iss.inActiveSprint);
    }

    if (text.includes("da implementare") && text.includes("sprint attivo")) {
      return Boolean(iss.inActiveSprint)
        && !iss.done
        && !Boolean(rep?.complete ?? rep?.hasRefs);
    }

    if (
      text.includes("valuta chiusura o aggiornamento ticket")
      || text.includes("valuta chiusura o aggiornamento")
    ) {
      return Boolean(iss.inActiveSprint)
        && !iss.done
        && Boolean(rep?.complete ?? rep?.hasRefs);
    }

    if (text.includes("Jira Fatto ma nessuna citazione")) {
      return iss.done && !Boolean(rep?.hasRefs ?? rep?.complete);
    }

    if (text.includes("mancano path attesi") || text.includes("mancano in repo")) {
      return iss.done && !Boolean(rep?.pathComplete ?? rep?.complete);
    }

    if (text.includes("repo parziale") || (text.includes("da implementare") && !text.includes("sprint attivo"))) {
      const partial = text.match(/(\d+)\/(\d+) path/);

      if (partial && rep) {
        return !iss.done
          && Number(partial[1]) === rep.found
          && Number(partial[2]) === rep.total
          && !rep.complete;
      }
    }

    const testFail = text.match(/Test ([\w./-]+): (\d+) falliti/)
      ?? text.match(/il test ([\w./-]+) ha (\d+) asserzioni fallite/);

    if (testFail) {
      const script = snapshot.report.scripts[testFail[1]];

      return script ? !script.ok && script.failed === Number(testFail[2]) : false;
    }

    const testMissing = text.match(/Test ([\w./-]+) non presente/)
      ?? text.match(/il test ([\w./-]+) non risulta/);

    if (testMissing) {
      return !snapshot.report.scripts[testMissing[1]];
    }
  }

  if (text.includes("Catena MVP")) {
    return true;
  }

  if (key && text.includes("tutte le") && text.includes("issue figlie sono Fatto")) {
    return snapshot.parentsPendingClose.includes(key);
  }

  if (text.includes("Analisi fallita")) {
    return false;
  }

  return true;
}

/**
 * @param {BacklogInsight[]} items
 * @param {ReturnType<typeof buildInsightSnapshot>} snapshot
 * @returns {BacklogInsight[]}
 */
export function applyInsightStaleFlags(items, snapshot) {
  return items.map((item) => ({
    ...item,
    stale: !isInsightStillValid(item, snapshot),
  }));
}

/**
 * @returns {Promise<{ scannedAt: string, insights: BacklogInsight[], snapshot: ReturnType<typeof buildInsightSnapshot> }>}
 */
export async function fetchBacklogInsights() {
  const backlog = await fetchJiraBacklog();
  const scannedAt = new Date().toISOString();
  const repoRefs = scanRepoJiraReferences();
  const snapshot = buildInsightSnapshot(backlog.issues, backlog.boardSprintKeysByPlanName, repoRefs);
  const insights = buildBacklogInsights(backlog.issues, scannedAt, { repoRefs });

  return { scannedAt, insights, snapshot };
}

