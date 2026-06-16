import { loadDevManifest } from "../lib/dev-manifest.mjs";
import { findPidsByCommandFragment } from "../runner/kill-dev-ports.mjs";
import { FRIEND_BOT_PROCESS_FRAGMENT } from "../lib/repo-service-discovery.mjs";

const PROBE_TIMEOUT_MS = 2000;

/**
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
 * @returns {Promise<Record<string, unknown>>}
 */
export async function getDevRequirements() {
  const manifest = await loadDevManifest();
  return manifest.requirements;
}

/**
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function getDevServicesWithHealth() {
  const manifest = await loadDevManifest();
  const services = manifest.services ?? [];

  const probed = await Promise.allSettled(
    services.map(async (svc) => {
      // Evita self-probe su :3999 mentre questa richiesta è in corso (può bloccare il caricamento UI).
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

      if (processScript) {
        const running = findPidsByCommandFragment(processScript).length > 0;

        return {
          ...svc
        , status    : running ? "up" : "down"
        , latencyMs : null
        , error     : running ? null : "processo non attivo"
        };
      }

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
