/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:05   by: IbyEll
 * modificato il: 2026-06-23 21:05   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *     Policy catalogo testScript AdminDashBoard — blocked ed excluded per discovery.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Suite admin.portal.testscript ha script che non vanno in run-all automatico o CI.
 *
 *   A cosa serve:
 *   - Espone BLOCKED_SCRIPTS, EXCLUDED_SCRIPTS e BLOCKED_REASONS per admin.portal.lib/test.catalog.mjs.
 *
 * Generalizzazione:
 *   No — policy fissa su path admin.portal.testscript relativi a PRJ_TEST_SCRIPT overlay.
 *
 * Input:
 *   - —
 *
 * Consumatori:
 *   - admin.portal.lib/test.catalog.mjs — loadOverlayPolicy merge con discovery generica
 *
 * Export principali:
 *   - BLOCKED_SCRIPTS — Set path non eseguibili da run-all
 *   - EXCLUDED_SCRIPTS — Set path esclusi da discovery default
 *   - BLOCKED_REASONS — messaggio UI per script blocked
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

export const BLOCKED_SCRIPTS = new Set([
  "cursor/test.api.cursor.agent.mjs"
]);

export const EXCLUDED_SCRIPTS = new Set([
  "funzionali/test.cruscotto.backlog.gogo.rules.mjs"
]);

export const BLOCKED_REASONS = {
  "cursor/test.api.cursor.agent.mjs": "blocked — richiede CURSOR_API_KEY e stack cruscotto; usare test:cursor-api da CLI"
};
