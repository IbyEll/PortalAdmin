# Template veve — description Jira

File riutilizzabili per **veve** / `aggiorna story` / `aggiorna subtask` (ADMIN-xxx e JLO-xxx in product repo).

| File | Uso |
| --- | --- |
| `veve-story-parent.md` | Story / Bug / Todo parent (step 3) |
| `veve-subtask.md` | Subtask (step 4) |

## Placeholder

Sostituisci `{…}` con valori reali da Leggi Jira + Analizza repo. Rimuovi sezioni opzionali se non applicabili.

| Placeholder | Fonte |
| --- | --- |
| `{KEY}` | Issue parent |
| `{EPIC-KEY}` | Epic link |
| `{DATE}` | Data analisi (oggi) |
| `{AREA}` / `{ESITO}` / `{NOTE}` | Tabella Stato repo da gap analysis |
| `{N}` / `{TOTAL}` | Ordine subtask |

## Regole veve

- Checkbox AC/DoD: default `[ ]`; promuovi a `[x]` con regole **B** poi **A** (vedi sotto).
- Stato repo da `scripts/analyze-repo-keys.mjs` + ispezione mirata.
- **ok chiudi** / **chiudi parent:** `.cursor/templates/workflow/`.

### Checkbox AC/DoD

| Regola | Parent | Subtask |
| --- | --- | --- |
| **B** (prima) | `[x]` se voce ↔ area **✅** in Stato repo | `[x]` se voce ↔ riga **✅** in Stato repo |
| **A** (poi) | `[x]` se subtask **Fatto** copre la voce; parent **Fatto** → tutti `[x]` salvo gap | Subtask **Fatto** → tutti DoD `[x]` salvo ⚠️/❌ |

Non azzerare `[x]` già presenti se B o A li confermano.

## Regole Cursor

- `ADMIN-Veve-AggiornaStory.mdc`, `ADMIN-Veve-AggiornaSubtask.mdc`
- JLO (product): `JustLastOne/.cursor/templates/veve/` — stesso schema
