/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** PROJECT CONFIG ** -- commentato il: 2026-06-18 18:00
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 09:39   by: IbyEll
 * modificato il: 2026-06-18 18:00   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *       Overlay AdminDashBoard — PortalAdmin come product istanziabile (cruscotto, test, ADMIN Jira)
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - PortalAdmin è product repo e overlay: stesso checkout per tooling, dashboard :3998 e ticket ADMIN.
 *
 *   A cosa serve:
 *   - Costanti PRJ_* per HOME, cruscotto, testScript, DB SQLite cruscotto.database e workflow ADMIN.
 *
 * Input:
 *   - .env PRJ_NAME=AdminDashBoard — chiave cartella PROJECT_AdminDashBoard (import dinamico)
 *   - PRODUCT_REPO_PATH — default sibling ../PortalAdmin (= PRJ_REPO)
 *
 * Note:
 *   - PRJ_NAME «AdminDashboard» = nome progetto in UI; env overlay resta AdminDashBoard.
 *   - PRJ_AUTH/API_HEALTH_URL = HOME e cruscotto (non NestJS product).
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

const DASHBOARD_PORT = "3998";

/** @type {import("../lib/project.config.mjs").ProjectConfig} */
export const PROJECT_CONFIG_VALUES = {
  PRJ_REPO             : "PortalAdmin"
, PRJ_NAME             : "AdminDashboard"
, PRJ_SLUG             : "admindashboard"
, PRJ_JIRA_PREFIX      : "ADMIN"
, PRJ_GITHUB_OWNER     : "IbyEll"
, PRJ_GITHUB_REPO      : "PortalAdmin"
, PRJ_DB_FILENAME      : "cruscotto.db"
, PRJ_DB_PACKAGE       : "cruscotto.database"
, PRJ_DB_PRISMA_DIR    : "cruscotto.database"
, PRJ_SEED             : "cruscotto.database/migrate.mjs"
, PRJ_SEED_FUNC        : "admin.portal.testscript/funzionali/test.cruscotto.startup.mjs"
, PRJ_DB_NPM_WORKSPACE : "@justlastone/cruscotto-db"
, PRJ_AUTH_HEALTH_URL  : "http://localhost:3990/api/health"
, PRJ_API_HEALTH_URL   : `http://localhost:${DASHBOARD_PORT}/api/health`
, PRJ_TEST_SCRIPT      : "admin.portal.testscript"
, PRJ_NPM_SCOPE        : "@portaladmin"
, PRJ_WEB_OPEN_URL     : `http://localhost:${DASHBOARD_PORT}/`
, PRJ_PRODUCT_MANIFEST : "PROJECT_AdminDashBoard/product.manifest.AdminDashBoard.json"
, PRJ_DASHBOARD_PORT   : DASHBOARD_PORT
};
