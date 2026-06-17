/**
 * Valori progetto PortalAdmin — repo tooling ADMIN (cruscotto, dashboard, runner).
 *
 * Overlay attivo con PRJ_NAME=PortalAdmin.
 * PRJ_REPO=PortalAdmin → resolveDefaultProductRepoPath punta a questo repo (sibling ../PortalAdmin).
 * Per smoke/e2e con stack product: imposta PRODUCT_REPO_PATH sul checkout JustLastOne.
 *
 * @type {import("../../lib/project.config.mjs").ProjectConfig}
 */
export const PROJECT_CONFIG_VALUES = {
  PRJ_REPO             : "PortalAdmin"
, PRJ_NAME             : "AdminDashboard"
, PRJ_SLUG             : "admindashboard"
, PRJ_JIRA_PREFIX      : "ADMIN"
, PRJ_GITHUB_OWNER     : "IbyEll"
, PRJ_GITHUB_REPO      : "PortalAdmin"
, PRJ_DB_FILENAME      : "cruscotto.db"
, PRJ_DB_PACKAGE       : "lib/cruscotto-db"
, PRJ_DB_PRISMA_DIR    : "lib/cruscotto-db/prisma"
, PRJ_SEED             : "lib/cruscotto-db/migrate.mjs"
, PRJ_SEED_FUNC        : "scripts/sync-jira-backlog.mjs"
, PRJ_DB_NPM_WORKSPACE : "@portaladmin/cruscotto-db"
, PRJ_AUTH_HEALTH_URL  : "http://localhost:4001/api/v1/health"
, PRJ_API_HEALTH_URL   : "http://localhost:4000/api/v1/health"
, PRJ_TEST_SCRIPT      : "scripts"
, PRJ_NPM_SCOPE        : "@portaladmin"
, PRJ_WEB_OPEN_URL     : "http://localhost:3998"
, PRJ_DEV_MANIFEST     : "cruscotto/dev-manifest.json"
, PRJ_DASHBOARD_PORT   : "3998"
};
