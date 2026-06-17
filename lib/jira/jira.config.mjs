/**
 * Config Jira generalizzata — policy catalogo, chiavi progetto e merge segnali.
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - centralizzare la logica oggi in portal.config.mjs con overlay parametrico (PRJ_NAME)
 *   - separare policy statica (skip path, branch) da dati per progetto (prefissi Jira, GitHub)
 *
 *   A cosa serve:
 *   - loadJiraConfig(input) carica config.project + signals.catalog per product e portal
 *   - buildRepoSignalsCatalogConfig unisce policy base con PROJECT_CONFIG_VALUES
 *
 * Consumatori:
 *   - portal.config.mjs — facade default PortalAdmin + product overlay
 *   - script/test che devono risolvere config senza importare portal.config
 *
 * Export principali:
 *   - loadJiraConfig — async, input PRJ_NAME (string) o { productOverlay, portalOverlay?, portalRoot? }
 *   - buildRepoSignalsCatalogConfig — policy catalogo da due config.project
 *   - BASE_REPO_SIGNALS_CATALOG_POLICY — skip path, branch, limiti git (condivisi)
 *
 * Input:
 *   - string → productOverlay (PRJ_NAME del monorepo product, es. JustLastOne)
 *   - object.productOverlay — obbligatorio se non c'è PRJ_NAME in env
 *   - object.portalOverlay — default PortalAdmin
 */

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import "../portal.load.env.mjs";

const MODULE_DIR  = dirname(fileURLToPath(import.meta.url));
const PORTAL_ROOT = join(MODULE_DIR, "..", "..");

 

/**
 * @typedef {import("../admin/config.project.mjs").ProjectConfig} ProjectConfig
 */

/**
 * @typedef {{
 *   productSignalsMarker   : string
 *   portalSignalsMarker    : string
 *   productJiraPrefix      : string
 *   productGithubUrl       : string
 *   portalJiraPrefix       : string
 *   portalGithubUrl        : string
 *   productProjectOverlay  : string
 *   portalProjectOverlay   : string
 *   maxPaths               : number
 *   maxTests               : number
 *   gitEvidenceCommitLimit : number
 *   branchTypePrefixes     : ReadonlyArray<string>
 *   branchKeySeparator     : string
 *   skipPathParts          : ReadonlyArray<string>
 *   skipBasenames          : ReadonlyArray<string>
 *   skipExactPaths         : ReadonlyArray<string>
 *   skipPathPrefixes       : ReadonlyArray<string>
 *   meaningfulPathPrefixes : ReadonlyArray<string>
 *   pathPriority           : ReadonlyArray<{ prefix: string, priority: number, excludeContains?: string }>
 *   defaultPathPriority    : number
 * }} RepoSignalsCatalogConfig
 */

/**
 * @typedef {{
 *   JIRA_PROJECT_KEYS            : ReadonlyArray<string>
 *   REPO_SIGNALS_CATALOG_CONFIG  : RepoSignalsCatalogConfig
 *   REPO_IMPLEMENTATION_SIGNALS    : ReadonlyArray<{ key: string, label: string, paths: string[], tests?: string[] }>
 *   GIT_EVIDENCE_COMMIT_LIMIT      : number
 *   PRODUCT_PROJECT_CONFIG         : ProjectConfig
 *   PORTAL_PROJECT_CONFIG          : ProjectConfig
 *   PRODUCT_PROJECT_OVERLAY        : string
 *   PORTAL_PROJECT_OVERLAY         : string
 *   PRODUCT_REPO_SIGNALS           : ReadonlyArray<{ key: string, label: string, paths: string[], tests?: string[] }>
 *   PORTAL_REPO_SIGNALS            : ReadonlyArray<{ key: string, label: string, paths: string[], tests?: string[] }>
 * }} JiraConfig
 */

/** Policy catalogo condivisa — indipendente dall'overlay product. */
export const BASE_REPO_SIGNALS_CATALOG_POLICY = {
  productSignalsMarker   : "export const PRODUCT_REPO_SIGNALS = ["
, maxPaths               : 6
, maxTests               : 4
, gitEvidenceCommitLimit : 5
, branchTypePrefixes     : ["STORY", "BUG", "TODO"]
, branchKeySeparator     : "---"
, skipPathParts          : [
    "node_modules"
  , ".next"
  , ".git"
  , "coverage"
  , ".turbo"
  , "history"
  , "archives"
  ]
, skipBasenames          : [
    "package-lock.json"
  , "pnpm-lock.yaml"
  , "yarn.lock"
  ]
, skipExactPaths         : [
    "lib/jira/jira.working.order.mjs"
  , "lib/jira/jira.working.insights.mjs"
  , "lib/jira/jira.project.tree.plan.mjs"
  , "scripts/confluence-pillar-matrix-body.html"
  , "scripts/generate-confluence-pillar-matrix.mjs"
  , "scripts/publish-confluence-pillar-matrix.mjs"
  , "lib/pillar-matrix-portal.mjs"
  , "scripts/generate-pillar-matrix-portal.mjs"
  , "lib/pillar-matrix-regenerate.mjs"
  ]
, skipPathPrefixes       : [
    "data/"
  , "cruscotto/"
  ]
, meaningfulPathPrefixes : [
    "apps/"
  , "packages/"
  , "lib/"
  , "server/"
  , "scripts/"
  , "testScript/"
  ]
, pathPriority           : [
    { prefix: "apps/", priority: 0 }
  , { prefix: "packages/", priority: 1 }
  , { prefix: "lib/", priority: 3 }
  , { prefix: "server/", priority: 3 }
  , { prefix: "cruscotto/", priority: 3 }
  , { prefix: "scripts/", priority: 3 }
  , { prefix: "Admin/", priority: 3, excludeContains: "cruscotto/jira-working" }
  , { prefix: "docs/", priority: 9 }
  ]
, defaultPathPriority    : 5
};

