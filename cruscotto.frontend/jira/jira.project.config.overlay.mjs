/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-18 03:48
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 03:48   by: IbyEll
 * modificato il: 2026-06-18 03:48   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                     Facade config Jira PortalAdmin — re-export top-level da jira.project.config.mjs.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Entrypoint storico sotto cruscotto.frontend/jira/ per consumer che importano config
 *     senza passare da portal.config.mjs o conoscere loadJiraConfig in dettaglio.
 *   - Evita duplicare policy catalogo segnali e merge overlay product/portal in ogni modulo.
 *
 *   A cosa serve:
 *   - Risolve overlay product da env PRJ_NAME (o default JustLastOne via loadJiraConfig).
 *   - Espone a init modulo: JIRA_PROJECT_KEYS, REPO_SIGNALS_CATALOG_CONFIG,
 *     REPO_IMPLEMENTATION_SIGNALS, GIT_EVIDENCE_COMMIT_LIMIT, PRODUCT_PROJECT_OVERLAY.
 *
 * Generalizzazione:
 *   Si — snapshot config all'import da overlay PRJ_NAME tramite loadJiraConfig.
 *
 * Input:
 *   - PRJ_NAME — overlay product (es. JustLastOne); opzionale se default in loadJiraConfig
 *
 * Consumatori:
 *   - cruscotto.jira.backlog.insights.mjs — inspect repo vs ticket
 *   - cruscotto.jira.backlog.related.tickets.mjs — JIRA_PROJECT_KEYS per regex IssueKEY
 *   - jira/JiraCORE/JiraCORE.signals.catalog.implementation.mjs — catalogo segnali implementazione
 *   - jira.function.repo.refs.mjs — scan citazioni key nel product repo
 *   - scripts/smoke-portal-config.mjs — smoke config PortalAdmin
 *
 * Export principali:
 *   - JIRA_PROJECT_KEYS — prefissi issue ammessi (JLO, ADMIN, …)
 *   - REPO_SIGNALS_CATALOG_CONFIG — policy path/branch per catalogo
 *   - REPO_IMPLEMENTATION_SIGNALS — mappa key → path/test (mutabile da close-story)
 *   - GIT_EVIDENCE_COMMIT_LIMIT — limite commit GitHub in inspect
 *   - PRODUCT_PROJECT_OVERLAY — nome overlay product (PRJ_NAME)
 *   - loadJiraConfig — re-export per reload esplicito
 *
 * Config canonica:
 *   - jira.project.config.mjs — loadJiraConfig, merge overlay PROJECT_*
 *
 * Variabili d'ambiente:
 *   - PRJ_NAME — overlay product (es. JustLastOne); opzionale se default in loadJiraConfig
 */

import { loadJiraConfig } from "./jira.project.config.mjs";

// 1. Overlay product — da env operatore o default in loadJiraConfig
const productOverlay = process.env.PRJ_NAME?.trim();

// 2. Caricamento config — merge portal + product, segnali e policy catalogo
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

export { loadJiraConfig } from "./jira.project.config.mjs";
