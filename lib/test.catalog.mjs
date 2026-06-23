/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 20:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 20:42   by: IbyEll
 * modificato il: 2026-06-23 20:42   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *     Catalogo testScript — discovery generica e policy da PROJECT_{overlay}/test.catalog.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Run-all, dashboard e meta tecnici condividono walk filesystem e policy skip senza logica
 *     duplicata per ogni overlay product.
 *
 *   A cosa serve:
 *   - Path product repo, discoverTestScripts; overlay opzionale espone BLOCKED e EXCLUDED.
 *
 * Generalizzazione:
 *   Si — walk su PRJ_TEST_SCRIPT product; policy da PROJECT_{PRJ_NAME}/test.catalog.{nome}.mjs.
 *
 * Input:
 *   - PRJ_NAME — overlay per caricare test.catalog.{overlay}.mjs
 *   - PRODUCT_REPO_PATH — root product per discover file .mjs
 *   - PRJ_TEST_SCRIPT — directory relativa suite test nel product repo
 *
 * Consumatori:
 *   - lib/test.run.all.mjs — elenco script da eseguire
 *   - cruscotto.frontend/cruscotto.server.mjs — API catalogo test
 *   - cruscotto.frontend/cruscotto.testscript.manager.mjs — gestione run singolo script
 *
 * Export principali:
 *   - discoverTestScripts — walk ricorsivo .mjs sotto testScript
 *   - BLOCKED_SCRIPTS, EXCLUDED_SCRIPTS, BLOCKED_REASONS — policy overlay
 *   - getRepoRoot, REPO_ROOT, TEST_SCRIPT_DIR, requireTestScriptDir — path product
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { resolveProjectOverlayName } from "./project.config.mjs";
import {
  getProductRepoPath
, getTestScriptDir
, requireTestScriptDir
} from "./portal.paths.resolver.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const overlayName = resolveProjectOverlayName();

/**
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function loadOverlayPolicy() {
  try {
    return await import(pathToFileURL(
      join(PORTAL_ROOT, `PROJECT_${overlayName}`, `test.catalog.${overlayName}.mjs`)
    ).href);
  } catch (err) {
    const notFound = err instanceof Error && "code" in err && err.code === "ERR_MODULE_NOT_FOUND";

    if (notFound) {
      return null;
    }

    throw err;
  }
}

const overlayPolicy = await loadOverlayPolicy();

/** @type {ReadonlySet<string>} */
export const BLOCKED_SCRIPTS = overlayPolicy?.BLOCKED_SCRIPTS instanceof Set
  ? overlayPolicy.BLOCKED_SCRIPTS
  : new Set();

/** @type {ReadonlySet<string>} */
export const EXCLUDED_SCRIPTS = overlayPolicy?.EXCLUDED_SCRIPTS instanceof Set
  ? overlayPolicy.EXCLUDED_SCRIPTS
  : new Set();

/** @type {Readonly<Record<string, string>>} */
export const BLOCKED_REASONS = overlayPolicy?.BLOCKED_REASONS && typeof overlayPolicy.BLOCKED_REASONS === "object"
  ? /** @type {Record<string, string>} */ (overlayPolicy.BLOCKED_REASONS)
  : {};

/**
 * Root del product repo (PRODUCT_REPO_PATH) — non la root di PortalAdmin.
 *
 * @returns {string}
 */
export function getRepoRoot() {
  return getProductRepoPath();
}

/** Compat import legacy (scan product repo). */
export const REPO_ROOT = getProductRepoPath();

/** Path assoluto alla directory test del product (PRJ_TEST_SCRIPT). */
export const TEST_SCRIPT_DIR = getTestScriptDir();

export { requireTestScriptDir };

/**
 * @typedef {{ rel: string, suite: string, file: string, abs: string }} ScriptEntry
 * @property {string} rel   — path relativo alla root testScript (slash forward)
 * @property {string} suite — prima cartella del path, o `"root"` se in root testScript
 * @property {string} file  — nome file (es. `test-login.mjs`)
 * @property {string} abs   — path assoluto sul filesystem
 */

