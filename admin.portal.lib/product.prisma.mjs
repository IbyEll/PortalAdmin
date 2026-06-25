/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 20:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 20:42   by: IbyEll
 * modificato il: 2026-06-23 20:42   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         PrismaClient dal product repo configurato — non da PortalAdmin/node_modules.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - PortalAdmin ha stub @prisma/client senza schema; runner e fixture devono usare client
 *     compilato nel checkout product attivo.
 *
 *   A cosa serve:
 *   - Re-export PrismaClient via createRequire sul package.json del product repo risolto.
 *
 * Generalizzazione:
 *   Si — product repo da PRODUCT_REPO_PATH o default PRJ_REPO in project.config.
 *
 * Input:
 *   - PRODUCT_REPO_PATH — root checkout product con @prisma/client generato
 *
 * Consumatori:
 *   - PROJECT_JustLastOne/test.custom.match-fixtures.JustLastOne.mjs — reset DB test
 *   - runner e fixture che operano sullo schema product Prisma
 *
 * Export principali:
 *   - PrismaClient — ORM tipato sullo schema del product repo attivo
 *   - getProductPrismaRequire — require CJS scoped al product root
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { createRequire } from "node:module";
import { join } from "node:path";

import { getProductRepoPath } from "./portal.paths.resolver.mjs";

/**
 * `createRequire` ancorato al root del product repo (`PRODUCT_REPO_PATH` / PRJ_REPO).
 *
 * @returns {NodeRequire}
 */
export function getProductPrismaRequire() {
  return createRequire(join(getProductRepoPath(), "package.json"));
}

const requireProduct = getProductPrismaRequire();

export const { PrismaClient } = requireProduct("@prisma/client");