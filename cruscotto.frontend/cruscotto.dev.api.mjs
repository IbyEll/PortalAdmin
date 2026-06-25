/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** APPLICATION MODULE ** -- commentato il: 2026-06-18 04:09
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 04:09   by: IbyEll
 * modificato il: 2026-06-18 04:09   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                            Health probe servizi dev — tab Requisiti e Servizi del cruscotto.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - La UI Servizi deve mostrare up/down e latenza senza duplicare logica probe nel frontend.
 *   - friendBOT e servizi senza healthUrl usano match su command line invece di HTTP.
 *
 *   A cosa serve:
 *   - Carica product.manifest.json e arricchisce ogni servizio con status, latencyMs, error.
 *   - Espone requirements (prerequisiti stack) per checklist avvio tab Requisiti.
 *
 * Generalizzazione:
 *   Si — servizi e requirements da product.manifest (overlay PRJ_NAME / PRODUCT_REPO_PATH).
 *  
 * Input:
 *   - product.manifest.json — loadProductManifest (lib/product.manifest.mjs)
 *   - svc.healthUrl, svc.processScript — probe HTTP o fragment processo per servizio
 *
 * Route o endpoint (montate da cruscotto.frontend/cruscotto.server.mjs):
 *   - GET /api/dev/requirements — prerequisiti da manifest.requirements
 *   - GET /api/dev/services     — servizi manifest + probe health/processo
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.server.mjs — route /api/dev/*
 *   - cruscotto.frontend/cruscotto.home.js — tab Requisiti e Servizi
 *
 * Dipendenze:
 *   - lib/product.manifest.mjs — definizione servizi e requirements
 *   - lib/discovery.services.repo.mjs — FRIEND_BOT_PROCESS_FRAGMENT
 *   - runner/cruscotto.process.kill.ports.mjs — findPidsByCommandFragment
 *
 * Export principali:
 *   - getDevRequirements — manifest.requirements per checklist
 *   - getDevServicesWithHealth — servizi con status/latency/error
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { loadProductManifest } from "../lib/product.manifest.mjs";
import { findPidsByCommandFragment } from "../cruscotto.frontend/cruscotto.process.kill.ports.mjs";
import { FRIEND_BOT_PROCESS_FRAGMENT } from "../lib/discovery.services.repo.mjs";

// --- policy probe ---
const PROBE_TIMEOUT_MS = 2000;

/**
 * GET healthUrl con timeout breve; status up se 2xx o 4xx (< 500).
 *
 * @param {string} url
 */
async function probeService(url) {
  const started = Date.now();

  try {
    // 1. Fetch healthUrl — 2xx o 4xx (< 500) = up
    const res = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    const up  = res.ok || res.status < 500;

    return {
      status    : up ? "up" : "down"
    , latencyMs : Date.now() - started
    , error     : up ? null : `HTTP ${res.status}`
    };
  } catch (err) {
    // 2. Timeout o rete — down con messaggio
    return {
      status    : "down"
    , latencyMs : null
    , error     : err instanceof Error ? err.message : "unreachable"
    };
  }
}

/**
 * Prerequisiti stack dev (node, env, DB, …) da product.manifest.requirements.
 *
 * @returns {Promise<Record<string, unknown>>}
 */
export async function getDevRequirements() {
  // 1. Manifest product — sezione requirements per tab Requisiti
  const manifest = await loadProductManifest();
  return manifest.requirements;
}

/**
 * Servizi product.manifest con status arricchito: dashboard sempre up, friendBOT via PID,
 * altri via healthUrl HTTP (salvo processScript esplicito).
 *
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function getDevServicesWithHealth() {
  // 1. Carica manifest e lista servizi da arricchire
  const manifest = await loadProductManifest();
  const services = manifest.services ?? [];

  // 2. Probe parallelo per ogni voce (HTTP, processo o skip dashboard)
  const probed = await Promise.allSettled(
    services.map(async (svc) => {
      // 2a. Dashboard — skip self-probe su :3999 (evita deadlock durante la richiesta HTTP)
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

      // 2b. Servizi senza healthUrl — up se esiste un processo con fragment noto
      if (processScript) {
        const running = findPidsByCommandFragment(processScript).length > 0;

        return {
          ...svc
        , status    : running ? "up" : "down"
        , latencyMs : null
        , error     : running ? null : "processo non attivo"
        };
      }

      // 2c. Probe HTTP su healthUrl
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

  // 3. Normalizza rejected — servizio down con messaggio errore
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
