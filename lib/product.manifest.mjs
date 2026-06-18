/**
 * ** LIBRARY MODULE **
 * Caricamento product.manifest.json — requisiti stack e catalogo servizi dev.
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - cruscotto, dev-api e discovery devono condividere porte, health URL e comandi start
 *     senza duplicare JSON in ogni consumer
 *
 *   A cosa serve:
 *   - legge e cachea il manifest PortalAdmin (PRJ_PRODUCT_MANIFEST)
 *   - valida requirements + services e normalizza il payload per discovery e tab Requisiti
 *
 * Struttura JSON attesa (cruscotto.frontend/product.manifest.json):
 *   requirements — nodeMin, stack, prerequisites, envFiles, commands, readmeUrl
 *   services     — id, label, port, healthUrl, openUrl, start, processScript, …
 *
 * Consumatori:
 *   - server/dev-api.mjs — tab Requisiti e Servizi
 *   - lib/discovery.services.repo.mjs — piano avvio Process
 *   - cruscotto.frontend/config_api-portal.mjs — fallback manifest PortalAdmin
 *   - scripts/smoke-portal-paths.mjs — smoke path e parse
 *
 * Export principali:
 *   - loadProductManifest — parse JSON con cache in-process
 *   - invalidateProductManifestCache — reset cache (test / reload overlay)
 *   - PRODUCT_MANIFEST_PATH — path assoluto manifest attivo
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { getProjectConfig } from "./project.config.mjs";
import { getPortalRoot } from "./portal.paths.resolver.mjs";

// --- path manifest — da PRJ_PRODUCT_MANIFEST overlay attivo ---
const MANIFEST_PATH = join(getPortalRoot(), getProjectConfig().PRJ_PRODUCT_MANIFEST);

/** @type {{ requirements: Record<string, unknown>, services: Array<Record<string, unknown>> } | null} */
let cached = null;

/**
 * @param {unknown} data
 * @returns {{ requirements: Record<string, unknown>, services: Array<Record<string, unknown>> }}
 */
function normalizeProductManifest(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("product.manifest.json — root deve essere un oggetto");
  }

  const root         = /** @type {Record<string, unknown>} */ (data);
  const requirements = root.requirements;
  const services     = root.services;

  if (!requirements || typeof requirements !== "object" || Array.isArray(requirements)) {
    throw new Error("product.manifest.json — requirements mancante o non oggetto");
  }

  if (!Array.isArray(services)) {
    throw new Error("product.manifest.json — services deve essere un array");
  }

  return {
    requirements : /** @type {Record<string, unknown>} */ (requirements)
  , services     : /** @type {Array<Record<string, unknown>>} */ (services)
  };
}

/**
 * Invalida cache in-process (smoke, cambio overlay in stesso processo).
 */
export function invalidateProductManifestCache() {
  cached = null;
}

/**
 * Legge e valida product.manifest.json (con cache in-process).
 *
 * @returns {Promise<{
 *   requirements: Record<string, unknown>
 * , services: Array<Record<string, unknown>>
 * }>}
 */
export async function loadProductManifest() {
  // 1. Cache hit — evita I/O ripetuto (dashboard poll, discovery, smoke)
  if (cached) {
    return cached;
  }

  // 2. Lettura file JSON sotto PortalAdmin (default cruscotto.frontend/product.manifest.json)
  const raw  = await readFile(MANIFEST_PATH, "utf8");
  const data = JSON.parse(raw);

  // 3. Validazione minima — requirements + services
  cached = normalizeProductManifest(data);

  return cached;
}

/** Path assoluto del manifest attivo (smoke test, diagnostica). */
export const PRODUCT_MANIFEST_PATH = MANIFEST_PATH;