/**
 * Verifica se un file .mjs è incluso nel catalogo (oltre al prefisso test-).
 *
 * @param {string} relDir — path relativo testScript della directory corrente
 * @param {string} fileName
 * @returns {boolean}
 */
export function isCatalogScriptFile(relDir, fileName) {
  if (fileName.startsWith("test-") || fileName.startsWith("test.")) {
    return true;
  }

  return fileName === "run-funzionali.mjs" && relDir === "funzionali";
}

/**
 * Scansiona la directory test del product e restituisce gli script della suite.
 *
 * @param {{
 *   excludedScripts?: ReadonlySet<string>
 *   skipDirNames?: ReadonlySet<string>
 *   isScriptFile?: (relDir: string, fileName: string) => boolean
 * }} [options]
 * @returns {Promise<ScriptEntry[]>}
 */
export async function discoverTestScripts(options = {}) {
  const excludedScripts = options.excludedScripts ?? EXCLUDED_SCRIPTS;
  const skipDirNames      = options.skipDirNames ?? new Set(["lib"]);
  const isScriptFile      = options.isScriptFile ?? isCatalogScriptFile;

  requireTestScriptDir();
  const testScriptDir = getTestScriptDir();

  /** @type {ScriptEntry[]} */
  const found = [];

  /**
   * @param {string} dir
   */
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const ent of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, ent.name);

      if (ent.isDirectory()) {
        if (skipDirNames.has(ent.name)) {
          continue;
        }

        await walk(full);
        continue;
      }

      if (!ent.isFile() || !ent.name.endsWith(".mjs")) {
        continue;
      }

      const relDir = relative(testScriptDir, dir).replace(/\\/g, "/");

      if (!isScriptFile(relDir, ent.name)) {
        continue;
      }

      const rel = relative(testScriptDir, full).replace(/\\/g, "/");

      if (excludedScripts.has(rel)) {
        continue;
      }

      const parts = rel.split("/");

      found.push({
        rel
      , suite : parts.length > 1 ? parts[0] : "root"
      , file  : ent.name
      , abs   : full
      });
    }
  }

  await walk(testScriptDir);

  const portalTestscriptDir = join(PORTAL_ROOT, "admin.portal.testscript");
  const portalFunzionaleDir = join(portalTestscriptDir, "funzionali");

  if (
    existsSync(portalFunzionaleDir)
    && resolve(testScriptDir).toLowerCase() !== resolve(portalTestscriptDir).toLowerCase()
  ) {
    /**
     * @param {string} dir
     */
    async function walkPortalFunzionale(dir) {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const ent of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const full = join(dir, ent.name);

        if (ent.isDirectory()) {
          if (skipDirNames.has(ent.name)) {
            continue;
          }

          await walkPortalFunzionale(full);
          continue;
        }

        if (!ent.isFile() || !ent.name.endsWith(".mjs")) {
          continue;
        }

        const relDir = relative(portalFunzionaleDir, dir).replace(/\\/g, "/");
        const relRaw = relative(portalFunzionaleDir, full).replace(/\\/g, "/");

        if (!isScriptFile(relDir, ent.name)) {
          continue;
        }

        const relCatalog = relDir ? `funzionali/${relRaw}` : `funzionali/${ent.name}`;

        if (excludedScripts.has(relRaw) || excludedScripts.has(relCatalog)) {
          continue;
        }

        found.push({
          rel   : relCatalog
        , suite : "funzionali"
        , file  : ent.name
        , abs   : full
        });
      }
    }

    await walkPortalFunzionale(portalFunzionaleDir);
  }

  found.sort((a, b) => a.suite.localeCompare(b.suite) || a.rel.localeCompare(b.rel));

  return found;
}
