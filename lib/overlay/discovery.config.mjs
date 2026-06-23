/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-18 05:53
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 05:53   by: IbyEll
 * modificato il: 2026-06-18 05:53   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Config discovery servizi dev — overlay product per tab Servizi, Process e match processi.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - discovery-services-repo resta generico; dettagli per progetto (friendbot, alias apps/,
 *     path runner) vivono in PROJECT_NOME/discovery.config.NOME.mjs.
 *
 *   A cosa serve:
 *   - getDiscoveryConfig unisce overlay e PRJ_NAME per tab Servizi, Process e match processi
 *     nel cruscotto dev.
 *   - buildStackStartScripts espone map id servizio → script avvio stack.
 *
 * Generalizzazione:
 *   Si — overlay dinamico via PRJ_NAME; valori da discovery.config del product attivo.
 *
 * Input:
 *   - PRJ_NAME — nome overlay (resolveDiscoveryOverlayName da env)
 *   - DISCOVERY_CONFIG_VALUES — export da PROJECT_NOME/discovery.config.NOME.mjs
 *   - getProjectConfig — label product e metadati portal per merge cache
 *
 * Consumatori:
 *   - lib/discovery.services.repo.mjs — discoverRepoServices, piano avvio servizi dev
 *   - PROJECT_NOME/discovery.config.NOME.mjs — definizione valori overlay per product
 *
 * Export principali:
 *   - resolveDiscoveryOverlayName — nome overlay allineato a project.config
 *   - getDiscoveryConfig — config merged con productLabel e repoExtrasAll
 *   - buildStackStartScripts — map id → script avvio stack
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { getProjectConfig, resolveProjectOverlayName } from "../project.config.mjs";

/**
 * Nome file overlay discovery.config.NOME.mjs — allineato a project.config.
 *
 * @returns {string}
 */
export function resolveDiscoveryOverlayName() {
  // 1. Delega — stesso PRJ_NAME usato da project.config e runner.config
  return resolveProjectOverlayName();
}

// 1. Risoluzione overlay — PRJ_NAME condiviso con project.config e runner.config
const overlayName = resolveDiscoveryOverlayName();

// 2. Import dinamico — DISCOVERY_CONFIG_VALUES da PROJECT_NOME/discovery.config.NOME.mjs
let DISCOVERY_CONFIG_VALUES;

try {
  ({ DISCOVERY_CONFIG_VALUES } = await import(`../PROJECT_${overlayName}/discovery.config.${overlayName}.mjs`));
} catch (err) {
  const notFound = err instanceof Error && "code" in err && err.code === "ERR_MODULE_NOT_FOUND";
  const hint     = notFound ? ` Crea PROJECT_${overlayName}/discovery.config.${overlayName}.mjs.` : "";

  throw new Error(`discovery.config — overlay "${overlayName}" non caricabile.${hint}`, { cause: err });
}

/**
 * @typedef {{
 *   id            : string
 *   label         : string
 *   script        : string
 *   processScript : string
 *   port?         : number
 * }} ConventionExtra
 */

/**
 * @typedef {{
 *   coreServiceIds          : string[]
 *   appIdAliases            : Record<string, string>
 *   portalServiceIds        : string[]
 *   productExtras           : string[]
 *   portalExtras            : string[]
 *   stackCompleteExtras     : string[]
 *   processFragments        : Record<string, string>
 *   stackStartScript        : { rel: string, processScript: string }
 *   stackStartServiceIds    : string[]
 *   conventionExtras        : ConventionExtra[]
 *   servicePathById         : Record<string, string>
 *   serviceDescriptionById  : Record<string, string>
 *   portalDashboardNpmScript: string
 *   apiPortalRunnerRel      : string
 *   apiPortalServeRel       : string
 *   apiDocumentationRunnerRel?: string
 *   apiDocumentationServeRel ?: string
 * }} DiscoveryConfigValues
 */

/**
 * @typedef {DiscoveryConfigValues & {
 *   productLabel : string
 *   portalLabel  : string
 *   repoExtrasAll: string[]
 * }} DiscoveryConfig
 */

/** @type {DiscoveryConfig | null} */
let cached = null;

/**
 * Config discovery merged — cache modulo, label da project.config attivo.
 *
 * @returns {DiscoveryConfig}
 */
export function getDiscoveryConfig() {
  // 1. Cache singleton — ritorna merge già costruito
  if (cached) {
    return cached;
  }

  const prj  = getProjectConfig();
  const vals = DISCOVERY_CONFIG_VALUES;

  // 2. Merge overlay e metadati product — label cruscotto e union extras
  cached = {
    ...vals
  , productLabel : prj.PRJ_NAME
  , portalLabel  : "PortalAdmin"
  , repoExtrasAll: [...new Set([...vals.productExtras, ...vals.portalExtras])]
  };

  return cached;
}

/**
 * Script avvio stack per id servizio (web, api, auth, …).
 *
 * @param {DiscoveryConfig} cfg
 * @returns {Record<string, { rel: string, processScript: string }>}
 */
export function buildStackStartScripts(cfg) {
  // 1. Map stackStartServiceIds — stesso script rel/processScript per ogni id stack
  /** @type {Record<string, { rel: string, processScript: string }>} */
  const out = {};

  for (const id of cfg.stackStartServiceIds) {
    out[id] = cfg.stackStartScript;
  }

  return out;
}
