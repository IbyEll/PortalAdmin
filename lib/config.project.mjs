/**
 * Config progetto product — catalogo costanti PRJ_* propedeutiche a PortalAdmin.
 *
 * I valori effettivi vivono in config_project.{Progetto}.mjs (es. config_project.JustLastOne.mjs).
 * Overlay attivo: env PRJ_NAME oppure default JustLastOne.
 * PRODUCT_REPO_PATH in .env resta l'override assoluto del path checkout.
 *
 * Uso:
 *   import { getProjectConfig, resolveProjectOverlayName } from "./config_project.mjs";
 *   const { PRJ_REPO, PRJ_DB_FILENAME } = getProjectConfig();
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import "./load-env.mjs";

/** Overlay se PRJ_NAME non è in .env / shell. */
const DEFAULT_PROJECT_OVERLAY = "JustLastOne";

/**
 * Nome file overlay `config.project.{name}.mjs`, `runner.config.{name}.mjs`, `config.discovery.{name}.mjs`.
 * Priorità: env PRJ_NAME → default JustLastOne.
 *
 * @returns {string}
 */
export function resolveProjectOverlayName() {
  const fromEnv = process.env.PRJ_NAME?.trim();

  if (fromEnv) {
    return fromEnv;
  }

  return DEFAULT_PROJECT_OVERLAY;
}

const overlayName = resolveProjectOverlayName();

let PROJECT_CONFIG_VALUES;

try {
  ({ PROJECT_CONFIG_VALUES } = await import(`./config.project.${overlayName}.mjs`));
} catch (err) {
  const notFound = err instanceof Error && "code" in err && err.code === "ERR_MODULE_NOT_FOUND";
  const hint     = notFound ? ` Crea lib/config.project.${overlayName}.mjs.` : "";

  throw new Error(`config.project — overlay "${overlayName}" non caricabile.${hint}`, { cause: err });
}

/**
 * @typedef {{
 *   PRJ_REPO           : string
 *   PRJ_NAME           : string
 *   PRJ_SLUG           : string
 *   PRJ_JIRA_PREFIX    : string
 *   PRJ_GITHUB_OWNER   : string
 *   PRJ_GITHUB_REPO    : string
 *   PRJ_DB_FILENAME    : string
 *   PRJ_DB_PACKAGE     : string
 *   PRJ_DB_PRISMA_DIR  : string
 *   PRJ_SEED           : string
 *   PRJ_SEED_FUNC      : string
 *   PRJ_DB_NPM_WORKSPACE : string
 *   PRJ_AUTH_HEALTH_URL  : string
 *   PRJ_API_HEALTH_URL   : string
 *   PRJ_TEST_SCRIPT    : string
 *   PRJ_NPM_SCOPE      : string
 *   PRJ_WEB_OPEN_URL   : string
 *   PRJ_DEV_MANIFEST   : string
 * }} ProjectConfig
 */

/** Elenco costanti — descrizione (schema); valori in config_project.{Progetto}.mjs */
export const PROJECT_CONFIG_KEYS = {
  PRJ_REPO           : "Cartella default del product repo (sibling ../PRJ_REPO)"
, PRJ_NAME           : "Nome visualizzato in cruscotto e discovery servizi"
, PRJ_SLUG           : "Slug progetto (minuscolo, kebab-case consigliato)"
, PRJ_JIRA_PREFIX    : "Prefisso chiavi Jira product (es. JLO-xxx)"
, PRJ_GITHUB_OWNER   : "Owner GitHub repository product"
, PRJ_GITHUB_REPO    : "Nome repository GitHub product"
, PRJ_DB_FILENAME    : "File SQLite dev sotto PRJ_DB_PRISMA_DIR"
, PRJ_DB_PACKAGE     : "Path package database / Prisma nel monorepo"
, PRJ_DB_PRISMA_DIR  : "Directory prisma (schema + .db dev)"
, PRJ_SEED           : "Script Prisma seed nel product repo (path relativo, es. …/prisma/seed.ts)"
, PRJ_SEED_FUNC      : "Script seed funzionali nel product repo (path relativo a root)"
, PRJ_DB_NPM_WORKSPACE : "Workspace npm per db:seed (es. @scope/database)"
, PRJ_AUTH_HEALTH_URL  : "URL health auth per --wait-auth (default stack dev)"
, PRJ_API_HEALTH_URL   : "URL health api per --wait-auth (default stack dev)"
, PRJ_TEST_SCRIPT    : "Directory testScript nel product repo"
, PRJ_NPM_SCOPE      : "Scope npm workspace (es. @justlastone/api)"
, PRJ_WEB_OPEN_URL   : "URL apertura web dev (health/open cruscotto)"
, PRJ_DEV_MANIFEST   : "dev-manifest servizi — path relativo root PortalAdmin"
};

