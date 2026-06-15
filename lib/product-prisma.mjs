/**
 * PrismaClient dal product repo (JustLastOne) — non da PortalAdmin/node_modules
 * (stub @prisma/client senza schema generato).
 */

import { createRequire } from "node:module";
import { join } from "node:path";

import { getProductRepoPath } from "./portal-paths.mjs";

const requireProduct = createRequire(join(getProductRepoPath(), "package.json"));

export const { PrismaClient } = requireProduct("@prisma/client");
