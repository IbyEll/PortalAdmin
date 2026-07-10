#!/usr/bin/env node
/**
 * Genera docs.portal/test-coverage-matrix.html — usa template matrice generico.
 *
 * Template renderer: docs.portal.lib/matrix.render.mjs
 * Dati sorgente: sezione DATA sotto (o test-coverage-matrix.md)
 */
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import { refreshMatrixPageHtml } from "../docs.portal.lib/matrix.refresh.mjs";
import {
  TEST_COVERAGE_COLUMNS
, TEST_COVERAGE_PRIORITY_SECTION
, TEST_COVERAGE_SECTION_DEFS
} from "../docs.portal.lib/matrix.test-coverage.meta.mjs";
import {
  enrichMatrixSectionsFromJira
, loadUnifiedMatrixSectionsFromDb
, MATRIX_KIND_TEST_COVERAGE
, persistUnifiedMatrixSections
} from "../docs.portal.lib/matrix.db.adapter.mjs";
import { isMatrixDbPrimary } from "../docs.portal.lib/matrix.persist.config.mjs";
import {
  renderMatrixPage
, summarizeMatrixSections
} from "../docs.portal.lib/matrix.render.mjs";
import { isFreshEntry, stripFreshMarks } from "../docs.portal.lib/docs.portal.refresh.mjs";
import {
  ensureMatrixRowCreateMeta
} from "../docs.portal.lib/matrix.finding.issues.mjs";

const __dirname   = dirname(fileURLToPath(import.meta.url));
const PORTAL_ROOT = join(__dirname, "..");
const OUT         = join(__dirname, "matrix.test.coverage.html");

/** @typedef {import("../docs.portal.lib/matrix.render.mjs").MatrixRow} Row */

const PA = "PortalAdmin";
const CR = "PortalAdmin.Cruscotto";

