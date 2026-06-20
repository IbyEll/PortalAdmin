/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-18 03:20
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 03:14   by: IbyEll
 * modificato il: 2026-06-18 03:20   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                    Config Jira generalizzata — policy catalogo, overlay PROJECT_* e merge segnali.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Centralizza policy statica (skip path git, branch ticket, limiti path/test) separata dai dati per
 *     progetto in PROJECT_{overlay}/project.config.*.mjs e signals.catalog.*.mjs.
 *   - Permette a PortalAdmin di puntare al product repo via PRJ_NAME senza hardcode in ogni modulo Jira.
 *
 *   A cosa serve:
 *   - loadJiraConfig carica project.config + PRODUCT_REPO_SIGNALS per l'overlay product.
 *   - buildRepoSignalsCatalogConfig unisce BASE_REPO_SIGNALS_CATALOG_POLICY con prefissi Jira/GitHub del
 *     product.
 *
 * Generalizzazione:
 *   Si — overlay product da PRJ_NAME o argomento loadJiraConfig; import dinamico PROJECT_{overlay}/*.
 *
 * Input:
 *   - PRJ_NAME — overlay product se non passato esplicitamente a loadJiraConfig
 *   - productOverlay — stringa o opts.productOverlay in loadJiraConfig / resolveJiraConfigInput
 *   - portalRoot — opts.portalRoot (default root PortalAdmin)
 *
 * Consumatori:
 *   - jira/jira.project.config.overlay.mjs — facade top-level (await loadJiraConfig a init)
 *
 * Export principali:
 *   - loadJiraConfig — async, input string (PRJ_NAME) o { productOverlay, portalRoot? }
 *   - resolveJiraConfigInput — normalizza input/env prima del load
 *   - buildRepoSignalsCatalogConfig — policy catalogo + metadati product overlay
 *   - buildProjectGithubUrl — URL repo GitHub da PROJECT_CONFIG_VALUES
 *   - BASE_REPO_SIGNALS_CATALOG_POLICY — skip path, branch, priority scan git (condivisa)
 *
 * Input loadJiraConfig:
 *   - string → productOverlay (es. JustLastOne)
 *   - object.productOverlay — obbligatorio se manca env PRJ_NAME
 *   - object.portalRoot — default root PortalAdmin (parent di PROJECT_*)
 *
 * Variabili d'ambiente:
 *   PRJ_NAME — overlay product se non passato in input
 */

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import "../../lib/portal.load.env.mjs";

const MODULE_DIR  = dirname(fileURLToPath(import.meta.url));
const PORTAL_ROOT = join(MODULE_DIR, "..", "..");

/**
 * @typedef {import("../project.config.mjs").ProjectConfig} ProjectConfig
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

/**
 * Policy catalogo condivisa — skip git scan, branch ticket, limiti path/test (indipendente dall'overlay).
 */
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
    "cruscotto.frontend/cruscotto.jira.working.order.mjs"
  , "cruscotto.frontend/cruscotto.jira.working.insights.mjs"
  , "cruscotto.frontend/cruscotto.jira.project.tree.plan.mjs"
  , "scripts/confluence-pillar-matrix-body.html"
  , "scripts/generate-confluence-pillar-matrix.mjs"
  , "scripts/publish-confluence-pillar-matrix.mjs"
  , "lib/pillar-matrix-portal.mjs"
  , "cruscotto.frontend/cruscotto.jira.pillar.matrix.portal.generate.mjs"
  , "lib/pillar-matrix-regenerate.mjs"
  ]
, skipPathPrefixes       : [
    "data/"
  , "cruscotto.frontend/"
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
  , { prefix: "cruscotto.frontend/", priority: 3 }
  , { prefix: "scripts/", priority: 3 }
  , { prefix: "Admin/", priority: 3, excludeContains: "cruscotto.frontend/jira" }
  , { prefix: "docs/", priority: 9 }
  ]
, defaultPathPriority    : 5
};

