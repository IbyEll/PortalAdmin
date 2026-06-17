import { checkProjectServices } from "../runner/cruscotto.runner.stack.probe.mjs";

/**
 * Stato health stack dev per API dashboard — riusa probe condiviso in lib/dev.stack.probe.mjs.
 *
 * @returns {Promise<{
 *   checkedAt: string
 *   auth: { up: boolean, url: string, latencyMs: number | null }
 *   api: { up: boolean, url: string, latencyMs: number | null }
 *   web: { up: boolean, url: string, latencyMs: number | null }
 * }>}
 */
export async function getHealthStatus() {
  const result = await checkProjectServices();

  return {
    checkedAt: new Date().toISOString()
  , auth: {
      up        : result.auth
    , url       : result.authHealthUrl
    , latencyMs : result.authLatencyMs
    }
  , api: {
      up        : result.api
    , url       : result.apiHealthUrl
    , latencyMs : result.apiLatencyMs
    }
  , web: {
      up        : result.web
    , url       : result.webUrl
    , latencyMs : result.webLatencyMs
    }
  };
}