/** @type {Record<string, Row[]>} */
const DATA = {
  orch: [
    { id: "cov-orch-smoke-ci", sev: "info", status: "coperto", project: PA, voce: "Smoke CI aggregate", dettaglio: "Test: npm run test:ci · Gap: —", paths: ["test.smoke/smoke-ci.mjs"] },
    { id: "cov-orch-portal-api", sev: "warn", status: "parziale", project: PA, voce: "API read-only suite", dettaglio: "Test: npm run test:portal-api · Gap: richiede cruscotto up se non in CI", paths: ["admin.portal.testscript/run-portal-api.mjs"] },
    { id: "cov-p1-portal-api-ci", sev: "P1", status: "fatto", project: PA, voce: "Portal API in CI", dettaglio: "Test: smoke-portal-api in test:ci · Gap: —", paths: ["test.smoke/smoke-portal-api.mjs"] },
    { id: "cov-orch-run-all", sev: "warn", status: "parziale", project: PA, voce: "Discovery run-all", dettaglio: "Test: smoke-run-all.mjs · Gap: solo --list, non esecuzione run", paths: ["admin.portal.lib/test.run.all.mjs"] },
  ],
  config: [
    { id: "cov-cfg-paths", sev: "info", status: "coperto", project: PA, voce: "Path resolver / product repo", dettaglio: "Test: smoke-paths-resolver.mjs", paths: ["admin.portal.lib/portal.paths.resolver.mjs"] },
    { id: "cov-cfg-overlay", sev: "info", status: "coperto", project: PA, voce: "Overlay / manifest / segnali", dettaglio: "Test: smoke-portal-config.mjs", paths: ["admin.portal.lib/project.config.mjs", "admin.portal.JiraCORE/jira.project.config.overlay.mjs"] },
    { id: "cov-cfg-refs", sev: "info", status: "coperto", project: PA, voce: "Scan citazioni Jira in repo", dettaglio: "Test: smoke-portal-config.mjs", paths: ["admin.portal.JiraCORE/jira.function.repo.refs.mjs"] },
    { id: "cov-cfg-workflow", sev: "info", status: "coperto", project: PA, voce: "Regole workflow .cursor", dettaglio: "Test: smoke-workflow.mjs", paths: [".cursor/rules/ADMIN-Workflow.mdc"] },
    { id: "cov-cfg-close", sev: "warn", status: "parziale", project: PA, voce: "Close story dry-run", dettaglio: "Test: smoke-workflow, smoke-portal-config · Gap: solo dry-run, no push/PR", paths: ["admin.portal.JiraCORE/jiraCORE.close.story.mjs"] },
    { id: "cov-cfg-signals", sev: "info", status: "coperto", project: PA, voce: "Catalogo segnali / branch ticket", dettaglio: "Test: smoke-workflow.mjs", paths: ["admin.portal.JiraCORE/JiraCORE.signals.catalog.implementation.mjs"] },
    { id: "cov-gap-gap-cli", sev: "P4", status: "gap", project: PA, voce: "Gap analysis CLI", dettaglio: "Test: — · Gap: nessun smoke su jiraCORE.repo..issuekey.gap.analysis.mjs", paths: ["admin.portal.JiraCORE/jiraCORE.repo..issuekey.gap.analysis.mjs"], create: { section: "Config / workflow", summary: "Smoke gap analysis CLI", detail: "Nessun test automatico per jiraCORE.repo..issuekey.gap.analysis.mjs." } },
  ],
  db: [
    { id: "cov-db-path", sev: "info", status: "coperto", project: CR, voce: "Path DB overlay", dettaglio: "Test: smoke-cruscotto-db.mjs", paths: ["cruscotto.database/cruscotto.db.config.mjs"] },
    { id: "cov-db-migrate", sev: "info", status: "coperto", project: CR, voce: "Migrate schema", dettaglio: "Test: smoke-cruscotto-db.mjs", paths: ["cruscotto.database/migrate.mjs"] },
    { id: "cov-db-load", sev: "warn", status: "parziale", project: CR, voce: "Load backlog cache", dettaglio: "Test: smoke-cruscotto-db.mjs · Gap: DB vuoto only", paths: ["admin.portal.JiraCORE/jiraCORE.backlog.load.mjs"] },
    { id: "cov-gap-db-sync", sev: "P3", status: "gap", project: CR, voce: "Sync Jira → DB", dettaglio: "Test: — · Gap: serve Jira live", paths: ["admin.portal.JiraCORE/jiraCORE.backlog.sync.mjs"], create: { section: "Cruscotto DB", summary: "Test sync backlog Jira → DB", detail: "Nessun test per jiraCORE.backlog.sync.mjs (richiede credenziali Jira)." } },
  ],
  spa: [
    { id: "cov-spa-shell", sev: "warn", status: "parziale", project: CR, voce: "/, /app.html, /home.html", dettaglio: "Test: smoke-dashboard.mjs · Gap: body minimo, no JS routing", paths: ["cruscotto.frontend/cruscotto.home.html"] },
    { id: "cov-spa-backlog", sev: "warn", status: "parziale", project: CR, voce: "/backlog.html", dettaglio: "Test: smoke-dashboard, gogo · Gap: no assert render tabella", paths: ["cruscotto.frontend/cruscotto.jira.backlog.html"] },
    { id: "cov-gap-mybacklog-html", sev: "P3", status: "gap", project: CR, voce: "/my-backlog.html", dettaglio: "Test: push test markup · Gap: no fetch API my-backlog", paths: ["cruscotto.frontend/cruscotto.jira.my-backlog.html"], create: { section: "HTTP / SPA", summary: "Test fetch API my-backlog da pagina", detail: "Pagina my-backlog senza assert su GET /api/jira/my-backlog." } },
    { id: "cov-gap-issue-html", sev: "P4", status: "gap", project: CR, voce: "/issue.html", dettaglio: "Test: — · Gap: pagina issue non coperta", paths: ["cruscotto.frontend/"], create: { section: "HTTP / SPA", summary: "Smoke issue.html", detail: "Nessun test HTTP o funzionale su issue display." } },
    { id: "cov-gap-overview-html", sev: "P4", status: "gap", project: CR, voce: "/project-overview.html", dettaglio: "Test: — · Gap: project overview non coperta", paths: ["cruscotto.frontend/cruscotto.project.overview.html"], create: { section: "HTTP / SPA", summary: "Smoke project-overview.html", detail: "Nessun test su project overview page." } },
    { id: "cov-gap-process-tab", sev: "P2", status: "gap", project: CR, voce: "Tab Process inline", dettaglio: "Test: — · Gap: UI Process in cruscotto.home.js non testata", paths: ["cruscotto.frontend/cruscotto.home.js"], create: { section: "HTTP / SPA", summary: "Test UI tab Process (#section-process)", detail: "Tab Process renderizzata inline; nessun test DOM o E2E." } },
    { id: "cov-spa-cursor-tab", sev: "lock", status: "blocked", project: CR, voce: "Tab Cursor inline", dettaglio: "Test: test.cursor.agent.ui.mjs · Gap: fuori run-portal-api / CI", paths: ["cruscotto.frontend/cruscotto.home.js"] },
    { id: "cov-gap-process-deeplink", sev: "info", status: "gap", project: CR, voce: "Deep-link tab /process", dettaglio: "Test: — · Gap: redirect #process non verificato", paths: ["cruscotto.frontend/cruscotto.server.mjs"] },
  ],
  apiHealth: [
    { id: "cov-api-health", sev: "info", status: "coperto", project: CR, voce: "Health stack", dettaglio: "GET /api/health · test.api.health.mjs", paths: ["cruscotto.frontend/cruscotto.health.mjs"] },
    { id: "cov-api-status", sev: "info", status: "coperto", project: CR, voce: "Run manager status", dettaglio: "GET /api/status · test.api.status.mjs", paths: ["cruscotto.frontend/cruscotto.server.mjs"] },
    { id: "cov-api-bootstrap", sev: "info", status: "coperto", project: CR, voce: "Bootstrap UI", dettaglio: "GET /api/cruscotto/project · test.cruscotto.project.mjs", paths: ["cruscotto.frontend/cruscotto.project.bootstrap.js"] },
    { id: "cov-api-scripts", sev: "info", status: "coperto", project: CR, voce: "Catalogo scripts", dettaglio: "GET /api/scripts · test.scripts.catalog.mjs", paths: ["admin.portal.lib/test.catalog.mjs"] },
  ],
  apiDev: [
    { id: "cov-api-dev-req", sev: "info", status: "coperto", project: CR, voce: "Requisiti stack", dettaglio: "GET /api/dev/requirements · test.dev.requirements.mjs", paths: ["cruscotto.frontend/cruscotto.dev.api.mjs"] },
    { id: "cov-api-dev-svc", sev: "info", status: "coperto", project: CR, voce: "Servizi + probe", dettaglio: "GET /api/dev/services · test.dev.services.mjs", paths: ["cruscotto.frontend/cruscotto.dev.api.mjs"] },
    { id: "cov-api-tecnici-meta", sev: "info", status: "coperto", project: CR, voce: "Meta test tecnici", dettaglio: "GET /api/tecnici/meta · test.tecnici.meta.mjs", paths: ["admin.portal.testscript/meta/test.tecnici.meta.mjs"] },
    { id: "cov-api-funz-meta", sev: "info", status: "coperto", project: CR, voce: "Meta test funzionali", dettaglio: "GET /api/funzionali/meta · test.funzionali.meta.mjs", paths: ["admin.portal.testscript/meta/test.funzionali.meta.mjs"] },
  ],
  apiRepo: [
    { id: "cov-api-discover", sev: "info", status: "coperto", project: CR, voce: "Discover servizi", dettaglio: "GET /api/repo/services/discover · test.repo.services.discover.mjs", paths: ["cruscotto.frontend/cruscotto.process.services.manager.mjs"] },
    { id: "cov-api-svc-status", sev: "info", status: "coperto", project: CR, voce: "Stato stack avviato", dettaglio: "GET /api/repo/services/status · test.repo.services.status.mjs", paths: ["cruscotto.frontend/cruscotto.process.services.manager.mjs"] },
    { id: "cov-p2-processes", sev: "P2", status: "fatto", project: CR, voce: "Tabella Process (PID/porte)", dettaglio: "GET /api/repo/services/processes · test.repo.services.processes.mjs", paths: ["admin.portal.testscript/repo/test.repo.services.processes.mjs"] },
    { id: "cov-gap-logs", sev: "P3", status: "gap", project: CR, voce: "Log console Process", dettaglio: "GET/DELETE /api/repo/services/logs · Gap: nessun test", paths: ["cruscotto.frontend/cruscotto.process.services.manager.mjs"], create: { section: "API repo / Process", summary: "Test API repo/services/logs", detail: "Endpoint logs Process senza copertura automatica." } },
    { id: "cov-gap-start-stop", sev: "P4", status: "gap", project: CR, voce: "Start/stop stack", dettaglio: "POST start/stop/start-one/stop-one · Gap: side-effect non testato", paths: ["cruscotto.frontend/cruscotto.process.services.manager.mjs"], create: { section: "API repo / Process", summary: "Test dry-run start/stop stack", detail: "Route POST con side-effect; serve mock o flag --dry-run." } },
    { id: "cov-gap-db-product", sev: "P4", status: "gap", project: CR, voce: "DB product reset/seed/push", dettaglio: "POST /api/repo/database/* · Gap: side-effect", paths: ["cruscotto.frontend/cruscotto.server.mjs"], create: { section: "API repo / Process", summary: "Test sicuro database product API", detail: "Endpoint reset/seed/push non coperti." } },
  ],
  apiRun: [
    { id: "cov-gap-run", sev: "P5", status: "gap", project: CR, voce: "Run suite / one / case", dettaglio: "POST /api/run* · Gap: nessun test", paths: ["cruscotto.frontend/cruscotto.server.mjs"], create: { section: "API run / report", summary: "Test POST /api/run/one script leggero", detail: "Priorità P5: un run su script catalogo a basso impatto." } },
    { id: "cov-gap-report", sev: "P4", status: "gap", project: CR, voce: "Report JSON/HTML", dettaglio: "GET /api/report* · Gap: nessun test", paths: ["cruscotto.frontend/cruscotto.server.mjs"], create: { section: "API run / report", summary: "Test GET /api/report dopo run", detail: "Report API non verificata." } },
    { id: "cov-gap-export", sev: "P4", status: "gap", project: CR, voce: "Export Excel", dettaglio: "GET /api/export · Gap: nessun test", paths: ["cruscotto.frontend/cruscotto.server.mjs"], create: { section: "API run / report", summary: "Test GET /api/export", detail: "Export Excel non coperto." } },
    { id: "cov-gap-tecnici-analysis", sev: "P4", status: "gap", project: CR, voce: "Analisi tecnici", dettaglio: "POST/GET tecnici-analysis* · Gap: nessun test", paths: ["cruscotto.frontend/cruscotto.server.mjs"], create: { section: "API run / report", summary: "Test tecnici-analysis API", detail: "Endpoint analisi tecnici senza smoke." } },
  ],
  apiJira: [
    { id: "cov-api-backlog", sev: "info", status: "coperto", project: CR, voce: "Backlog live", dettaglio: "GET /api/jira/backlog · test.jira.backlog.mjs, gogo · 502 ok senza credenziali", paths: ["cruscotto.frontend/cruscotto.jira.backlog.mjs"] },
    { id: "cov-gap-insights", sev: "P3", status: "gap", project: CR, voce: "Backlog insights", dettaglio: "GET /api/jira/backlog/insights · Gap: nessun test", paths: ["cruscotto.frontend/cruscotto.jira.backlog.insights.mjs"], create: { section: "API Jira", summary: "Test backlog insights API", detail: "Endpoint insights backlog non coperto." } },
    { id: "cov-gap-mybacklog-api", sev: "P3", status: "gap", project: CR, voce: "MyBacklog cache", dettaglio: "GET /api/jira/my-backlog · Gap: nessun test", paths: ["cruscotto.frontend/cruscotto.jira.backlog.mjs"], create: { section: "API Jira", summary: "Test GET /api/jira/my-backlog", detail: "Cache MyBacklog non verificata." } },
    { id: "cov-gap-mybacklog-sync", sev: "P3", status: "gap", project: CR, voce: "Sync MyBacklog", dettaglio: "POST /api/jira/my-backlog/sync · Gap: nessun test", paths: ["cruscotto.frontend/cruscotto.server.mjs"], create: { section: "API Jira", summary: "Test POST my-backlog/sync", detail: "Sync MyBacklog da Jira live non testato." } },
    { id: "cov-gap-issue-api", sev: "P4", status: "gap", project: CR, voce: "Issue live / DB", dettaglio: "GET /api/jira/issue/:KEY · Gap: nessun test", paths: ["cruscotto.frontend/cruscotto.server.mjs"], create: { section: "API Jira", summary: "Test GET /api/jira/issue", detail: "Issue API live/DB non coperta." } },
    { id: "cov-api-wip-status", sev: "info", status: "coperto", project: CR, voce: "WIP status", dettaglio: "GET /api/jira/wip/status · test.cruscotto.backlog.push.mjs", paths: ["cruscotto.frontend/cruscotto.jira.wip.mjs"] },
    { id: "cov-api-wip-push", sev: "warn", status: "parziale", project: CR, voce: "WIP push", dettaglio: "POST /api/jira/wip/push · push test 400/409 · dry-run opzionale env", paths: ["admin.portal.testscript/cursor/test.cruscotto.backlog.push.mjs"] },
    { id: "cov-gap-wip-enroll", sev: "P3", status: "gap", project: CR, voce: "WIP enroll / finalize / pr-poll", dettaglio: "POST /api/jira/wip/* · Gap: nessun test", paths: ["cruscotto.frontend/cruscotto.server.mjs"], create: { section: "API Jira", summary: "Test WIP enroll e finalize", detail: "Flusso WIP completo non coperto oltre push validation." } },
    { id: "cov-gap-workflow", sev: "P3", status: "gap", project: CR, voce: "Gogo preflight / PR URL", dettaglio: "GET /api/workflow/* · Gap: nessun test API dedicato", paths: ["cruscotto.frontend/cruscotto.server.mjs"], create: { section: "API Jira", summary: "Test API /api/workflow/*", detail: "Preflight gogo e PR URL non in run-portal-api." } },
    { id: "cov-gap-overview-api", sev: "P4", status: "gap", project: CR, voce: "My-project / project-overview analyze", dettaglio: "GET *-overview/analyze · Gap: nessun test", paths: ["cruscotto.frontend/cruscotto.project.overview.analysis.mjs"], create: { section: "API Jira", summary: "Test overview analyze API", detail: "Endpoint analyze overview non coperti." } },
  ],
  apiPortal: [
    { id: "cov-api-portal-projects", sev: "info", status: "coperto", project: CR, voce: "Lista progetti", dettaglio: "GET /api/portal/projects · test.portal.projects.mjs", paths: ["admin.portal.lib/portal.instance.mjs"] },
    { id: "cov-api-portal-instance", sev: "info", status: "coperto", project: CR, voce: "Istanza attiva", dettaglio: "GET /api/portal/instance · test.portal.instance.mjs", paths: ["admin.portal.lib/portal.instance.mjs"] },
    { id: "cov-gap-portal-post", sev: "P4", status: "gap", project: CR, voce: "Attiva overlay", dettaglio: "POST /api/portal/instance · Gap: side-effect .env", paths: ["cruscotto.frontend/cruscotto.server.mjs"], create: { section: "Portal instance", summary: "Test dry-run POST portal/instance", detail: "Attivazione overlay modifica .env; serve sandbox o mock." } },
  ],
  apiCursor: [
    { id: "cov-api-cursor-get", sev: "lock", status: "blocked", project: CR, voce: "Config / status / logs", dettaglio: "GET /api/cursor/* · test.api.cursor.agent.mjs · BLOCKED in run-all catalog", paths: ["admin.portal.testscript/cursor/test.api.cursor.agent.mjs"] },
    { id: "cov-api-cursor-post", sev: "warn", status: "parziale", project: CR, voce: "Avvio agent", dettaglio: "POST /api/cursor/agent · push test 400/503 · no run cloud reale", paths: ["admin.portal.testscript/cursor/test.cruscotto.backlog.push.mjs"] },
    { id: "cov-gap-cursor-cancel", sev: "P4", status: "gap", project: CR, voce: "Cancel agent", dettaglio: "POST /api/cursor/agent/cancel · Gap: nessun test", paths: ["cruscotto.frontend/cruscotto.server.mjs"], create: { section: "Cursor agent", summary: "Test POST cursor/agent/cancel", detail: "Cancel agent non coperto." } },
  ],
  apiHome: [
    { id: "cov-home-health", sev: "warn", status: "parziale", project: PA, voce: "Health home-only", dettaglio: "GET /api/health · test.portal.home.health.mjs · opzionale in run-portal-api", paths: ["admin.portal/portal.home.server.mjs"] },
    { id: "cov-home-projects", sev: "info", status: "coperto", project: PA, voce: "Progetti", dettaglio: "GET /api/portal/projects · test.portal.home.projects.mjs", paths: ["admin.portal/portal.home.server.mjs"] },
    { id: "cov-gap-home-docs", sev: "P4", status: "gap", project: PA, voce: "Docs list / refresh", dettaglio: "GET/POST /api/docs/* · Gap: nessun test", paths: ["admin.portal/portal.home.server.mjs"], create: { section: "Portal HOME", summary: "Test /api/docs/list e refresh", detail: "API documenti HOME non in suite automatica." } },
    { id: "cov-gap-home-rules", sev: "P4", status: "gap", project: PA, voce: "Cursor rules docs", dettaglio: "/api/doc.cursor.rule/* · Gap: nessun test", paths: ["admin.portal/portal.home.server.mjs"], create: { section: "Portal HOME", summary: "Test API doc.cursor.rule", detail: "Endpoint regole Cursor su HOME non coperti." } },
    { id: "cov-gap-home-lifecycle", sev: "P4", status: "gap", project: PA, voce: "Istanze / lifecycle cruscotto", dettaglio: "POST open/start/kill-cruscotto · Gap: nessun test", paths: ["admin.portal/portal.home.server.mjs"], create: { section: "Portal HOME", summary: "Test lifecycle cruscotto da HOME", detail: "Spawn/kill cruscotto da HOME non testato." } },
    { id: "cov-gap-home-advancement", sev: "P4", status: "gap", project: PA, voce: "Matrix finding issues API", dettaglio: "/api/docs/matrix/* · Gap: nessun test", paths: ["admin.portal/portal.home.server.mjs"], create: { section: "Portal HOME", summary: "Test API matrix finding Jira", detail: "Creazione issue da finding matrice non testata." } },
  ],
  funz: [
    { id: "cov-funz-startup", sev: "info", status: "coperto", project: CR, voce: "Startup spawn cruscotto", dettaglio: "npm run test:cruscotto-startup · non in CI", paths: ["admin.portal.testscript/funzionali/test.cruscotto.startup.mjs"] },
    { id: "cov-funz-gogo", sev: "info", status: "coperto", project: CR, voce: "Backlog gogo UI", dettaglio: "npm run test:backlog-gogo · richiede Jira", paths: ["admin.portal.testscript/funzionali/test.cruscotto.backlog.gogo.mjs"] },
    { id: "cov-funz-gogo-rules", sev: "info", status: "coperto", project: CR, voce: "Gogo rules unit", dettaglio: "EXCLUDED catalog · rules.mjs standalone", paths: ["admin.portal.testscript/funzionali/test.cruscotto.backlog.gogo.rules.mjs"] },
    { id: "cov-funz-cursor-ui", sev: "info", status: "coperto", project: CR, voce: "Cursor UI markup", dettaglio: "npm run test:cursor-funzionale · non in CI", paths: ["admin.portal.testscript/cursor/test.cursor.agent.ui.mjs"] },
    { id: "cov-funz-wip-push", sev: "info", status: "coperto", project: CR, voce: "WIP push integrato", dettaglio: "test:backlog-push, run-portal-api", paths: ["admin.portal.testscript/cursor/test.cruscotto.backlog.push.mjs"] },
  ],
};

