/**
 * Facade config PortalAdmin — re-export da lib/jira/jira.config.mjs.
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - entrypoint storico per consumer (jira.backlog.insights, signals.catalog, smoke)
 *   - mantiene export sincroni a top-level senza duplicare policy
 *
 *   A cosa serve:
 *   - risolve product overlay da env PRJ_NAME, fallback JustLastOne
 *   - portal overlay fisso PortalAdmin
 *
 * Consumatori:
 *   - lib/jira/jira.backlog.insights.mjs
 *   - lib/signals.catalog.implementation.mjs
 *   - lib/function.repo.jira.refs.mjs
 *   - scripts/smoke-portal-config.mjs
 *
 * Config generalizzata: lib/jira/jira.config.mjs — loadJiraConfig(PRJ_NAME)
 *
 * Env: PRJ_NAME (product overlay )
 */

import { loadJiraConfig } from "./jira.config.mjs";

const productOverlay = process.env.PRJ_NAME?.trim() ;

const {
  JIRA_PROJECT_KEYS
, REPO_SIGNALS_CATALOG_CONFIG
, REPO_IMPLEMENTATION_SIGNALS
, GIT_EVIDENCE_COMMIT_LIMIT
, PRODUCT_PROJECT_OVERLAY
} = await loadJiraConfig({ productOverlay });

export {
  JIRA_PROJECT_KEYS
, REPO_SIGNALS_CATALOG_CONFIG
, REPO_IMPLEMENTATION_SIGNALS
, GIT_EVIDENCE_COMMIT_LIMIT
, PRODUCT_PROJECT_OVERLAY
};

export { loadJiraConfig } from "./jira.config.mjs";
