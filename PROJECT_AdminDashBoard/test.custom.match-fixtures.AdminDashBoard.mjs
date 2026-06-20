/**
 * Fixture test AdminDashboard — overlay senza database product Prisma.
 *
 * Descrizione funzionale:
 *   Perché esiste: PortalAdmin come product non ha SQLite/Prisma nel monorepo;
 *     run-all importa comunque test.match-fixtures via overlay dinamico.
 *   A cosa serve: no-op per setup DATABASE_URL e reset stato host (non applicabile).
 *
 * Consumatori: lib/test.match-fixtures.mjs → lib/test.run-all.mjs
 *
 * Export principali:
 *   setupDefaultDatabaseUrl, resetHostTestState, clearHostRecruitingMatches
 */

import { getProductRepoPath } from "../lib/portal-paths.mjs";

/**
 * @returns {string} root checkout PortalAdmin (product repo)
 */
export function setupDefaultDatabaseUrl() {
  return getProductRepoPath();
}

/**
 * @returns {Promise<{ cancelled: number }>}
 */
export async function clearHostRecruitingMatches() {
  return { cancelled: 0 };
}

/**
 * @returns {Promise<{ cancelled: number, inGameCleared: number, friendshipsDeleted: number }>}
 */
export async function resetHostTestState() {
  return {
    cancelled          : 0
  , inGameCleared      : 0
  , friendshipsDeleted : 0
  };
}
