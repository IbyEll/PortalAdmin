/**
 * Carica .env nella root PortalAdmin (dashboard, runner, script).
 * Idempotente: non sovrascrive variabili già impostate nel shell.
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH    = join(PORTAL_ROOT, ".env");

let loaded = false;

export function loadAdminEnv() {
  if (loaded) {
    return ENV_PATH;
  }

  loaded = true;

  if (!existsSync(ENV_PATH)) {
    return null;
  }

  config({ path: ENV_PATH, override: false });
  return ENV_PATH;
}

loadAdminEnv();

/** @deprecated use loadAdminEnv */
export { loadAdminEnv as loadPortalEnv };
