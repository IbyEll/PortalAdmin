/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-18 05:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 05:42   by: IbyEll
 * modificato il: 2026-06-18 05:42   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Probe HTTP stack dev — health auth, API e web prima di test, seed e dashboard.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - run-all, dashboard e seed devono sapere se lo stack dev è raggiungibile prima di procedere.
 *   - Un solo probe HTTP condiviso evita duplicazione tra cruscotto.health e admin.portal.lib/test.run-all.
 *
 *   A cosa serve:
 *   - probeUrl — GET con esito up e latencyMs.
 *   - checkServices / checkProjectServices — probe fisso auth/api/web (prerequisiti run-all).
 *   - checkDevStackServices — probe dinamico su ogni servizio da runner.config devStack.
 *
 * Generalizzazione:
 *   Si — URL da project.config e lista servizi da resolveDevServices (overlay PRJ_NAME).
 *
 * Input:
 *   - PRJ_AUTH_HEALTH_URL, PRJ_API_HEALTH_URL, PRJ_WEB_OPEN_URL — endpoint da project.config
 *   - timeoutMs — opzione consumer per probe lenti o CI
 *   - authHealthUrl, apiHealthUrl, webUrl — override opzionali in checkServices
 *
 * Consumatori:
 *   - admin.portal.lib/test.run-all.mjs — checkProjectServices prima dei test funzionali
 *   - server/cruscotto.health.mjs — checkDevStackServices per GET /api/health
 *
 * Export principali:
 *   - probeUrl, isReachable — probe singolo URL
 *   - checkServices, checkProjectServices — health auth/api/web
 *   - checkDevStackServices — health lista servizi devStack
 *   - DEFAULT_PROBE_TIMEOUT_MS — timeout default probe
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { resolveDevStackProbeUrls } from "../admin.portal.lib/project.config.mjs";
import { resolveDevServices } from "./cruscotto.runner.stack.config.overlay.mjs";

/** Timeout default probe HTTP (ms). */
export const DEFAULT_PROBE_TIMEOUT_MS = 5000;

/**
 * Probe HTTP — up se 2xx o 4xx (< 500).
 *
 * @param {string} url
 * @param {number} [timeoutMs]
 * @returns {Promise<{ up: boolean, latencyMs: number | null }>}
 */
export async function probeUrl(url, timeoutMs = DEFAULT_PROBE_TIMEOUT_MS) {
  // 1. GET con timeout — up se 2xx o 4xx (< 500)
  const started = Date.now();

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    const up  = res.ok || res.status < 500;

    return {
      up
    , latencyMs: Date.now() - started
    };
  } catch {
    return {
      up        : false
    , latencyMs : null
    };
  }
}

/**
 * Verifica raggiungibilità URL — wrapper booleano su probeUrl.
 *
 * @param {string} url
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
export async function isReachable(url, timeoutMs = DEFAULT_PROBE_TIMEOUT_MS) {
  return (await probeUrl(url, timeoutMs)).up;
}

/**
 * @typedef {{
 *   authHealthUrl? : string
 *   apiHealthUrl?  : string
 *   webUrl?        : string
 *   timeoutMs?     : number
 * }} CheckServicesOptions
 */

/**
 * @typedef {{
 *   auth            : boolean
 *   api             : boolean
 *   web             : boolean
 *   authHealthUrl   : string
 *   apiHealthUrl    : string
 *   webUrl          : string
 *   authUrl         : string
 *   apiUrl          : string
 *   authLatencyMs   : number | null
 *   apiLatencyMs    : number | null
 *   webLatencyMs    : number | null
 * }} CheckServicesResult
 */

/**
 * Health stack dev — probe parallelo su tre endpoint.
 * URL mancanti: resolveDevStackProbeUrls() (overlay + env).
 *
 * @param {CheckServicesOptions} [options]
 * @returns {Promise<CheckServicesResult>}
 */
export async function checkServices(options = {}) {
  const defaults      = resolveDevStackProbeUrls();
  const authHealthUrl = options.authHealthUrl ?? defaults.authHealthUrl;
  const apiHealthUrl  = options.apiHealthUrl ?? defaults.apiHealthUrl;
  const webUrl        = options.webUrl ?? defaults.webUrl;
  const timeoutMs     = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;

  // 1. Probe parallelo — run-all blocca se auth o api down; web opzionale (skip suite web)
  const [authProbe, apiProbe, webProbe] = await Promise.all([
    probeUrl(authHealthUrl, timeoutMs)
  , probeUrl(apiHealthUrl, timeoutMs)
  , probeUrl(webUrl, timeoutMs)
  ]);

  return {
    auth          : authProbe.up
  , api           : apiProbe.up
  , web           : webProbe.up
  , authHealthUrl
  , apiHealthUrl
  , webUrl
  , authUrl       : authHealthUrl
  , apiUrl        : apiHealthUrl
  , authLatencyMs : authProbe.latencyMs
  , apiLatencyMs  : apiProbe.latencyMs
  , webLatencyMs  : webProbe.latencyMs
  };
}

/**
 * Health stack del progetto attivo (PRJ_NAME) — alias esplicito per runner e dashboard.
 *
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<CheckServicesResult>}
 */
export async function checkProjectServices(options = {}) {
  return checkServices(options);
}

/**
 * @typedef {{
 *   id        : string
 *   label     : string
 *   kind      : string
 *   workspace : string
 *   port      : number
 *   up        : boolean
 *   url       : string
 *   latencyMs : number | null
 * }} DevStackHealthEntry
 */

/**
 * Health stack dev da runner.config — probe parallelo su ogni servizio con healthUrl/openUrl.
 * Generalizza auth/api/web: lista servizi definita in devStack overlay (PRJ_NAME).
 *
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<DevStackHealthEntry[]>}
 */
export async function checkDevStackServices(options = {}) {
  // 1. Probe parallelo — ogni servizio devStack con healthUrl o openUrl
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const services  = resolveDevServices();

  return Promise.all(
    services.map(async (svc) => {
      const url = typeof svc.healthUrl === "string" && svc.healthUrl
        ? svc.healthUrl
        : typeof svc.openUrl === "string"
          ? svc.openUrl
          : "";

      if (!url) {
        return {
          id        : svc.id
        , label     : svc.label
        , kind      : svc.kind
        , workspace : svc.workspace
        , port      : svc.port
        , up        : false
        , url       : ""
        , latencyMs : null
        };
      }

      const probe = await probeUrl(url, timeoutMs);

      return {
        id        : svc.id
      , label     : svc.label
      , kind      : svc.kind
      , workspace : svc.workspace
      , port      : svc.port
      , up        : probe.up
      , url
      , latencyMs : probe.latencyMs
      };
    })
  );
}
