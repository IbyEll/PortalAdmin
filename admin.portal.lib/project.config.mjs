/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 20:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 20:42   by: IbyEll
 * modificato il: 2026-06-23 20:42   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Config progetto product — catalogo costanti PRJ_* propedeutiche a PortalAdmin.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Valori overlay (repo, Jira, GitHub, DB, health URL) non devono essere hardcoded nel host
 *     PortalAdmin.
 *
 *   A cosa serve:
 *   - Carica PROJECT_{PRJ_NAME}/project.config.{nome}.mjs, valida chiavi e espone getter condivisi.
 *
 * Generalizzazione:
 *   Si — overlay da PRJ_NAME env; PRODUCT_REPO_PATH override path checkout product.
 *
 * Input:
 *   - PRJ_NAME — overlay obbligatorio in env (nessun default implicito)
 *   - PRODUCT_REPO_PATH — path assoluto product repo (env, opzionale)
 *   - AUTH_HEALTH_URL, API_HEALTH_URL, WEB_OPEN_URL — override probe stack dev
 *
 * Consumatori:
 *   - admin.portal.lib/portal.paths.resolver.mjs — PRJ_REPO, PRJ_TEST_SCRIPT
 *   - admin.portal.lib/overlay/cruscotto.config.overlay.mjs — payload UI cruscotto
 *   - runner, cruscotto.server, workflow Jira — costanti product ovunque
 *
 * Export principali:
 *   - resolveProjectOverlayName, getProjectConfig — overlay e config validata
 *   - projectHasProductDatabase — true se overlay dichiara Prisma/SQLite
 *   - resolveDefaultProductRepoPath, getProjectGithubUrl — path e URL GitHub
 *   - resolveDevStackProbeUrls — URL health auth/api/web con priorità env
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { stripTrailingSlash } from "./portal.utils.mjs";
import "./portal.load.env.mjs";

/**
 * Nome file overlay `project.config.{name}.mjs`, `runner.config.{name}.mjs`, `discovery.config.{name}.mjs`.
 * Richiede PRJ_NAME in .env o shell (es. AdminDashBoard | JustLastOne).
 *
 * @returns {string}
 */
export function resolveProjectOverlayName() {
  const fromEnv = process.env.PRJ_NAME?.trim();

  if (!fromEnv) {
    throw new Error(
      [
        "project.config — PRJ_NAME obbligatorio."
      , "Imposta in .env (es. PRJ_NAME=AdminDashBoard o PRJ_NAME=JustLastOne). Vedi .env.example."
      ].join(" ")
    );
  }

  return fromEnv;
}

const overlayName = resolveProjectOverlayName();

let PROJECT_CONFIG_VALUES;

try {
  ({ PROJECT_CONFIG_VALUES } = await import(`../PROJECT_${overlayName}/project.config.${overlayName}.mjs`));
} catch (err) {
  const notFound = err instanceof Error && "code" in err && err.code === "ERR_MODULE_NOT_FOUND";
  const hint     = notFound ? ` Crea PROJECT_${overlayName}/project.config.${overlayName}.mjs.` : "";

  throw new Error(`project.config — overlay "${overlayName}" non caricabile.${hint}`, { cause: err });
}

/**
 * @typedef {{
 *   PRJ_REPO           : string
 *   PRJ_NAME           : string
 *   PRJ_SLUG           : string
 *   PRJ_JIRA_PREFIX    : string
 *   PRJ_JIRA_BOARD_ID? : string
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
 *   PRJ_WEB_OPEN_URL     : string
 *   PRJ_PRODUCT_MANIFEST : string
 *   PRJ_DASHBOARD_PORT   : string
 * }} ProjectConfig
 */

/** Elenco costanti — descrizione (schema); valori in project.config.{Progetto}.mjs */
export const PROJECT_CONFIG_KEYS = {
  PRJ_REPO           : "Cartella default del product repo (sibling ../PRJ_REPO)"
, PRJ_NAME           : "Nome visualizzato in cruscotto e discovery servizi"
, PRJ_SLUG           : "Slug progetto (minuscolo, kebab-case consigliato)"
, PRJ_JIRA_PREFIX    : "Prefisso chiavi Jira product (es. ADMIN-xxx, JLO-xxx)"
, PRJ_JIRA_BOARD_ID  : "Id board Jira Software (override env JIRA_BOARD_ID)"
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
, PRJ_WEB_OPEN_URL     : "URL apertura web dev (health/open cruscotto)"
, PRJ_PRODUCT_MANIFEST : "product.manifest — path relativo root PortalAdmin"
, PRJ_DASHBOARD_PORT   : "Porta HTTP dashboard-server dedicata a questo overlay"
};

/** Chiavi obbligatorie — stringhe non vuote in values */
const REQUIRED_KEYS = [
  "PRJ_REPO"
, "PRJ_NAME"
, "PRJ_SLUG"
, "PRJ_JIRA_PREFIX"
, "PRJ_GITHUB_OWNER"
, "PRJ_GITHUB_REPO"
, "PRJ_SEED_FUNC"
, "PRJ_AUTH_HEALTH_URL"
, "PRJ_API_HEALTH_URL"
, "PRJ_TEST_SCRIPT"
, "PRJ_NPM_SCOPE"
, "PRJ_WEB_OPEN_URL"
, "PRJ_PRODUCT_MANIFEST"
, "PRJ_DASHBOARD_PORT"
];

