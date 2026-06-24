/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 20:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 20:42   by: IbyEll
 * modificato il: 2026-06-23 20:42   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Analisi dipendenze test case — parse sorgente testScript.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Run-all, dashboard e meta tecnici devono condividere lettura runTest/run e catene
 *     dipendenze senza duplicare regex nel product.
 *
 *   A cosa serve:
 *   - Estrae nomi test, commenti step, catena fino al target e header JSDoc dagli script .mjs.
 *
 * Generalizzazione:
 *   Si — parser sorgente puro; path file assoluto passato dal consumer.
 *
 * Input:
 *   - source string — contenuto file testScript .mjs
 *   - scriptPath assoluto — per discoverTestCasesForScript e discoverScriptDescription
 *
 * Consumatori:
 *   - lib/test.technical.meta.mjs, lib/test.functional.meta.mjs — catalogo test case UI
 *   - cruscotto.frontend/cruscotto.server.mjs — tab TestTecnici e dipendenze
 *
 * Export principali:
 *   - parseTestNamesFromSource, parseTestStepCommentsFromSource — scan sorgente
 *   - resolveTestChain, buildTestCaseCatalog — grafo dipendenze ordinato
 *   - discoverTestCasesForScript, discoverScriptDescription — I/O file assoluto
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { readFile } from "node:fs/promises";

/**
 * @typedef {{
 *   name         : string
 *   index        : number
 *   dependencies : string[]
 *   chain        : string[]
 *   stepComment  : string | null
 * }} TestCaseMeta
 */

/** Pattern `await runTest("nome")` / `await run("nome")` nel sorgente testScript. */
const RUN_TEST_CALL_RE = /await\s+run(?:Test)?\s*\(\s*["']([^"']+)["']/g;

/**
 * Estrae i nomi dei test case nell'ordine di definizione nel sorgente.
 *
 * @param {string} source
 * @returns {string[]}
 */
export function parseTestNamesFromSource(source) {
  /** @type {string[]} */
  const names = [];

  RUN_TEST_CALL_RE.lastIndex = 0;

  // 1. Match globale — ordine occorrenze = ordine esecuzione suite
  for (const match of source.matchAll(RUN_TEST_CALL_RE)) {
    const name = match[1]?.trim();

    if (name) {
      names.push(name);
    }
  }

  return names;
}

/**
 * Commento `// …` immediatamente precedente ogni `runTest` nel sorgente.
 *
 * @param {string} source
 * @returns {Map<string, string>}
 */
export function parseTestStepCommentsFromSource(source) {
  /** @type {Map<string, string>} */
  const steps = new Map();

  RUN_TEST_CALL_RE.lastIndex = 0;

  for (const match of source.matchAll(RUN_TEST_CALL_RE)) {
    const name = match[1]?.trim();

    if (!name || match.index == null) {
      continue;
    }

    const before = source.slice(0, match.index);
    const lines  = before.split("\n");

    // 2. Ultima riga non vuota prima della call — commento step se `//`
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();

      if (!line) {
        continue;
      }

      if (line.startsWith("//")) {
        const text = line.replace(/^\/\/\s*/, "").trim();

        if (text) {
          steps.set(name, text);
        }
      }

      break;
    }
  }

  return steps;
}

/**
 * Legge file testScript e restituisce nomi test in ordine di definizione.
 *
 * @param {string} absPath
 * @returns {Promise<string[]>}
 */
export async function discoverTestNamesInScript(absPath) {
  const source = await readFile(absPath, "utf8");
  return parseTestNamesFromSource(source);
}

/**
 * Catena dipendenze: tutti i test definiti prima del target (incluso).
 *
 * @param {string[]} names
 * @param {string} target
 */
export function resolveTestChain(names, target) {
  const index = names.indexOf(target);

  if (index === -1) {
    return {
      found        : false
    , target
    , index        : -1
    , dependencies : []
    , chain        : []
    };
  }

  const chain = names.slice(0, index + 1);

  return {
    found        : true
  , target
  , index
  , dependencies : names.slice(0, index)
  , chain
  };
}

/**
 * Catalogo meta per ogni test: index, dependencies, chain, stepComment.
 *
 * @param {string[]} names
 * @param {Map<string, string>} [stepByName]
 * @returns {TestCaseMeta[]}
 */
export function buildTestCaseCatalog(names, stepByName = new Map()) {
  return names.map((name, index) => {
    const chain = names.slice(0, index + 1);

    return {
      name
    , index
    , dependencies : names.slice(0, index)
    , chain
    , stepComment  : stepByName.get(name) ?? null
    };
  });
}

