/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** APPLICATION MODULE ** -- commentato il: 2026-06-18 04:11
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 04:11   by: IbyEll
 * modificato il: 2026-06-17   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                          Stato health stack dev — servizi da runner.config overlay progetto.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - La dashboard e GET /api/health devono esporre up/latency senza duplicare probe HTTP nel server.
 *   - Un solo adapter API sopra checkDevStackServices (probe condiviso con runner overlay).
 *
 *   A cosa serve:
 *   - Probe parallelo su ogni voce devStack (auth, api, web o altri id definiti in runner.config.{PRJ_NAME}).
 *   - Include metadati progetto (PRJ_NAME, slug, prefisso Jira) e lista services normalizzata.
 *   - Mantiene chiavi legacy auth/api/web quando presenti nello stack (compatibilità client).
 *
 * Generalizzazione:
 *   Si — servizi e URL da overlay PRJ_NAME (resolveDevServices) + override env su singoli endpoint.
 *
 * Input:
 *   - runner.config.{PRJ_NAME}.mjs — devStack (id, healthFrom, openFrom)
 *   - project.config.{PRJ_NAME}.mjs — PRJ_* health/open URL
 *   - PRJ_NAME, PRODUCT_REPO_PATH — contesto product attivo
 *
 * Route o endpoint (montate da cruscotto.frontend/cruscotto.server.mjs):
 *   - GET /api/health — snapshot project + services (+ auth/api/web legacy)
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.server.mjs — handler GET /api/health
 *   - smoke testScript — verifica HTTP 200
 *
 * Dipendenze:
 *   - runner/cruscotto.runner.stack.probe.mjs — checkDevStackServices
 *   - admin.portal.lib/project.config.mjs — getProjectConfig
 *
 * Export principali:
 *   - getHealthStatus — payload JSON per /api/health
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { getProjectConfig } from "../admin.portal.lib/project.config.mjs";
import { checkDevStackServices } from "../cruscotto.frontend/cruscotto.runner.stack.probe.mjs";

/**
 * @typedef {{ up: boolean, url: string, latencyMs: number | null }} LegacyServiceHealth
 */

/**
 * @param {import("../cruscotto.frontend/cruscotto.runner.stack.probe.mjs").DevStackHealthEntry[]} entries
 * @param {string} id
 * @returns {LegacyServiceHealth}
 */
function legacyServiceHealth(entries, id) {
  const entry = entries.find((svc) => svc.id === id);

  if (!entry) {
    return {
      up        : false
    , url       : ""
    , latencyMs : null
    };
  }

  return {
    up        : entry.up
  , url       : entry.url
  , latencyMs : entry.latencyMs
  };
}

/**
 * Stato health stack dev per API dashboard — servizi da runner overlay progetto attivo.
 *
 * @returns {Promise<{
 *   checkedAt: string
 *   project: { name: string, slug: string, jiraPrefix: string }
 *   services: Array<{
 *     id: string
 *     label: string
 *     kind: string
 *     workspace: string
 *     port: number
 *     up: boolean
 *     url: string
 *     latencyMs: number | null
 *   }>
 *   auth: LegacyServiceHealth
 *   api: LegacyServiceHealth
 *   web: LegacyServiceHealth
 * }>}
 */
export async function getHealthStatus() {
  const prj      = getProjectConfig();
  const entries  = await checkDevStackServices();
  const checkedAt = new Date().toISOString();

  return {
    checkedAt
  , project: {
      name       : prj.PRJ_NAME
    , slug       : prj.PRJ_SLUG
    , jiraPrefix : prj.PRJ_JIRA_PREFIX
    }
  , services: entries.map((entry) => ({
      id        : entry.id
    , label     : entry.label
    , kind      : entry.kind
    , workspace : entry.workspace
    , port      : entry.port
    , up        : entry.up
    , url       : entry.url
    , latencyMs : entry.latencyMs
    }))
  , auth: legacyServiceHealth(entries, "auth")
  , api : legacyServiceHealth(entries, "api")
  , web : legacyServiceHealth(entries, "web")
  };
}