const priorityRows = [
  { id: "cov-prio-p1", sev: "P1", status: "fatto", project: PA, voce: "smoke-portal-api.mjs in test:ci", dettaglio: "Completato 2026-06-25", paths: ["test.smoke/smoke-portal-api.mjs"] },
  { id: "cov-prio-p2", sev: "P2", status: "fatto", project: CR, voce: "test.repo.services.processes.mjs", dettaglio: "Completato 2026-06-25", paths: ["admin.portal.testscript/repo/test.repo.services.processes.mjs"] },
  { id: "cov-prio-p3", sev: "P3", status: "gap", project: CR, voce: "MyBacklog API + insights + WIP enroll/poll", dettaglio: "Backlog test P3 — vedi sezioni API Jira e SPA", paths: ["cruscotto.frontend/cruscotto.jira.backlog.mjs"], create: { section: "Priorità backlog", summary: "Suite test P3 MyBacklog e insights", detail: "Implementare test per my-backlog, insights, WIP enroll e workflow preflight." } },
  { id: "cov-prio-p4", sev: "P4", status: "gap", project: PA, voce: "Portal HOME docs API, run/report, gap CLI", dettaglio: "Vedi sezioni HOME, run/report, config", paths: ["admin.portal/portal.home.server.mjs"], create: { section: "Priorità backlog", summary: "Suite test P4 HOME e run API", detail: "Coprire docs API HOME, run/report e gap analysis CLI." } },
  { id: "cov-prio-p5", sev: "P5", status: "gap", project: CR, voce: "POST /api/run/one su script leggero", dettaglio: "Vedi sezione API run / report", paths: ["cruscotto.frontend/cruscotto.server.mjs"], create: { section: "Priorità backlog", summary: "Test P5 POST /api/run/one", detail: "Un run automatico su script catalogo a basso impatto." } },
];

