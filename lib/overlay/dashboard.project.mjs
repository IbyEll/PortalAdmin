/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 20:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 20:42   by: IbyEll
 * modificato il: 2026-06-23 20:42   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *           Dashboard product overlay — facade moduli PROJECT_{PRJ_NAME} per cruscotto.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Dashboard-server non deve importare path fissi overlay; analisi test e my-project vivono
 *     nell'overlay product attivo.
 *
 *   A cosa serve:
 *   - Dynamic import da PROJECT_{overlay} con fallback stub e moduli lib se assenti.
 *
 * Generalizzazione:
 *   Si — resolveProjectOverlayFilePath per ogni modulo pagina/meta/analysis overlay.
 *
 * Input:
 *   - PRJ_NAME — overlay attivo via project.config
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.server.mjs — API analisi progetto e tab test
 *
 * Export principali:
 *   - analyzeMyProject, analyzeProjectOverview — pagine analisi overlay
 *   - loadAndAnalyzeTestTecnici — report tecnici da latest.json
 *   - getFunzionaliMetaPayload, getTecniciMetaPayload — meta tab test
 *   - TECNICI_ANALYSIS_JSON, TECNICI_ANALYSIS_HTML, DASHBOARD_PROJECT_OVERLAY
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getPortalReportsDir } from "../portal.paths.resolver.mjs";
import { resolveProjectOverlayName } from "../project.config.mjs";
import { resolveProjectOverlayFilePath } from "./project.overlay.paths.mjs";
import { getFunzionaliMetaPayload as getDefaultFunzionaliMetaPayload } from "../test.functional.meta.mjs";
import { loadAndAnalyzeTestTecnici as loadDefaultTecniciAnalysis } from "../test.technical.analysis.mjs";
import { getTecniciMetaPayload as getDefaultTecniciMetaPayload } from "../test.technical.meta.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const overlayName = resolveProjectOverlayName();
const reportsDir  = getPortalReportsDir();

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
    const resolved = resolveProjectOverlayFilePath(overlayName, rel);

    if (!resolved) {
      continue;
    }

    const mod = await tryImportModule(resolved);

    if (mod) {
      return mod;
    }
  }

  return null;
}

const myProjectMod = await loadFirstOverlayModule([
  `page.my-project.analysis.${overlayName}.mjs`
, "page.my-project.analysis.mjs"
]);

const myProjectFallbackMod = await tryImportModule(
  join(PORTAL_ROOT, "PARKING_tocheck/cruscotto.jira.my-project.analysis.mjs")
);

const projectOverviewMod = await loadFirstOverlayModule([
  `page.project.overview.${overlayName}.mjs`
, "page.project.overview.mjs"
]);

const projectOverviewFallbackMod = await tryImportModule(
  join(PORTAL_ROOT, "cruscotto.frontend/cruscotto.project.overview.analysis.mjs")
);

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

  if (typeof myProjectFallbackMod?.analyzeMyProject === "function") {
    return myProjectFallbackMod.analyzeMyProject();
  }

  return {
    configured : false
  , overlay    : overlayName
  , summary    : {
      title : "My Project"
    , note  : `Overlay ${overlayName}: analisi My Project non disponibile`
    }
  , sections   : []
  };
}

/**
 * @returns {Promise<unknown>}
 */
export async function analyzeProjectOverview() {
  if (typeof projectOverviewMod?.analyzeProjectOverview === "function") {
    return projectOverviewMod.analyzeProjectOverview();
  }

  const full = await analyzeMyProject();

  if (typeof projectOverviewMod?.buildProjectOverviewPayload === "function") {
    return projectOverviewMod.buildProjectOverviewPayload(full);
  }

  if (typeof projectOverviewFallbackMod?.buildProjectOverviewPayload === "function") {
    return projectOverviewFallbackMod.buildProjectOverviewPayload(full);
  }

  return {
    configured : false
  , overlay    : overlayName
  , pageKind   : "project-overview"
  , summary    : {
      title : "Project Overview"
    , note  : `Overlay ${overlayName}: analisi overview non disponibile`
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
