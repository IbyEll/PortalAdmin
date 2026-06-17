/**
 * Admin cruscotto SQLite — path, client lifecycle, migrate helper.
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import { getPortalDataDir, getPortalRoot } from "../portal.paths.resolver.mjs";

/** Default sibling of PortalAdmin root: data/cruscotto.db */
const DEFAULT_DB_NAME = "cruscotto.db";

/**
 * Resolve cruscotto SQLite path (PortalAdmin root / data / override env).
 *
 * @returns {string}
 */
export function resolveCruscottoDbPath() {
  const raw = process.env.CRUSCOTTO_DB_PATH?.trim();

  if (raw) {
    return resolve(raw);
  }

  return join(getPortalDataDir(), DEFAULT_DB_NAME);
}

/** @type {string} Absolute path to cruscotto SQLite — use {@link resolveCruscottoDbPath} for fresh env reads */
export function getCruscottoDbPath() {
  return resolveCruscottoDbPath();
}

/** @type {PrismaClient | null} */
let activeClient = null;

/**
 * @returns {string}
 */
export function resolveCruscottoDatabaseUrl() {
  const normalized = resolveCruscottoDbPath().replace(/\\/g, "/");

  return `file:${normalized}`;
}

/**
 * Ensure data/ (or CRUSCOTTO_DB_PATH parent) exists and return datasource URL for Prisma CLI.
 *
 * @returns {string}
 */
export function prepareCruscottoDatabaseUrl() {
  const path = resolveCruscottoDbPath();

  mkdirSync(dirname(path), { recursive: true });

  return resolveCruscottoDatabaseUrl();
}

/**
 * @returns {boolean}
 */
export function cruscottoDbFileExists() {
  return existsSync(resolveCruscottoDbPath());
}

/**
 * @returns {string}
 */
export function describeCruscottoDbLayout() {
  return `portal=${getPortalRoot()} db=${resolveCruscottoDbPath()}`;
}

/**
 * Open (or reuse) Prisma client for the cruscotto SQLite DB.
 *
 * @returns {Promise<PrismaClient>}
 */
export async function openCruscottoDb() {
  if (activeClient) {
    return activeClient;
  }

  prepareCruscottoDatabaseUrl();

  activeClient = new PrismaClient({
    datasources: {
      db: { url: resolveCruscottoDatabaseUrl() },
    },
  });

  await activeClient.$connect();

  return activeClient;
}

/**
 * Disconnect and release the shared client.
 *
 * @returns {Promise<void>}
 */
export async function closeCruscottoDb() {
  if (!activeClient) {
    return;
  }

  await activeClient.$disconnect();
  activeClient = null;
}

export { PrismaClient };
