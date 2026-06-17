/**
 * Valori progetto product — JustLastOne.
 *
 * Per un altro monorepo: duplica come config_project.{PRJ_NAME}.mjs
 * (es. PRJ_NAME=MyApp → config_project.MyApp.mjs). Nessun import fisso in config_project.mjs.
 *
 * @type {import("../lib/project.config.mjs").ProjectConfig}
 */
export const PROJECT_CONFIG_VALUES = {
  PRJ_REPO          : "JustLastOne"
, PRJ_NAME          : "JustLastOne"
, PRJ_SLUG          : "justlastone"
, PRJ_JIRA_PREFIX   : "JLO"
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
, PRJ_DEV_MANIFEST     : "cruscotto/dev-manifest.json"
, PRJ_DASHBOARD_PORT   : "3999"
};
