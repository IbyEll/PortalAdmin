# Matrice copertura test PortalAdmin

Feature → test → gap · aggiornata 2026-06-25.

Legenda: **✅** coperto · **⚠️** parziale · **❌** assente · **🔒** blocked/manuale

Pagina narrativa: [test-coverage-portaladmin.html](./test-coverage-portaladmin.html) ·
Layout Avanzamento: [test-coverage-matrix.html](./test-coverage-matrix.html)

---

## Orchestrazione

| Feature | Implementazione | Test | Gap | P |
| --- | --- | --- | --- | --- |
| Smoke CI aggregate | `test.smoke/smoke-ci.mjs` | `npm run test:ci` | — | — |
| API read-only suite | `admin.portal.testscript/run-portal-api.mjs` | `npm run test:portal-api` | Richiede cruscotto up se non in CI | P1 |
| Portal API in CI | `test.smoke/smoke-portal-api.mjs` | step in `test:ci` | — | P1 ✅ |
| Discovery run-all | `admin.portal.lib/test.run.all.mjs` | `smoke-run-all.mjs` | Solo `--list`, non esecuzione run | — |

---

## Config, path, workflow (offline)

| Feature | Implementazione | Test | Gap | P |
| --- | --- | --- | --- | --- |
| Path resolver / product repo | `admin.portal.lib/portal.paths.resolver.mjs` | `smoke-portal-paths.mjs` | — | — |
| Overlay / manifest / segnali | `admin.portal.lib/project.config.mjs`, `jira.project.config.overlay.mjs` | `smoke-portal-config.mjs` | — | — |
| Scan citazioni Jira in repo | `admin.portal.JiraCORE/jira.function.repo.refs.mjs` | `smoke-portal-config.mjs` | — | — |
| Regole workflow `.cursor` | `ADMIN-Workflow.mdc`, skills | `smoke-workflow.mjs` | — | — |
| Close story dry-run | `jiraCORE.close.story.mjs` | `smoke-workflow.mjs`, `smoke-portal-config.mjs` | Solo dry-run, no push/PR reali | — |
| Catalogo segnali / branch ticket | `JiraCORE.signals.catalog.implementation.mjs` | `smoke-workflow.mjs` | — | — |
| Gap analysis CLI | `jiraCORE.repo..issuekey.gap.analysis.mjs` | — | ❌ Nessun smoke | P4 |

---

## Cruscotto DB

| Feature | Implementazione | Test | Gap | P |
| --- | --- | --- | --- | --- |
| Path DB overlay | `cruscotto.database/cruscotto.db.config.mjs` | `smoke-cruscotto-db.mjs` | — | — |
| Migrate schema | `cruscotto.database/migrate.mjs` | `smoke-cruscotto-db.mjs` | — | — |
| Load backlog cache | `jiraCORE.backlog.load.mjs` | `smoke-cruscotto-db.mjs` | DB vuoto only | — |
| Sync Jira → DB | `jiraCORE.backlog.sync.mjs` | — | ❌ No test (serve Jira live) | P3 |

---

## HTTP statico / SPA shell

| Feature | Implementazione | Test | Gap | P |
| --- | --- | --- | --- | --- |
| `/`, `/app.html`, `/home.html` | `cruscotto.home.html` | `smoke-dashboard.mjs` | Body minimo, no JS routing | — |
| `/backlog.html` | `cruscotto.jira.backlog.html` | `smoke-dashboard.mjs`, gogo test | No assert render tabella | — |
| `/my-backlog.html` | `cruscotto.jira.my-backlog.html` | push test (markup) | ❌ No fetch API my-backlog | P3 |
| `/issue.html` | issue display | — | ❌ | P4 |
| `/project-overview.html` | project overview | — | ❌ | P4 |
| Tab Process inline | `cruscotto.home.js` `#section-process` | — | ❌ UI non testata | P2 |
| Tab Cursor inline | `cruscotto.home.js` | `test.cursor.agent.ui.mjs` | 🔒 Fuori run-portal-api | — |
| Deep-link tab `/process` | `cruscotto.server.mjs` redirect | — | ❌ | — |

---

## API cruscotto — health / bootstrap

| Feature | Endpoint | Test | Gap | P |
| --- | --- | --- | --- | --- |
| Health stack | `GET /api/health` | `test.api.health.mjs`, smoke | — | — |
| Run manager status | `GET /api/status` | `test.api.status.mjs` | — | — |
| Bootstrap UI | `GET /api/cruscotto/project` | `test.cruscotto.project.mjs` | — | — |
| Catalogo scripts | `GET /api/scripts` | `test.scripts.catalog.mjs`, e2e fallback | — | — |

---

## API cruscotto — dev / meta

| Feature | Endpoint | Test | Gap | P |
| --- | --- | --- | --- | --- |
| Requisiti stack | `GET /api/dev/requirements` | `test.dev.requirements.mjs` | — | — |
| Servizi + probe | `GET /api/dev/services` | `test.dev.services.mjs`, e2e | — | — |
| Meta test tecnici | `GET /api/tecnici/meta` | `test.tecnici.meta.mjs` | — | — |
| Meta test funzionali | `GET /api/funzionali/meta` | `test.funzionali.meta.mjs` | — | — |

---

## API cruscotto — repo services / Process

