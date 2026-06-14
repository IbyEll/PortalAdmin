import { join } from "node:path";

import { getPortalReportsDir } from "./portal-paths.mjs";

export const REPORTS_DIR = getPortalReportsDir();
export const HISTORY_DIR = join(REPORTS_DIR, "history");
export const LATEST_JSON = join(REPORTS_DIR, "latest.json");
export const LATEST_HTML = join(REPORTS_DIR, "latest.html");

/**
 * @returns {string}
 */
export function getReportsDir() {
  return getPortalReportsDir();
}
