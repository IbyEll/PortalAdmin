/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 20:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 20:42   by: IbyEll
 * modificato il: 2026-06-23 20:42   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Caricamento .env root PortalAdmin — idempotente, non sovrascrive shell.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Runner, dashboard e script devono leggere PRODUCT_REPO_PATH, PRJ_NAME e URL stack senza
 *     dotenv duplicato in ogni entrypoint.
 *
 *   A cosa serve:
 *   - Side-effect all'import del modulo più loadAdminEnv esplicito; env shell resta prioritaria.
 *
 * Generalizzazione:
 *   Si — path .env fisso sotto portal root; riusabile da ogni overlay e script host.
 *
 * Input:
 *   - file .env in root PortalAdmin (opzionale; assente in CI/smoke)
 *   - process.env già impostate — non sovrascritte (override false)
 *
 * Consumatori:
 *   - admin.portal.lib/test.run.all.mjs, runner/runner.config.stack.mjs, cruscotto.frontend/cruscotto.server.mjs
 *   - admin.portal.lib/project.config.mjs, admin.portal.lib/portal.paths.resolver.mjs — import per PRJ_NAME
 *   - test.smoke e script Jira — variabili stack e credenziali
 *
 * Export principali:
 *   - loadAdminEnv — carica .env una sola volta; ritorna path o null se assente
 *   - loadPortalEnv — alias deprecato di loadAdminEnv
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH    = join(PORTAL_ROOT, ".env");

/** Guard idempotenza — un solo parse dotenv per processo. */
let loaded = false;

/**
 * Carica `.env` in PortalAdmin root se esiste; non sovrascrive env già impostate.
 *
 * @returns {string | null} path `.env` caricato, o null se file assente
 */
export function loadAdminEnv() {
  // 1. Idempotenza — seconda chiamata ritorna path senza rileggere file
  if (loaded) {
    return ENV_PATH;
  }

  loaded = true;

  // 2. File assente — ok in CI/smoke senza .env locale
  if (!existsSync(ENV_PATH)) {
    return null;
  }

  // 3. dotenv — override: false rispetta variabili già esportate in shell
  config({ path: ENV_PATH, override: false });
  return ENV_PATH;
}

// Side-effect: primo import applica .env prima di project.config / portal.paths
loadAdminEnv();

/** @deprecated use loadAdminEnv */
export { loadAdminEnv as loadPortalEnv };