/**
 * @returns {import("../docs.portal.lib/matrix.render.mjs").MatrixSection[]}
 */
export function buildTestCoverageSections() {
  return [
    ...TEST_COVERAGE_SECTION_DEFS.map((def) => ({
      id     : def.id
    , title  : def.title
    , open   : def.open ?? false
    , badge  : `${DATA[def.id].length} voci`
    , rows   : DATA[def.id].map((row) => ensureMatrixRowCreateMeta(row, def.title))
    , columns: TEST_COVERAGE_COLUMNS
    }))
  , {
      id     : TEST_COVERAGE_PRIORITY_SECTION.id
    , title  : TEST_COVERAGE_PRIORITY_SECTION.title
    , open   : TEST_COVERAGE_PRIORITY_SECTION.open
    , badge  : `${priorityRows.filter((r) => r.status === "gap").length} aperti · ${priorityRows.length} voci`
    , rows   : priorityRows.map((row) => ensureMatrixRowCreateMeta(row, TEST_COVERAGE_PRIORITY_SECTION.title))
    , columns: TEST_COVERAGE_COLUMNS
    }
  ];
}

/**
 * @param {import("../docs.portal.lib/matrix.render.mjs").MatrixSection[]} sections
 * @param {{ generatedAt?: string, runId?: string | null, runSource?: string | null, embed?: boolean }} [opts]
 * @returns {import("../docs.portal.lib/matrix.render.mjs").MatrixPageConfig}
 */
