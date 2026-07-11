#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-26 08:40
 * ------------------------------------------------------------------------------------------------------------------------
 * creato il: 2026-06-26 08:40 by: IbyEll
 * modificato il: 2026-06-26 08:40 by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              CLI template — genera pagina matrice HTML da JSON o configurazione esempio
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Nuove matrici docs devono partire da uno scheletro HTML coerente con gap analysis e
 *     Avanzamento senza copiare renderMatrixPage a mano.
 *
 *   A cosa serve:
 *   - Legge JSON opzionale (--data), applica exampleConfig di default e scrive HTML via
 *     matrix.render.mjs; --describe stampa guida procedurale su stdout.
 *
 * Generalizzazione:
 *   Si — MatrixPageConfig da file JSON o modulo esterno; path output da --out.
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - argv --out — path file HTML di destinazione
 *   - argv --data — path JSON MatrixPageConfig opzionale
 *   - argv --describe — help testuale ed exit 0
 *
 * Uso:
 *   - node docs.portal/matrix.template.mjs --out docs.portal/my-matrix.html --data my.json
 *   - node docs.portal/matrix.template.mjs --describe
 *
 * Flag CLI:
 *   --help, -h     non implementato — usare --describe
 *   --out          path output HTML
 *   --data         path JSON configurazione matrice
 *   --describe     stampa guida ed exit 0
 *
 * Consumatori:
 *   - Sviluppo manuale — bootstrap nuove pagine matrice docs.portal
 *
 * Export principali:
 *   - exampleConfig — configurazione esempio per test o default CLI
 *   - parseArgs — parsing argv CLI
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

/**
 * Esempio generico — crea una pagina matrice HTML da dati JSON o inline.
 *
 * Uso:
 *   node docs.portal/matrix.template.mjs --out docs.portal/my-matrix.html --data my-matrix.json
 *   node docs.portal/matrix.template.mjs --describe
 *
 * Formato JSON (--data):
 * {
 *   "title": "Titolo pagina",
 *   "pageTitle": "Browser title",
 *   "leadHtml": "…",
 *   "metaHtml": "…",
 *   "metrics": [{ "value": 10, "meta": "Etichetta" }],
 *   "metricsBadge": "3 gap",
 *   "sections": [{
 *     "id": "sec1",
 *     "title": "Sezione",
 *     "badge": "5 voci",
 *     "open": true,
 *     "columns": ["Sev", "Issue refinement", "Project", "Voce", "Dettaglio", "Path", "Stato"],
 *     "rows": [{
 *       "id": "row-1",
 *       "sev": "P2",
 *       "status": "gap",
 *       "project": "PortalAdmin",
 *       "voce": "Titolo riga",
 *       "dettaglio": "Descrizione",
 *       "paths": ["path/file.mjs"],
 *       "create": { "section": "Sezione", "summary": "…", "detail": "…" }
 *     }]
 *   }]
 * }
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

import { renderMatrixPage } from "./matrix.render.mjs";

const DOCS_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * @param {string[]} argv
 * @returns {{ out: string, dataPath: string | null, describe: boolean }}
 */
function parseArgs(argv) {
  const outIdx   = argv.indexOf("--out");
  const dataIdx  = argv.indexOf("--data");

  return {
    out     : outIdx >= 0 ? resolve(argv[outIdx + 1]) : join(DOCS_DIR, "matrix.example.html")
  , dataPath: dataIdx >= 0 ? resolve(argv[dataIdx + 1]) : null
  , describe: argv.includes("--describe")
  };
}

function printDescribe() {
  console.log(`# Template matrice HTML PortalAdmin

Renderer: docs.portal.lib/docs.portal.matrix.render.mjs

## Creare una nuova matrice

1. Prepara i dati (JSON o modulo JS) con sezioni \`rows[]\`.
2. Ogni riga: id, sev, status (coperto|parziale|gap|fatto|blocked), project, voce, dettaglio, paths[].
3. Gap aperti: opzionale \`create: { section, summary, detail }\` per pulsante Crea Jira.
4. Genera HTML:

\`\`\`bash
node docs.portal/matrix.template.mjs --out docs.portal/my-matrix.html --data my-matrix.json
\`\`\`

## Esempi nel repo

| Script | Output |
| --- | --- |
| portal-gap-analysis.mjs | portal-gap-matrix.html (analisi automatica) |
| test-coverage-matrix.mjs | test-coverage-matrix.html (dati inline) |
| repo-audit-ridondanze-gap.mjs | repo-audit-ridondanze-gap.html (audit narrativo) |
| Avanzamento_Gap_Feature.mjs | Avanzamento_Gap_Feature.html (merge finding) |

## Procedura gap analysis completa

\`\`\`bash
node docs.portal/portal-gap-analysis.procedure.mjs --describe
node docs.portal/portal-gap-analysis.mjs
\`\`\`
`);
}

/**
 * @returns {import("./matrix.render.mjs").MatrixPageConfig}
 */
function exampleConfig() {
  return {
    title      : "Esempio matrice — PortalAdmin"
  , pageTitle  : "PortalAdmin — Esempio matrice"
  , leadHtml   : "Pagina generata da <code>matrix.template.mjs</code> con dati di esempio."
  , metaHtml   : "Template generico · docs.portal/matrix.template.mjs"
  , metrics    : [
      { value: 2, meta: "Righe esempio" }
    , { value: 1, meta: "Gap aperti" }
    ]
  , metricsBadge: "1 gap"
  , sections   : [
      {
        id    : "example"
      , title : "Sezione esempio"
      , badge : "2 voci"
      , open  : true
      , rows  : [
          {
            id       : "ex-ok"
          , sev      : "info"
          , status   : "coperto"
          , project  : "PortalAdmin"
          , voce     : "Voce allineata"
          , dettaglio: "Stato target raggiunto."
          , paths    : ["admin.portal.lib/portal.paths.resolver.mjs"]
          }
        , {
            id       : "ex-gap"
          , sev      : "P2"
          , status   : "gap"
          , project  : "PortalAdmin"
          , voce     : "Gap di esempio"
          , dettaglio: "Descrizione del gap da chiudere."
          , paths    : ["path/da/correggere.mjs"]
          , create   : {
              section : "Esempio"
            , summary : "Gap di esempio"
            , detail  : "Creare issue da template matrice."
            }
          }
        ]
      }
    ]
  , footerHtml: "Generato da matrix.template.mjs"
  };
}

const isCliMain = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCliMain) {
  // 1. Argomenti CLI — --describe esce 0 senza scrivere file
  const args = parseArgs(process.argv.slice(2));

  if (args.describe) {
    printDescribe();
    process.exit(0);
  }

  /** @type {import("./matrix.render.mjs").MatrixPageConfig} */
  let config = exampleConfig();

  // 2. Config — JSON esterno oppure esempio inline
  if (args.dataPath) {
    config = JSON.parse(readFileSync(args.dataPath, "utf8"));
  }

  // 3. Render e scrittura — stdout path per log operatore
  const html = renderMatrixPage(config);

  writeFileSync(args.out, html, "utf8");
  console.log(`Scritto ${args.out}`);
}

export { exampleConfig, parseArgs };
