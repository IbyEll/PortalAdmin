/**
 * Discovery servizi dev da path repo — manifest, monorepo turbo, convenzioni.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { loadDevManifest } from "./dev-manifest.mjs";
import { getPortalRoot, resolveProductRepoPath } from "./portal-paths.mjs";

/** @typedef {{
 *   id: string
 *   label?: string
 *   port?: number
 *   healthUrl?: string
 *   openUrl?: string
 *   processScript?: string
 *   product?: string
 *   path?: string
 *   description?: string
 *   start?: Record<string, unknown>
 *   cwd?: string
 * }} DiscoveredService */

/** @typedef {{
 *   kind: "turbo-group" | "process"
 *   id: string
 *   label: string
 *   port?: number
 *   healthUrl?: string
 *   openUrl?: string
 *   cwd: string
 *   cmd: string
 *   args: string[]
 *   services: DiscoveredService[]
 * }} StartUnit */

const APP_ID_ALIASES = {
  auth : "authentication"
};

const PRODUCT_CORE_IDS = new Set(["web", "api", "auth"]);

/** Extra inclusi in «stack completo» / utility allExtras */
export const REPO_EXTRAS_ALL = ["api-portal", "dashboard", "friendbot"];

/** Extra product repo (JustLastOne) — senza PortalAdmin */
export const PRODUCT_REPO_EXTRAS = ["friendbot"];

/** Stack product in tabella Utility (solo web, api, auth) */
export const PRODUCT_STACK_COMPLETE_EXTRAS = [];

export const PRODUCT_REPO_LABEL = "JustLastOne";

export const FRIEND_BOT_PROCESS_FRAGMENT = "friend-bot.mjs";

const CONVENTION_EXTRAS = [
  {
    id            : "friendbot"
  , label         : "friendBOT JLO"
  , script        : "testScript/funzionali/friend-bot.mjs"
  , processScript : "testScript/funzionali/friend-bot.mjs"
  }
];

/** Script runner in PortalAdmin per avvio stack product (web + api + auth). */
const PRODUCT_STACK_START_SCRIPT = {
  rel           : "runner/start_ALL_Services.mjs"
, processScript : "start_ALL_Services"
};

/** @deprecated singoli servizi — Avvia stack usa start_ALL_Services */
const PRODUCT_ELLA_START_SCRIPTS = {
  web : PRODUCT_STACK_START_SCRIPT
, api : PRODUCT_STACK_START_SCRIPT
, auth: PRODUCT_STACK_START_SCRIPT
};

/**
 * Risolve script ellaStartScript nel product repo o in PortalAdmin.
 *
 * @param {string} relScript
 * @returns {{ script: string, cwd: string } | null}
 */
function resolveEllaScriptPath(relScript) {
  const product = resolveProductRepoPath({ required: false });

  if (product && existsSync(join(product, relScript))) {
    return {
      script : join(product, relScript)
    , cwd    : product
    };
  }

  const portal       = getPortalRoot();
  const portalScript = join(portal, relScript);

  if (existsSync(portalScript)) {
    return {
      script : portalScript
    , cwd    : product ?? portal
    };
  }

  return null;
}

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
 * @param {string} repoRoot
 */
