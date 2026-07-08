# Matrice gap PortalAdmin

## Architettura e avanzamento

| Sev | Voce | Dettaglio | Path | Stato |
| --- | --- | --- | --- | --- |
| info | Dual entrypoint HOME + Dashboard | Completato / allineato allo stato target 2026-06. | admin.portal/portal.home.server.mjs, cruscotto.frontend/cruscotto.server.mjs | fatto |
| info | Overlay in admin.portal.lib/overlay/ | Completato / allineato allo stato target 2026-06. | admin.portal.lib/overlay/ | fatto |
| info | Health/dev API in cruscotto.frontend | Completato / allineato allo stato target 2026-06. | cruscotto.frontend/cruscotto.health.mjs | fatto |
| info | Jira tooling canonico admin.portal.JiraCORE | Completato / allineato allo stato target 2026-06. | admin.portal.JiraCORE/ | fatto |
| info | cruscotto.frontend/jira/ eliminato | Completato / allineato allo stato target 2026-06. | cruscotto.frontend/jira/ | fatto |
| info | Documenti HTML + chrome su HOME :3990 | Completato / allineato allo stato target 2026-06. | docs.portal/, admin.portal/portal.home.html | fatto |
| info | start:dev → admin.script.standalone | Completato / allineato allo stato target 2026-06. | admin.script.standalone/start-dev.mjs | fatto |
| info | Smoke spostati in test.smoke/ | Completato / allineato allo stato target 2026-06. | test.smoke/ | fatto |
| info | PROJECT_Base fallback | Completato / allineato allo stato target 2026-06. | PROJECT_Base/ | fatto |
| info | portal.paths.resolver canonico | Completato / allineato allo stato target 2026-06. | admin.portal.lib/portal.paths.resolver.mjs | fatto |
| info | server/ legacy rimosso | Completato / allineato allo stato target 2026-06. | server/ | fatto |
| P1 | Jira Working de-integata (PARKING) | Migrazione incompleta o assente. | PARKING_tocheck/cruscotto.jira.working.html | gap |

## Gap analysis

| Sev | Voce | Dettaglio | Path | Stato |
| --- | --- | --- | --- | --- |
| P1 | PARKING_tocheck referenziato da moduli attivi | 1 moduli .mjs fuori PARKING importano o re-exportano da staging. | admin.portal.JiraCORE/jiraCORE.working.plan.generate.mjs | parziale |

## Bug

| Sev | Voce | Dettaglio | Path | Stato |
| --- | --- | --- | --- | --- |
| P1 | regenerateProjectTreeHtml chiamata senza import | POST route in cruscotto.server.mjs → ReferenceError a runtime; sorgente in PARKING_tocheck. | cruscotto.frontend/cruscotto.server.mjs, PARKING_tocheck/cruscotto.jira.project.tree.plan.mjs | gap |
| P1 | CI workflow importa portal-paths.mjs rimosso | Non più rilevato nel codice attivo (PARKING/docs esclusi). | — | fatto |

## Deprecation / drift

| Sev | Voce | Dettaglio | Path | Stato |
| --- | --- | --- | --- | --- |
| P2 | Commenti/doc citano runner/cruscotto.server.mjs (legacy) | 6 file attivi con path legacy; canonico cruscotto.frontend/cruscotto.server.mjs. · Ticket chiuso su Jira. | cruscotto.frontend/cruscotto.jira.my-project.analysis.mjs, cruscotto.frontend/cruscotto.jira.pillar.matrix.portal.generate.mjs, cruscotto.frontend/pillar-matrix.js, cruscotto.frontend/reports/working.plan.AdminDashBoard.fragment.html, cruscotto.frontend/reports/working.plan.AdminDashBoard.html, cruscotto.frontend/reports/working.plan.AdminDashBoard.payload.json | fatto |
| P2 | Consumer residui su portal-paths (shim rimosso) | 7 file importano admin.portal.lib/portal-paths.mjs non più presente. | admin.portal.lib/product.manifest.mjs, cruscotto.frontend/reports/working.plan.AdminDashBoard.fragment.html, cruscotto.frontend/reports/working.plan.AdminDashBoard.html, cruscotto.frontend/reports/working.plan.AdminDashBoard.payload.json, package.json, test.smoke/smoke-ci.mjs, test.smoke/smoke-portal-paths.mjs | gap |

## Feature completate

