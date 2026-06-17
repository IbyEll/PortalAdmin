/**
 * Config discovery servizi dev — overlay per progetto product attivo.
 *
 * Descrizione funzionale:
 *   Perché esiste: discovery-services-repo resta generico; dettagli per progetto
 *     (friendbot, alias apps/, path runner) vivono in discovery-config.{Progetto}.mjs.
 *   A cosa serve: getDiscoveryConfig() unisce overlay + PRJ_NAME per tab Servizi,
 *     Utility e match processi nel cruscotto dev.
 *
 * Consumatori: lib/discovery-services-repo.mjs, lib/discovery.services.repo.mjs
 *
 * Export principali:
 *   resolveDiscoveryOverlayName — nome overlay (allineato a config_project)
 *   getDiscoveryConfig          — config merged con productLabel / repoExtrasAll
 *   buildStackStartScripts      — map id → script avvio stack
 *
 * Env: PRJ_NAME → config.discovery.{name}.mjs
 */

import { getProjectConfig, resolveProjectOverlayName } from "./config.project.mjs";

/**
 * Nome file overlay `config.discovery.{name}.mjs`.
 *
 * @returns {string}
 */
export function resolveDiscoveryOverlayName() {
  return resolveProjectOverlayName();
}

// 1. Carica overlay product — stesso PRJ_NAME di config.project / runner.config.stack
const overlayName = resolveDiscoveryOverlayName();

let DISCOVERY_CONFIG_VALUES;

try {
  ({ DISCOVERY_CONFIG_VALUES } = await import(`../../PROJECT_${overlayName}/config.discovery.${overlayName}.mjs`));
} catch (err) {
  const notFound = err instanceof Error && "code" in err && err.code === "ERR_MODULE_NOT_FOUND";
  const hint     = notFound ? ` Crea PROJECT_${overlayName}/config.discovery.${overlayName}.mjs.` : "";

  throw new Error(`config.discovery — overlay "${overlayName}" non caricabile.${hint}`, { cause: err });
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
 * Config discovery merged — cache modulo, label da config_project attivo.
 *
 * @returns {DiscoveryConfig}
 */
export function getDiscoveryConfig() {
  if (cached) {
    return cached;
  }

  const prj  = getProjectConfig();
  const vals = DISCOVERY_CONFIG_VALUES;

  // 2. Merge overlay + metadati product (label cruscotto, union extras)
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
  /** @type {Record<string, { rel: string, processScript: string }>} */
  const out = {};

  for (const id of cfg.stackStartServiceIds) {
    out[id] = cfg.stackStartScript;
  }

  return out;
}
