# Go-live — Epic ADMIN-88 (ADMIN-148)

Checklist chiusura migration **PortalAdmin repository autonomo** (dual-repo con JustLastOne).

_Epic:_ [ADMIN-88](https://myfuturejobsearch.atlassian.net/browse/ADMIN-88)

---

## Layout dual-repo operativo

| # | Voce | Verifica |
| --- | --- | --- |
| 1 | Checkout sibling `JustLastOne/` + `PortalAdmin/` | `npm run test:paths` verde |
| 2 | `PRODUCT_REPO_PATH` punta al monorepo prodotto | `.env` o default `../JustLastOne` |
| 3 | `testScript/` scoperto da `runner/run-all.mjs --list` | `npm run test:run-all` verde |
| 4 | Report in `PortalAdmin/data/reports/` (gitignored) | run-all o dashboard run |

## Cruscotto e DB

| # | Voce | Verifica |
| --- | --- | --- |
| 5 | Dashboard :3999 — `npm run admin:dashboard` | UI «Cruscotto Dev» |
| 6 | SQLite — `npm run db:migrate` | schema cruscotto.db |
| 7 | Sync Jira — `npm run db:sync` (opz.) | richiede `JIRA_*` |
| 8 | Backlog API — `GET /api/jira/backlog` | 200 (DB/API) o 502 esplicito senza creds |

## Test e CI

| # | Voce | Key / script |
| --- | --- | --- |
| 9 | Smoke CI aggregate | `npm run test:ci` — ADMIN-95 |
| 10 | E2E portal smoke | `npm run test:portal-e2e` — ADMIN-100 / ADMIN-145 |
| 11 | testScript product | `testScript/admin/test-portal-smoke.mjs` |
| 12 | GitHub Actions portal-smoke | badge README, PR/push main |

## Story migrationADMIN (ordine epic)

| # | Key | Summary | Stato atteso |
| --- | --- | --- | --- |
| 1 | ADMIN-89 | Estrazione repo / scaffold | Fatto |
| 2 | ADMIN-90 | Dual-repo PRODUCT_REPO_PATH | Fatto |
| 3 | ADMIN-91 | Tree Admin/ migrato | Fatto |
| 4 | ADMIN-92 | Runner run-all testScript | Fatto |
| 5 | ADMIN-93 | portal.config.mjs | Fatto |
| 6 | ADMIN-94 | Cruscotto static + server | Fatto |
| 7 | ADMIN-95 | CI/CD standalone | Fatto |
| 8 | ADMIN-96 | Workflow Cursor | Fatto |
| 9 | ADMIN-97 | Regole agent | Fatto |
| 10 | ADMIN-99 | Cruscotto DB sync post-split | Fatto |
| 11 | ADMIN-100 | Verifica E2E full | Fatto (questa story) |

## Blocker aperti

_Nessuno — migrationADMIN operativa su layout sibling documentato in README._

---

_Documento generato in chiusura ADMIN-100. Merge PR PortalAdmin su `main` a cura maintainer._
