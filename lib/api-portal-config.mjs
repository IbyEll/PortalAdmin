/**
 * Config dinamica API Portal — servizi OpenAPI dal product repo (dev-manifest).
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { getProductRepoPath, getPortalRoot } from "./portal-paths.mjs";

/** @type {Record<string, { badge: string, badgeCls: string, cardCls: string }>} */
const BADGE_BY_ID = {
  auth : { badge: "Auth", badgeCls: "badge-auth", cardCls: "auth" }
, api  : { badge: "API",  badgeCls: "badge-api",  cardCls: "api" }
};

/**
 * @param {string} filePath
 */
function tryReadJson(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * @param {string} productRoot
 */
function resolveManifest(productRoot) {
  const local =
    tryReadJson(join(productRoot, "dev-manifest.json"))
    ?? tryReadJson(join(productRoot, "cruscotto", "dev-manifest.json"));

  if (local?.services) {
    return local;
  }

  return tryReadJson(join(getPortalRoot(), "cruscotto", "dev-manifest.json"));
}

/**
 * @param {string | undefined} healthUrl
 * @returns {string}
 */
function inferBasePath(healthUrl) {
  if (!healthUrl) {
    return "/api/v1";
  }

  try {
    const pathname = new URL(healthUrl).pathname.replace(/\/health\/?$/i, "");

    return pathname || "/api/v1";
  } catch {
    return "/api/v1";
  }
}

/**
 * @param {number} port
 * @param {string | undefined} openApiSpec
 * @param {string | null | undefined} docs
 * @returns {string}
 */
function buildSpecUrl(port, openApiSpec, docs) {
  if (typeof openApiSpec === "string" && openApiSpec.startsWith("http")) {
    return openApiSpec;
  }

  const specPath = typeof openApiSpec === "string" && openApiSpec
    ? openApiSpec
    : docs
      ? `${docs}-json`
      : "/docs-json";

  const normalized = specPath.startsWith("/") ? specPath : `/${specPath}`;

  return `http://localhost:${port}${normalized}`;
}

/**
 * @param {Record<string, unknown>} svc
 * @returns {boolean}
 */
function hasOpenApiDocs(svc) {
  if (typeof svc.openApiSpec === "string" && svc.openApiSpec.trim()) {
    return true;
  }

  const docs = svc.docs;

  return typeof docs === "string" && docs.length > 0 && docs !== "docs/api-portal";
}

/**
 * @param {string} [productRoot]
 */
export function buildApiPortalConfig(productRoot = getProductRepoPath()) {
  const manifest     = resolveManifest(productRoot);
  const pkg          = tryReadJson(join(productRoot, "package.json"));
  const projectName  = typeof pkg?.name === "string"
    ? pkg.name.replace(/^@[^/]+\//, "")
    : basename(productRoot);
  const projectLabel = typeof pkg?.description === "string" && pkg.description.trim()
    ? pkg.description.trim()
    : projectName;

  /** @type {Array<Record<string, unknown>>} */
  const rawServices = Array.isArray(manifest?.services) ? manifest.services : [];

  const services = rawServices
    .filter((svc) => typeof svc.id === "string" && hasOpenApiDocs(svc))
    .filter((svc) => svc.id !== "api-portal" && svc.id !== "dashboard")
    .filter((svc) => typeof svc.port === "number")
    .map((svc) => {
      const id      = String(svc.id);
      const port    = Number(svc.port);
      const badge   = BADGE_BY_ID[id] ?? {
        badge   : typeof svc.label === "string" ? svc.label : id
      , badgeCls: "badge-default"
      , cardCls : id
      };
      const docsUrl = typeof svc.openUrl === "string"
        ? svc.openUrl
        : `http://localhost:${port}${typeof svc.docs === "string" ? svc.docs : "/docs"}`;
      const basePath = typeof svc.apiBasePath === "string"
        ? svc.apiBasePath
        : inferBasePath(typeof svc.healthUrl === "string" ? svc.healthUrl : undefined);

      return {
        id
      , name     : typeof svc.label === "string" ? svc.label : id
      , badge    : badge.badge
      , badgeCls : badge.badgeCls
      , cardCls  : badge.cardCls
      , port
      , specUrl  : buildSpecUrl(
          port
        , typeof svc.openApiSpec === "string" ? svc.openApiSpec : undefined
        , typeof svc.docs === "string" ? svc.docs : null
        )
      , basePath
      , docsUrl
      , description: typeof svc.description === "string" ? svc.description : ""
      };
    });

  return {
    projectName
  , projectLabel
  , productRoot
  , services
  , generatedAt: new Date().toISOString()
  };
}
