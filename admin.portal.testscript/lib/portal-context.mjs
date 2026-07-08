/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-18 16:10
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 16:10   by: IbyEll
 * modificato il: 2026-06-18 16:10   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                                    Contesto overlay e base URL per testscript portal
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - I testscript devono puntare al cruscotto o alla home portal con overlay e porta corretti;
 *     parsing CLI e risoluzione env non vanno duplicati in ogni test.*.mjs.
 *
 *   A cosa serve:
 *   - parseOverlayCli estrae --overlay, --base, --port e --help da argv condiviso.
 *   - resolveCruscottoContext costruisce base URL cruscotto da CLI, DASHBOARD_URL o porta overlay.
 *   - resolveHomeBase e resolveProductRepoPathForOverlay per area home e path product repo.
 *   - printOverlayCliHelp — testo help uniforme per scope script.
 *
 * Generalizzazione:
 *   Si — overlay parametrizzato (es. JustLastOne, AdminDashBoard); base da env o flag CLI.
 *
 * Input:
 *   - argv — flag --overlay, --project, --base, --port, --json, --help
 *   - DASHBOARD_URL, PRJ_NAME, PRODUCT_REPO_PATH — contesto cruscotto da env
 *   - PORTAL_HOME_URL, PORTAL_HOME_PORT — base server home portal
 *   - cfg ProjectConfig — PRJ_REPO per default product repo path
 *   - scope — stringa path relativo per printOverlayCliHelp
 *
 * Consumatori:
 *   - admin.portal.testscript/health, portal, cruscotto, scripts, meta, dev, repo, jira, cursor,
 *     funzionali, home — test.*.mjs con parseOverlayCli e resolveCruscottoContext
 *   - admin.portal.testscript/run-portal-api.mjs — parseOverlayCli e printOverlayCliHelp
 *   - admin.portal.testscript/funzionali/test.cruscotto.startup.mjs — resolveProductRepoPathForOverlay
 *
 * Export principali:
 *   - parseOverlayCli — parsing argv overlay/base/port/help
 *   - resolveProductRepoPathForOverlay — path assoluto repo product da override o cfg
 *   - resolveCruscottoContext — base URL cruscotto + config overlay
 *   - resolveHomeBase — base URL portal.home.server
 *   - printOverlayCliHelp — stampa uso CLI per scope indicato
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadOverlayConfig
, resolveOverlayDashboardPort
} from "../../admin.portal.lib/portal.instance.mjs";
import { resolveDashboardListenPort } from "../../admin.portal.lib/portal.launch.dashboard.mjs";

import { stripTrailingSlash } from "./http.mjs";

// Root PortalAdmin — default sibling product repo da cfg.PRJ_REPO
const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * @typedef {{
 *   overlay : string | null
 * , port    : number | null
 * , base    : string | null
 * , help    : boolean
 * }} OverlayCliArgs
 */

/**
 * @typedef {{
 *   base    : string
 * , overlay : string | null
 * , config  : import("../../admin.portal.lib/project.config.mjs").ProjectConfig | null
 * }} CruscottoTestContext
 */

/**
 * Parsing argv condiviso per testscript cruscotto e runner suite.
 *
 * @param {string[]} argv
 * @returns {OverlayCliArgs}
 */
export function parseOverlayCli(argv) {
  /** @type {OverlayCliArgs} */
  const out = {
    overlay : null
  , port    : null
  , base    : null
  , help    : false
  };

  // 1. Scansiona argv da indice 2 — ignora node e path script
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    // 2. --help / -h — flag help senza consumare argomento successivo
    if (arg === "--help" || arg === "-h") {
      out.help = true;
      continue;
    }

    if (arg === "--overlay" || arg === "--project") {
      out.overlay = argv[++i]?.trim() ?? null;
      continue;
    }

    if (arg === "--port") {
      const n = Number(argv[++i]);
      out.port = Number.isFinite(n) && n > 0 ? n : null;
      continue;
    }

    if (arg === "--base") {
      out.base = argv[++i]?.trim() ?? null;
      continue;
    }

    // 3. --json — riconosciuto ma gestito da http.mjs isJsonMode
    if (arg === "--json") {
      continue;
    }

    // 4. --skip-home — solo run-portal-api (salta test HOME)
    if (arg === "--skip-home") {
      continue;
    }

    // 5. Argomento sconosciuto — fail-fast con hint --help
    throw new Error(`Argomento sconosciuto: ${arg} (usa --help)`);
  }

  return out;
}

