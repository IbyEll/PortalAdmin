# PortalAdmin

Repository autonomo per l'**Admin Dashboard** estratto da [JustLastOne](https://github.com/IbyEll/JustLastOne) (`Admin/`).

**Epic Jira:** [ADMIN-88](https://myfuturejobsearch.atlassian.net/browse/ADMIN-88) — `[migrationADMIN] PortalAdmin — repository autonomo`

## Prerequisiti

- **Node.js 20+** (ESM nativo)
- npm 10+
- Accesso Jira (token API) — opzionale fino a integrazione backlog live

## Layout cartelle

| Cartella | Ruolo |
| --- | --- |
| `server/` | `dashboard-server.mjs` — HTTP static + API (stub bootstrap) |
| `cruscotto/` | SPA frontend cruscotto |
| `lib/` | Helper condivisi (env, Jira, catalogo) |
| `runner/` | Orchestrazione test (`run-all.mjs`) — migrato in ADMIN-92 |
| `report/` | Report HTML/JSON test — migrato in ADMIN-91 |
| `export/` | Export Excel report |
| `scripts/` | Script CLI (Jira, pillar matrix, close-story) |
| `data/` | Artefatti generati (DB SQLite, report) — **gitignored** |

## Quick start

```bash
npm install
cp .env.example .env   # opzionale
npm run admin:dashboard
```

Apri http://localhost:3999/ — pagina bootstrap finché il cruscotto non è migrato (ADMIN-91).

## Script npm

| Script | Descrizione |
| --- | --- |
| `admin:dashboard` | Avvia `server/dashboard-server.mjs` (:3999) |
| `db:migrate` | Stub fino a migrazione `lib/cruscotto-db` (ADMIN-91+) |

## Migrazione

Ordine epic ADMIN-88: bootstrap (89) → `PRODUCT_REPO_PATH` (90) → estrazione tree (91) → runner (92) → …
