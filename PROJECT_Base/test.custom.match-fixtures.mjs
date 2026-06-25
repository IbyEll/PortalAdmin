/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 20:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 20:42   by: IbyEll
 * modificato il: 2026-06-23 20:42   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Fixture test default — overlay senza database product Prisma (PROJECT_Base).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Product senza SQLite/Prisma (es. PortalAdmin) usano run-all con stub idempotente;
 *     overlay con DB override in PROJECT_{nome}/test.custom.match-fixtures.{nome}.mjs.
 *
 *   A cosa serve:
 *   - Fornisce setup DATABASE_URL e reset stato host non applicabili (no-op sicuri per la suite).
 *
 * Generalizzazione:
 *   No — stub dedicato a product senza Prisma; gli overlay con DB forniscono modulo proprio.
 *
 * Input:
 *   - —
 *
 * Consumatori:
 *   - admin.portal.lib/test.match-fixtures.mjs — import dinamico con fallback su PROJECT_Base
 *   - admin.portal.lib/test.run.all.mjs — setup e reset prima dell'esecuzione test
 *
 * Export principali:
 *   - setupDefaultDatabaseUrl — ritorna root checkout product (nessun DATABASE_URL Prisma)
 *   - resetHostTestState — contatori a zero (nessuna pulizia DB)
 *   - clearHostRecruitingMatches — cancelled 0 (nessun match da cancellare)
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { getProductRepoPath } from "../admin.portal.lib/portal.paths.resolver.mjs";

/**
 * Root checkout product repo — usato da run-all quando non c'è DB Prisma.
 *
 * @returns {string}
 */
export function setupDefaultDatabaseUrl() {
  return getProductRepoPath();
}

/**
 * No-op — product host senza tabelle recruiting da cancellare.
 *
 * @returns {Promise<{ cancelled: number }>}
 */
export async function clearHostRecruitingMatches() {
  return { cancelled: 0 };
}

/**
 * No-op — reset stato host senza side effect su SQLite product.
 *
 * @returns {Promise<{ cancelled: number, inGameCleared: number, friendshipsDeleted: number }>}
 */
export async function resetHostTestState() {
  return {
    cancelled          : 0
  , inGameCleared      : 0
  , friendshipsDeleted : 0
  };
}
