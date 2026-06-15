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
| `server/` | `dashboard-server.mjs` — HTTP static + API run/status/report |
| `cruscotto/` | SPA frontend cruscotto |
| `runner/` | `run-all.mjs` — orchestrazione testScript nel **product repo** |
| `lib/` | Helper condivisi (env, Jira, catalogo, `portal-paths`) |
| `lib/cruscotto-db/` | SQLite cache Jira (ADMIN-81) |
| `data/` | Artefatti generati (DB, report) — **gitignored** |

Tree Admin/ migrato in ADMIN-91 — nessun prefisso `Admin/` nel repo PortalAdmin.

## Quick start

```bash
npm install
cp .env.example .env   # opzionale
npm run admin:dashboard
```

Apri http://localhost:3999/

## Runner e testScript (ADMIN-92)

I test vivono nel **product repo** (`JustLastOne/testScript/`). PortalAdmin li orchestra e scrive i report in locale.

| Path | Repo | Contenuto |
| --- | --- | --- |
| `{PRODUCT_REPO}/testScript/` | JustLastOne | Script `test-*.mjs` eseguiti |
| `runner/run-all.mjs` | PortalAdmin | Discovery + run sequenziale |
| `data/reports/latest.json` | PortalAdmin | Ultimo report JSON |
| `data/reports/latest.html` | PortalAdmin | Report HTML offline |

Layout sibling (consigliato):

```
C:/dev/
  JustLastOne/          ← PRODUCT_REPO_PATH (default ../JustLastOne)
    testScript/
    apps/
  PortalAdmin/          ← questo repo
    runner/run-all.mjs
    data/reports/       ← gitignored
```

Comandi:

```bash
node runner/run-all.mjs --list          # discovery testScript
node runner/run-all.mjs --suite auth    # run suite (richiede stack :4000/:4001)
npm run test:run-all                      # smoke discovery
```

`POST /api/run` sul dashboard avvia `runner/run-all.mjs` in PortalAdmin con script da product repo.

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

## portal.config.mjs (ADMIN-93)

Segnali repo e progetti Jira configurabili **senza** modificare `lib/jira-backlog-insights.mjs`:

| Export | Ruolo |
| --- | --- |
| `JIRA_PROJECT_KEYS` | Progetti ammessi nello scan (`JLO`, `ADMIN`) |
| `REPO_IMPLEMENTATION_SIGNALS` | Path noti per ticket → colonna «Repo ok» nel cruscotto |

Esempio entry:

```javascript
{
  key   : "ADMIN-81"
, label : "Schema SQLite cruscotto"
, paths : ["lib/cruscotto-db/prisma/schema.prisma"]
}
```

`close-story.mjs --key ADMIN-81` e `analyze-repo-keys.mjs --parent ADMIN-88` accettano key `ADMIN-*`.

## Workflow Cursor (ADMIN-96)

Regole agent in `.cursor/rules/`:

| File | Ruolo |
| --- | --- |
| `ADMIN-Workflow.mdc` | gogo / procedi / chiudi su ticket ADMIN-xxx |
| `ADMIN-AnalizzaRepo.mdc` | gap analysis + CLI `analyze-repo-keys` |
| `ADMIN-Veve*.mdc` | grooming Jira read-only |
| `JLO-Workflow.mdc` | alias → ADMIN-Workflow |

Skills: `.cursor/skills/jlo-jira-auto/`, `jlo-analizza-repo/`

```bash
npm run test:workflow   # smoke rules + close-story ADMIN dry-run
```

| Script | Descrizione |
| --- | --- |
| `admin:dashboard` | Avvia `server/dashboard-server.mjs` (:3999) |
| `db:migrate` | Migrazione SQLite cruscotto (`lib/cruscotto-db`) |
| `test:paths` | Smoke `PRODUCT_REPO_PATH` + scan Jira refs |
| `test:run-all` | Smoke discovery `run-all.mjs --list` |
| `test:config` | Smoke `portal.config.mjs` + ADMIN keys + close-story |
| `test:workflow` | Smoke regole Cursor + catalog ADMIN branch |

## Migrazione

Ordine epic ADMIN-88: bootstrap (89) → `PRODUCT_REPO_PATH` (90) → estrazione tree (91) → runner (92) → …