| Feature | Endpoint | Test | Gap | P |
| --- | --- | --- | --- | --- |
| Discover servizi | `GET /api/repo/services/discover` | `test.repo.services.discover.mjs` | — | — |
| Stato stack avviato | `GET /api/repo/services/status` | `test.repo.services.status.mjs` | — | — |
| Tabella Process (PID/porte) | `GET /api/repo/services/processes` | `test.repo.services.processes.mjs` | — | P2 ✅ |
| Log console Process | `GET/DELETE /api/repo/services/logs` | — | ❌ | P3 |
| Start/stop stack | `POST .../start`, `stop`, `start-one`, `stop-one` | — | ❌ Side-effect | P4 |
| DB product reset/seed/push | `POST /api/repo/database/*` | — | ❌ Side-effect | P4 |

---

## API cruscotto — run / report

| Feature | Endpoint | Test | Gap | P |
| --- | --- | --- | --- | --- |
| Run suite / one / case | `POST /api/run*` | — | ❌ | P5 |
| Report JSON/HTML | `GET /api/report*` | — | ❌ | P4 |
| Export Excel | `GET /api/export` | — | ❌ | P4 |
| Analisi tecnici | `POST/GET .../tecnici-analysis*` | — | ❌ | P4 |

---

## API cruscotto — Jira

| Feature | Endpoint | Test | Gap | P |
| --- | --- | --- | --- | --- |
| Backlog live | `GET /api/jira/backlog` | `test.jira.backlog.mjs`, gogo | 502 ok senza credenziali | — |
| Backlog insights | `GET /api/jira/backlog/insights` | — | ❌ | P3 |
| MyBacklog cache | `GET /api/jira/my-backlog` | — | ❌ | P3 |
| Sync MyBacklog | `POST /api/jira/my-backlog/sync` | — | ❌ | P3 |
| Issue live / DB | `GET /api/jira/issue/:KEY` | — | ❌ | P4 |
| WIP status | `GET /api/jira/wip/status` | `test.cruscotto.backlog.push.mjs` | — | — |
| WIP push | `POST /api/jira/wip/push` | push test (400/409) | Dry-run opzionale env | — |
| WIP enroll / finalize / pr-poll | `POST /api/jira/wip/*` | — | ❌ | P3 |
| Gogo preflight / PR URL | `GET /api/workflow/*` | — | ❌ | P3 |
| My-project / project-overview analyze | `GET /api/*-overview/analyze` | — | ❌ | P4 |

---

## API cruscotto — portal instance (su dashboard)

| Feature | Endpoint | Test | Gap | P |
| --- | --- | --- | --- | --- |
| Lista progetti | `GET /api/portal/projects` | `test.portal.projects.mjs` | — | — |
| Istanza attiva | `GET /api/portal/instance` | `test.portal.instance.mjs` | — | — |
| Attiva overlay | `POST /api/portal/instance` | — | ❌ Side-effect | P4 |

---

## API cruscotto — Cursor agent

| Feature | Endpoint | Test | Gap | P |
| --- | --- | --- | --- | --- |
| Config / status / logs | `GET /api/cursor/*` | `test.api.cursor.agent.mjs` | 🔒 BLOCKED in run-all catalog | — |
| Avvio agent | `POST /api/cursor/agent` | push test (400/503) | No run cloud reale | — |
| Cancel agent | `POST /api/cursor/agent/cancel` | — | ❌ | P4 |

---

## Portal HOME (`admin.portal/portal.home.server.mjs`)

| Feature | Endpoint | Test | Gap | P |
| --- | --- | --- | --- | --- |
| Health home-only | `GET /api/health` | `test.portal.home.health.mjs` | Opzionale in run-portal-api | — |
| Progetti | `GET /api/portal/projects` | `test.portal.home.projects.mjs` | — | — |
| Docs list / refresh | `GET/POST /api/docs/*` | — | ❌ | P4 |
| Cursor rules docs | `/api/doc.cursor.rule/*` | — | ❌ | P4 |
| Istanze / lifecycle cruscotto | `POST open/start/kill-cruscotto`, `node-processes` | — | ❌ | P4 |
| Advancement finding issues | `/api/docs/advancement/*` | — | ❌ | P4 |

---

## Funzionali (fuori CI default)

| Feature | Script | Test | Gap | P |
| --- | --- | --- | --- | --- |
| Startup spawn cruscotto | `test.cruscotto.startup.mjs` | `npm run test:cruscotto-startup` | Non in CI | — |
| Backlog gogo UI | `test.cruscotto.backlog.gogo.mjs` | `npm run test:backlog-gogo` | Richiede Jira | — |
| Gogo rules unit | `test.cruscotto.backlog.gogo.rules.mjs` | — | EXCLUDED catalog | — |
| Cursor UI markup | `test.cursor.agent.ui.mjs` | `npm run test:cursor-funzionale` | Non in CI | — |
| WIP push integrato | `test.cruscotto.backlog.push.mjs` | `npm run test:backlog-push`, run-portal-api | — | — |

---

## Priorità backlog test

| ID | Azione | Stato |
| --- | --- | --- |
| P1 | `smoke-portal-api.mjs` in `test:ci` | ✅ |
| P2 | `test.repo.services.processes.mjs` | ✅ |
| P3 | MyBacklog API + insights + WIP enroll/poll | ❌ |
| P4 | Portal HOME docs API, run/report, gap CLI | ❌ |
| P5 | `POST /api/run/one` su script leggero | ❌ |

---

## Comandi rapidi

```bash
npm run test:ci
npm run test:portal-api          # cruscotto già up
node test.smoke/smoke-portal-api.mjs   # spawn + portal-api (--skip-home)
```
