/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-18 11:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 11:05   by: IbyEll
 * modificato il: 2026-06-18 11:05   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *   Stop stack product — kill porte nest, fragment command line e CLI npm run stop:all
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Stop stack product dal cruscotto deve liberare porte 3000/4000/4001 e processi nest/turbo/npm.
 *   - Fragment command line variano per OS (slash) e avvio (StartUnit, workspace, path assoluto).
 *
 *   A cosa serve:
 *   - Libreria kill per web/api/auth/friendBOT usata da cruscotto.process.services.manager.
 *   - Entry CLI: node cruscotto.frontend/cruscotto.process.stop.all.services.mjs [--include-dashboard]
 *
 * Generalizzazione:
 *   Si — porte e fragment da product manifest; manager orchestration product-agnostic.
 *
 * Input:
 *   - productRoot — root PRODUCT_REPO_PATH (path apps/, testScript/)
 *   - options.excludePids — PID da non terminare (es. dashboard corrente)
 *   - options.ports — override porte nest (default 3000, 4000, 4001)
 *   - serviceId — web | api | auth per kill singolo servizio
 *   - CLI --include-dashboard — termina anche il cruscotto su DASHBOARD_PORT
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.process.services.manager.mjs — stop stack / stop-one UI Process
 *   - package.json script stop:all — entry CLI
 *
 * Export principali:
 *   - PRODUCT_NEST_PORTS, FRIEND_BOT_SCRIPT_REL — costanti porte e path friendBOT
 *   - buildProductNestStackKillFragments, killProductNestStack — kill stack completo
 *   - buildNestServiceKillFragments, killProductNestService — kill singolo servizio nest
 *   - buildFriendBotKillFragments, killFriendBotProcesses, findFriendBotPids — friendBOT
 *   - killProcessesByFragments — helper batch fragment senza porte
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  findPidsByCommandFragment
, killListenersOnPorts
, killProcessesByCommandFragment
} from "./cruscotto.process.kill.ports.mjs";

// --- costanti product (porte nest, path app, workspace npm) ---
export const PRODUCT_NEST_PORTS = [3000, 4000, 4001];

export const FRIEND_BOT_SCRIPT_REL = "testScript/funzionali/friend-bot.mjs";

const NEST_SERVICE_REL = {
  auth : "apps/authentication"
, api  : "apps/api"
, web  : "apps/web"
};

const NEST_WORKSPACE_FRAGMENT = {
  auth : "@justlastone/auth"
, api  : "@justlastone/api"
, web  : "@justlastone/web"
};

const NEST_START_SCRIPT_FRAGMENT = {
  auth : "start_API_Auth"
, api  : "start_API_Project"
, web  : "start_WEB"
};

/**
 * Varianti path per match command line Windows/Unix e relativo basename product.
 *
 * @param {string} productRoot
 * @param {string} relPath
 * @returns {string[]}
 */
