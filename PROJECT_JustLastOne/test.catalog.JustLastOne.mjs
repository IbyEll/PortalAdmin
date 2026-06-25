/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:05   by: IbyEll
 * modificato il: 2026-06-23 21:05   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *     Policy catalogo testScript JustLastOne — blocked ed excluded per discovery.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Suite testScript JLO ha script blocked o esclusi da run-all per dipendenze o API assenti.
 *
 *   A cosa serve:
 *   - BLOCKED_SCRIPTS, EXCLUDED_SCRIPTS e BLOCKED_REASONS per admin.portal.lib/test.catalog.mjs.
 *
 * Generalizzazione:
 *   No — policy fissa path relativi testScript product JustLastOne.
 *
 * Input:
 *   - —
 *
 * Consumatori:
 *   - admin.portal.lib/test.catalog.mjs — loadOverlayPolicy quando PRJ_NAME=JustLastOne
 *
 * Export principali:
 *   - BLOCKED_SCRIPTS — Set path non eseguibili
 *   - EXCLUDED_SCRIPTS — Set path fuori discovery default
 *   - BLOCKED_REASONS — messaggio per UI cruscotto
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

export const BLOCKED_SCRIPTS = new Set([
  "social/test-user-follow-api.mjs"
, "tournament/test-bracket-match-api.mjs"
]);

export const EXCLUDED_SCRIPTS = new Set([
  "web/benchmark-web-routes.mjs"
, "match/evaluate-matches.mjs"
]);

export const BLOCKED_REASONS = {
  "social/test-user-follow-api.mjs"      : "blocked — API follow assente"
, "tournament/test-bracket-match-api.mjs": "blocked — dipende JLO-696"
};
