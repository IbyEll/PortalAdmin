---
name: jlo-analizza-repo
description: Gap analysis Jira vs codice — ADMIN-xxx (PortalAdmin) e JLO-xxx (product repo). CLI admin.portal.JiraCORE/jiraCORE.repo.issuekey.gap.analysis.mjs + JiraCORE.repo.issuekey.signal.analysis.mjs
---

# Analizza repo — PortalAdmin

## CLI

```bash
node admin.portal.JiraCORE/jiraCORE.repo.issuekey.gap.analysis.mjs --parent ADMIN-96 --format md
node admin.portal.JiraCORE/jiraCORE.repo.issuekey.gap.analysis.mjs --keys ADMIN-121,ADMIN-122
node admin.portal.JiraCORE/jiraCORE.repo.issuekey.gap.analysis.mjs --parent JLO-507 --format md
```

## Artefatti

| Path | Ruolo |
| --- | --- |
| `admin.portal.JiraCORE/jiraCORE.repo.issuekey.gap.analysis.mjs` | CLI |
| `admin.portal.JiraCORE/JiraCORE.repo.issuekey.signal.analysis.mjs` | Modulo analisi |
| `portal.config.mjs` | Segnali catalogo |
| `lib/function.repo.jira.refs.mjs` | Scan citazioni in product repo |

## Aree PortalAdmin

`admin.portal.lib/`, `server/`, `cruscotto/`, `scripts/`, `portal.config.mjs`

## Aree product (JLO)

`apps/`, `packages/`, `testScript/` via `PRODUCT_REPO_PATH`

Regola: `.cursor/rules/ADMIN-AnalizzaRepo.mdc`
