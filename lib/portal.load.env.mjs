/**
 * Caricamento `.env` root PortalAdmin — idempotente, non sovrascrive shell.
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - runner, dashboard e script devono leggere PRODUCT_REPO_PATH, PRJ_NAME, Jira e URL stack
 *   - evita dotenv duplicato in ogni entrypoint
 *
 *   A cosa serve:
 *   - import side-effect all'avvio modulo + loadAdminEnv() esplicito
 *   - variabili già in process.env restano prioritarie (override: false)
 *
 * Consumatori:
 *   - runner/run-all.mjs, runner/runner.config.stack.mjs, server/dashboard-server.mjs
 *   - lib/project.config.mjs, lib/portal.paths.resolver.mjs, script smoke Jira
 *
 * Export principali:
 *   - loadAdminEnv — carica .env una sola volta; ritorna path o null se assente
 *   - loadPortalEnv — alias deprecato
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
