/**
 * Config runner product — overlay per progetto attivo.
 *
 * Descrizione funzionale:
 *   Perché esiste: runner.stack.base resta generico; path clean, build order, stack dev
 *     e daemon opzionali vivono in runner.config.{Progetto}.mjs.
 *   A cosa serve: getRunnerConfig() + resolveDevServices() per entrypoint start_*.
 *
 * Overlay attivo: config.project.{name}.mjs e runner.config.{name}.mjs
 *   con name = resolveProjectOverlayName() (env PRJ_NAME obbligatorio).
 */

import "../lib/portal.load.env.mjs";

import { getProjectConfig, resolveProjectOverlayName } from "../lib/admin/config.project.mjs";

/**
 * Nome file overlay `runner.config.{name}.mjs` — allineato a config.project.
 *
 * @returns {string}
 */
export function resolveRunnerOverlayName() {
  return resolveProjectOverlayName();
}

const overlayName = resolveRunnerOverlayName();

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
 * @param {string} id
 * @returns {ResolvedDevService}
 */
export function resolveDevService(id) {
  const svc = resolveDevServices().find((entry) => entry.id === id);

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
export const START_DEV_SERVICE_MJS = "start_DEV_Service.mjs";
export const START_DEV_SERVICE_PS1 = "start_DEV_Service.ps1";

/**
 * Path clean con PRJ_DB_PACKAGE al posto del path database hardcoded.
 *
 * @param {RunnerConfigValues} [runnerCfg]
 * @returns {string[]}
 */
export function resolveCleanPaths(runnerCfg = getRunnerConfig()) {
  const { PRJ_DB_PACKAGE } = getProjectConfig();

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
  const { PRJ_DB_PACKAGE } = getProjectConfig();

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
