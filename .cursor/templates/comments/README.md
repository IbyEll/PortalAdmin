# Template commenti — comando `comcom`

Quando in chat scrivi **`comcom nomefile`**, l'agente **deve leggere** uno dei template sotto (tool Read) e applicarne struttura e sezioni sul file indicato.

I template sono **riferimento obbligatorio** — non importati a runtime. Placeholder solo in commenti `/** */` e `//`; corpo esempio = sintassi JS valida.

## Scelta template

| Template | File da leggere | Quando |
| --- | --- | --- |
| **Script / entrypoint** | `script-entrypoint.mjs` | `#!/usr/bin/env node`, `runner/start_*.mjs`, `scripts/`, seed CLI, `main` implicito |
| **Libreria** | `lib-module.mjs` | `lib/*.mjs`, `runner/runner.stack.base.mjs`, `runner/runner.config.stack.mjs` — export, no argv |
| **Server / UI** | `app-module.mjs` | `server/`, `cruscotto/`, `api-portal/` |

Path base: `.cursor/templates/comments/`

## Regola Cursor

`.cursor/rules/ADMIN-Comcom.mdc` — sequenza: target + consumer → **Read template** → applica → output breve.

## Lingua

Commenti in **italiano**.

## Cosa non commentare

- import/export ovvi, re-export one-liner
- codice già autoesplicativo
- **non** cambiare logica

## Descrizione funzionale (nel template testata)

```text
Descrizione funzionale:
  Perché esiste: …
  A cosa serve: …
```

Derivare da codice + `grep` consumer del file target.

## Formattazione

- **No** riga vuota dopo ogni riga commento/codice — solo spaziatura normale tra sezioni.
- JSDoc compatto come `runner/runner.stack.mjs` (riferimento), non “una riga sì una no”.
- Write intero file: fine riga `\n`; preferire patch mirate.

## Checklist agente

- [ ] Template letto con Read (non solo README)
- [ ] Tipo file corretto (script / lib / app)
- [ ] Testata allineata al template scelto
- [ ] Step `// N.` come nel template
- [ ] Righe `*!` lasciate intatte
- [ ] Nessuna modifica al comportamento
