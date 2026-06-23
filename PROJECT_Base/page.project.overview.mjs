/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 20:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 20:42   by: IbyEll
 * modificato il: 2026-06-23 20:42   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Project Overview — entry PROJECT_Base su cruscotto.project.overview.analysis.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Overlay senza page.project.overview custom ereditano payload overview dal cruscotto.
 *
 *   A cosa serve:
 *   - Re-export buildProjectOverviewPayload per tab overview progetto.
 *
 * Generalizzazione:
 *   No — thin re-export verso cruscotto.frontend/cruscotto.project.overview.analysis.mjs.
 *
 * Input:
 *   - —
 *
 * Consumatori:
 *   - lib/dashboard.project.mjs — dynamic import overview overlay
 *   - cruscotto.frontend/cruscotto.server.mjs — API project overview
 *
 * Export principali:
 *   - buildProjectOverviewPayload — payload JSON overview repo e Jira
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

export { buildProjectOverviewPayload } from "../cruscotto.frontend/cruscotto.project.overview.analysis.mjs";