export function buildTestCoveragePageConfig(sections, opts = {}) {
  const summary     = summarizeMatrixSections(sections);
  const generatedAt = opts.generatedAt ?? new Date().toISOString();
  const date        = generatedAt.slice(0, 19).replace("T", " ");
  const today       = generatedAt.slice(0, 10);

  return {
    title      : "Matrice copertura test — PortalAdmin"
  , pageTitle  : "PortalAdmin — Matrice copertura test"
  , generatedAt
  , metaHtml   : [
      `Matrice DB · ${date}`
    , opts.runId ? `· run <code>${opts.runId}</code>` : ""
    , opts.runSource ? `· fonte <code>${opts.runSource}</code>` : ""
    , `· Feature → test → gap · ${today} · correlati:`
    , `<a href="matrix.portal.gap.html">avanzamento repo</a>,`
    , `<a href="matrix.test.coverage.md">sorgente MD</a>`
    ].join(" ")
  , leadHtml   : opts.embed
      ? ""
      : [
          "Mappatura tracciabile di implementazione, test automatici e gap."
        , "Dati da tabelle <code>matrix_*</code> (<code>matrix_kind=test_coverage</code>)."
        ].join(" ")
  , metrics    : [
      { value: summary.total, meta: "Feature mappate" }
    , { value: summary.done, meta: "Coperte / fatte" }
    , { value: summary.partial, meta: "Parziali / manuali" }
    , { value: summary.gap, meta: "Gap aperti" }
    , { value: 8, meta: "Step smoke CI" }
    , { value: "P1–P2", meta: "Priorità chiuse" }
    ]
  , metricsBadge    : `${summary.gap} gap · ${summary.partial} parziali`
  , metricsCardTitle: "Sintesi copertura test"
  , sections
  , footerHtml : [
      "Persistenza:"
    , `<code>matrix_kind=test_coverage</code> ·`
    , `${sections.reduce((acc, sec) => acc + sec.rows.length, 0)} righe`
    ].join(" ")
  };
}