/**
 * Path assoluto repo product — override CLI/env o sibling da cfg.PRJ_REPO.
 *
 * @param {string | null} override
 * @param {import("../../admin.portal.lib/project.config.mjs").ProjectConfig} cfg
 * @returns {string}
 */
export function resolveProductRepoPathForOverlay(cfg, override) {
  // 1. Override esplicito o PRODUCT_REPO_PATH da env
  const raw = override?.trim() || process.env.PRODUCT_REPO_PATH?.trim();

  if (raw) {
    return resolve(raw);
  }

  // 2. Default sibling da cfg.PRJ_REPO rispetto a root PortalAdmin
  return resolve(join(PORTAL_ROOT, "..", cfg.PRJ_REPO));
}

/**
 * Base URL cruscotto — da DASHBOARD_URL, --base, oppure overlay + porta config.
 *
 * @param {OverlayCliArgs} cli
 * @returns {Promise<CruscottoTestContext>}
 */
export async function resolveCruscottoContext(cli) {
  const envBase = process.env.DASHBOARD_URL?.trim();

  // 1. --base esplicito — priorità su env e risoluzione porta
  if (cli.base) {
    return {
      base    : stripTrailingSlash(cli.base)
    , overlay : cli.overlay ?? process.env.PRJ_NAME?.trim() ?? null
    , config  : cli.overlay ? await loadOverlayConfig(cli.overlay) : null
    };
  }

  // 2. DASHBOARD_URL da env — cruscotto già avviato esternamente
  if (envBase) {
    const overlay = cli.overlay ?? process.env.PRJ_NAME?.trim() ?? null;
    const config  = overlay ? await loadOverlayConfig(overlay) : null;

    return {
      base    : stripTrailingSlash(envBase)
    , overlay
    , config
    };
  }

  // 3. Overlay da CLI o PRJ_NAME — risolve porta dashboard da project.config
  const overlay = cli.overlay ?? process.env.PRJ_NAME?.trim() ?? null;

  if (!overlay) {
    throw new Error("Specificare --overlay, --base o DASHBOARD_URL");
  }

  const config = await loadOverlayConfig(overlay);

  if (!config) {
    throw new Error(`Overlay "${overlay}" non trovato`);
  }

  const port = cli.port ?? await resolveOverlayDashboardPort(overlay, config);

  return {
    base    : `http://127.0.0.1:${port}`
  , overlay
  , config
  };
}

/**
 * Env e argv extra per spawn figli testscript (run-all, cruscotto POST /api/run).
 * Propaga DASHBOARD_URL e --overlay da PRJ_NAME quando il child non riceve flag CLI.
 *
 * @returns {{ env: NodeJS.ProcessEnv, args: string[] }}
 */
export function buildTestScriptChildContext() {
  const overlay = process.env.PRJ_NAME?.trim() ?? null;

  /** @type {NodeJS.ProcessEnv} */
  const env = {};

  if (!process.env.DASHBOARD_URL?.trim()) {
    env.DASHBOARD_URL = `http://127.0.0.1:${resolveDashboardListenPort()}`;
  }

  /** @type {string[]} */
  const args = [];

  if (overlay) {
    args.push("--overlay", overlay);
  }

  return { env, args };
}

/**
 * Base URL server HOME (portal.home.server).
 *
 * @returns {string}
 */
export function resolveHomeBase() {
  // 1. PORTAL_HOME_URL da env se impostato
  const env = process.env.PORTAL_HOME_URL?.trim();

  if (env) {
    return stripTrailingSlash(env);
  }

  // 2. Default localhost — porta da PORTAL_HOME_PORT o 3990
  const port = Number(process.env.PORTAL_HOME_PORT ?? 3990);

  return `http://127.0.0.1:${port}`;
}

/**
 * Stampa help CLI uniforme per testscript dello scope indicato.
 *
 * @param {string} scope
 */
export function printOverlayCliHelp(scope) {
  // 1. Testo uso — flag overlay, base, port, json e variabili env note
  console.log([
    `Uso: node admin.portal.testscript/${scope}/test.….mjs`
  , ""
  , "  --overlay, --project   Overlay PROJECT_Nome (es. JustLastOne, AdminDashBoard)"
  , "  --base                 Base URL cruscotto (es. http://127.0.0.1:3999)"
  , "  --port                 Porta se si risolve base da overlay"
  , "  --json                 Report JSON su stdout"
  , ""
  , "  DASHBOARD_URL          Alternativa a --base (cruscotto già avviato)"
  , "  PORTAL_HOME_URL        Per test area home (default :3990)"
  ].join("\n"));
}
