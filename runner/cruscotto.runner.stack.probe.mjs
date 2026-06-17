/**
 * Prerequisiti stack dev — health check auth, API e web prima dei test.
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - run-all, dashboard e seed devono sapere se auth/api/web sono raggiungibili
 *   - un solo probe HTTP condiviso (server/health.mjs)
 *
 *   A cosa serve:
 *   - probeUrl() — GET con up + latencyMs
 *   - checkServices({ authHealthUrl, apiHealthUrl, webUrl, timeoutMs }) — parametrico
 *   - checkProjectServices() — URL da overlay PRJ_* + override env
 *
 * Consumatori:
 *   - runner/run-all.mjs
 *   - server/health.mjs
 *
 * Export principali:
 *   - probeUrl, isReachable
 *   - checkServices, checkProjectServices
 */

import { resolveDevStackProbeUrls } from "../lib/project.config.mjs";

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
