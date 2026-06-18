/**
 * Dashboard product overlay — facade moduli PROJECT_{PRJ_NAME} per cruscotto.
 *
 * Descrizione funzionale:
 *   Perché esiste: dashboard-server non deve importare path fissi JustLastOne;
 *     analisi test e my-project vivono nell'overlay product attivo.
 *   A cosa serve: dynamic import da PROJECT_{overlay} con fallback stub se assenti.
 *
 * Consumatori: server/dashboard-server.mjs
 *
 * Export principali:
 *   analyzeMyProject, loadAndAnalyzeTestTecnici, getFunzionaliMetaPayload, getTecniciMetaPayload
 *   TECNICI_ANALYSIS_JSON, TECNICI_ANALYSIS_HTML, DASHBOARD_PROJECT_OVERLAY
 *
 * File overlay attesi (primo trovato vince):
 *   - page.my-project.analysis.mjs
 *   - test.technical.analysis.{overlay}.mjs | test.technical.analysis.mjs | lib/test.technical.analysis.mjs (fallback)
 *   - test.functional.meta.{overlay}.mjs | lib/test.functional.meta.mjs (fallback)
 *   - test.technical.meta.{overlay}.mjs | test.technical.meta.mjs | lib/test.technical.meta.mjs (fallback)
 *
 * Env: PRJ_NAME (via project.config)
 */

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getPortalReportsDir } from "./portal.paths.resolver.mjs";
import { resolveProjectOverlayName } from "./project.config.mjs";
import { getFunzionaliMetaPayload as getDefaultFunzionaliMetaPayload } from "./test.functional.meta.mjs";
import { loadAndAnalyzeTestTecnici as loadDefaultTecniciAnalysis } from "./test.technical.analysis.mjs";
import { getTecniciMetaPayload as getDefaultTecniciMetaPayload } from "./test.technical.meta.mjs";

const PORTAL_ROOT   = join(dirname(fileURLToPath(import.meta.url)), "..");
const overlayName   = resolveProjectOverlayName();
const overlayDir    = join(PORTAL_ROOT, `PROJECT_${overlayName}`);
const reportsDir    = getPortalReportsDir();

/**
 * @param {string} filePath
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function tryImportModule(filePath) {
  try {
    return await import(pathToFileURL(filePath).href);
  } catch (err) {
    const notFound = err instanceof Error && "code" in err && err.code === "ERR_MODULE_NOT_FOUND";

    if (notFound) {
      return null;
    }

    throw err;
  }
}

/**
 * @param {string[]} candidates
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function loadFirstOverlayModule(candidates) {
  for (const rel of candidates) {
    const mod = await tryImportModule(join(overlayDir, rel));

    if (mod) {
      return mod;
    }
  }

  return null;
}

const myProjectMod = await loadFirstOverlayModule([
  "page.my-project.analysis.mjs"
]);

const tecniciAnalysisMod = await loadFirstOverlayModule([
  `test.technical.analysis.${overlayName}.mjs`
, "test.technical.analysis.mjs"
]);

const funzionaliMetaMod = await loadFirstOverlayModule([
  `test.functional.meta.${overlayName}.mjs`
]);

const tecniciMetaMod = await loadFirstOverlayModule([
  `test.technical.meta.${overlayName}.mjs`
, "test.technical.meta.mjs"
]);

export const DASHBOARD_PROJECT_OVERLAY = overlayName;

export const TECNICI_ANALYSIS_JSON = /** @type {string} */ (
  tecniciAnalysisMod?.TECNICI_ANALYSIS_JSON
  ?? join(reportsDir, "tecnici-analysis-latest.json")
);

export const TECNICI_ANALYSIS_HTML = /** @type {string} */ (
  tecniciAnalysisMod?.TECNICI_ANALYSIS_HTML
  ?? join(reportsDir, "tecnici-analysis-latest.html")
);

/**
 * @returns {Promise<unknown>}
 */
export async function analyzeMyProject() {
  if (typeof myProjectMod?.analyzeMyProject === "function") {
    return myProjectMod.analyzeMyProject();
  }

  return {
    configured : false
  , overlay    : overlayName
  , summary    : {
      title : "My Project"
    , note  : `Overlay ${overlayName}: page.my-project.analysis.mjs non configurato`
    }
  , sections   : []
  };
}

/**
 * @param {unknown} [report]
 * @returns {Promise<unknown>}
 */
export async function loadAndAnalyzeTestTecnici(report = null) {
  if (typeof tecniciAnalysisMod?.loadAndAnalyzeTestTecnici === "function") {
    return tecniciAnalysisMod.loadAndAnalyzeTestTecnici(report);
  }

  return loadDefaultTecniciAnalysis(report);
}

/**
 * @returns {Promise<unknown>}
 */
export async function getFunzionaliMetaPayload() {
  if (typeof funzionaliMetaMod?.getFunzionaliMetaPayload === "function") {
    return funzionaliMetaMod.getFunzionaliMetaPayload();
  }

  return getDefaultFunzionaliMetaPayload();
}

/**
 * @returns {Promise<unknown>}
 */
export async function getTecniciMetaPayload() {
  if (typeof tecniciMetaMod?.getTecniciMetaPayload === "function") {
    return tecniciMetaMod.getTecniciMetaPayload();
  }

  return getDefaultTecniciMetaPayload();
}
