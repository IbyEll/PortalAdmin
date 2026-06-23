/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:37
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 20:42   by: IbyEll
 * modificato il: 2026-06-23 21:37   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Discovery servizi dev — ponte tra PortalAdmin (ADMIN) e product repo (REPO).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Cruscotto e repo-services-manager vivono in PortalAdmin ma devono avviare servizi sparsi
 *     tra host e product senza hardcodare porte e cwd ovunque.
 *
 *   A cosa serve:
 *   - Adapter che unifica product.manifest, dev-manifest e script runner in services e plan
 *     StartUnit per tab Process del cruscotto.
 *
 * Generalizzazione:
 *   Si — repoRoot, extras e withPortal parametrizzano discoverRepoServices per ogni overlay.
 *
 * Input:
 *   - PRODUCT_REPO_PATH — root product per manifest locale e scan apps turbo
 *   - PRJ_NAME — overlay per getDiscoveryConfig in lib/overlay/discovery.config.mjs
 *   - options.extras, options.withPortal — extra friendbot e servizi PortalAdmin in discovery
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.process.services.manager.mjs — spawn/kill stack dev
 *   - cruscotto.frontend/cruscotto.server.mjs — REPO_EXTRAS_ALL per API Process
 *   - server/dev-api.mjs — FRIEND_BOT_PROCESS_FRAGMENT per match PID friendbot
 *   - cruscotto.frontend/cruscotto.api.documentation.server.mjs — id api-documentation
 *
 * Export principali:
 *   - discoverRepoServices — manifest o monorepo-scan, services e plan
 *   - resolveServiceStartUnit — StartUnit per singolo servizio
 *   - formatStartPlan — piano avvio leggibile per log CLI
 *   - REPO_EXTRAS_ALL, PRODUCT_REPO_EXTRAS — set id extra tab Process
 *   - FRIEND_BOT_PROCESS_FRAGMENT — suffix path testScript friend-bot
 *
 * ------------------------------------------------------------------------------------------------------------------------
 *
 *!  ------------------------
 *!  Cosa collega
 *!   
 *!  REPO (product)
 *!  Cosa legge / risolve : apps/ turbo (web, api, auth), dev-manifest.json locale,
 *!                         testScript/funzionali/friend-bot.mjs, package.json
 *!  
 *!  ADMIN (PortalAdmin)
 *!  Cosa legge / risolve : dev-manifest via loadDevManifest()
 *!                        , runner (cruscotto.process.start.all.services, start_API_Documentation), dashboard-server
 *!                        , path da getPortalRoot()
 *!  
 *!  La funzione centrale è discoverRepoServices(repoRoot): prende un root (di solito il product repo) 
 *!  e restituisce un elenco unificato di servizi + piano di avvio (StartUnit) usato da repo-services-manager.
 *!  
 *!  ------------------------------------------------
 *!  Come fa da "ponte" tra ADMIN e REPO
 *!  ------------------------------------------------
 *!  1 . Script in entrambi i repo — resolveEllaScriptPath prova prima il product, poi PortalAdmin:
 *!  _______________________________________________________________________________________________
 *!   * Risolve script runner/ nel product repo o in PortalAdmin.
 *!   * Product ha priorità; PortalAdmin come fallback (es. cruscotto.process.start.all.services).
 *!   
 *!  function resolveEllaScriptPath(relScript) {
 *!    // 1. Script nel product repo checkout
 *!    const product = resolveProductRepoPath({ required: false });
 *!    ...
 *!    // 2. Fallback PortalAdmin — runner condivisi tra product e admin
 *!    const portal       = getPortalRoot();
 *!  _______________________________________________________________________________________________
 *!  
 *!  2 . Manifest incrociato — se il product non ha dev-manifest con services, usa quello di PortalAdmin (loadDevManifest).
 *!  
 *!  3 . Etichetta product per la UI — ogni servizio viene marcato come appartenente a un mondo o all’altro:
 *!  _______________________________________________________________________________________________
 *!    // Servizi hosted in PortalAdmin — product label e cwd portal
 *!    if (svc.id === "dashboard") {
 *!      return { ...svc, product: "PortalAdmin", ... };
 *!    }
 *!    if (svc.id === "api-documentation") {
 *!      return { ...svc, product: "PortalAdmin", ... };
 *!    }
 *!    ...
 *!    return { ...svc, product: "JustLastOne", ... };
 *!  _______________________________________________________________________________________________
 *!  
 *!  4 . Stack product avviato da ADMIN — web/api/auth nel manifest puntano a runner/cruscotto.process.start.all.services.mjs
 *!      in PortalAdmin, non ai singoli apps/* del product (commento esplicito nel file: un runner unico per lo stack).
 *!  
 *!  5 . Extra misti — costanti come REPO_EXTRAS_ALL vs PRODUCT_REPO_EXTRAS separano cosa vive nel product (friendbot)
 *!      da cosa vive in ADMIN (dashboard, api-documentation).
 *!  _______________________________________________________________________________________________
 *!  
 *!  ------------------------------------------------
 *!  Schema concettuale
 *!  ------------------------------------------------
 *!  
 *!  PortalAdmin (cruscotto, dev-api)
 *!          │
 *!          ▼
 *!   discovery.services.repo  ◄── dev-manifest (ADMIN)
 *!          │              ◄── turbo/apps, testScript (REPO)
 *!          │              ◄── runner ADMIN per avvio stack
 *!          ▼
 *!  { services[], plan[] }  →  repo-services-manager (spawn/kill/monitor)
 *!  _______________________________________________________________________________________________
 *!  
 *!  Cosa non è :
 *!  - Non è importato dal product repo — vive solo in PortalAdmin.
 *!  - Non sostituisce portal.paths.resolver.mjs (path) né dev-manifest.mjs (lettura JSON): li compone.
 *!  - Non è il ponte Jira/git — quello è altro (config_project, workflow, ecc.).
 *!  - Non è il ponte Jira/git — quello è altro (config_project, workflow, ecc.).
 *!  - In sintesi: è il layer di discovery e avvio dev che fa parlare ADMIN con REPO, producendo una vista unica “cosa posso avviare, da dove, con quale comando” per il cruscotto. Se ti serve un nome architetturale: adapter + facade tra i due repository.
 *!  
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { loadProductManifest } from "./product.manifest.mjs";
import { resolveDashboardListenPort } from "./portal.launch.dashboard.mjs";
import {
  buildStackStartScripts
, getDiscoveryConfig
} from "./overlay/discovery.config.mjs";
import { getPortalRoot, resolveProductRepoPath } from "./portal.paths.resolver.mjs";

const CFG = getDiscoveryConfig();

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

const APP_ID_ALIASES           = CFG.appIdAliases;
const PRODUCT_CORE_IDS         = new Set(CFG.coreServiceIds);
const PORTAL_SERVICE_IDS       = new Set(CFG.portalServiceIds);
const CONVENTION_EXTRAS        = CFG.conventionExtras;
const SERVICE_PATH_BY_ID       = CFG.servicePathById;
const SERVICE_DESCRIPTION_BY_ID = CFG.serviceDescriptionById;
const PRODUCT_STACK_START_SCRIPT = CFG.stackStartScript;
const PRODUCT_ELLA_START_SCRIPTS   = buildStackStartScripts(CFG);

// --- costanti export — stack Process cruscotto ---
/** Extra inclusi in «stack completo» / process allExtras */
export const REPO_EXTRAS_ALL = CFG.repoExtrasAll;

/** Extra product repo — senza PortalAdmin */
export const PRODUCT_REPO_EXTRAS = CFG.productExtras;

/** Stack product in tabella Process (solo core) */
export const PRODUCT_STACK_COMPLETE_EXTRAS = CFG.stackCompleteExtras;

export const PRODUCT_REPO_LABEL = CFG.productLabel;

export const FRIEND_BOT_PROCESS_FRAGMENT =
  CFG.processFragments.friendbot ?? "friend-bot.mjs";

/**
 * Risolve script runner/ nel product repo o in PortalAdmin.
 * Product ha priorità; PortalAdmin come fallback (es. cruscotto.process.start.all.services).
 *
 * @param {string} relScript
 * @returns {{ script: string, cwd: string } | null}
 */
function resolveEllaScriptPath(relScript) {
  // 1. Script nel product repo checkout
  const product = resolveProductRepoPath({ required: false });

  if (product && existsSync(join(product, relScript))) {
    return {
      script : join(product, relScript)
    , cwd    : product
    };
  }

  // 2. Fallback PortalAdmin — runner condivisi tra product e admin
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
 * Manifest JSON: product repo locale, poi loadProductManifest se repo = product configurato.
 *
 * @param {string} repoRoot
 */
async function resolveManifestForRepo(repoRoot) {
  const productPath = resolveProductRepoPath({ required: false });

  // 1. Product repo attivo — manifest overlay (PRJ_PRODUCT_MANIFEST) prima dello stub JLO
  if (productPath && resolve(productPath) === resolve(repoRoot)) {
    try {
      const overlayManifest = await loadProductManifest();

      if (overlayManifest?.services?.length) {
        return overlayManifest;
      }
    } catch {
      // fallback manifest locale sotto
    }
  }

  // 2. product.manifest.json nel repo scansionato (root o cruscotto.frontend/)
  const local =
    tryReadJson(join(repoRoot, "product.manifest.json"))
    ?? tryReadJson(join(repoRoot, "cruscotto.frontend", "product.manifest.json"))
    ?? tryReadJson(join(repoRoot, "cruscotto", "product.manifest.json"));

  if (local?.services) {
    return local;
  }

  // 3. Ultimo tentativo loadProductManifest se step 1 non applicabile
  if (productPath && resolve(productPath) === resolve(repoRoot)) {
    try {
      return await loadProductManifest();
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Porta dev da package.json (--port) o da main.ts (PORT ?? N).
 *
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
 * App turbo in apps/ con script dev e package name.
 *
 * @param {string} repoRoot
 */
function discoverTurboAppPackages(repoRoot) {
  const appsDir = join(repoRoot, "apps");

  // Monorepo turbo obbligatorio — altrimenti scan vuoto
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
 * Aggiunge product, path relativo, description e cwd al servizio per il cruscotto.
 *
 * @param {DiscoveredService} svc
 * @param {{ productRoot: string, portalRoot: string }} ctx
 * @returns {DiscoveredService}
 */
function enrichServiceMeta(svc, ctx) {
  const { productRoot, portalRoot } = ctx;

  // Servizi hosted in PortalAdmin — label da discovery-config.portalLabel
  if (PORTAL_SERVICE_IDS.has(svc.id)) {
    return {
      ...svc
    , product     : CFG.portalLabel
    , path        : SERVICE_PATH_BY_ID[svc.id] ?? svc.path ?? "."
    , description : resolveServiceDescription(svc)
    , cwd         : portalRoot
    };
  }

  /** @type {string} */
  let path = SERVICE_PATH_BY_ID[svc.id] ?? "";

  // Path da manifest: processScript, start.script o workspace npm
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
  , product     : CFG.productLabel
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
 * Voce manifest → DiscoveredService con start risolto (ella, turbo, convenzione).
 *
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

  // Stack product — un solo runner PortalAdmin per web/api/auth
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

  const portalSvc = resolvePortalManifestService(base, id);

  if (portalSvc) {
    return portalSvc;
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
 * Fallback senza manifest: solo app turbo core (+ extras richiesti).
 *
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
 * Servizio PortalAdmin (dashboard, home, api-documentation) da manifest o discovery.config.
 *
 * @param {DiscoveredService} base
 * @param {string} id
 * @returns {DiscoveredService | null}
 */
function resolvePortalManifestService(base, id) {
  if (!PORTAL_SERVICE_IDS.has(id)) {
    return null;
  }

  /** @type {DiscoveredService | null} */
  let portalSvc = null;

  if (id === "dashboard") {
    portalSvc = discoverPortalDashboard(getPortalRoot());
  } else if (id === "api-documentation") {
    portalSvc = discoverPortalApiDocumentation(getPortalRoot());
  } else if (id === "home") {
    portalSvc = discoverPortalHome(getPortalRoot());
  }

  if (portalSvc) {
    return {
      ...portalSvc
    , label         : base.label ?? portalSvc.label
    , description   : base.description ?? portalSvc.description
    , port          : base.port ?? portalSvc.port
    , healthUrl     : base.healthUrl ?? portalSvc.healthUrl
    , openUrl       : base.openUrl ?? portalSvc.openUrl
    , processScript : base.processScript ?? portalSvc.processScript
    };
  }

  const pathRel = SERVICE_PATH_BY_ID[id];

  if (!pathRel) {
    return null;
  }

  const portal    = getPortalRoot();
  const scriptAbs = join(portal, pathRel);

  if (!existsSync(scriptAbs)) {
    return null;
  }

  return {
    ...base
  , cwd   : portal
  , start : {
      type   : "node"
    , script : scriptAbs
    }
  };
}

/**
 * @param {string} repoRoot
 */
function discoverPortalDashboard(repoRoot) {
  const pkg = tryReadJson(join(repoRoot, "package.json"));

  if (!pkg?.scripts?.[CFG.portalDashboardNpmScript]) {
    return null;
  }

  return {
    id    : "dashboard"
  , label : "Admin Dashboard"
  , port  : resolveDashboardListenPort()
  , cwd   : repoRoot
  , start : {
      type   : "npm"
    , script : CFG.portalDashboardNpmScript
    }
  };
}

/**
 * @param {string} portalRoot
 */
function discoverPortalApiDocumentation(portalRoot) {
  const runnerRel = CFG.apiDocumentationRunnerRel ?? CFG.apiDocumentationRunnerRel ?? "";
  const runnerAbs = runnerRel ? join(portalRoot, runnerRel) : "";

  if (runnerAbs && existsSync(runnerAbs)) {
    const port = Number(process.env.API_DOCUMENTATION_PORT ?? process.env.PORTAL_PORT ?? 4080);

    return {
      id            : "api-documentation"
    , label         : "API Documentation"
    , description   : SERVICE_DESCRIPTION_BY_ID["api-documentation"]
    , port
    , healthUrl     : `http://localhost:${port}/`
    , openUrl       : `http://localhost:${port}/`
    , processScript : "cruscotto.process.start.api.documentation"
    , cwd           : portalRoot
    , start         : {
        type   : "node"
      , script : runnerAbs
      }
    };
  }

  const scriptRel = CFG.apiDocumentationServeRel ?? CFG.apiDocumentationServeRel ?? "";

  if (!scriptRel) {
    return null;
  }

  const scriptAbs = join(portalRoot, scriptRel);

  if (!existsSync(scriptAbs)) {
    return null;
  }

  const port = Number(process.env.API_DOCUMENTATION_PORT ?? process.env.PORTAL_PORT ?? 4080);

  return {
    id            : "api-documentation"
  , label         : "API Documentation"
  , description   : SERVICE_DESCRIPTION_BY_ID["api-documentation"]
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
 * Portal HOME — selezione overlay PROJECT_* (:3990).
 *
 * @param {string} portalRoot
 * @returns {DiscoveredService | null}
 */
function discoverPortalHome(portalRoot) {
  const scriptRel = SERVICE_PATH_BY_ID.home ?? "admin.portal/portal.home.server.mjs";
  const scriptAbs = join(portalRoot, scriptRel);

  if (!existsSync(scriptAbs)) {
    return null;
  }

  const port = Number(process.env.PORTAL_HOME_PORT ?? 3990);

  return {
    id            : "home"
  , label         : "Portal HOME"
  , description   : SERVICE_DESCRIPTION_BY_ID.home ?? "Selezione overlay PROJECT_*"
  , port
  , healthUrl     : `http://localhost:${port}/api/health`
  , openUrl       : `http://localhost:${port}/`
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
  if (extraId === "dashboard" && PORTAL_SERVICE_IDS.has("dashboard")) {
    return discoverPortalDashboard(getPortalRoot());
  }

  if (extraId === "home" && PORTAL_SERVICE_IDS.has("home")) {
    return discoverPortalHome(getPortalRoot());
  }

  if (extraId === "api-documentation" && PORTAL_SERVICE_IDS.has("api-documentation")) {
    return discoverPortalApiDocumentation(getPortalRoot());
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
 * Trasforma start.type del servizio in comando spawn (npm, node, turbo-filters).
 *
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

  // npm run dev -w workspace — app Nest/Next in monorepo
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

  // npm run script — es. admin:dashboard
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

  // node script.mjs — runner PortalAdmin o testScript
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

  // turbo run dev --filter=… — gruppo workspace
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
 * Raggruppa servizi npm-workspace in un unico turbo dev quando possibile.
 *
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

  // 1. Workspace product — un turbo-group se più app e turbo disponibile
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

  // 2. Altri servizi (node, npm, turbo-filters) — un processo ciascuno
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
 *
 * @param {string} repoRoot
 * @param {DiscoveredService} service
 * @returns {StartUnit | null}
 */
export function resolveServiceStartUnit(repoRoot, service) {
  // 1. Delega a serviceToStartUnit — cmd/args/cwd per spawn detached
  return serviceToStartUnit(service, repoRoot);
}

/**
 * Discovery completa: manifest o scan monorepo, extra, meta UI, piano avvio.
 *
 * @param {string} repoRoot
 * @param {{
 *   extras?: string[]
 * , withPortal?: boolean
 * }} [options]
 */
export async function discoverRepoServices(repoRoot, options = {}) {
  const resolved     = resolve(repoRoot);
  const { extras = [], withPortal = false } = options;

  // 1. Validazione repo — package.json obbligatorio
  if (!existsSync(join(resolved, "package.json"))) {
    throw new Error(`Repo non valido (package.json assente): ${resolved}`);
  }

  const manifest = await resolveManifestForRepo(resolved);

  /** @type {DiscoveredService[]} */
  let services = [];

  // 2. Servizi da manifest (filtrati) o fallback scan apps/ turbo
  if (manifest?.services?.length) {
    const allowedIds = new Set([
      ...PRODUCT_CORE_IDS
    , ...extras
    , ...(withPortal ? CFG.portalServiceIds.filter((id) => id === "dashboard") : [])
    ]);

    services = manifest.services
      .filter((svc) => typeof svc.id === "string" && allowedIds.has(svc.id))
      .map((svc) => enrichManifestService(resolved, svc))
      .filter((svc) => svc !== null);
  } else {
    services = discoverFromMonorepo(resolved, { extras });
  }

  // 3. Extra richiesti (friendbot, api-documentation, …) non già in lista
  for (const extraId of extras) {
    if (services.some((svc) => svc.id === extraId)) {
      continue;
    }

    const extra = resolveExtraService(resolved, extraId);

    if (extra) {
      services.push(extra);
    }
  }

  // 4. Servizi PortalAdmin opzionali (dashboard, api-documentation)
  if (withPortal) {
    const portalRoot = getPortalRoot();
    const dashboard  = discoverPortalDashboard(portalRoot);

    if (dashboard && !services.some((svc) => svc.id === "dashboard")) {
      services.push(dashboard);
    }

    const apiDocumentation = discoverPortalApiDocumentation(portalRoot);

    if (apiDocumentation && !services.some((svc) => svc.id === "api-documentation")) {
      services.push(apiDocumentation);
    }

    const home = discoverPortalHome(portalRoot);

    if (home && !services.some((svc) => svc.id === "home")) {
      services.push(home);
    }
  }

  // 5. Solo servizi avviabili; arricchimento path/product per UI
  services = services.filter((svc) => svc.start);
  const portalRoot = getPortalRoot();

  services = services.map((svc) => enrichServiceMeta(svc, {
    productRoot : resolved
  , portalRoot
  }));

  // 6. Piano spawn (turbo group + processi singoli)
  const plan = buildStartPlan(resolved, services);

  return {
    repoRoot : resolved
  , manifest : manifest ? "product-manifest" : "monorepo-scan"
  , services
  , plan
  };
}

/**
 * Piano avvio formattato per log CLI (--list, diagnostica).
 *
 * @param {StartUnit[]} plan
 * @returns {string}
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
