/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TEST ANALYSIS ** -- commentato il: 2026-06-18 18:30
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 18:30   by: IbyEll
 * modificato il: 2026-06-18 18:30   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *      Analisi TestTecnici AdminDashboard — entry overlay su lib/test.technical.analysis.mjs
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - lib/dashboard.project.mjs risolve test.technical.analysis.{Nome}.mjs nell'overlay PROJECT_*.
 *   - La logica di aggregazione latest.json vive in lib/; l'overlay espone solo il binding al product.
 *
 *   A cosa serve:
 *   - Re-export di buildTestTecniciAnalysis, render MD/HTML, persistenza report e loadAndAnalyze
 *     per GET/POST analisi TestTecnici del cruscotto AdminDashboard (PortalAdmin).
 *
 * Generalizzazione:
 *   Si — implementazione in lib/test.technical.analysis.mjs (project.config); custom via
 *     buildTecniciAnalysisRecommendations nell'overlay se serve policy diversa.
 *
 * Input:
 *   - PRJ_NAME=AdminDashBoard — seleziona questo file via lib/dashboard.project.mjs
 *   - lib/test.technical.analysis.mjs — cluster, raccomandazioni, export history
 *   - data/reports/latest.json — report runner (lettura in loadAndAnalyzeTestTecnici)
 *
 * Consumatori:
 *   - lib/dashboard.project.mjs — loadAndAnalyzeTestTecnici, path TECNICI_ANALYSIS_*
 *   - cruscotto.frontend/cruscotto.server.mjs — POST analisi e GET tecnici-analysis
 *
 * Export principali:
 *   - TECNICI_ANALYSIS_JSON | TECNICI_ANALYSIS_HTML | TECNICI_ANALYSIS_MD — path output
 *   - buildTestTecniciAnalysis, buildTecniciAnalysisRecommendations — aggregazione e azioni
 *   - renderTestTecniciAnalysisMarkdown | renderTestTecniciAnalysisHtml — export testuale
 *   - writeTestTecniciAnalysisReport | loadAndAnalyzeTestTecnici — persistenza e entry API
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
} from "../lib/test.technical.analysis.mjs";
