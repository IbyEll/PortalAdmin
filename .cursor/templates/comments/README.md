# Template commenti — comando `comcom`

Quando in chat scrivi **`comcom nomefile`**, l'agente **deve sempre** leggere un template (tool Read) e applicarne struttura e sezioni sul file indicato.

I template sono **riferimento obbligatorio** — non importati a runtime. Il corpo esempio nei template (dove presente) è solo sintassi JS di riferimento.

## Scelta template (ordine)

| Priorità | Template | File da leggere | Quando |
| --- | --- | --- | --- |
| 1 | **Testscript** | `testscript.mjs` | `testScript/` (product), `test.smoke/`, `admin.portal.testscript/`, suite `runTest`/`assert` |
| 2 | **Script / entrypoint** | `script-entrypoint.mjs` | `#!/usr/bin/env node`, `scripts/`, seed CLI, `main` implicito, argv (non test) |
| 3 | **Libreria** | `lib-module.mjs` | `lib/`, `cruscotto.database/`, `runner/*-lib.mjs`, export senza argv |
| 4 | **Server / UI** | `app-module.mjs` | `server/`, `runner/*server*.mjs`, handler HTTP Node |
| 5 | **Pagina HTML** | `page-html.html` | `.html` in `cruscotto.frontend/`, `admin.portal/`, `pillar-matrix/`, pagine generate Jira |
| 6 | **Script pagina HTML** | `page-html.mjs` | `.js`/`.mjs` client servito con una HTML (no `import` Node, no `#!/usr/bin/env node`) |
| 7 | **Foglio stili pagina** | `page-styles.css` | `.css` in `cruscotto.frontend/`, `pillar-matrix/`, `admin.portal/` — link da HTML cruscotto o alias server |
| 8 | **Regola Cursor** | `cursor-rule.mdc` | `.cursor/rules/*.mdc` — policy agente, workflow, veve, comcom, silenzio |
| 9 | **Default (fallback)** | `template_default.mjs` | Dubbio tra i tipi sopra, `.ps1`/`.sh`, config, path misti, estensioni non coperte |

**Regola:** se il tipo non è chiaro dopo aver letto il file → **`template_default.mjs`** (mai inventare un formato libero).

Path base: `.cursor/templates/comments/`

## Regola Cursor

`.cursor/rules/ADMIN-Comcom.mdc` — sequenza: target + consumer → **Read template** → applica → **valida** → output breve.

## Lingua

Commenti in **italiano** (salvo termini tecnici: CLI, env, path).

## Formato testata (tutti i template)

```text
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - bullet concreto
 *
 *   A cosa serve:
 *   - bullet concreto
 *
 * Consumatori:
 *   - path — ruolo
```

- Riga vuota dopo `Descrizione funzionale:` e tra sottosezioni.
- Ogni voce sotto Consumatori, Export, Uso, Prerequisiti: prefisso `-` (lib/script) o allineamento colonne (Flag CLI, env) come nel template scelto.
- **Generalizzazione** + **Input** obbligatori in testata (vedi sotto).
- **Vietato** nel file target: placeholder `{…}`, testo guida del template, sezioni copiate vuote.

## Generalizzazione (tutti i template)

Dopo *A cosa serve*, documentare se il file è **generalizzato** (multi-overlay / parametrizzato) o **no**.

| Esito | Testata |
| --- | --- |
| **Si** | Una riga che spiega perché (es. overlay `PROJECT_*`, argv `--key`, env product) + elenco **Input** con origine |
| **No** | Una riga che spiega perché è dedicato + `Input: —` |

Esempi di input da citare quando pertinenti: `PRJ_NAME`, `PRODUCT_REPO_PATH`, `JIRA_PROJECT_KEYS`, flag CLI, `window.CRUSCOTTO_PROJECT`, `data-cruscotto-bind`, parametri HTTP, payload API.

## Re-comcom — `creato il` / `by`

