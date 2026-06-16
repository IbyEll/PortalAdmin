/**
 * Fixture Prisma per suite test JLO — DB dev e reset stato host/player.
 *
 * Descrizione funzionale:
 *   Perché esiste: run-all e testScript condividono setup DATABASE_URL e teardown match
 *     senza duplicare query Prisma tra PortalAdmin e product repo (port da testScript/lib).
 *   A cosa serve: imposta `file:` su JLO_DEV.db nel product checkout e ripulisce match
 *     recruiting/in_game e amicizie host↔player prima di ogni run test.
 *
 * Consumatori: runner/JustLastOne___run-all.mjs
 *
 * Export principali:
 *   setupDefaultDatabaseUrl — env DATABASE_URL + path repo product
 *   clearHostRecruitingMatches — annulla match open/full dell'host seed
 *   resetHostTestState — teardown completo pre-run (match + friendship)
 */

import { join } from "node:path";

import { getProductRepoPath } from "../lib/portal-paths.mjs";

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
