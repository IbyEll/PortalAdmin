/**
 * dev-api — health probe servizi dev per tab Servizi del cruscotto.
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - la UI Servizi deve mostrare up/down e latenza senza duplicare logica probe nel frontend
 *   - friendBOT e servizi senza healthUrl usano match su command line invece di HTTP
 *
 *   A cosa serve:
 *   - carica dev-manifest.json e arricchisce ogni servizio con status, latencyMs, error
 *   - espone requirements (prerequisiti stack) per checklist avvio
 *
 * Route (montate da cruscotto.server.mjs):
 *   GET /api/dev/requirements — prerequisiti da manifest.requirements
 *   GET /api/dev/services     — servizi manifest + probe health/processo
 *
 * Consumatori: server/cruscotto.server.mjs
 *
 * Dipendenze: lib/dev-manifest.mjs, lib/discovery.services.repo.mjs, runner/kill-dev-ports.mjs
 */

import { loadDevManifest } from "../lib/dev-manifest.mjs";
import { findPidsByCommandFragment } from "../runner/kill-dev-ports.mjs";
import { FRIEND_BOT_PROCESS_FRAGMENT } from "../lib/discovery.services.repo.mjs";

const PROBE_TIMEOUT_MS = 2000;

/**
 * GET healthUrl con timeout breve; status up se 2xx o 4xx (< 500).
 *
 * @param {string} url
 */
async function probeService(url) {
  const started = Date.now();

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    const up  = res.ok || res.status < 500;

    return {
      status    : up ? "up" : "down"
    , latencyMs : Date.now() - started
    , error     : up ? null : `HTTP ${res.status}`
    };
  } catch (err) {
    return {
      status    : "down"
    , latencyMs : null
    , error     : err instanceof Error ? err.message : "unreachable"
    };
  }
}

/**
 * Prerequisiti stack dev (node, env, DB, …) da dev-manifest.requirements.
 *
 * @returns {Promise<Record<string, unknown>>}
 */
export async function getDevRequirements() {
  const manifest = await loadDevManifest();
  return manifest.requirements;
}

/**
 * Servizi dev-manifest con status arricchito: dashboard sempre up, friendBOT via PID,
 * altri via healthUrl HTTP (salvo processScript esplicito).
 *
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function getDevServicesWithHealth() {
  const manifest = await loadDevManifest();
  const services = manifest.services ?? [];

  const probed = await Promise.allSettled(
    services.map(async (svc) => {
      // 1. Dashboard — skip self-probe su :3999 (evita deadlock durante la richiesta HTTP)
      if (svc.id === "dashboard") {
        return {
          ...svc
        , status    : "up"
        , latencyMs : 0
        , error     : null
        };
      }

      const processScript = typeof svc.processScript === "string"
        ? svc.processScript
        : svc.id === "friendbot"
          ? FRIEND_BOT_PROCESS_FRAGMENT
          : null;

      // 2. Servizi senza healthUrl — up se esiste un processo con fragment noto
      if (processScript) {
        const running = findPidsByCommandFragment(processScript).length > 0;

        return {
          ...svc
        , status    : running ? "up" : "down"
        , latencyMs : null
        , error     : running ? null : "processo non attivo"
        };
      }

      // 3. Probe HTTP su healthUrl
      const healthUrl = typeof svc.healthUrl === "string" ? svc.healthUrl : "";
      const probe     = healthUrl ? await probeService(healthUrl) : { status: "down", latencyMs: null, error: "no healthUrl" };

      return {
        ...svc
      , status    : probe.status
      , latencyMs : probe.latencyMs
      , error     : probe.error
      };
    })
  );

  // 4. Normalizza rejected — servizio down con messaggio errore
  return probed.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    const svc = services[index];
    return {
      ...svc
    , status    : "down"
    , latencyMs : null
    , error     : result.reason instanceof Error ? result.reason.message : "probe failed"
    };
  });
}