/** Database product (Prisma/SQLite nel monorepo) — opzionale; stringa vuota = assente */
const OPTIONAL_DB_KEYS = [
  "PRJ_DB_FILENAME"
, "PRJ_DB_PACKAGE"
, "PRJ_DB_PRISMA_DIR"
, "PRJ_SEED"
, "PRJ_DB_NPM_WORKSPACE"
];

/**
 * @param {unknown} values
 * @returns {ProjectConfig}
 */
function validateProjectConfig(values) {
  if (!values || typeof values !== "object") {
    throw new Error("project.config — PROJECT_CONFIG_VALUES mancante o invalido");
  }

  /** @type {Record<string, string>} */
  const record = /** @type {Record<string, string>} */ ({ ...values });

  for (const key of REQUIRED_KEYS) {
    const val = record[key];

    if (typeof val !== "string" || !val.trim()) {
      throw new Error(`project.config — ${key} deve essere una stringa non vuota`);
    }
  }

  for (const key of OPTIONAL_DB_KEYS) {
    const val = record[key];

    record[key] = typeof val === "string" ? val.trim() : "";
  }

  return /** @type {ProjectConfig} */ (record);
}

/** Config progetto attivo (validata all'import). */
const ACTIVE_CONFIG = validateProjectConfig(PROJECT_CONFIG_VALUES);

/**
 * True se l'overlay dichiara un database product (Prisma/SQLite nel monorepo).
 *
 * @param {ProjectConfig} [config]
 * @returns {boolean}
 */
export function projectHasProductDatabase(config = ACTIVE_CONFIG) {
  return Boolean(
    config.PRJ_DB_FILENAME?.trim()
    && config.PRJ_DB_PACKAGE?.trim()
    && config.PRJ_DB_PRISMA_DIR?.trim()
  );
}

/**
 * @returns {ProjectConfig}
 */
export function getProjectConfig() {
  return ACTIVE_CONFIG;
}

/**
 * Id board Jira Software — env JIRA_BOARD_ID poi PRJ_JIRA_BOARD_ID overlay.
 *
 * @param {ProjectConfig} [config]
 * @returns {number}
 */
export function resolveJiraBoardId(config = ACTIVE_CONFIG) {
  const fromEnv = process.env.JIRA_BOARD_ID?.trim();

  if (fromEnv) {
    return Number(fromEnv);
  }

  const fromCfg = config.PRJ_JIRA_BOARD_ID?.trim();

  if (fromCfg) {
    return Number(fromCfg);
  }

  throw new Error(
    [
      "resolveJiraBoardId — JIRA_BOARD_ID mancante."
    , "Imposta env JIRA_BOARD_ID o PRJ_JIRA_BOARD_ID in project.config overlay."
    ].join(" ")
  );
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
 * Path assoluto product.manifest PortalAdmin (servizi stack dev product).
 *
 * @param {string} portalRoot
 * @returns {string}
 */
export function resolvePortalProductManifestPath(portalRoot) {
  return join(portalRoot, ACTIVE_CONFIG.PRJ_PRODUCT_MANIFEST);
}

/**
 * Verifica che il manifest configurato esista (smoke / diagnostica).
 *
 * @param {string} portalRoot
 * @returns {boolean}
 */
export function portalProductManifestExists(portalRoot) {
  return existsSync(resolvePortalProductManifestPath(portalRoot));
}

/**
 * Path assoluto script Prisma seed nel product repo.
 *
 * @param {string} productRoot
 * @returns {string}
 */
export function resolveProductSeedPath(productRoot) {
  const rel = ACTIVE_CONFIG.PRJ_SEED?.trim();

  if (!rel) {
    return "";
  }

  return join(productRoot, rel);
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

/**
 * URL probe stack dev — override env poi overlay progetto (PRJ_*).
 *
 * Priorità:
 *   auth — AUTH_HEALTH_URL → AUTH_URL/health → PRJ_AUTH_HEALTH_URL
 *   api  — API_HEALTH_URL → API_URL/health → PRJ_API_HEALTH_URL
 *   web  — WEB_OPEN_URL → WEB_BASE → PRJ_WEB_OPEN_URL
 *
 * @returns {{ authHealthUrl: string, apiHealthUrl: string, webUrl: string }}
 */
export function resolveDevStackProbeUrls() {
  const { auth, api } = getProjectHealthUrls();

  const authHealthUrl = process.env.AUTH_HEALTH_URL?.trim()
    || (process.env.AUTH_URL?.trim()
      ? `${stripTrailingSlash(process.env.AUTH_URL)}/health`
      : auth);
  const apiHealthUrl  = process.env.API_HEALTH_URL?.trim()
    || (process.env.API_URL?.trim()
      ? `${stripTrailingSlash(process.env.API_URL)}/health`
      : api);
  const webUrl        = process.env.WEB_OPEN_URL?.trim()
    || process.env.WEB_BASE?.trim()
    || ACTIVE_CONFIG.PRJ_WEB_OPEN_URL;

  return { authHealthUrl, apiHealthUrl, webUrl };
}
