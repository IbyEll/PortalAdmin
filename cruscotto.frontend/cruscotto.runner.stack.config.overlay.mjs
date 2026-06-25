/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-18 05:50
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 05:42   by: IbyEll
 * modificato il: 2026-06-18 05:50   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Config runner product — risolve overlay runner.config per stack dev, build e servizi.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - cruscotto.runner.stack.base resta generico; path clean, build order, devStack e daemon
 *     opzionali sono definiti in PROJECT_NOME/runner.config.NOME.mjs per ogni overlay product.
 *
 *   A cosa serve:
 *   - Carica RUNNER_CONFIG_VALUES dall'overlay attivo ed espone funzioni resolveDevServices,
 *     resolveCleanPaths e simili per stack.mjs e stack.probe.
 *   - Mappa devStack in ResolvedDevService con porte e URL health da project.config.
 *
 * Generalizzazione:
 *   Si — overlay dinamico via PRJ_NAME e import da PROJECT_NOME/runner.config.NOME.mjs.
 *
 * Input:
 *   - PRJ_NAME — nome overlay (resolveProjectOverlayName da env)
 *   - PRJ_DB_PACKAGE, PRJ_NPM_SCOPE, URL health auth/api/web — da getProjectConfig()
 *   - RUNNER_CONFIG_VALUES — export da runner.config overlay del progetto attivo
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.runner.stack.mjs — prepare, avvio servizi, turbo filters
 *   - cruscotto.frontend/cruscotto.runner.stack.probe.mjs — resolveDevServices per health
 *   - cruscotto.frontend/cruscotto.process.start.all.services.mjs — resolveStackRunnerEntries
 *
 * Export principali:
 *   - getRunnerConfig — cache config overlay
 *   - resolveDevServices, resolveDevService, resolveDevServiceDef — metadati servizi dev
 *   - resolveWorkspaceBuildOrder, resolveCleanPaths, resolveEnvFiles — prepare monorepo
 *   - resolveDevStackFilters, resolveStackRunnerEntries — avvio stack e spawn CLI
 *   - npmWorkspace, portFromUrl, docsUrlFromHealth — helper path e URL
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import "../admin.portal.lib/portal.load.env.mjs";

import { getProjectConfig, resolveProjectOverlayName } from "../admin.portal.lib/project.config.mjs";

/**
 * Nome file overlay runner.config.NOME.mjs — allineato a project.config.
 *
 * @returns {string}
 */
export function resolveRunnerOverlayName() {
  return resolveProjectOverlayName();
}

const overlayName = resolveRunnerOverlayName();

// 1. Import dinamico — carica RUNNER_CONFIG_VALUES da PROJECT_NOME/runner.config.NOME.mjs
let RUNNER_CONFIG_VALUES;

try {
  ({ RUNNER_CONFIG_VALUES } = await import(`../PROJECT_${overlayName}/runner.config.${overlayName}.mjs`));
} catch (err) {
  const notFound = err instanceof Error && "code" in err && err.code === "ERR_MODULE_NOT_FOUND";
  const hint     = notFound ? ` Crea PROJECT_${overlayName}/runner.config.${overlayName}.mjs.` : "";

  throw new Error(`runner.config.stack — overlay "${overlayName}" non caricabile.${hint}`, { cause: err });
}

/**
 * @typedef {{
 *   pkg             : string
 *   prismaGen?      : boolean
 *   useDbWorkspace? : boolean
 * }} WorkspaceBuildStep
 */

/**
 * @typedef {{
 *   id         : string
 *   pkg        : string
 *   label      : string
 *   kind       : "nest" | "web"
 *   healthFrom?         : "auth" | "api"
 *   openFrom?           : "web"
 *   relatedServiceIds?  : string[]
 * }} DevStackServiceDef
 */

/**
 * @typedef {{
 *   id               : string
 *   scriptRel        : string
 *   envDisableSuffix : string
 *   label            : string
 * }} OptionalDaemonDef
 */

/**
 * @typedef {{
 *   useTurbo             : boolean
 *   cleanPaths           : string[]
 *   workspaceBuildOrder  : WorkspaceBuildStep[]
 *   envFiles             : { example: string, target: string }[]
 *   webPrepareWorkspaces : string[]
 *   devStack             : DevStackServiceDef[]
 *   optionalDaemons      : OptionalDaemonDef[]
 * }} RunnerConfigValues
 */

