/**
 * PortalAdmin path resolver — PORTAL_ROOT vs PRODUCT_REPO_PATH (product repo).
 */

import "./portal.load.env.mjs";

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  getProjectConfig
, resolveDefaultProductRepoPath
} from "./project.config.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_SIBLING = resolveDefaultProductRepoPath(PORTAL_ROOT);

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
 * Resolve configured product monorepo path (default da config_project PRJ_REPO).
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
      , `Imposta PRODUCT_REPO_PATH in .env (es. checkout sibling ../${getProjectConfig().PRJ_REPO}).`
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
  const rel = getProjectConfig().PRJ_TEST_SCRIPT?.trim() || "testScript";

  return join(getProductRepoPath(), rel);
}

/**
 * Verifica che la directory test (PRJ_TEST_SCRIPT) esista nel product repo.
 *
 * @returns {string} Absolute path alla directory test
 */
export function requireTestScriptDir() {
  const dir = getTestScriptDir();
  const rel = getProjectConfig().PRJ_TEST_SCRIPT?.trim() || "testScript";

  if (!existsSync(dir)) {
    throw new Error(
      [
        `${rel} non trovato: ${dir}`
      , `Verifica PRODUCT_REPO_PATH e checkout ${getProjectConfig().PRJ_NAME} (sibling ../${getProjectConfig().PRJ_REPO}).`
      ].join("\n")
    );
  }

  return dir;
}

/** Alias — `join(PRODUCT_REPO_PATH, PRJ_TEST_SCRIPT)`. */
export { getTestScriptDir as TEST_SCRIPT_DIR };

/**
 * @returns {string}
 */
export function getPortalDataDir() {
  return join(PORTAL_ROOT, "cruscotto.database");
}

/**
 * @returns {string}
 */
export function getPortalFrontendDir() {
  return join(PORTAL_ROOT, "cruscotto.frontend");
}

/**
 * @returns {string}
 */
export function getPortalReportsDir() {
  return join(getPortalFrontendDir(), "reports");
}
