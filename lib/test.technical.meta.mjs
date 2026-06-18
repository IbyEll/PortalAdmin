/**
 * Meta test tecnici — implementazione generica per overlay product (catalogo testScript).
 *
 * Descrizione funzionale:
 *   Perché esiste: ogni PROJECT_* può esporre meta tecnici senza duplicare discovery
 *     e parse test case; overlay specifici (es. JustLastOne) estendono prerequisites/architecture.
 *   A cosa serve: TECNICI_IMPLEMENTATION minimale + getTecniciMetaPayload() per tab TestTecnici.
 *
 * Consumatori:
 *   - lib/dashboard.project.mjs — fallback se manca test.technical.meta.* nell'overlay
 *   - PROJECT_{Nome}/test.technical.meta.mjs — re-export opzionale
 *
 * Export principali: TECNICI_IMPLEMENTATION, getTecniciMetaPayload, buildTecniciMetaPayload
 */

import { getProjectConfig } from "./project.config.mjs";
import {
  BLOCKED_SCRIPTS
, discoverTestScripts
} from "./test.catalog.mjs";
import {
  discoverScriptDescription
, discoverTestCasesForScript
} from "./test.dipendenze.mjs";

const { PRJ_NAME, PRJ_TEST_SCRIPT } = getProjectConfig();

/**
 * Overview tab Test tecnici — vuota di default; compilare in overlay specifico se serve.
 *
 * @type {{
 *   title: string
 *   summary: string
 *   prerequisites: string[]
 *   architecture: string[]
 *   runOrder: string[]
 * }}
 */
export const TECNICI_IMPLEMENTATION = {
  title         : "Test tecnici"
, summary       : `Suite in ${PRJ_TEST_SCRIPT}/ — discovery catalogo overlay ${PRJ_NAME}.`
, prerequisites : []
, architecture  : []
, runOrder      : []
};

/**
 * Costruisce payload API da catalogo script e implementation (override opzionale).
 *
 * @param {{
 *   implementation?: typeof TECNICI_IMPLEMENTATION
 *   excludeSuites?: string[]
 * }} [options]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function buildTecniciMetaPayload(options = {}) {
  const implementation = options.implementation ?? TECNICI_IMPLEMENTATION;
  const excludeSuites  = new Set(options.excludeSuites ?? ["funzionali"]);
  const scripts        = await discoverTestScripts();
  const tecnici        = scripts.filter(
    (entry) => !excludeSuites.has(entry.suite) && !BLOCKED_SCRIPTS.has(entry.rel)
  );

  /** @type {Array<{ script: string, topic?: string, title: string, cases: Array<{ name: string, description: string }> }>} */
  const scenarios = [];

  for (const entry of tecnici) {
    let testCases   = [];
    let description = null;

    try {
      testCases = await discoverTestCasesForScript(entry.abs);
    } catch {
      testCases = [];
    }

    try {
      description = await discoverScriptDescription(entry.abs);
    } catch {
      description = null;
    }

    const title = description ?? entry.file.replace(/^test-/, "").replace(/\.mjs$/, "");

    scenarios.push({
      script : entry.rel
    , topic  : entry.suite
    , title
    , cases  : testCases.map((item) => ({
        name        : item.name
      , description : item.stepComment ?? "—"
      }))
    });
  }

  return {
    configured     : true
  , overlay        : PRJ_NAME
  , implementation
  , scenarios
  , scriptCount    : scenarios.length
  , caseCount      : scenarios.reduce((sum, row) => sum + row.cases.length, 0)
  };
}

/**
 * Payload API tab Test tecnici — implementation generica e scenari da discovery.
 *
 * @returns {Promise<Record<string, unknown>>}
 */
export async function getTecniciMetaPayload() {
  return buildTecniciMetaPayload();
}
