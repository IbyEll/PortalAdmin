/**
 * Policy catalogo testScript JustLastOne — solo blocked/excluded (discovery in lib/test.catalog.mjs).
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