| Sev | Voce | Dettaglio | Path | Stato |
| --- | --- | --- | --- | --- |
| info | Documenti HOME con Aggiorna + analisi repo | docs.portal.lib — verifica automatica, sezione DOCS-AUTO-ADDITIONS, stelline su delta. | docs.portal.lib/docs.portal.mjs, docs.portal.lib/docs.portal.analysis.mjs, docs.portal/utility.toolbar.document.js | fatto |
| info | Multi-istanza overlay da HOME | portal.instance.mjs + card PROJECT_* + persistenza .env PRJ_NAME / PRODUCT_REPO_PATH. | admin.portal.lib/portal.instance.mjs, admin.portal/portal.home.html | fatto |
| info | JiraCORE gap analysis + close story workflow | CLI e Task agente per gap repo vs ticket, PR, catalogo segnali. | admin.portal.JiraCORE/jiraCORE.repo.issuekey.gap.analysis.mjs | fatto |

## Miglioramenti suggeriti

| Sev | Voce | Dettaglio | Path | Stato |
| --- | --- | --- | --- | --- |
| P2 | Promuovere moduli PARKING ancora live | my-project analysis, pillar generate → cruscotto.frontend/; ridurre import cross-PARKING. | PARKING_tocheck/cruscotto.jira.my-project.analysis.mjs, admin.portal.lib/overlay/dashboard.project.mjs | gap |
| P2 | CI job AdminDashBoard + smoke admin:home | portal-smoke.yml copre solo JustLastOne; nessuno smoke HOME :3990. | .github/workflows/portal-smoke.yml | gap |
| P2 | README allineato ad albero attuale | Aggiornare path cruscotto.frontend, test.smoke, assenza server/scripts. | README.md | gap |

## PARKING_tocheck — live nel flusso

| Sev | Voce | Dettaglio | Path | Stato |
| --- | --- | --- | --- | --- |
| P2 | My-project analysis da PARKING | dashboard.project.mjs importa analyze da PARKING_tocheck | PARKING_tocheck/cruscotto.jira.my-project.analysis.mjs, admin.portal.lib/overlay/dashboard.project.mjs | obsoleto |
| P2 | URL pilastri da PARKING | cruscotto.jira.backlog.pillars.mjs punta a cruscotto.jira.pillar.matrix.portal.mjs in PARKING | cruscotto.frontend/cruscotto.jira.backlog.pillars.mjs, PARKING_tocheck/cruscotto.jira.pillar.matrix.portal.mjs | obsoleto |
| P2 | close-story --pillar path obsoleto | jiraCORE.close.story.mjs --pillar usa git path cruscotto/pillar-matrix legacy | admin.portal.JiraCORE/jiraCORE.close.story.mjs, PARKING_tocheck/pillar-matrix-targeted.mjs | obsoleto |
| P2 | API regenerate pillar in PARKING | POST regenerate scrive in PARKING_tocheck/pillar-matrix/ non in frontend | cruscotto.frontend/cruscotto.server.mjs, PARKING_tocheck/cruscotto.jira.pillar.matrix.portal.generate.mjs | obsoleto |

## Ridondanze e drift

| Sev | Voce | Dettaglio | Path | Stato |
| --- | --- | --- | --- | --- |
| info | Config Jira scan canonica | admin.portal.JiraCORE/jira.project.config.mjs — gap analysis, signals, scan paths | admin.portal.JiraCORE/jira.project.config.mjs | fatto |
| warn | Copia jira in PARKING_tocheck | Drift parziale — nessun import live da PARKING jira/ | PARKING_tocheck/cruscotto.frontend/jira/ | obsoleto |
| warn | Commenti path overlay legacy | Regole Cursor e commenti citano admin.portal.lib/dashboard.project.mjs (spostato in overlay/) | admin.portal.lib/overlay/dashboard.project.mjs, .cursor/rules/ | obsoleto |
| P3 | Discovery + manifest + servicePathById | Stesso servizio descritto 3 volte per overlay — single source da definire | admin.portal.lib/discovery.services.repo.mjs, lib/product.manifest.mjs | obsoleto |
| info | Smoke spostati in test.smoke/ | Completato / allineato allo stato target 2026-06. | test.smoke/ | fatto |

## Gap import / runtime