/**
 * Nomi + commenti step + catalogo meta per un singolo script testScript.
 *
 * @param {string} absPath
 * @returns {Promise<TestCaseMeta[]>}
 */
export async function discoverTestCasesForScript(absPath) {
  const source     = await readFile(absPath, "utf8");
  const names      = parseTestNamesFromSource(source);
  const stepByName = parseTestStepCommentsFromSource(source);

  return buildTestCaseCatalog(names, stepByName);
}

const SCRIPT_DOC_SECTION_STOP = /^(Perché esiste|A cosa serve|Generalizzazione|Input|Scenari verificati|Uso|Flag CLI|Variabili d'ambiente|Integrazione|Prerequisiti|Nota|Environment|Env|Descrizione funzionale)\b/i;

/**
 * @param {string} line
 * @returns {boolean}
 */
function isDecorativeJsdocLine(line) {
  const trimmed = line.trim();

  return !trimmed
    || /^[-─*=\s]+$/.test(trimmed)
    || /^\*\*.*\*\*$/.test(trimmed);
}

/**
 * Estrae il contenuto di una sezione JSDoc («Perché esiste», «A cosa serve», …).
 *
 * @param {string[]} lines
 * @param {string} sectionLabel
 * @returns {string}
 */
function extractJsdocSection(lines, sectionLabel) {
  const headerRe = new RegExp(`^${sectionLabel}\\s*:?\\s*(.*)$`, "iu");
  let collecting   = false;
  /** @type {string[]} */
  const parts      = [];

  for (const rawLine of lines) {
    const line    = rawLine.trim();
    const header  = line.match(headerRe);

    if (!collecting) {
      if (!header) {
        continue;
      }

      collecting = true;

      const inline = (header[1] ?? "").trim();

      if (inline && !isDecorativeJsdocLine(inline)) {
        parts.push(inline.replace(/^-\s*/, ""));
      }

      continue;
    }

    if (SCRIPT_DOC_SECTION_STOP.test(line) && !headerRe.test(line)) {
      break;
    }

    if (isDecorativeJsdocLine(line)) {
      continue;
    }

    parts.push(line.replace(/^-\s*/, "").trim());
  }

  return parts.filter(Boolean).join("\n");
}

/**
 * Descrizione breve del blocco JSDoc in testa al file .mjs: solo le sezioni
 * «Perché esiste» e «A cosa serve» (colonna Dettaglio cruscotto).
 *
 * @param {string} source
 * @returns {string | null}
 */
export function parseScriptDescriptionFromSource(source) {
  const block = source.match(/\/\*\*([\s\S]*?)\*\//);

  if (!block) {
    return null;
  }

  const lines = block[1]
    .split("\n")
    .map((rawLine) => rawLine.replace(/^\s*\*?\s?/, "").trimEnd());

  const perche = extractJsdocSection(lines, "Perché esiste");
  const cosa   = extractJsdocSection(lines, "A cosa serve");
  /** @type {string[]} */
  const sections = [];

  if (perche) {
    sections.push(`Perché esiste:\n${perche}`);
  }

  if (cosa) {
    sections.push(`A cosa serve:\n${cosa}`);
  }

  return sections.length > 0 ? sections.join("\n\n") : null;
}

/**
 * Blocco JSDoc completo in testa al file .mjs (testo integrale per popup documentazione).
 *
 * @param {string} source
 * @returns {string | null}
 */
export function parseScriptDocHeaderFromSource(source) {
  const block = source.match(/\/\*\*([\s\S]*?)\*\//);

  if (!block) {
    return null;
  }

  const lines = block[1]
    .split("\n")
    .map((rawLine) => rawLine.replace(/^\s*\*?\s?/, "").trimEnd());

  const text = lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text || null;
}

/**
 * Descrizione breve dal blocco JSDoc: «Perché esiste» + «A cosa serve».
 *
 * @param {string} absPath
 * @returns {Promise<string | null>}
 */
export async function discoverScriptDescription(absPath) {
  const source = await readFile(absPath, "utf8");

  return parseScriptDescriptionFromSource(source);
}

/**
 * Testo integrale header JSDoc — popup documentazione cruscotto.
 *
 * @param {string} absPath
 * @returns {Promise<string | null>}
 */
export async function discoverScriptDocHeader(absPath) {
  const source = await readFile(absPath, "utf8");

  return parseScriptDocHeaderFromSource(source);
}