function pathFragmentVariants(productRoot, relPath) {
  const abs = join(productRoot, relPath);

  return [
    abs
  , abs.replace(/\\/g, "/")
  , abs.replace(/\//g, "\\")
  , `${basename(productRoot)}/${relPath}`
  , `${basename(productRoot)}\\${relPath}`
  , relPath.replace(/\//g, "\\")
  , relPath
  ];
}

/**
 * Fragment per kill stack nest completo (auth, api, web, turbo, runner start).
 *
 * @param {string} productRoot
 * @returns {string[]}
 */
export function buildProductNestStackKillFragments(productRoot) {
  const fragments = [
    ...pathFragmentVariants(productRoot, "apps/authentication")
  , ...pathFragmentVariants(productRoot, "apps/api")
  , ...pathFragmentVariants(productRoot, "apps/web")
  , ...pathFragmentVariants(productRoot, "node_modules/.bin/turbo")
  , "@justlastone/auth"
  , "@justlastone/api"
  , "@justlastone/web"
  , "nest start"
  , "turbo run dev"
  , "cruscotto.process.start.all.services"
  , "cruscotto.process.start.service.mjs auth"
  , "cruscotto.process.start.service.mjs api"
  , "cruscotto.process.start.service.mjs web"
  , "cruscotto.process.start.all.services"
  ];

  return [...new Set(fragments)];
}

/**
 * Fragment per kill processo friendBOT (script funzionali).
 *
 * @param {string} productRoot
 * @returns {string[]}
 */
export function buildFriendBotKillFragments(productRoot) {
  return [...new Set([
    ...pathFragmentVariants(productRoot, FRIEND_BOT_SCRIPT_REL)
  , "friend-bot.mjs"
  , "friendBOT"
  ])];
}

/**
 * Termina processi friendBOT per fragment noti.
 *
 * @param {string} productRoot
 * @param {{ excludePids?: number[] }} [options]
 */
export function killFriendBotProcesses(productRoot, options = {}) {
  return killProcessesByFragments(
    buildFriendBotKillFragments(productRoot)
  , options
  );
}

/**
 * Elenco PID friendBOT senza kill (per status UI).
 *
 * @param {string} productRoot
 * @param {{ excludePids?: number[] }} [options]
 * @returns {number[]}
 */
export function findFriendBotPids(productRoot, options = {}) {
  const exclude = new Set(options.excludePids ?? []);
  /** @type {Set<number>} */
  const pids    = new Set();

  for (const fragment of buildFriendBotKillFragments(productRoot)) {
    for (const pid of findPidsByCommandFragment(fragment)) {
      if (!exclude.has(pid)) {
        pids.add(pid);
      }
    }
  }

  return [...pids];
}

/**
 * Fragment per un singolo servizio nest (web, api o auth).
 *
 * @param {string} productRoot
 * @param {"web" | "api" | "auth"} serviceId
 * @returns {string[]}
 */
export function buildNestServiceKillFragments(productRoot, serviceId) {
  const rel = NEST_SERVICE_REL[serviceId];

  if (!rel) {
    return [];
  }

  const fragments = [
    ...pathFragmentVariants(productRoot, rel)
  , NEST_WORKSPACE_FRAGMENT[serviceId]
  , NEST_START_SCRIPT_FRAGMENT[serviceId]
  , "nest start"
  , "turbo run dev"
  ].filter((value) => typeof value === "string" && value.length > 0);

  return [...new Set(fragments)];
}

/**
 * Kill batch per ogni fragment — deduplica PID tentati.
 *
 * @param {string[]} fragments
 * @param {{ excludePids?: number[] }} [options]
 */
export function killProcessesByFragments(fragments, options = {}) {
  /** @type {ReturnType<typeof killProcessesByCommandFragment>[]} */
  const results = [];
  /** @type {Set<number>} */
  const seen = new Set();

  for (const fragment of fragments) {
    const outcome = killProcessesByCommandFragment(fragment, options);

    results.push(outcome);

    for (const pid of outcome.attempted) {
      seen.add(pid);
    }
  }

  return {
    results
  , attemptedPids : [...seen]
  };
}

/**
 * Kill porte nest + processi stack product (default 3000, 4000, 4001).
 *
 * @param {string} productRoot
 * @param {{ excludePids?: number[], ports?: number[] }} [options]
 */
export function killProductNestStack(productRoot, options = {}) {
  const { excludePids = [], ports = PRODUCT_NEST_PORTS } = options;

  const portResults     = killListenersOnPorts(ports, { excludePids });
  const fragmentResults = killProcessesByFragments(
    buildProductNestStackKillFragments(productRoot)
  , { excludePids }
  );

  return {
    portResults
  , fragmentResults
  };
}

/**
 * Kill porta e processi di un singolo servizio nest (web, api o auth).
 *
 * @param {"web" | "api" | "auth"} serviceId
 * @param {string} productRoot
 * @param {{ excludePids?: number[] }} [options]
 */
export function killProductNestService(serviceId, productRoot, options = {}) {
  const { excludePids = [] } = options;
  const portByService        = {
    web  : 3000
  , api  : 4000
  , auth : 4001
  };
  const port                 = portByService[serviceId];

  const portResults     = port
    ? killListenersOnPorts([port], { excludePids })
    : [];
  const fragmentResults = killProcessesByFragments(
    buildNestServiceKillFragments(productRoot, serviceId)
  , { excludePids }
  );

  return {
    port
  , portResults
  , fragmentResults
  };
}

// --- CLI npm run stop:all — import dinamico manager per evitare ciclo statico ---
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await import("../admin.portal.lib/portal.load.env.mjs");

  const includeDashboard = process.argv.includes("--include-dashboard");
  const { stopRepoServices } = await import("./cruscotto.process.services.manager.mjs");
  const result               = await stopRepoServices({ includeDashboard });

  for (const line of result.lines ?? []) {
    const prefix = line.stream === "stderr" ? "ERR " : line.stream === "system" ? ">> " : "   ";
    console.log(`${prefix}${line.text}`);
  }

  console.log("");
  console.log(result.summary);
}
