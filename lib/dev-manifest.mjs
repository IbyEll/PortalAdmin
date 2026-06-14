import { join, relative } from "node:path";

import {
  getPortalRoot
, getProductRepoPath
} from "./portal-paths.mjs";

/**
 * Dev manifest con path relativi a product repo e PortalAdmin.
 *
 * @returns {Record<string, unknown>}
 */
export function buildDevManifest() {
  const portalRoot  = getPortalRoot();
  const productRoot = getProductRepoPath();
  const productRel  = (sub) => relative(productRoot, join(productRoot, sub)).replace(/\\/g, "/");
  const portalRel   = (sub) => relative(portalRoot, join(portalRoot, sub)).replace(/\\/g, "/");

  return {
    portalRoot
  , productRoot
  , requirements: {
      nodeMin: "20"
    , stack: [
        { app: "web", label: "Web", tech: "Next.js 15" }
      , { app: "api", label: "API", tech: "NestJS" }
      , { app: "auth", label: "Auth", tech: "NestJS" }
      , { app: "database", label: "Database", tech: "Prisma + SQLite" }
      , { app: "monorepo", label: "Monorepo", tech: "Turbo" }
      ]
    , prerequisites: [
        "Node.js >= 20"
      , "npm"
      , "SQLite (via Prisma)"
      , "Checkout sibling JustLastOne o PRODUCT_REPO_PATH"
      ]
    , envFiles: [
        { path: portalRel(".env"), label: "PortalAdmin / Cruscotto", repo: "portal" }
      , { path: productRel("packages/database/.env"), label: "Database", repo: "product" }
      , { path: productRel("apps/api/.env"), label: "API", repo: "product" }
      , { path: productRel("apps/authentication/.env"), label: "Auth", repo: "product" }
      , { path: productRel("apps/web/.env"), label: "Web", repo: "product" }
      ]
    , commands: [
        { id: "install", label: "Installa dipendenze (product)", cmd: "npm install", cwd: "product" }
      , { id: "db-setup", label: "Setup database", cmd: "npm run db:setup", cwd: "product" }
      , { id: "dev", label: "Avvia stack dev", cmd: "npm run dev", cwd: "product" }
      , {
          id        : "dashboard"
        , label     : "Avvia cruscotto PortalAdmin"
        , cmd       : "npm run admin:dashboard"
        , cwd       : "portal"
        }
      ]
    , readmeUrl: productRel("README.md")
    }
  , services: [
      {
        id        : "web"
      , label     : "Web"
      , port      : 3000
      , healthUrl : "http://localhost:3000/it"
      , openUrl   : "http://localhost:3000/it"
      , docs      : null
      }
    , {
        id        : "api"
      , label     : "API"
      , port      : 4000
      , healthUrl : "http://localhost:4000/api/v1/health"
      , openUrl   : "http://localhost:4000/api/v1/docs"
      , docs      : "/docs"
      }
    , {
        id        : "auth"
      , label     : "Auth"
      , port      : 4001
      , healthUrl : "http://localhost:4001/api/v1/health"
      , openUrl   : "http://localhost:4001/api/v1/docs"
      , docs      : "/docs"
      }
    , {
        id        : "dashboard"
      , label     : "Admin Dashboard"
      , port      : 3999
      , healthUrl : "http://localhost:3999/api/health"
      , openUrl   : "http://localhost:3999/"
      , docs      : null
      }
    ]
  };
}
