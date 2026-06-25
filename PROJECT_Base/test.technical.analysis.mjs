/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 20:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 20:42   by: IbyEll
 * modificato il: 2026-06-23 20:42   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *     Analisi TestTecnici — entry PROJECT_Base su admin.portal.lib/test.technical.analysis.mjs.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - admin.portal.lib/dashboard.project.mjs risolve test.technical.analysis per overlay; la logica vive in
 *     lib e PROJECT_Base evita duplicati in ogni PROJECT overlay.
 *
 *   A cosa serve:
 *   - Re-export build, load e render analisi TestTecnici per il cruscotto dev.
 *
 * Generalizzazione:
 *   No — thin re-export fisso verso admin.portal.lib/test.technical.analysis.mjs.
 *
 * Input:
 *   - —
 *
 * Consumatori:
 *   - admin.portal.lib/dashboard.project.mjs — resolveProjectOverlayFilePath fallback Base
 *   - cruscotto.frontend/cruscotto.server.mjs — API analisi tecnici
 *
 * Export principali:
 *   - TECNICI_ANALYSIS_JSON, TECNICI_ANALYSIS_HTML, TECNICI_ANALYSIS_MD — path artifact
 *   - buildTestTecniciAnalysis, loadAndAnalyzeTestTecnici — analisi e persistenza
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

export {
  TECNICI_ANALYSIS_JSON
, TECNICI_ANALYSIS_HTML
, TECNICI_ANALYSIS_MD
, buildTecniciAnalysisRecommendations
, buildTestTecniciAnalysis
, renderTestTecniciAnalysisMarkdown
, renderTestTecniciAnalysisHtml
, writeTestTecniciAnalysisReport
, loadAndAnalyzeTestTecnici
} from "../admin.portal.lib/test.technical.analysis.mjs";