/**
 * @typedef {{
 *   workspace : string
 *   label     : string
 *   prismaGen?: boolean
 * }} ResolvedBuildStep
 */

/**
 * @typedef {{
 *   id        : string
 *   workspace : string
 *   label     : string
 *   kind      : "nest" | "web"
 *   port      : number
 *   healthUrl?: string
 *   docsUrl?  : string
 *   openUrl?  : string
 * }} ResolvedDevService
 */

/** @type {RunnerConfigValues | null} */
let cached = null;

/**
 * @returns {RunnerConfigValues}
 */
export function getRunnerConfig() {
  // 1. Cache singleton — shallow copy RUNNER_CONFIG_VALUES al primo accesso
  if (!cached) {
    cached = { ...RUNNER_CONFIG_VALUES };
  }

  return cached;
}

/**
 * @param {string} scope
 * @param {string} pkg
 * @returns {string}
 */
export function npmWorkspace(scope, pkg) {
  return `${scope}/${pkg}`;
}

/**
 * @param {string} url
 * @returns {number}
 */
export function portFromUrl(url) {
  const parsed = new URL(url);

  return parsed.port ? Number(parsed.port) : (parsed.protocol === "https:" ? 443 : 80);
}

/**
 * @param {string} healthUrl
 * @returns {string}
 */
export function docsUrlFromHealth(healthUrl) {
  return healthUrl.replace(/\/health\/?$/, "/docs");
}

/**
 * @param {RunnerConfigValues} runnerCfg
 * @returns {ResolvedBuildStep[]}
 */
export function resolveWorkspaceBuildOrder(runnerCfg = getRunnerConfig()) {
  // 1. Mappa step — workspace npm da scope/pkg o PRJ_DB_NPM_WORKSPACE se useDbWorkspace
  const prj = getProjectConfig();

  return runnerCfg.workspaceBuildOrder.map((step) => {
    const workspace = step.useDbWorkspace
      ? prj.PRJ_DB_NPM_WORKSPACE
      : npmWorkspace(prj.PRJ_NPM_SCOPE, step.pkg);
    const label     = step.prismaGen
      ? `Prisma generate ${workspace}`
      : `Build ${workspace}`;

    return {
      workspace
    , label
    , prismaGen: Boolean(step.prismaGen)
    };
  });
}

/**
 * @param {RunnerConfigValues} [runnerCfg]
 * @returns {ResolvedDevService[]}
 */
export function resolveDevServices(runnerCfg = getRunnerConfig()) {
  // 1. devStack → ResolvedDevService — porte e URL da PRJ_AUTH_HEALTH_URL, openUrl web
  const prj    = getProjectConfig();
  const health = {
    auth : prj.PRJ_AUTH_HEALTH_URL
  , api  : prj.PRJ_API_HEALTH_URL
  , web  : prj.PRJ_WEB_OPEN_URL
  };

  return runnerCfg.devStack.map((def) => {
    const workspace = npmWorkspace(prj.PRJ_NPM_SCOPE, def.pkg);
    const base      = {
      id        : def.id
    , workspace
    , label     : def.label
    , kind      : def.kind
    , port      : 0
    };

    if (def.kind === "nest" && def.healthFrom) {
      const healthUrl = health[def.healthFrom];

      return {
        ...base
      , port      : portFromUrl(healthUrl)
      , healthUrl
      , docsUrl   : docsUrlFromHealth(healthUrl)
      };
    }

    if (def.kind === "web" && def.openFrom) {
      const openUrl = health[def.openFrom];

      return {
        ...base
      , port      : portFromUrl(openUrl)
      , openUrl
      , healthUrl : openUrl
      };
    }

    return base;
  });
}

/**
 * Alias legacy (web | auth | api) quando l'overlay usa id diversi (es. dashboard).
 *
 * @param {string} id
 * @param {ResolvedDevService[]} services
 * @param {RunnerConfigValues} runnerCfg
 * @returns {ResolvedDevService | undefined}
 */