/**
 * @param {ProjectConfig} config
 * @returns {string}
 */
export function buildProjectGithubUrl(config) {
  return `https://github.com/${config.PRJ_GITHUB_OWNER}/${config.PRJ_GITHUB_REPO}`;
}

/**
 * @param {ProjectConfig} productConfig
 * @param {{ productOverlay: string, portalOverlay: string }} overlays
 * @returns {RepoSignalsCatalogConfig}
 */
export function buildRepoSignalsCatalogConfig(productConfig, overlays) {
  return {
    ...BASE_REPO_SIGNALS_CATALOG_POLICY
  , productJiraPrefix     : productConfig.PRJ_JIRA_PREFIX
  , productGithubUrl      : buildProjectGithubUrl(productConfig)
  , productProjectOverlay : overlays.productOverlay
  };
}

/**
 * Normalizza input loadJiraConfig.
 *
 * @param {string | { productOverlay?: string, portalRoot?: string }} [input]
 * @returns {{ productOverlay: string, portalRoot: string }}
 */
export function resolveJiraConfigInput(input) {
  const portalRoot = (typeof input === "object" && input?.portalRoot)
    ? input.portalRoot
    : PORTAL_ROOT;

  if (typeof input === "string" && input.trim()) {
    return {
      productOverlay : input.trim()
    , portalRoot
    };
  }

  const productOverlay = (typeof input === "object" && input?.productOverlay?.trim())
    || process.env.PRJ_NAME?.trim();

  if (!productOverlay) {
    throw new Error(
      [
        "jira.config — productOverlay mancante."
      , "Passa PRJ_NAME (string), opts.productOverlay o imposta env PRJ_NAME (es. JustLastOne)."
      ].join(" ")
    );
  }



  return { productOverlay, portalRoot };
}

/**
 * @param {string} overlay
 * @param {string} portalRoot
 * @returns {Promise<ProjectConfig>}
 */
async function loadProjectConfigValues(overlay, portalRoot) {
  const file = join(portalRoot, `PROJECT_${overlay}`, `config.project.${overlay}.mjs`);

  try {
    const mod = await import(pathToFileURL(file).href);

    if (!mod.PROJECT_CONFIG_VALUES) {
      throw new Error(`PROJECT_CONFIG_VALUES mancante in ${file}`);
    }

    return mod.PROJECT_CONFIG_VALUES;
  } catch (err) {
    const notFound = err instanceof Error && "code" in err && err.code === "ERR_MODULE_NOT_FOUND";
    const hint     = notFound ? ` Crea PROJECT_${overlay}/config.project.${overlay}.mjs.` : "";

    throw new Error(`jira.config — overlay "${overlay}" non caricabile.${hint}`, { cause: err });
  }
}

/**
 * @param {string} overlay
 * @param {string} portalRoot
 * @returns {Promise<ReadonlyArray<{ key: string, label: string, paths: string[], tests?: string[] }>>}
 */
async function loadProductRepoSignals(overlay, portalRoot) {
  const file = join(portalRoot, `PROJECT_${overlay}`, `signals.catalog.${overlay}.mjs`);

  try {
    const mod = await import(pathToFileURL(file).href);

    if (!mod.PRODUCT_REPO_SIGNALS) {
      throw new Error(`PRODUCT_REPO_SIGNALS mancante in ${file}`);
    }

    return mod.PRODUCT_REPO_SIGNALS;
  } catch (err) {
    const notFound = err instanceof Error && "code" in err && err.code === "ERR_MODULE_NOT_FOUND";
    const hint     = notFound ? ` Crea PROJECT_${overlay}/signals.catalog.${overlay}.mjs.` : "";

    throw new Error(`jira.config — segnali product "${overlay}" non caricabili.${hint}`, { cause: err });
  }
}



/**
 * Carica config Jira per coppia product + portal overlay.
 *
 * @param {string | { productOverlay?: string,  portalRoot?: string }} [input]
 *   - string → PRJ_NAME product (es. `JustLastOne`)
 *   - object → `productOverlay` (o env PRJ_NAME), 
 * @returns {Promise<JiraConfig>}
 */
export async function loadJiraConfig(input) {
  const { productOverlay, portalRoot } = resolveJiraConfigInput(input);

  const [productConfig,  productSignals] = await Promise.all([
    loadProjectConfigValues(productOverlay, portalRoot)
  , loadProductRepoSignals(productOverlay, portalRoot)
  ]);

  const REPO_SIGNALS_CATALOG_CONFIG = buildRepoSignalsCatalogConfig(
    productConfig
  , { productOverlay }
  );

  const JIRA_PROJECT_KEYS = [productConfig.PRJ_JIRA_PREFIX];

  return {
    JIRA_PROJECT_KEYS
  , REPO_SIGNALS_CATALOG_CONFIG
  , REPO_IMPLEMENTATION_SIGNALS : [...productSignals]
  , GIT_EVIDENCE_COMMIT_LIMIT   : REPO_SIGNALS_CATALOG_CONFIG.gitEvidenceCommitLimit
  , PRODUCT_PROJECT_CONFIG      : productConfig
  , PRODUCT_PROJECT_OVERLAY     : productOverlay
  , PRODUCT_REPO_SIGNALS        : productSignals
  };
}
