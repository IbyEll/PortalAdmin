/**
 * Config dinamica API Portal — servizi OpenAPI dal product repo (dev-manifest).
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - l'API Portal (:4080) non deve hardcodare porte, path e label in HTML o negli runner
 *   - la fonte unica dei servizi dev è dev-manifest.json del product repo
 *
 *   A cosa serve:
 *   - trasforma dev-manifest + package.json in payload JSON per card Swagger (specUrl, docsUrl)
 *
 * Consumatori:
 *   - runner/serve-api-portal.mjs — GET /config.json a runtime
 *   - runner/cruscotto.process.start.api.portal.mjs   — anteprima config in avvio
 *
 * Export principali:
 *   - buildApiPortalConfig — manifest → { projectName, services[], generatedAt }
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { getProductRepoPath, getPortalRoot } from "./portal.paths.resolver.mjs";

// --- costanti di modulo (badge/card UI per id servizio noti) ---
/**
 * Classi CSS e etichette per auth/api; gli altri id usano label dal manifest o id grezzo.
 *
 * @type {Record<string, { badge: string, badgeCls: string, cardCls: string }>}
 */
const BADGE_BY_ID = {
  auth : { badge: "Auth", badgeCls: "badge-auth", cardCls: "auth" }
, api  : { badge: "API",  badgeCls: "badge-api",  cardCls: "api" }
};

/**
 * Legge JSON da path se il file esiste; null su assenza o parse fallito.
 *
 * @param {string} filePath
 * @returns {unknown}
 */
function tryReadJson(filePath) {
  // Guard — manifest/package opzionali, assenza non è errore
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    // Parse fallito — trattato come file assente
    return null;
  }
}

/**
 * Risolve dev-manifest: product repo prima, poi fallback cruscotto PortalAdmin.
 *
 * @param {string} productRoot
 * @returns {Record<string, unknown> | null}
 */
function resolveManifest(productRoot) {
  // 1. Manifest nel product repo (root o sotto cruscotto/)
  const local =
    tryReadJson(join(productRoot, "dev-manifest.json"))
    ?? tryReadJson(join(productRoot, "cruscotto", "dev-manifest.json"));

  if (local?.services) {
    return local;
  }

  // 2. Fallback — manifest bundled in PortalAdmin quando product non ha services
  return tryReadJson(join(getPortalRoot(), "cruscotto", "dev-manifest.json"));
}

/**
 * Deduce apiBasePath da healthUrl (strip /health) o default /api/v1.
 *
 * @param {string | undefined} healthUrl
 * @returns {string}
 */
function inferBasePath(healthUrl) {
  if (!healthUrl) {
    return "/api/v1";
  }
  try {
    // Strip suffisso /health dal pathname — resto = base API
    const pathname = new URL(healthUrl).pathname.replace(/\/health\/?$/i, "");

    return pathname || "/api/v1";
  } catch {
    return "/api/v1";
  }
}

/**
 * URL assoluto allo spec OpenAPI — openApiSpec assoluto, path relativo o docs-json.
 *
 * @param {number} port
 * @param {string | undefined} openApiSpec
 * @param {string | null | undefined} docs
 * @returns {string}
 */
function buildSpecUrl(port, openApiSpec, docs) {
  // 1. Spec già assoluta — nessuna risoluzione locale
  if (typeof openApiSpec === "string" && openApiSpec.startsWith("http")) {
    return openApiSpec;
  }
  // 2. Path relativo: openApiSpec esplicito, {docs}-json o default Nest /docs-json
  const specPath = typeof openApiSpec === "string" && openApiSpec
    ? openApiSpec
    : docs
      ? `${docs}-json`
      : "/docs-json";
  const normalized = specPath.startsWith("/") ? specPath : `/${specPath}`;

  // 3. Prefisso host dev — il frontend statico non conosce la porta
  return `http://localhost:${port}${normalized}`;
}

/**
 * Servizio idoneo al portal solo se espone openApiSpec o path docs reale (non placeholder).
 *
 * @param {Record<string, unknown>} svc
 * @returns {boolean}
 */
function hasOpenApiDocs(svc) {
  if (typeof svc.openApiSpec === "string" && svc.openApiSpec.trim()) {
    return true;
  }
  const docs = svc.docs;

  // Esclude placeholder del portal stesso — non è uno spec OpenAPI esterno
  return typeof docs === "string" && docs.length > 0 && docs !== "docs/api-portal";
}

/**
 * Costruisce il payload config per API Portal a partire dal product repo.
 *
 * @param {string} [productRoot]
 * @returns {{
 *   projectName: string
 * , projectLabel: string
 * , productRoot: string
 * , services: Array<Record<string, unknown>>
 * , generatedAt: string
 * }}
 */
export function buildApiPortalConfig(productRoot = getProductRepoPath()) {
  // 1. Manifest servizi dev + metadati progetto (nome/label) da package.json
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

  // 2. Filtra: OpenAPI reale, no api-portal/dashboard, porta obbligatoria
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

      // 3. Campi card per api-portal/index.html (badge, specUrl, docsUrl, basePath)
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

  // 4. Payload completo con timestamp per cache-bust lato client
  return {
    projectName
  , projectLabel
  , productRoot
  , services
  , generatedAt: new Date().toISOString()
  };
}