| Sev | Voce | Dettaglio | Path | Stato |
| --- | --- | --- | --- | --- |
| P0 | working.plan.data.JustLastOne.mjs assente | Import in working.order.mjs e working.plan.overlay.mjs — file mancante in PROJECT_JustLastOne/ | PROJECT_JustLastOne/, cruscotto.frontend/cruscotto.jira.working.order.mjs, admin.portal.lib/overlay/working.plan.overlay.mjs | obsoleto |
| P1 | Import Confluence pillar generate | publish.mjs cerca generate-confluence-pillar-matrix.mjs — rinominato confluence.pillar.matrix.generate.mjs | admin.script.standalone/confluence.pillar.matrix.publish.mjs, admin.script.standalone/confluence.pillar.matrix.generate.mjs | obsoleto |
| P1 | pillar-matrix-diff solo in PARKING | confluence.pillar.matrix.publish.mjs importa ../admin.portal.lib/pillar-matrix-diff.mjs assente | PARKING_tocheck/pillar-matrix-diff.mjs, admin.script.standalone/confluence.pillar.matrix.publish.mjs | obsoleto |
| P2 | test:cruscotto-startup path errato | package.json punta a cruscotto.setup/ — file in funzionali/ | package.json, admin.portal.testscript/funzionali/test.cruscotto.startup.mjs | obsoleto |

## Miglioramenti consigliati

| Sev | Voce | Dettaglio | Path | Stato |
| --- | --- | --- | --- | --- |
| info | Smoke spostati in test.smoke/ | Completato / allineato allo stato target 2026-06. | test.smoke/ | fatto |
| P1 | Shim lib → JiraCORE | Smoke importano path admin.portal.lib/* — verificare re-export o aggiornare import diretti JiraCORE | admin.portal.JiraCORE/jira.function.repo.refs.mjs, test.smoke/smoke-portal-config.mjs | obsoleto |
| P2 | Scan paths Jira config | Rimuovere path fantasma server/, scripts/ da jira.project.config.mjs | admin.portal.JiraCORE/jira.project.config.mjs | parziale |
| P3 | Pulizia server/ e runner/ | Rimuovere residui orfani se non importati | server/, runner/ | obsoleto |
| warn | admin.portal.testscript fuori test:ci | ~23 script API — richiedono cruscotto up; non in smoke CI default — non più rilevato allo scan. | admin.portal.testscript/ | coperto |
| info | Comcom testata moduli principali | lib, PROJECT_*, test.smoke, cruscotto, JiraCORE, admin.portal — drift commenti legacy residuo | .cursor/rules/ADMIN-Comcom.mdc | coperto |

## Priorità backlog (R1–R7)

| Sev | Voce | Dettaglio | Path | Stato |
| --- | --- | --- | --- | --- |
| info | R1 — Fix path smoke npm/CI | Completato / allineato allo stato target 2026-06. | test.smoke/ | fatto |
| P1 | R2 — Shim lib JiraCORE | Smoke importano path admin.portal.lib/* — verificare re-export o aggiornare import diretti JiraCORE | admin.portal.JiraCORE/jira.function.repo.refs.mjs, test.smoke/smoke-portal-config.mjs | obsoleto |
| P0 | R3 — working.plan.data JLO | Import in working.order.mjs e working.plan.overlay.mjs — file mancante in PROJECT_JustLastOne/ | PROJECT_JustLastOne/, cruscotto.frontend/cruscotto.jira.working.order.mjs, admin.portal.lib/overlay/working.plan.overlay.mjs | obsoleto |
| P1 | R4 — Confluence publish + pillar-diff | publish.mjs cerca generate-confluence-pillar-matrix.mjs — rinominato confluence.pillar.matrix.generate.mjs | admin.script.standalone/confluence.pillar.matrix.publish.mjs, admin.script.standalone/confluence.pillar.matrix.generate.mjs | obsoleto |
| P2 | R5 — Promote PARKING frontend | my-project analysis, pillar generate → cruscotto.frontend/; ridurre import cross-PARKING. | PARKING_tocheck/cruscotto.jira.my-project.analysis.mjs, admin.portal.lib/overlay/dashboard.project.mjs | gap |
| P2 | R6 — CI AdminDashBoard + HOME | portal-smoke.yml copre solo JustLastOne; nessuno smoke HOME :3990. | .github/workflows/portal-smoke.yml | gap |
| P2 | R7 — Jira config unico + scan paths | Rimuovere path fantasma server/, scripts/ da jira.project.config.mjs | admin.portal.JiraCORE/jira.project.config.mjs | parziale |

