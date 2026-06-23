/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:05   by: IbyEll
 * modificato il: 2026-06-23 21:05   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Fixture Prisma test JLO — DATABASE_URL dev e reset stato host/player.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Run-all e testScript condividono setup DATABASE_URL e teardown match senza duplicare
 *     query Prisma tra PortalAdmin host e product repo.
 *
 *   A cosa serve:
 *   - Imposta file JLO_DEV.db nel product checkout e ripulisce match e amicizie seed pre-run.
 *
 * Generalizzazione:
 *   No — path SQLite e email host seed fissi per monorepo JustLastOne.
 *
 * Input:
 *   - PRODUCT_REPO_PATH — root product per path packages/database/prisma/JLO_DEV.db
 *   - DATABASE_URL — env opzionale; default file: impostato da setupDefaultDatabaseUrl
 *
 * Consumatori:
 *   - lib/test.match-fixtures.mjs — import dinamico overlay JustLastOne
 *   - lib/test.run.all.mjs — resetHostTestState prima della suite
 *
 * Export principali:
 *   - setupDefaultDatabaseUrl — env DATABASE_URL e root product
 *   - clearHostRecruitingMatches — annulla match recruiting host seed
 *   - resetHostTestState — teardown completo pre-run
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { join } from "node:path";

import { getProductRepoPath } from "../lib/portal.paths.resolver.mjs";

/**
 * Imposta `process.env.DATABASE_URL` su SQLite dev se assente.
 *
 * @returns {string} root checkout product (JLO)
 */
export function setupDefaultDatabaseUrl() {
  const repoRoot = getProductRepoPath();

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = `file:${join(
      repoRoot
    , "packages/database/prisma/JLO_DEV.db"
    ).replace(/\\/g, "/")}`;
  }

  return repoRoot;
}

/**
 * Annulla match recruiting (open/full) dell'host seed — idempotente se host assente.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} [hostEmail]
 * @returns {Promise<{ cancelled: number }>}
 */
export async function clearHostRecruitingMatches(
  prisma
, hostEmail = "host@justlastone.local"
) {
  const host = await prisma.user.findUnique({
    where  : { email: hostEmail }
  , select : { id: true }
  });

  if (!host) {
    return { cancelled: 0 };
  }

  const result = await prisma.match.updateMany({
    where: {
      hostUserId : host.id
    , status     : { in: ["open", "full"] }
    }
  , data: { status: "cancelled" }
  });

  return { cancelled: result.count };
}

/**
 * Reset stato test host: match recruiting + in_game + amicizia con player seed.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} [hostEmail]
 * @param {string} [playerEmail]
 */
export async function resetHostTestState(
  prisma
, hostEmail = "host@justlastone.local"
, playerEmail = "player@justlastone.local"
) {
  // 1. Risolvi utenti seed — early exit se host mancante
  const [host, player] = await Promise.all([
    prisma.user.findUnique({ where: { email: hostEmail }, select: { id: true } })
  , prisma.user.findUnique({ where: { email: playerEmail }, select: { id: true } })
  ]);

  if (!host) {
    return { cancelled: 0, inGameCleared: 0, friendshipsDeleted: 0 };
  }

  const recruiting = await clearHostRecruitingMatches(prisma, hostEmail);

  // 2. Match in corso → cancelled
  const inGame = await prisma.match.updateMany({
    where: {
      hostUserId : host.id
    , status     : "in_game"
    }
  , data: { status: "cancelled" }
  });

  // 3. Amicizia bidirezionale host↔player (solo se player esiste)
  let friendshipsDeleted = 0;
  if (player) {
    const friendships = await prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: host.id, addresseeId: player.id }
        , { requesterId: player.id, addresseeId: host.id }
        ]
      }
    });
    friendshipsDeleted = friendships.count;
  }

  return {
    cancelled          : recruiting.cancelled
  , inGameCleared      : inGame.count
  , friendshipsDeleted
  };
}
