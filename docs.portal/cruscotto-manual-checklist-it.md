# Checklist manuale — Backlog e Insights (ADMIN-146)

Verifica UI cruscotto in **italiano** con dashboard avviato (`npm run admin:dashboard` → http://localhost:3999).

## Prerequisiti

- Layout dual-repo sibling (`../JustLastOne` + PortalAdmin)
- Opzionale: `npm run db:sync` per backlog da SQLite (altrimenti API Jira live con `JIRA_*` in `.env`)

## Backlog (`/backlog.html`)

| # | Verifica | Esito |
| --- | --- | --- |
| 1 | Pagina carica senza errori console | ☐ |
| 2 | Tabella/lista issue JLO+ADMIN visibile | ☐ |
| 3 | Filtri o ricerca rispondono (se presenti) | ☐ |
| 4 | Colonna «Repo ok» / allineamento repo popolata su ticket noti | ☐ |
| 5 | Albero pillar/epic espandibile | ☐ |

## Insights backlog

| # | Verifica | Esito |
| --- | --- | --- |
| 1 | Sezione insights backlog raggiungibile dalla UI | ☐ |
| 2 | Metriche o card insights non vuote (con Jira configurato) | ☐ |
| 3 | Nessun 502 persistente se credenziali Jira valide | ☐ |

## Automazione correlata

Smoke API (senza browser):

```bash
npm run test:portal-e2e
# oppure dal product repo:
node testScript/admin/test-portal-smoke.mjs
```

Endpoint coperti: `/api/jira/backlog`, `/api/jira/backlog/insights`, statiche `/backlog.html`.

## Note sessione

Segna ✅ in Jira subtask ADMIN-146 quando checklist completata o delegata a smoke automatizzato + spot-check UI locale.
