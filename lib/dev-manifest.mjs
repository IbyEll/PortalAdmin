import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { getPortalRoot } from "./portal-paths.mjs";

const MANIFEST_PATH = join(getPortalRoot(), "cruscotto", "dev-manifest.json");

/** @type {unknown | null} */
let cached = null;

/**
 * @returns {Promise<{
 *   requirements: Record<string, unknown>
 *   services: Array<Record<string, unknown>>
 * }>}
 */
export async function loadDevManifest() {
  if (cached) {
    return /** @type {{ requirements: Record<string, unknown>, services: Array<Record<string, unknown>> }} */ (cached);
  }

  const raw  = await readFile(MANIFEST_PATH, "utf8");
  const data = JSON.parse(raw);

  if (!data || typeof data !== "object") {
    throw new Error("dev-manifest.json non valido");
  }

  cached = data;
  return /** @type {{ requirements: Record<string, unknown>, services: Array<Record<string, unknown>> }} */ (data);
}

export const DEV_MANIFEST_PATH = MANIFEST_PATH;
