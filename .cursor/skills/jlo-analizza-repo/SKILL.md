---
name: jlo-analizza-repo
description: Gap analysis Jira vs codice — ADMIN-xxx (PortalAdmin) e JLO-xxx (product repo). CLI scripts/analyze-repo-keys.mjs + lib/jira-repo-analysis.mjs
---

# Analizza repo — PortalAdmin

## CLI

```bash
node scripts/analyze-repo-keys.mjs --parent ADMIN-96 --format md
node scripts/analyze-repo-keys.mjs --keys ADMIN-121,ADMIN-122
node scripts/analyze-repo-keys.mjs --parent JLO-507 --format md
```

## Artefatti

| Path | Ruolo |
| --- | --- |
| `lib/jira-repo-analysis.mjs` | Modulo analisi |
| `scripts/analyze-repo-keys.mjs` | CLI |
| `portal.config.mjs` | Segnali catalogo |
| `lib/function.repo.jira.refs.mjs` | Scan citazioni in product repo |

## Aree PortalAdmin

`lib/`, `server/`, `cruscotto/`, `scripts/`, `portal.config.mjs`

## Aree product (JLO)

`apps/`, `packages/`, `testScript/` via `PRODUCT_REPO_PATH`

Regola: `.cursor/rules/ADMIN-AnalizzaRepo.mdc`
