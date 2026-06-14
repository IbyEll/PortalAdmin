/**
 * Admin cruscotto SQLite — path, client lifecycle, migrate helper.
 */

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { PrismaClient } from "@prisma/client";

import { getPortalDataDir } from "../portal-paths.mjs";

/** @type {string} Absolute path to data/cruscotto.db */
export const CRUSCOTTO_DB_PATH = join(getPortalDataDir(), "cruscotto.db");

/** @type {PrismaClient | null} */
let activeClient = null;

/**
 * @returns {string}
 */
export function resolveCruscottoDatabaseUrl() {
  const normalized = CRUSCOTTO_DB_PATH.replace(/\\/g, "/");

  return `file:${normalized}`;
}

/**
 * Ensure data/ exists and return datasource URL for Prisma CLI.
 *
 * @returns {string}
 */
export function prepareCruscottoDatabaseUrl() {
  mkdirSync(dirname(CRUSCOTTO_DB_PATH), { recursive: true });

  return resolveCruscottoDatabaseUrl();
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
