/**
 * Kill web / api / auth — porte + command line (Turbo, nest, npm workspace).
 */

import { basename, join } from "node:path";

import {
  findPidsByCommandFragment
, killListenersOnPorts
, killProcessesByCommandFragment
} from "./kill-dev-ports.mjs";

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
 * @param {string} productRoot
 * @param {{ excludePids?: number[], ports?: number[] }} [options]
 */
export function killProductNestStack(productRoot, options = {}) {
  const { excludePids = [], ports = PRODUCT_NEST_PORTS } = options;
  const portResults      = killListenersOnPorts(ports, { excludePids });
  const fragmentResults  = killProcessesByFragments(
    buildProductNestStackKillFragments(productRoot)
  , { excludePids }
  );

  return {
    portResults
  , fragmentResults
  };
}

/**
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
  const portResults          = port
    ? killListenersOnPorts([port], { excludePids })
    : [];
  const fragmentResults      = killProcessesByFragments(
    buildNestServiceKillFragments(productRoot, serviceId)
  , { excludePids }
  );

  return {
    port
  , portResults
  , fragmentResults
  };
}
