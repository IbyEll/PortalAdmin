/**
 * Meta test funzionali — implementation generica e discovery suite funzionali (catalogo testScript).
 *
 * Descrizione funzionale:
 *   Perché esiste: ogni PROJECT_* può esporre meta funzionali senza duplicare payload API;
 *     overlay specifici forniscono FUNZIONALI_IMPLEMENTATION e scenari statici opzionali.
 *   A cosa serve: FUNZIONALI_IMPLEMENTATION minimale + getFunzionaliMetaPayload() per tab TestFunzionali.
 *
 * Consumatori:
 *   - lib/dashboard.project.mjs — fallback se manca test.functional.meta.{Nome}.mjs
 *   - PROJECT_{Nome}/test.functional.meta.{Nome}.mjs — implementation e scenari custom
 *
 * Export principali: FUNZIONALI_IMPLEMENTATION, buildFunzionaliMetaPayload, getFunzionaliMetaPayload
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
 * Overview tab Test funzionali — vuota di default; compilare in test.functional.meta.{Nome}.mjs.
 *
 * @type {{
 *   title: string
 *   summary: string
 *   prerequisites: string[]
 *   architecture: string[]
 *   runOrder: string[]
 * }}
 */
export const FUNZIONALI_IMPLEMENTATION = {
  title         : "Test funzionali"
, summary       : `Suite in ${PRJ_TEST_SCRIPT}/funzionali/ — overlay ${PRJ_NAME}.`
, prerequisites : []
, architecture  : []
, runOrder      : []
};

/**
 * Discovery script suite funzionali e test case da catalogo + dipendenze.
 *
 * @returns {Promise<Array<{ script: string, topic?: string, topicLabel?: string, title: string, cases: Array<{ name: string, description: string }> }>>}
 */
export async function discoverFunzionaliScenarios() {
  const scripts     = await discoverTestScripts();
  const funzionali    = scripts.filter(
    (entry) => (
      entry.suite === "funzionali"
      || entry.rel.startsWith("funzionali/")
    )
    && !BLOCKED_SCRIPTS.has(entry.rel)
  );

  /** @type {Array<{ script: string, topic?: string, topicLabel?: string, title: string, cases: Array<{ name: string, description: string }> }>} */
  const scenarios = [];

  for (const entry of funzionali) {
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

    const title      = description ?? entry.file.replace(/^test-/, "").replace(/\.mjs$/, "");
    const topicLabel = entry.suite === "funzionali"
      ? entry.rel.split("/").slice(1, -1)[0] ?? entry.suite
      : entry.suite;

    scenarios.push({
      script : entry.rel
    , topic  : topicLabel
    , topicLabel
    , title
    , cases  : testCases.map((item) => ({
        name        : item.name
      , description : item.stepComment ?? "—"
      }))
    });
  }

  return scenarios;
}

/**
 * Costruisce payload API tab Test funzionali.
 *
 * @param {{
 *   implementation?: typeof FUNZIONALI_IMPLEMENTATION
 *   scenarios?: Array<{ script: string, topic?: string, topicLabel?: string, title: string, cases: Array<{ name: string, description: string }> }>
 * }} [options]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function buildFunzionaliMetaPayload(options = {}) {
  const implementation = options.implementation ?? FUNZIONALI_IMPLEMENTATION;
  const scenarios      = options.scenarios ?? await discoverFunzionaliScenarios();

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
 * Payload API tab Test funzionali — implementation generica e scenari da discovery o overlay.
 *
 * @returns {Promise<Record<string, unknown>>}
 */
export async function getFunzionaliMetaPayload() {
  return buildFunzionaliMetaPayload();
}
