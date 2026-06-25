/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:30
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:30   by: IbyEll
 * modificato il: 2026-06-23 21:30   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Config Cursor Agent SDK — API key, runtime local/cloud e repository GitHub.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Tab Cursor agent cruscotto deve sapere se SDK è configurato e quale repo usare.
 *
 *   A cosa serve:
 *   - Legge CURSOR_API_KEY, runtime e path product per spawn agent Cursor.
 *
 * Generalizzazione:
 *   Si — env CURSOR_API_KEY; product repo da PRODUCT_REPO_PATH; runtime local o cloud.
 *
 * Input:
 *   - CURSOR_API_KEY — token API Cursor (env)
 *   - CURSOR_AGENT_RUNTIME — local o cloud (env opzionale)
 *   - PRODUCT_REPO_PATH — repository GitHub workflow agent
 *
 * Consumatori:
 *   - admin.portal/portal.cursor.agent.manager.mjs — validazione prima spawn
 *   - admin.portal/portal.cursor.agent.workflow.mjs — contesto run agent
 *
 * Export principali:
 *   - getCursorApiKey, isCursorAgentConfigured — stato configurazione SDK
 *   - getCursorAgentPublicConfig, getCursorAgentWorkerPath — payload UI e path worker
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getPortalRoot, getProductRepoPath } from "../admin.portal.lib/portal.paths.resolver.mjs";

const ADMIN_PORTAL_DIR = dirname(fileURLToPath(import.meta.url));

/** @typedef {"local" | "cloud"} CursorAgentRuntime */

/**
 * @returns {string | null}
 */
export function getCursorApiKey() {
  const key = process.env.CURSOR_API_KEY?.trim();

  return key || null;
}

/**
 * @returns {boolean}
 */
export function isCursorAgentConfigured() {
  return Boolean(getCursorApiKey());
}

/**
 * Modello default agent (override con CURSOR_AGENT_MODEL).
 *
 * @returns {{ id: string }}
 */
export function getCursorAgentModel() {
  const id = process.env.CURSOR_AGENT_MODEL?.trim() || "composer-2.5";

  return { id };
}

/**
 * Runtime default da CURSOR_AGENT_DEFAULT_RUNTIME (local | cloud).
 *
 * @returns {CursorAgentRuntime}
 */
export function getCursorDefaultRuntime() {
  const raw = process.env.CURSOR_AGENT_DEFAULT_RUNTIME?.trim().toLowerCase();

  return raw === "cloud" ? "cloud" : "local";
}

/**
 * cwd per agent local — product repo attivo.
 *
 * @returns {string}
 */
export function getCursorLocalCwd() {
  const override = process.env.CURSOR_AGENT_LOCAL_CWD?.trim();

  if (override && existsSync(override)) {
    return override;
  }

  return getProductRepoPath();
}

/**
 * Repository GitHub per cloud agent — CURSOR_CLOUD_REPOS (virgola) o default PortalAdmin.
 *
 * @returns {Array<{ url: string, startingRef?: string }>}
 */
export function getCursorCloudRepos() {
  const raw = process.env.CURSOR_CLOUD_REPOS?.trim();

  if (raw) {
    return raw.split(",").map((part) => part.trim()).filter(Boolean).map((url) => ({ url }));
  }

  const defaults = [
    "https://github.com/IbyEll/PortalAdmin"
  , "https://github.com/IbyEll/JustLastOne"
  ];

  return defaults.map((url) => ({ url }));
}

/**
 * Payload pubblico per GET /api/cursor/config (senza API key).
 *
 * @returns {{
 *   configured: boolean
 *   defaultRuntime: CursorAgentRuntime
 *   model: { id: string }
 *   localCwd: string
 *   cloudRepos: Array<{ url: string }>
 *   autoCreatePR: boolean
 * }}
 */
export function getCursorAgentPublicConfig() {
  return {
    configured     : isCursorAgentConfigured()
  , defaultRuntime : getCursorDefaultRuntime()
  , model          : getCursorAgentModel()
  , localCwd       : getCursorLocalCwd()
  , cloudRepos     : getCursorCloudRepos().map((r) => ({ url: r.url }))
  , autoCreatePR   : process.env.CURSOR_CLOUD_AUTO_PR !== "0"
  };
}

/**
 * Path file stato runtime agent (persistenza tra restart server).
 *
 * @returns {string}
 */
export function getCursorAgentStatePath() {
  return join(ADMIN_PORTAL_DIR, "cursor.agent.runtime.state.json");
}

/**
 * Path worker script Cursor agent.
 *
 * @returns {string}
 */
export function getCursorAgentWorkerPath() {
  return join(ADMIN_PORTAL_DIR, "portal.cursor.agent.worker.mjs");
}
