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

const RUN_TEST_CALL_RE = /await\s+run(?:Test)?\s*\(\s*["']([^"']+)["']/g;

/**
 * Estrae i nomi dei test case nell'ordine di definizione nel sorgente.
 *
 * @param {string} source
 */
export function parseTestNamesFromSource(source) {
  /** @type {string[]} */
  const names = [];

  RUN_TEST_CALL_RE.lastIndex = 0;

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
 * @param {string} absPath
 * @returns {Promise<string[]>}
 */
export async function discoverTestNamesInScript(absPath) {
  const source = await readFile(absPath, "utf8");
  return parseTestNamesFromSource(source);
}

/**
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
 * @param {string} absPath
 * @returns {Promise<TestCaseMeta[]>}
 */
export async function discoverTestCasesForScript(absPath) {
  const source     = await readFile(absPath, "utf8");
  const names      = parseTestNamesFromSource(source);
  const stepByName = parseTestStepCommentsFromSource(source);

  return buildTestCaseCatalog(names, stepByName);
}

const SCRIPT_DOC_SECTION = /^(Uso|Variabili|Prerequisiti|Nota|Environment|Env)\b/i;
const SCRIPT_DOC_FUNCTIONAL = /^(──|Perché esiste\b)/i;

/**
 * Descrizione breve del blocco JSDoc in testa al file .mjs: la riga (o breve
 * paragrafo) introduttiva prima delle sezioni funzionali («Perché esiste», Uso, …).
 *
 * @param {string} source
 * @returns {string | null}
 */
export function parseScriptDescriptionFromSource(source) {
  const block = source.match(/\/\*\*([\s\S]*?)\*\//);

  if (!block) {
    return null;
  }

  /** @type {string[]} */
  const parts = [];

  for (const rawLine of block[1].split("\n")) {
    const line = rawLine.replace(/^\s*\*?\s?/, "").trim();

    if (line.startsWith("/")) {
      continue;
    }

    if (!line) {
      if (parts.length > 0) {
        break;
      }

      continue;
    }

    if (SCRIPT_DOC_FUNCTIONAL.test(line) || SCRIPT_DOC_SECTION.test(line)) {
      break;
    }

    if (line.startsWith("node testScript") || line.startsWith("@")) {
      continue;
    }

    parts.push(line);
  }

  const text = parts.join(" ").replace(/\s+/g, " ").trim();

  if (!text) {
    return null;
  }

  const sentences = text.match(/[^.!?…]+[.!?…]+(?:\s|$)|[^.!?…]+$/gu) ?? [text];

  return sentences.slice(0, 2).join(" ").trim() || null;
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
 * @param {string} absPath
 * @returns {Promise<string | null>}
 */
export async function discoverScriptDescription(absPath) {
  const source = await readFile(absPath, "utf8");

  return parseScriptDescriptionFromSource(source);
}

/**
 * @param {string} absPath
 * @returns {Promise<string | null>}
 */
export async function discoverScriptDocHeader(absPath) {
  const source = await readFile(absPath, "utf8");

  return parseScriptDocHeaderFromSource(source);
}