/**
 * @param {import("../docs.portal.lib/matrix.render.mjs").MatrixSection[]} sections
 * @returns {string}
 */
export function generateTestCoverageHtml(sections) {
  return renderMatrixPage(buildTestCoveragePageConfig(sections));
}

/**
 * @param {{ fullRender?: boolean }} [opts]
 * @returns {Promise<{ html: string, sections: import("../docs.portal.lib/matrix.render.mjs").MatrixSection[], merge: boolean, fromDb: boolean }>}
 */
export async function runTestCoverageMatrix({ fullRender = false, source = "matrix.test.coverage" } = {}) {
  let sections = buildTestCoverageSections();
  const dbPrimary = isMatrixDbPrimary();

  await persistUnifiedMatrixSections({
    matrixKind: MATRIX_KIND_TEST_COVERAGE
  , sections
  , source
  });

  if (dbPrimary) {
    const fromDb = await loadUnifiedMatrixSectionsFromDb(MATRIX_KIND_TEST_COVERAGE);

    if (fromDb.length > 0) {
      sections = fromDb;
    }
  }

  await enrichMatrixSectionsFromJira(sections, PORTAL_ROOT, { matrixKind: MATRIX_KIND_TEST_COVERAGE });
  const summary  = summarizeMatrixSections(sections);
  const metrics  = [
    { value: summary.total, meta: "Feature mappate" }
  , { value: summary.done, meta: "Coperte / fatte" }
  , { value: summary.partial, meta: "Parziali / manuali" }
  , { value: summary.gap, meta: "Gap aperti" }
  , { value: 8, meta: "Step smoke CI" }
  , { value: "P1–P2", meta: "Priorità chiuse" }
  ];
  const useFullRender = fullRender || dbPrimary;
  const mergeMode     = !useFullRender && existsSync(OUT);
  let html;

  if (mergeMode) {
    const existing = readFileSync(OUT, "utf8");
    let out        = stripFreshMarks(existing);

    out = refreshMatrixPageHtml(
      out
    , sections
    , new Map()
    , new Date().toISOString()
    , isFreshEntry
    , { metrics, metricsBadge: `${summary.gap} gap · ${summary.partial} parziali`, metricsOnly: dbPrimary }
    );
    html = out;
  } else {
    html = generateTestCoverageHtml(sections);
  }

  writeFileSync(OUT, html, "utf8");

  return { html, sections, merge: mergeMode, fromDb: dbPrimary };
}

const isCliMain = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCliMain) {
  const fullRender = process.argv.includes("--full") || !process.argv.includes("--merge");

  void runTestCoverageMatrix({ fullRender }).then(({ sections, merge, fromDb }) => {
    const summary = summarizeMatrixSections(sections);

    console.log(`Wrote ${OUT}${fullRender ? " (full)" : merge ? " (merge)" : ""} (${summary.total} rows, ${summary.gap} gaps)`);
  });
}