async function resolveManifestForRepo(repoRoot) {
  const local =
    tryReadJson(join(repoRoot, "dev-manifest.json"))
    ?? tryReadJson(join(repoRoot, "cruscotto", "dev-manifest.json"));

  if (local?.services) {
    return local;
  }

  const productPath = resolveProductRepoPath({ required: false });

  if (productPath && resolve(productPath) === resolve(repoRoot)) {
    try {
      return await loadDevManifest();
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * @param {string} appDir
 */
function inferPortFromApp(appDir) {
  const pkgPath = join(appDir, "package.json");
  const pkg     = tryReadJson(pkgPath);

  if (pkg?.scripts?.dev) {
    const match = String(pkg.scripts.dev).match(/--port\s+(\d+)/);

    if (match) {
      return Number(match[1]);
    }
  }

  const mainTs = join(appDir, "src", "main.ts");

  if (existsSync(mainTs)) {
    const src   = readFileSync(mainTs, "utf8");
    const match = src.match(/PORT\s*\?\?\s*(\d+)/);

    if (match) {
      return Number(match[1]);
    }
  }

  return undefined;
}

/**
 * @param {string} repoRoot
 */
function discoverTurboAppPackages(repoRoot) {
  const appsDir = join(repoRoot, "apps");

  if (!existsSync(join(repoRoot, "turbo.json")) || !existsSync(appsDir)) {
    return [];
  }

  /** @type {Array<{ id: string, name: string, label: string, port?: number }>} */
  const apps = [];

  for (const ent of readdirSync(appsDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) {
      continue;
    }

    const pkgPath = join(appsDir, ent.name, "package.json");
    const pkg     = tryReadJson(pkgPath);

    if (!pkg?.scripts?.dev || typeof pkg.name !== "string") {
      continue;
    }

    apps.push({
      id    : ent.name
    , name  : pkg.name
    , label : pkg.name
    , port  : inferPortFromApp(join(appsDir, ent.name))
    });
  }

  return apps;
}

const SERVICE_PATH_BY_ID = {
  web        : "runner/start_ALL_Services.mjs"
, api        : "runner/start_ALL_Services.mjs"
, auth       : "runner/start_ALL_Services.mjs"
, "api-portal": "runner/start_API_Portal.mjs"
, friendbot  : "testScript/funzionali/friend-bot.mjs"
, dashboard  : "server/dashboard-server.mjs"
};

const SERVICE_DESCRIPTION_BY_ID = {
  web        : "Frontend Next.js 15 — UI prodotto IT/EN"
, api        : "API REST NestJS — dominio applicativo"
, auth       : "API auth NestJS — login, JWT, registrazione"
, "api-portal": "Navigazione OpenAPI centralizzata — config da PRODUCT_REPO_PATH"
, dashboard  : "Cruscotto dev — test, report, utility"
, friendbot  : "Daemon dev — amicizie e risposte chat automatiche"
};

/**
 * @param {DiscoveredService} svc
 * @returns {string}
 */
function resolveServiceDescription(svc) {
  if (typeof svc.description === "string" && svc.description.trim()) {
    return svc.description.trim();
  }

  return SERVICE_DESCRIPTION_BY_ID[svc.id] ?? "";
}

/**
 * @param {DiscoveredService} svc
 * @param {{ productRoot: string, portalRoot: string }} ctx
 * @returns {DiscoveredService}
 */
function enrichServiceMeta(svc, ctx) {
  const { productRoot, portalRoot } = ctx;

  if (svc.id === "dashboard") {
    return {
      ...svc
    , product     : "PortalAdmin"
    , path        : "server/dashboard-server.mjs"
    , description : resolveServiceDescription(svc)
    , cwd         : portalRoot
    };
  }

  if (svc.id === "api-portal") {
    return {
      ...svc
    , product     : "PortalAdmin"
    , path        : "runner/start_API_Portal.mjs"
    , description : resolveServiceDescription(svc)
    , cwd         : portalRoot
    };
  }

  /** @type {string} */
  let path = SERVICE_PATH_BY_ID[svc.id] ?? "";

  if (!path && typeof svc.processScript === "string") {
    path = svc.processScript;
  }

  if (!path && svc.start && typeof svc.start === "object") {
    const start = svc.start;

    if (typeof start.script === "string") {
      path = start.script;
    } else if (start.type === "npm-workspace" && typeof start.workspace === "string") {
      const dirName = APP_ID_ALIASES[svc.id] ?? svc.id;
      const appDir  = join(productRoot, "apps", dirName);

      if (existsSync(appDir)) {
        path = `apps/${dirName}`;
      }
    }
  }

  if (!path) {
    const app = resolveAppPackage(productRoot, svc.id);

    if (app) {
      path = `apps/${APP_ID_ALIASES[svc.id] ?? svc.id}`;
    }
  }

  return {
    ...svc
  , product     : "JustLastOne"
  , path        : path.replace(/\\/g, "/") || "."
  , description : resolveServiceDescription(svc)
  , cwd         : svc.cwd ?? productRoot
  };
}

/**
 * @param {string} repoRoot
 * @param {string} serviceId
 */
function resolveAppPackage(repoRoot, serviceId) {
  const apps     = discoverTurboAppPackages(repoRoot);
  const dirName  = APP_ID_ALIASES[serviceId] ?? serviceId;
  const byDir    = apps.find((row) => row.id === dirName);
  const byId     = apps.find((row) => row.id === serviceId);

  return byDir ?? byId ?? null;
}

/**
 * @param {string} repoRoot
 * @param {Record<string, unknown>} svc
 * @returns {DiscoveredService | null}
 */
function enrichManifestService(repoRoot, svc) {
  const id = typeof svc.id === "string" ? svc.id : "";

  if (!id) {
    return null;
  }

  /** @type {DiscoveredService} */
  const base = {
    id
  , label         : typeof svc.label === "string" ? svc.label : id
  , description   : typeof svc.description === "string" ? svc.description : undefined
  , port          : typeof svc.port === "number" ? svc.port : undefined
  , healthUrl     : typeof svc.healthUrl === "string" ? svc.healthUrl : undefined
  , openUrl       : typeof svc.openUrl === "string" ? svc.openUrl : undefined
  , processScript : typeof svc.processScript === "string" ? svc.processScript : undefined
  , cwd           : repoRoot
  };

  const start = svc.start;

  if (start && typeof start === "object") {
    return { ...base, start: /** @type {Record<string, unknown>} */ (start) };
  }

  const ellaStart = PRODUCT_ELLA_START_SCRIPTS[id];

  if (ellaStart) {
    const portal    = getPortalRoot();
    const scriptAbs = join(portal, ellaStart.rel);

    if (existsSync(scriptAbs)) {
      return {
        ...base
      , processScript : base.processScript ?? ellaStart.processScript
      , cwd           : portal
      , start         : {
          type   : "node"
        , script : scriptAbs
        }
      };
    }
  }

  const app = resolveAppPackage(repoRoot, id);

  if (app) {
    return {
      ...base
    , port  : base.port ?? app.port
    , start : {
        type      : "npm-workspace"
      , workspace : app.name
      , script    : "dev"
      }
    };
  }

  const convention = CONVENTION_EXTRAS.find((row) => row.id === id);
  const resolved   = convention ? resolveEllaScriptPath(convention.script) : null;

  if (id === "api-portal") {
    return discoverPortalApiPortal(getPortalRoot());
  }

  if (convention && resolved) {
    return {
      ...base
    , port          : base.port ?? convention.port
    , processScript : base.processScript ?? convention.processScript
    , cwd           : resolved.cwd
    , start         : {
        type   : "node"
      , script : resolved.script
      }
    };
  }

  return null;
}

/**
 * @param {string} repoRoot
 */
function discoverFromMonorepo(repoRoot, options = {}) {
  const { extras = [] } = options;
  const apps            = discoverTurboAppPackages(repoRoot);

  return apps
    .filter((app) => PRODUCT_CORE_IDS.has(app.id) || extras.includes(app.id))
    .map((app) => ({
    id    : app.id
  , label : app.label
  , port  : app.port
  , cwd   : repoRoot
  , start : {
      type      : "npm-workspace"
    , workspace : app.name
    , script    : "dev"
    }
  }));
}

/**
 * @param {string} repoRoot
 */
function discoverPortalDashboard(repoRoot) {
  const pkg = tryReadJson(join(repoRoot, "package.json"));

  if (!pkg?.scripts?.["admin:dashboard"]) {
    return null;
  }

  return {
    id    : "dashboard"
  , label : "Admin Dashboard"
  , port  : Number(process.env.DASHBOARD_PORT ?? process.env.ADMIN_PORT ?? process.env.PORT ?? 3999)
  , cwd   : repoRoot
  , start : {
      type   : "npm"
    , script : "admin:dashboard"
    }
  };
}

/**
 * @param {string} portalRoot
 */
function discoverPortalApiPortal(portalRoot) {
  const runnerRel = "runner/start_API_Portal.mjs";
  const runnerAbs = join(portalRoot, runnerRel);

  if (existsSync(runnerAbs)) {
    const port = Number(process.env.API_PORTAL_PORT ?? process.env.PORTAL_PORT ?? 4080);

    return {
      id            : "api-portal"
    , label         : "API Portal"
    , description   : SERVICE_DESCRIPTION_BY_ID["api-portal"]
    , port
    , healthUrl     : `http://localhost:${port}/`
    , openUrl       : `http://localhost:${port}/`
    , processScript : "start_API_Portal"
    , cwd           : portalRoot
    , start         : {
        type   : "node"
      , script : runnerAbs
      }
    };
  }

  const scriptRel = "ellaStartScript/serve-api-portal.mjs";
  const scriptAbs = join(portalRoot, scriptRel);

  if (!existsSync(scriptAbs)) {
    return null;
  }

  const port = Number(process.env.API_PORTAL_PORT ?? process.env.PORTAL_PORT ?? 4080);

  return {
    id            : "api-portal"
  , label         : "API Portal"
  , description   : SERVICE_DESCRIPTION_BY_ID["api-portal"]
  , port
  , healthUrl     : `http://localhost:${port}/`
  , openUrl       : `http://localhost:${port}/`
  , processScript : scriptRel
  , cwd           : portalRoot
  , start         : {
      type   : "node"
    , script : scriptAbs
    }
  };
}

/**
 * @param {string} productRoot
 * @param {string} extraId
 */
function resolveExtraService(productRoot, extraId) {
  if (extraId === "dashboard") {
    return discoverPortalDashboard(getPortalRoot());
  }

  if (extraId === "api-portal") {
    return discoverPortalApiPortal(getPortalRoot());
  }

  return discoverConventionExtra(productRoot, extraId);
}

/**
 * @param {string} repoRoot
 * @param {string} extraId
 */
function discoverConventionExtra(repoRoot, extraId) {
  const convention = CONVENTION_EXTRAS.find((row) => row.id === extraId);
  const resolved   = convention ? resolveEllaScriptPath(convention.script) : null;

  if (!convention || !resolved) {
    return null;
  }

  return {
    id            : convention.id
  , label         : convention.label
  , port          : convention.port
  , processScript : convention.processScript
  , cwd           : resolved.cwd
  , start         : {
      type   : "node"
    , script : resolved.script
    }
  };
}

/**
 * @param {DiscoveredService} service
 * @param {string} fallbackCwd
 * @returns {StartUnit | null}
 */
function serviceToStartUnit(service, fallbackCwd) {
  const cwd   = service.cwd ?? fallbackCwd;
  const start = service.start;

  if (!start || typeof start !== "object") {
    return null;
  }

  const type = start.type;

  if (type === "npm-workspace") {
    const workspace = start.workspace;
    const script    = start.script ?? "dev";

    if (typeof workspace !== "string") {
      return null;
    }

    return {
      kind     : "process"
    , id       : service.id
    , label    : service.label ?? service.id
    , port     : service.port
    , healthUrl: service.healthUrl
    , openUrl  : service.openUrl
    , cwd
    , cmd      : process.platform === "win32" ? "npm.cmd" : "npm"
    , args     : ["run", String(script), "-w", workspace]
    , services : [service]
    };
  }

  if (type === "npm") {
    const script = start.script;

    if (typeof script !== "string") {
      return null;
    }

    return {
      kind     : "process"
    , id       : service.id
    , label    : service.label ?? service.id
    , port     : service.port
    , healthUrl: service.healthUrl
    , openUrl  : service.openUrl
    , cwd
    , cmd      : process.platform === "win32" ? "npm.cmd" : "npm"
    , args     : ["run", script]
    , services : [service]
    };
  }

  if (type === "node") {
    const script = start.script;

    if (typeof script !== "string") {
      return null;
    }

    return {
      kind     : "process"
    , id       : service.id
    , label    : service.label ?? service.id
    , port     : service.port
    , healthUrl: service.healthUrl
    , openUrl  : service.openUrl
    , cwd
    , cmd      : process.execPath
    , args     : [script]
    , services : [service]
    };
  }

  if (type === "turbo-filters") {
    const filters = start.filters;

    if (!Array.isArray(filters) || filters.length === 0) {
      return null;
    }

    const turboBin = join(
      cwd
    , "node_modules"
    , ".bin"
    , process.platform === "win32" ? "turbo.cmd" : "turbo"
    );

    return {
      kind     : "turbo-group"
    , id       : service.id
    , label    : service.label ?? "turbo dev"
    , cwd
    , cmd      : turboBin
    , args     : [
        "run"
      , "dev"
      , ...filters.map((filter) => `--filter=${filter}`)
      ]
    , services : [service]
    };
  }

  return null;
}

/**
 * @param {string} repoRoot
 * @param {DiscoveredService[]} services
 * @returns {StartUnit[]}
 */
function buildStartPlan(repoRoot, services) {
  const hasTurbo      = existsSync(join(repoRoot, "turbo.json"));
  const turboBin      = join(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "turbo.cmd" : "turbo");
  const workspaceSvcs = services.filter((svc) => svc.start?.type === "npm-workspace");
  const otherSvcs     = services.filter((svc) => svc.start?.type !== "npm-workspace");

  /** @type {StartUnit[]} */
  const plan = [];

  if (hasTurbo && existsSync(turboBin) && workspaceSvcs.length > 1) {
    const filters = workspaceSvcs
      .map((svc) => svc.start?.workspace)
      .filter((value) => typeof value === "string");

    plan.push({
      kind     : "turbo-group"
    , id       : "turbo-dev"
    , label    : `Turbo dev (${filters.join(", ")})`
    , cwd      : repoRoot
    , cmd      : turboBin
    , args     : [
        "run"
      , "dev"
      , ...filters.map((filter) => `--filter=${filter}`)
      ]
    , services : workspaceSvcs
    });
  } else {
    for (const svc of workspaceSvcs) {
      const unit = serviceToStartUnit(svc, repoRoot);

      if (unit) {
        plan.push(unit);
      }
    }
  }

  for (const svc of otherSvcs) {
    const unit = serviceToStartUnit(svc, repoRoot);

    if (unit) {
      plan.push(unit);
    }
  }

  return plan;
}

/**
 * Unità di avvio per un singolo servizio (ignora raggruppamento turbo).
 * @param {string} repoRoot
 * @param {DiscoveredService} service
 * @returns {StartUnit | null}
 */
export function resolveServiceStartUnit(repoRoot, service) {
  return serviceToStartUnit(service, repoRoot);
}

/**
 * @param {string} repoRoot
 * @param {{
 *   extras?: string[]
 *   withPortal?: boolean
 * }} [options]
 */
export async function discoverRepoServices(repoRoot, options = {}) {
  const resolved     = resolve(repoRoot);
  const { extras = [], withPortal = false } = options;

  if (!existsSync(join(resolved, "package.json"))) {
    throw new Error(`Repo non valido (package.json assente): ${resolved}`);
  }

  const manifest = await resolveManifestForRepo(resolved);

  /** @type {DiscoveredService[]} */
  let services = [];

  if (manifest?.services?.length) {
    const allowedIds = new Set([
      ...PRODUCT_CORE_IDS
    , ...extras
    , ...(withPortal ? ["dashboard"] : [])
    ]);

    services = manifest.services
      .filter((svc) => typeof svc.id === "string" && allowedIds.has(svc.id))
      .map((svc) => enrichManifestService(resolved, svc))
      .filter((svc) => svc !== null);
  } else {
    services = discoverFromMonorepo(resolved, { extras });
  }

  for (const extraId of extras) {
    if (services.some((svc) => svc.id === extraId)) {
      continue;
    }

    const extra = resolveExtraService(resolved, extraId);

    if (extra) {
      services.push(extra);
    }
  }

  if (withPortal) {
    const portalRoot = getPortalRoot();
    const dashboard  = discoverPortalDashboard(portalRoot);

    if (dashboard && !services.some((svc) => svc.id === "dashboard")) {
      services.push(dashboard);
    }

    const apiPortal = discoverPortalApiPortal(portalRoot);

    if (apiPortal && !services.some((svc) => svc.id === "api-portal")) {
      services.push(apiPortal);
    }
  }

  services = services.filter((svc) => svc.start);
  const portalRoot = getPortalRoot();

  services = services.map((svc) => enrichServiceMeta(svc, {
    productRoot : resolved
  , portalRoot
  }));

  const plan = buildStartPlan(resolved, services);

  return {
    repoRoot : resolved
  , manifest : manifest ? "dev-manifest" : "monorepo-scan"
  , services
  , plan
  };
}

/**
 * @param {StartUnit[]} plan
 */
export function formatStartPlan(plan) {
  return plan.map((unit, index) => {
    const ports = unit.services
      .map((svc) => svc.port)
      .filter((port) => typeof port === "number")
      .join(", ");

    return [
      `${index + 1}. ${unit.label} [${unit.kind}]`
    , `   cwd: ${unit.cwd}`
    , `   cmd: ${unit.cmd} ${unit.args.join(" ")}`
    , ports ? `   port: ${ports}` : null
    ].filter(Boolean).join("\n");
  }).join("\n\n");
}
