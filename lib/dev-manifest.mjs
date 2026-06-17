/**
 * Caricamento dev-manifest.json — requisiti stack e catalogo servizi dev.
 *
 * Descrizione funzionale:
 *   Perché esiste: cruscotto, dev-api e discovery devono condividere un'unica
 *     fonte per porte, health URL e comandi start — senza duplicare JSON in ogni modulo.
 *   A cosa serve: legge e cachea il manifest PortalAdmin (PRJ_DEV_MANIFEST) ed espone
 *     requirements + services per API dev, smoke test e discovery.services.repo.
 *
 * Struttura JSON attesa:
 *   requirements — nodeMin, stack, prerequisites, envFiles, commands (tab Requisiti)
 *   services     — id, label, port, healthUrl, openUrl, start, … (discovery + Utility)
 *
 * Consumatori: server/dev-api.mjs, lib/discovery.services.repo.mjs,
 *   scripts/smoke-portal-paths.mjs, runner/stop_ALL_services.mjs
 *
 * Export principali:
 *   loadDevManifest   — parse JSON con cache in-process
 *   DEV_MANIFEST_PATH — path assoluto per diagnostica/smoke
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { getProjectConfig } from "./admin/config.project.mjs";
import { getPortalRoot } from "./portal-paths.mjs";

// Path assoluto — relativo a PortalAdmin da PRJ_DEV_MANIFEST (config progetto attivo)
const MANIFEST_PATH = join(getPortalRoot(), getProjectConfig().PRJ_DEV_MANIFEST);

/** @type {unknown | null} */
let cached = null;

/**
 * Legge e valida dev-manifest.json (con cache in-process).
 *
 * @returns {Promise<{
 *   requirements: Record<string, unknown>
 * , services: Array<Record<string, unknown>>
 * }>}
 */
export async function loadDevManifest() {
  // 1. Cache hit — evita I/O ripetuto (dashboard poll, discovery, smoke)
  if (cached) {
    return /** @type {{ requirements: Record<string, unknown>, services: Array<Record<string, unknown>> }} */ (cached);
  }

  // 2. Lettura file JSON da PortalAdmin (default cruscotto/dev-manifest.json)
  const raw  = await readFile(MANIFEST_PATH, "utf8");
  const data = JSON.parse(raw);

  // 3. Validazione minima — root deve essere un oggetto
  if (!data || typeof data !== "object") {
    throw new Error("dev-manifest.json non valido");
  }

  // 4. Memorizza per richieste successive nello stesso processo Node
  cached = data;
  return /** @type {{ requirements: Record<string, unknown>, services: Array<Record<string, unknown>> }} */ (data);
}

/** Path assoluto del manifest attivo (smoke test, diagnostica). */
export const DEV_MANIFEST_PATH = MANIFEST_PATH;
