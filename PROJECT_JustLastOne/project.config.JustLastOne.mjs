/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:05   by: IbyEll
 * modificato il: 2026-06-23 21:05   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Valori progetto product — JustLastOne (PRJ_* per admin.portal.lib/project.config).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Costanti product JLO non devono essere hardcoded in admin.portal.lib/project.config.mjs del host.
 *
 *   A cosa serve:
 *   - PROJECT_CONFIG_VALUES caricato dinamicamente quando PRJ_NAME=JustLastOne.
 *
 * Generalizzazione:
 *   No — valori fissi monorepo JustLastOne; duplicare file per altro product.
 *
 * Input:
 *   - PRJ_NAME=JustLastOne in env — seleziona questo overlay all'import project.config
 *
 * Consumatori:
 *   - admin.portal.lib/project.config.mjs — validateProjectConfig e getter PRJ_*
 *
 * Export principali:
 *   - PROJECT_CONFIG_VALUES — repo, Jira JLO, GitHub, DB Prisma, health URL, manifest
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

/** @type {import("../admin.portal.lib/project.config.mjs").ProjectConfig} */
export const PROJECT_CONFIG_VALUES = {
  PRJ_REPO          : "JustLastOne"
, PRJ_NAME          : "JustLastOne"
, PRJ_SLUG          : "justlastone"
, PRJ_JIRA_PREFIX   : "JLO"
, PRJ_JIRA_BOARD_ID : "68"
, PRJ_GITHUB_OWNER  : "IbyEll"
, PRJ_GITHUB_REPO   : "JustLastOne"
, PRJ_DB_FILENAME   : "JLO_DEV.db"
, PRJ_DB_PACKAGE    : "packages/database"
, PRJ_DB_PRISMA_DIR : "packages/database/prisma"
, PRJ_SEED          : "packages/database/prisma/seed.ts"
, PRJ_SEED_FUNC     : "testScript/funzionali/test-seed-utenti.mjs"
, PRJ_DB_NPM_WORKSPACE : "@justlastone/database"
, PRJ_AUTH_HEALTH_URL  : "http://localhost:4001/api/v1/health"
, PRJ_API_HEALTH_URL   : "http://localhost:4000/api/v1/health"
, PRJ_TEST_SCRIPT   : "testScript"
, PRJ_NPM_SCOPE     : "@justlastone"
, PRJ_WEB_OPEN_URL     : "http://localhost:3000/it"
, PRJ_PRODUCT_MANIFEST : "cruscotto.frontend/product.manifest.json"
, PRJ_DASHBOARD_PORT   : "3999"
};
