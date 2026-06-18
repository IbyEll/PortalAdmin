/**
 * Policy catalogo testScript AdminDashboard — blocked/excluded (discovery in lib/test.catalog.mjs).
 *
 * Path relativi a PRJ_TEST_SCRIPT (= admin.portal.testscript).
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
