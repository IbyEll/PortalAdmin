/**
 * Cruscotto SQLite PortalAdmin — path, URL Prisma e lifecycle client condiviso.
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - cache Jira locale (cruscotto.db) — path e client Prisma non duplicati in ogni script
 *
 *   A cosa serve:
 *   - risolve cruscotto.database/cruscotto.db, prepara datasource URL, singleton Prisma per load/sync
 *
 * Consumatori:
 *   - cruscotto.database/load-backlog.mjs, sync-backlog.mjs, migrate.mjs
 *   - admin.portal.JiraCORE/jiraCORE.backlog.sync.mjs, test.smoke/smoke-cruscotto-db.mjs
 *   - cruscotto.frontend/cruscotto.jira.backlog.mjs — loadJiraBacklogFromDb via load-backlog
 *
 * Export principali:
 *   - resolveCruscottoDbPath, prepareCruscottoDatabaseUrl — path e URL file SQLite
 *   - openCruscottoDb, closeCruscottoDb — client Prisma condiviso
 *   - cruscottoDbFileExists, describeCruscottoDbLayout — diagnostica
 *
 * Variabili d'ambiente:
 *   - CRUSCOTTO_DB_PATH — override path assoluto .db (default cruscotto.database/cruscotto.db)
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import { getPortalDataDir, getPortalRoot } from "../lib/portal.paths.resolver.mjs";

// --- costanti di modulo (policy, set, path fissi) ---
/**
 * Nome file SQLite cruscotto sotto getPortalDataDir().
 */
const DEFAULT_DB_NAME = "cruscotto.db";

/**
 * Risolve path assoluto SQLite cruscotto (env o getPortalDataDir).
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

/**
 * Alias di {@link resolveCruscottoDbPath} — preferire resolve per letture env fresche.
 *
 * @returns {string}
 */
export function getCruscottoDbPath() {
  return resolveCruscottoDbPath();
}

/** @type {PrismaClient | null} */
let activeClient = null;

/**
 * URL datasource Prisma `file:` normalizzato per Windows.
 *
 * @returns {string}
 */
export function resolveCruscottoDatabaseUrl() {
  const normalized = resolveCruscottoDbPath().replace(/\\/g, "/");

  return `file:${normalized}`;
}

/**
 * Crea parent dir se manca e restituisce URL per Prisma CLI.
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
 * Riga diagnostica portal root + path db (smoke, sync-jira-backlog).
 *
 * @returns {string}
 */
export function describeCruscottoDbLayout() {
  return `portal=${getPortalRoot()} db=${resolveCruscottoDbPath()}`;
}

/**
 * Apre (o riusa) PrismaClient sul cruscotto.db.
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
 * Disconnette e azzera il client condiviso.
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
