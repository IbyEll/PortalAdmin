/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 20:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 20:42   by: IbyEll
 * modificato il: 2026-06-23 20:42   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         My Project — entry PROJECT_Base su cruscotto.jira.my-project.analysis.mjs.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Overlay senza page.my-project.analysis custom ereditano analisi generica repo vs Jira.
 *
 *   A cosa serve:
 *   - Re-export analyzeMyProject per GET /api/my-project/analyze.
 *
 * Generalizzazione:
 *   No — thin re-export verso modulo analisi my-project del cruscotto.
 *
 * Input:
 *   - —
 *
 * Consumatori:
 *   - lib/dashboard.project.mjs — resolveProjectOverlayFilePath fallback Base
 *   - cruscotto.frontend/cruscotto.server.mjs — handler API my-project
 *
 * Export principali:
 *   - analyzeMyProject — analisi gap repo vs backlog Jira parent
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

export { analyzeMyProject } from "../PARKING_tocheck/cruscotto.jira.my-project.analysis.mjs";
