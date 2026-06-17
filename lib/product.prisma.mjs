/**
 * PrismaClient dal product repo configurato — non da PortalAdmin/node_modules.
 *
 * Descrizione funzionale:
 *   Perché esiste: PortalAdmin ha uno stub `@prisma/client` senza schema generato;
 *     runner e fixture devono usare il client compilato nel checkout product attivo.
 *   A cosa serve: re-export `PrismaClient` via `createRequire` sul `package.json` del repo
 *     risolto da `getProductRepoPath()` (`PRODUCT_REPO_PATH` o default `project.config`).
 *
 * Consumatori: runner/JustLastOne___run-all.mjs, match-fixtures (fixture test)
 *
 * Export principali:
 *   PrismaClient — ORM tipato sullo schema del product repo attivo
 *   getProductPrismaRequire — require CJS scoped al product (estensioni avanzate)
 */

import { createRequire } from "node:module";
import { join } from "node:path";

import { getProductRepoPath } from "./portal-paths.mjs";

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