/** Nomi obbligatori — devono essere stringhe non vuote in values */
const REQUIRED_KEYS = Object.keys(PROJECT_CONFIG_KEYS);

/**
 * @param {unknown} values
 * @returns {ProjectConfig}
 */
function validateProjectConfig(values) {
  if (!values || typeof values !== "object") {
    throw new Error("config_project — PROJECT_CONFIG_VALUES mancante o invalido");
  }

  /** @type {Record<string, string>} */
  const record = /** @type {Record<string, string>} */ (values);

  for (const key of REQUIRED_KEYS) {
    const val = record[key];

    if (typeof val !== "string" || !val.trim()) {
      throw new Error(`config_project — ${key} deve essere una stringa non vuota`);
    }
  }

  return /** @type {ProjectConfig} */ ({ ...record });
}

/** Config progetto attivo (validata all'import). */
const ACTIVE_CONFIG = validateProjectConfig(PROJECT_CONFIG_VALUES);

/**
 * @returns {ProjectConfig}
 */
export function getProjectConfig() {
  return ACTIVE_CONFIG;
}

/**
 * Path default product repo: sibling ../PRJ_REPO rispetto a PortalAdmin.
 *
 * @param {string} portalRoot
 * @returns {string}
 */
export function resolveDefaultProductRepoPath(portalRoot) {
  return resolve(join(portalRoot, "..", ACTIVE_CONFIG.PRJ_REPO));
}

/**
 * URL GitHub del repository product (senza trailing slash).
 *
 * @returns {string}
 */
export function getProjectGithubUrl() {
  return `https://github.com/${ACTIVE_CONFIG.PRJ_GITHUB_OWNER}/${ACTIVE_CONFIG.PRJ_GITHUB_REPO}`;
}

/**
 * Path assoluto dev-manifest PortalAdmin (servizi stack dev).
 *
 * @param {string} portalRoot
 * @returns {string}
 */
export function resolvePortalDevManifestPath(portalRoot) {
  return join(portalRoot, ACTIVE_CONFIG.PRJ_DEV_MANIFEST);
}

/**
 * Verifica che il manifest configurato esista (smoke / diagnostica).
 *
 * @param {string} portalRoot
 * @returns {boolean}
 */
export function portalDevManifestExists(portalRoot) {
  return existsSync(resolvePortalDevManifestPath(portalRoot));
}

/**
 * Path assoluto script Prisma seed nel product repo.
 *
 * @param {string} productRoot
 * @returns {string}
 */
export function resolveProductSeedPath(productRoot) {
  return join(productRoot, ACTIVE_CONFIG.PRJ_SEED);
}

/**
 * Path assoluto script seed funzionali nel product repo.
 *
 * @param {string} productRoot
 * @returns {string}
 */
export function resolveProductFuncSeedPath(productRoot) {
  return join(productRoot, ACTIVE_CONFIG.PRJ_SEED_FUNC);
}

/**
 * URL health default per attesa stack (--wait-auth).
 *
 * @returns {{ auth: string, api: string }}
 */
export function getProjectHealthUrls() {
  return {
    auth : ACTIVE_CONFIG.PRJ_AUTH_HEALTH_URL
  , api  : ACTIVE_CONFIG.PRJ_API_HEALTH_URL
  };
}