function resolveDevServiceAlias(id, services, runnerCfg) {
  if (id === "web") {
    return services.find((entry) => entry.id === "web")
      ?? services.find((entry) => entry.kind === "web");
  }

  if (id === "auth") {
    return services.find((entry) => entry.id === "auth")
      ?? services.find((entry) => {
        const def = runnerCfg.devStack.find((row) => row.id === entry.id);

        return def?.kind === "nest" && def.healthFrom === "auth";
      });
  }

  if (id === "api") {
    return services.find((entry) => entry.id === "api")
      ?? services.find((entry) => {
        const def = runnerCfg.devStack.find((row) => row.id === entry.id);

        return def?.kind === "nest" && def.healthFrom === "api";
      });
  }

  return undefined;
}

/**
 * @param {string} id
 * @returns {ResolvedDevService}
 */
export function resolveDevService(id) {
  // 1. Lookup id — alias web/auth/api se overlay usa id product-specific (es. dashboard)
  const runnerCfg = getRunnerConfig();
  const services  = resolveDevServices(runnerCfg);
  const svc         = services.find((entry) => entry.id === id)
    ?? resolveDevServiceAlias(id, services, runnerCfg);

  if (!svc) {
    throw new Error(`runner.config.stack — servizio dev sconosciuto: ${id}`);
  }

  return svc;
}

/**
 * Definizione grezza da runner.config.stack (es. relatedServiceIds).
 *
 * @param {string} id
 * @param {RunnerConfigValues} [runnerCfg]
 * @returns {DevStackServiceDef | undefined}
 */
export function resolveDevServiceDef(id, runnerCfg = getRunnerConfig()) {
  return runnerCfg.devStack.find((entry) => entry.id === id);
}

/** Script CLI generico avvio singolo servizio dev. */
export const START_DEV_SERVICE_MJS = "cruscotto.process.start.service.mjs";
export const START_DEV_SERVICE_PS1 = "cruscotto.process.start.service.ps1";

/**
 * Path clean con PRJ_DB_PACKAGE al posto del path database hardcoded.
 *
 * @param {RunnerConfigValues} [runnerCfg]
 * @returns {string[]}
 */
export function resolveCleanPaths(runnerCfg = getRunnerConfig()) {
  // 1. Sostituisce path database hardcoded con PRJ_DB_PACKAGE dall'overlay
  const { PRJ_DB_PACKAGE } = getProjectConfig();

  if (!PRJ_DB_PACKAGE?.trim()) {
    return [...runnerCfg.cleanPaths];
  }

  return runnerCfg.cleanPaths.map((rel) => (
    rel === "packages/database/dist" ? `${PRJ_DB_PACKAGE}/dist` : rel
  ));
}

/**
 * Env files con path database da config_project.
 *
 * @param {RunnerConfigValues} [runnerCfg]
 * @returns {{ example: string, target: string }[]}
 */
export function resolveEnvFiles(runnerCfg = getRunnerConfig()) {
  // 1. Riscrive path packages/database/* con PRJ_DB_PACKAGE da project.config
  const { PRJ_DB_PACKAGE } = getProjectConfig();

  if (!PRJ_DB_PACKAGE?.trim()) {
    return [...runnerCfg.envFiles];
  }

  return runnerCfg.envFiles.map((entry) => {
    if (entry.example.startsWith("packages/database/")) {
      const suffix = entry.example.slice("packages/database".length);

      return {
        example : `${PRJ_DB_PACKAGE}${suffix}`
      , target  : `${PRJ_DB_PACKAGE}${entry.target.slice("packages/database".length)}`
      };
    }

    return entry;
  });
}

/**
 * Workspace turbo filter per startDevStack.
 *
 * @returns {string[]}
 */
export function resolveDevStackFilters() {
  return resolveDevServices().map((svc) => svc.workspace);
}

/**
 * Entry spawn per process.start.all.services — ordine devStack.
 *
 * @param {RunnerConfigValues} [runnerCfg]
 * @returns {Array<{ id: string, serviceId: string, ps1?: string, mjs: string, label: string, port: number }>}
 */
export function resolveStackRunnerEntries(runnerCfg = getRunnerConfig()) {
  const services = resolveDevServices(runnerCfg);

  return services.map((svc) => ({
    id        : svc.id
  , serviceId : svc.id
  , ps1       : START_DEV_SERVICE_PS1
  , mjs       : START_DEV_SERVICE_MJS
  , label     : svc.label
  , port      : svc.port
  }));
}