/**
 * URL browse GitHub da PROJECT_CONFIG_VALUES (owner/repo).
 *
 * @param {ProjectConfig} config
 * @returns {string}
 */
export function buildProjectGithubUrl(config) {
  // 1. URL browse da owner/repo in PROJECT_CONFIG_VALUES
  return `https://github.com/${config.PRJ_GITHUB_OWNER}/${config.PRJ_GITHUB_REPO}`;
}

/**
 * Merge policy base + prefissi Jira/GitHub del product overlay.
 *
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
 * Normalizza input loadJiraConfig (string, object o env PRJ_NAME).
 *
 * @param {string | { productOverlay?: string, portalRoot?: string }} [input]
 * @returns {{ productOverlay: string, portalRoot: string }}
 */
export function resolveJiraConfigInput(input) {
  // 1. portalRoot — esplicito in opts o default PORTAL_ROOT
  const portalRoot = (typeof input === "object" && input?.portalRoot)
    ? input.portalRoot
    : PORTAL_ROOT;

  if (typeof input === "string" && input.trim()) {
    return {
      productOverlay : input.trim()
    , portalRoot
    };
  }

  // 2. productOverlay — opts o env PRJ_NAME; throw se mancante
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
 * Import dinamico PROJECT_{overlay}/project.config.{overlay}.mjs.
 *
 * @param {string} overlay
 * @param {string} portalRoot
 * @returns {Promise<ProjectConfig>}
 */
async function loadProjectConfigValues(overlay, portalRoot) {
  const file = join(portalRoot, `PROJECT_${overlay}`, `project.config.${overlay}.mjs`);

  // 1. Import dinamico PROJECT_{overlay}/project.config — ERR_MODULE_NOT_FOUND con hint
  try {
    const mod = await import(pathToFileURL(file).href);

    if (!mod.PROJECT_CONFIG_VALUES) {
      throw new Error(`PROJECT_CONFIG_VALUES mancante in ${file}`);
    }

    return mod.PROJECT_CONFIG_VALUES;
  } catch (err) {
    const notFound = err instanceof Error && "code" in err && err.code === "ERR_MODULE_NOT_FOUND";
    const hint     = notFound ? ` Crea PROJECT_${overlay}/project.config.${overlay}.mjs.` : "";

    throw new Error(`jira.config — overlay "${overlay}" non caricabile.${hint}`, { cause: err });
  }
}

/**
 * Import dinamico PROJECT_{overlay}/signals.catalog.{overlay}.mjs (PRODUCT_REPO_SIGNALS).
 *
 * @param {string} overlay
 * @param {string} portalRoot
 * @returns {Promise<ReadonlyArray<{ key: string, label: string, paths: string[], tests?: string[] }>>}
 */
async function loadProductRepoSignals(overlay, portalRoot) {
  const file = join(portalRoot, `PROJECT_${overlay}`, `signals.catalog.${overlay}.mjs`);

  // 1. Import dinamico signals.catalog — PRODUCT_REPO_SIGNALS obbligatorio
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
 * Carica config Jira per overlay product (PROJECT_* sotto portal root).
 *
 * @param {string | { productOverlay?: string, portalRoot?: string }} [input]
 * @returns {Promise<JiraConfig>}
 */
export async function loadJiraConfig(input) {
  // 1. Input — productOverlay + portalRoot
  const { productOverlay, portalRoot } = resolveJiraConfigInput(input);

  // 2. Parallel load — project.config e catalogo segnali product
  const [productConfig, productSignals] = await Promise.all([
    loadProjectConfigValues(productOverlay, portalRoot)
  , loadProductRepoSignals(productOverlay, portalRoot)
  ]);

  // 3. Policy catalogo — merge statica + metadati GitHub/Jira product
  const REPO_SIGNALS_CATALOG_CONFIG = buildRepoSignalsCatalogConfig(
    productConfig
  , { productOverlay }
  );

  const JIRA_PROJECT_KEYS = [productConfig.PRJ_JIRA_PREFIX];

  // 4. Snapshot config — consumer facade e signals.catalog
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