| | Primo comcom | Re-comcom |
| --- | --- | --- |
| **creato il / by** | Ora corrente + `git config user.name` | **Preservare** dal file esistente |
| **commentato il / modificato il** | Ora corrente | **Aggiornare** a ora corrente |

Dettaglio: `.cursor/rules/ADMIN-Comcom.mdc` (§ Re-comcom).

## Testata metadati (righe `---`)

Prima del blocco titolo stellato:

1. Riga `---` (120 trattini)
2. Riga tipo `** LIBRARY MODULE ** -- commentato il: …` (o APPLICATION / SCRIPT ENTRYPOINT / PAGE SCRIPT / PAGE HTML / **STYLESHEET**) — allineata a sinistra
3. Riga `---`
4. `creato il` / `modificato il` / `ticket refirement` (opzionale)
5. Riga `---`
6. Sezioni testata (Descrizione, Generalizzazione, Uso, …)
7. Riga `---` **finale** (120 trattini) — subito prima di `*/`

## Corpo codice — step `// N.` / sezioni `/* --- */`

Vedi `ADMIN-Comcom.mdc` (§ Corpo codice): script/server/lib con step numerati; CSS con sezioni tematiche.

## Titolo (blocco stellato)

- **Larghezza banda:** 120 caratteri (riga `*`).
- **Max 120 caratteri** per riga (solo testo titolo).
- Se più lungo → righe aggiuntive; **a capo su spazio**, **mai** spezzare parole.
- **Centrato** nella banda: padding sinistro dopo ` * ` (JSDoc) o `*` (HTML); formula in `ADMIN-Comcom.mdc`.

## Testo (commenti, escluso titolo)

- **Max 120 caratteri/riga**; a capo su spazio — **mai** spezzare parole.
- Vale per bullet, Generalizzazione, Input, Consumatori, Export, step `// N.`, ecc.
- Il **titolo** stellato usa le stesse 120 caratteri/riga ma con **centratura** in banda 120.

## Cosa non commentare

- import/export ovvi, re-export one-liner
- codice già autoesplicativo
- **non** cambiare logica

## Formattazione

- Preferire patch mirate (`StrReplace`); Write intero file con fine riga `\n` (LF).
- JSDoc compatto come `cruscotto.database/index.mjs`, non “una riga sì una no”.
- Righe `*!` intoccabili.

## Checklist agente

### Applicazione (passi 1–4)

- [ ] Template letto con Read (obbligatorio — mai solo README)
- [ ] Tipo corretto o **template_default** se dubbio
- [ ] Testata con bullet e righe vuote come nel template
- [ ] **Generalizzazione** (Si/No) + **Input** compilati da codice reale
- [ ] **Titolo:** ≤120 caratteri/riga; a capo su spazio; **centrato** nella banda 120
- [ ] **Testo:** ≤120 caratteri/riga; a capo su spazio; mai spezzare parole
- [ ] **Re-comcom:** `creato il` / `by` preservati se già in testata; solo `commentato`/`modificato` aggiornati
- [ ] Step `// N.` o sezioni `/* --- */` come nel template (dove applicabile)
- [ ] Nessuna modifica al comportamento

### Validazione commento (passo 5 — obbligatorio prima di chiudere)

- [ ] **V1–V2:** zero placeholder schema e zero `{…}` in commenti testata/step
- [ ] **V3:** zero glob `*` nel testo (`resolve*`, `PROJECT_*/` → nomi espliciti)
- [ ] **V4–V5:** separatori `---` a 120 trattini; riga `---` finale prima di `*/`
- [ ] **V6–V7:** righe commento ≤120 caratteri; a capo solo su spazio
- [ ] **V8–V10:** metadati, Descrizione funzionale a bullet, Generalizzazione + Input
- [ ] **V11:** re-comcom — `creato il` preservato se già presente
- [ ] **V12–V14:** step corpo, italiano, solo commenti modificati

Dettaglio controlli: `.cursor/rules/ADMIN-Comcom.mdc` (§ Validazione commento).

### Output

- [ ] Una riga: `template X + path`
