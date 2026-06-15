/**
 * Fixture Prisma per runner/run-all.mjs — port da testScript/lib/match-fixtures.mjs (ADMIN-97).
 */

import { join } from "node:path";

import { getProductRepoPath } from "./portal-paths.mjs";

/**
 * @returns {string}
 */
export function setupDefaultDatabaseUrl() {
  const repoRoot = getProductRepoPath();

  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = `file:${join(
      repoRoot
    , "packages/database/prisma/dev.db"
    ).replace(/\\/g, "/")}`;
  }

  return repoRoot;
}

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} [hostEmail]
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
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {string} [hostEmail]
 * @param {string} [playerEmail]
 */
export async function resetHostTestState(
  prisma
, hostEmail = "host@justlastone.local"
, playerEmail = "player@justlastone.local"
) {
  const [host, player] = await Promise.all([
    prisma.user.findUnique({ where: { email: hostEmail }, select: { id: true } })
  , prisma.user.findUnique({ where: { email: playerEmail }, select: { id: true } })
  ]);

  if (!host) {
    return { cancelled: 0, inGameCleared: 0, friendshipsDeleted: 0 };
  }

  const recruiting = await clearHostRecruitingMatches(prisma, hostEmail);

  const inGame = await prisma.match.updateMany({
    where: {
      hostUserId : host.id
    , status     : "in_game"
    }
  , data: { status: "cancelled" }
  });

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
