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
| `lib/cruscotto-db/` | SQLite cache Jira (ADMIN-81) |
| `data/` | Artefatti generati (DB, report) — **gitignored** |

Tree Admin/ migrato in ADMIN-91 — nessun prefisso `Admin/` nel repo PortalAdmin.

## Quick start

```bash
npm install
cp .env.example .env   # opzionale
npm run admin:dashboard
```

Apri http://localhost:3999/ — pagina bootstrap finché il cruscotto non è migrato (ADMIN-91).

## Dual-repo (ADMIN-90)

PortalAdmin e **JustLastOne** (product repo) sono repository separati. Il cruscotto legge codice e `testScript/` dal product repo via `PRODUCT_REPO_PATH`.

| Variabile | Default | Ruolo |
| --- | --- | --- |
| `PRODUCT_REPO_PATH` | `../JustLastOne` (sibling) | Root monorepo prodotto |

Layout consigliato:

```
C:/dev/
  JustLastOne/     ← product repo
  PortalAdmin/   ← questo repo
```

Se il product repo non esiste, gli script che scansionano il monorepo falliscono con messaggio esplicito.

Verifica path:

```bash
npm run test:paths
```

## Script npm

| Script | Descrizione |
| --- | --- |
| `admin:dashboard` | Avvia `server/dashboard-server.mjs` (:3999) |
| `db:migrate` | Stub fino a migrazione `lib/cruscotto-db` (ADMIN-91+) |
| `test:paths` | Smoke test `PRODUCT_REPO_PATH` + scan Jira refs |

## Migrazione

Ordine epic ADMIN-88: bootstrap (89) → `PRODUCT_REPO_PATH` (90) → estrazione tree (91) → runner (92) → …
