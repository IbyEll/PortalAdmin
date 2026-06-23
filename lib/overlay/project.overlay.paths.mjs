/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 20:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 20:42   by: IbyEll
 * modificato il: 2026-06-23 20:42   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *           Path overlay progetto — risoluzione PROJECT_{overlay} con fallback PROJECT_Base.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - File condivisi tra overlay (analysis, overview, fixture no-op) non vanno duplicati in ogni
 *     PROJECT_{nome}.
 *
 *   A cosa serve:
 *   - Directory overlay/base, resolve path file e URL import dinamico (overlay prima, poi Base).
 *
 * Generalizzazione:
 *   Si — overlayName e portalRoot parametrizzano ogni risoluzione; PROJECT_Base come fallback.
 *
 * Input:
 *   - overlayName — nome istanza (es. AdminDashBoard, JustLastOne) o Base
 *   - relativePath — file relativo alla cartella PROJECT_{overlay}
 *   - portalRoot — root PortalAdmin (default da import.meta.url)
 *
 * Consumatori:
 *   - lib/overlay/dashboard.project.mjs — path pagine e config overlay
 *   - lib/test.match-fixtures.mjs — resolveProjectOverlayFilePath per fixture test
 *   - lib/portal.instance.mjs — elenco overlay istanziabili
 *
 * Export principali:
 *   - PROJECT_BASE_OVERLAY_NAME — costante "Base" (non istanziabile in HOME)
 *   - getProjectBaseDir, getProjectOverlayDir — path assoluti cartelle PROJECT_*
 *   - resolveProjectOverlayFilePath — path file con fallback Base
 *   - resolveProjectOverlayFileUrl — file URL per import dinamico
 *   - listProjectInstanceOverlays — nomi overlay attivabili (esclude Base)
 *   - isProjectBaseOverlay — true se overlay è PROJECT_Base
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Nome cartella condivisa — non è un'istanza attivabile in HOME. */
export const PROJECT_BASE_OVERLAY_NAME = "Base";

/**
 * @returns {string}
 */
export function getPortalRoot() {
  return PORTAL_ROOT;
}

/**
 * @param {string} overlayName
 * @returns {boolean}
 */
export function isProjectBaseOverlay(overlayName) {
  return overlayName === PROJECT_BASE_OVERLAY_NAME;
}

/**
 * @param {string} [portalRoot]
 * @returns {string}
 */
export function getProjectBaseDir(portalRoot = PORTAL_ROOT) {
  return join(portalRoot, `PROJECT_${PROJECT_BASE_OVERLAY_NAME}`);
}

/**
 * @param {string} overlayName
 * @param {string} [portalRoot]
 * @returns {string}
 */
export function getProjectOverlayDir(overlayName, portalRoot = PORTAL_ROOT) {
  return join(portalRoot, `PROJECT_${overlayName}`);
}

/**
 * Path assoluto: overlay PROJECT_{nome} poi PROJECT_Base.
 *
 * @param {string} overlayName
 * @param {string} relativePath — nome file relativo alla cartella overlay/base
 * @param {string} [portalRoot]
 * @returns {string | null}
 */
export function resolveProjectOverlayFilePath(
  overlayName
, relativePath
, portalRoot = PORTAL_ROOT
) {
  // 1. Guard — path relativo obbligatorio
  if (!relativePath?.trim()) {
    return null;
  }

  // 2. Tentativo cartella overlay specifica (salta Base come sorgente primaria)
  if (overlayName && !isProjectBaseOverlay(overlayName)) {
    const overlayPath = join(getProjectOverlayDir(overlayName, portalRoot), relativePath);

    if (existsSync(overlayPath)) {
      return overlayPath;
    }
  }

  // 3. Fallback PROJECT_Base — file condiviso tra overlay
  const basePath = join(getProjectBaseDir(portalRoot), relativePath);

  if (existsSync(basePath)) {
    return basePath;
  }

  return null;
}

/**
 * @param {string} overlayName
 * @param {string} relativePath
 * @param {string} [portalRoot]
 * @returns {string | null}
 */
export function resolveProjectOverlayFileUrl(
  overlayName
, relativePath
, portalRoot = PORTAL_ROOT
) {
  const filePath = resolveProjectOverlayFilePath(overlayName, relativePath, portalRoot);

  return filePath ? pathToFileURL(filePath).href : null;
}

/**
 * Nomi overlay istanziabili (esclude PROJECT_Base).
 *
 * @param {string} [portalRoot]
 * @returns {string[]}
 */
export function listProjectInstanceOverlays(portalRoot = PORTAL_ROOT) {
  const entries = readdirSync(portalRoot, { withFileTypes: true });
  /** @type {string[]} */
  const out = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("PROJECT_")) {
      continue;
    }

    const overlay = entry.name.slice("PROJECT_".length);

    if (isProjectBaseOverlay(overlay)) {
      continue;
    }

    out.push(overlay);
  }

  return out.sort((a, b) => a.localeCompare(b));
}
