/**
 * PortalAdmin path resolver — PORTAL_ROOT vs PRODUCT_REPO_PATH (JustLastOne).
 */

import "./load-env.mjs";

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_SIBLING = join(PORTAL_ROOT, "..", "JustLastOne");

/**
 * Root directory of PortalAdmin (this repository).
 *
 * @returns {string}
 */
export function getPortalRoot() {
  return PORTAL_ROOT;
}

/** @deprecated use getPortalRoot() */
export { PORTAL_ROOT };

/**
 * Resolve configured product monorepo path (JustLastOne).
 *
 * @param {{ required?: boolean }} [opts]
 * @returns {string | null}
 */
export function resolveProductRepoPath(opts = {}) {
  const { required = true } = opts;
  const raw   = process.env.PRODUCT_REPO_PATH?.trim();
  const path  = raw ? resolve(raw) : resolve(DEFAULT_SIBLING);

  if (!existsSync(path)) {
    if (!required) {
      return null;
    }

    throw new Error(
      [
        `Product repo non trovato: ${path}`
      , "Imposta PRODUCT_REPO_PATH in .env (es. checkout sibling ../JustLastOne)."
      ].join("\n")
    );
  }

  return path;
}

/**
 * @returns {string}
 */
export function getProductRepoPath() {
  const path = resolveProductRepoPath({ required: true });

  if (!path) {
    throw new Error("Product repo non configurato.");
  }

  return path;
}

/**
 * @returns {string}
 */
export function getTestScriptDir() {
  return join(getProductRepoPath(), "testScript");
}

/**
 * Verifica che testScript/ esista nel product repo (ADMIN-92).
 *
 * @returns {string} Absolute path to testScript/
 */
export function requireTestScriptDir() {
  const dir = getTestScriptDir();

  if (!existsSync(dir)) {
    throw new Error(
      [
        `testScript/ non trovato: ${dir}`
      , "Verifica PRODUCT_REPO_PATH e checkout JustLastOne (sibling ../JustLastOne)."
      ].join("\n")
    );
  }

  return dir;
}

/** Alias esplicito ADMIN-92 — `join(PRODUCT_REPO_PATH, "testScript")`. */
export { getTestScriptDir as TEST_SCRIPT_DIR };

/**
 * @returns {string}
 */
export function getPortalDataDir() {
  return join(PORTAL_ROOT, "data");
}

/**
 * @returns {string}
 */
export function getPortalReportsDir() {
  return join(getPortalDataDir(), "reports");
}
