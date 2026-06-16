import {
  BLOCKED_SCRIPTS
, discoverTestScripts
} from "./test.catalog.JustLastOne.mjs";
import {
  discoverScriptDescription
, discoverTestCasesForScript
} from "../runner/test.dipendenze.mjs";

export const TECNICI_IMPLEMENTATION = {
  title        : "Test tecnici backend"
, summary      : "Suite API e integrazione in testScript/ — esecuzione via run-all.mjs, catena dipendenze tra test case, report JSON in data/reports/latest.json."
, prerequisites: [
    "API :4000 e auth :4001 avviati (preflight run-all)"
  , "DATABASE_URL → packages/database/prisma/JLO_DEV.db"
  , ".env con AUTH_URL, API_URL, WEB_BASE"
  , "Per test web: Next.js su WEB_BASE (es. :3000)"
  ]
, architecture: [
    "runner/JustLastOne___run-all.mjs — orchestratore discovery + run sequenziale"
  , "lib/JustLastOne___prj_testScript_catalog.mjs — discovery script, blocked/excluded"
  , "PROJECT_JustLastOne/test-deps.mjs — catena test case (dependencies/chain)"
  , "lib/reporter.mjs — merge report → latest.json + HTML"
  ]
, runOrder: [
    "Preflight servizi + reset host test state"
  , "Discovery cartelle: auth → chat → dashboard → match → notifications → profile → social → tournament → web"
  , "Ogni script: test case in ordine con dipendenza implicita sulla catena"
  ]
};

/**
 * @returns {Promise<Record<string, unknown>>}
 */
export async function getTecniciMetaPayload() {
  const scripts = await discoverTestScripts();
  const tecnici   = scripts.filter(
    (entry) => entry.suite !== "funzionali" && !BLOCKED_SCRIPTS.has(entry.rel)
  );

  /** @type {Array<{ script: string, title: string, cases: Array<{ name: string, description: string }> }>} */
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
    implementation : TECNICI_IMPLEMENTATION
  , scenarios
  , scriptCount    : scenarios.length
  , caseCount      : scenarios.reduce((sum, row) => sum + row.cases.length, 0)
  };
}
