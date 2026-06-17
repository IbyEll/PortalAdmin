/**
 * Runner stack — orchestrazione dev da runner.config.stack + project.config.
 *
 * Descrizione funzionale:
 *   Perché esiste: policy di build, prepare nest/web, avvio servizi e Prisma
 *     dipendono dal monorepo product attivo — non vanno in cruscotto.runner.stack.base generico.
 *   A cosa serve: espone getDevService(), prepareProductRepo(), runDevServiceStart(),
 *     startDevStack() e helper DB/daemon per entrypoint runner e script_seed.
 *
 * Consumatori:
 *   runner/cruscotto.process.start.service.mjs, runner/cruscotto.process.start.all.services.mjs
 *   lib/cruscotto-db/script_seed/script_seed-lib.mjs, init_Database_DEV.mjs
 *
 * Export principali:
 *   getDevService, getDevServices, getStackRunnerEntries — metadati stack da runner.config.stack
 *   prepareProductRepo*, runDevServiceStart, startDevStack — avvio dev
 *   runDbGenerateWithRetry, maybeStartOptionalDaemons — Prisma e daemon dev
 *   root, run, runTurbo — re-export da cruscotto.runner.stack.base
 *
 * Variabili d'ambiente:
 *   PRODUCT_REPO_PATH — root monorepo (via cruscotto.runner.stack.base / portal-paths)
 *   {PRJ_JIRA_PREFIX}_FRIEND_BOT — es. JLO_FRIEND_BOT=0 disabilita daemon opzionali
 *   NODE_ENV=production — skip daemon dev
 *
 * Dipendenze: runner/cruscotto.runner.stack.base.mjs, runner/runner.config.stack.mjs, lib/project.config.mjs,
 *   lib/seed-cli-args.mjs
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { getProjectConfig } from "../lib/project.config.mjs";
import {
  getRunnerConfig
, npmWorkspace
, portFromUrl
, resolveCleanPaths
, resolveDevService
, resolveDevServiceDef
, resolveDevServices
, resolveDevStackFilters
, resolveEnvFiles
, resolveStackRunnerEntries
, resolveWorkspaceBuildOrder
} from "./cruscotto.runner.stack.config.overlay.mjs";
import { parseSeedIds } from "../lib/seed-cli-args.mjs";

import {
  ensureEnvFiles
, ensureNodeModules
, maybeCleanBuildArtifacts
, parseApiStartArgs
, portalRoot
, root
, run
, runTurbo
, sleepSync
, turbo
} from "./cruscotto.runner.stack.base.mjs";

export {
  ensureNodeModules
, maybeCleanBuildArtifacts
, parseApiStartArgs
, portalRoot
, root
, run
, runTurbo
};

const {
  PRJ_NAME
, PRJ_JIRA_PREFIX
, PRJ_DB_NPM_WORKSPACE
, PRJ_NPM_SCOPE
, PRJ_AUTH_HEALTH_URL
, PRJ_API_HEALTH_URL
, PRJ_WEB_OPEN_URL
} = getProjectConfig();

/** @deprecated Usare getDevService("auth") */
export const NEST_API_DEV = {
  get auth() {
    return getDevService("auth");
  }
, get project() {
    return getDevService("api");
  }
};

/** @deprecated Usare getDevService("web") */
export const WEB_DEV = resolveDevService("web");

/**
 * @param {string} id
 * @returns {import("./cruscotto.runner.stack.config.overlay.mjs").ResolvedDevService}
 */
export function getDevService(id) {
  return resolveDevService(id);
}

/**
 * @returns {import("./cruscotto.runner.stack.config.overlay.mjs").ResolvedDevService[]}
 */
export function getDevServices() {
  return resolveDevServices();
}

/**
 * @returns {ReturnType<typeof resolveStackRunnerEntries>}
 */
export function getStackRunnerEntries() {
  return resolveStackRunnerEntries();
}

/** Path .env e clean path da runner.config.stack (wrapper su cruscotto.runner.stack.base). */
export function ensureProductEnvFiles() {
  ensureEnvFiles(resolveEnvFiles());
}

/** Cleanup artefatti da runner.config.stack.cleanPaths se --cleanup. */
export function maybeCleanProductArtifacts(cleanup) {
  maybeCleanBuildArtifacts(cleanup, resolveCleanPaths());
}

/** Rimuove file .tmp bloccati da generate precedenti (Windows). */
export function cleanupPrismaEngineTmpFiles() {
  const clientDir = join(root, "node_modules", ".prisma", "client");

  if (!existsSync(clientDir)) {
    return;
  }

  let removed = 0;

  try {
    // 1. rimuove solo file .tmp nel client Prisma (lock Windows)
    for (const name of readdirSync(clientDir)) {
      if (!/\.tmp/i.test(name)) {
        continue;
      }

      try {
        rmSync(join(clientDir, name), { force: true });
        removed += 1;
      } catch {
        // file ancora in uso — skip
      }
    }
  } catch {
    // directory illeggibile — skip silenzioso
  }

  if (removed > 0) {
    console.log(`  puliti ${removed} file .tmp in node_modules/.prisma/client`);
  }
}

/**
 * @param {string} label
 */
export function runDbGenerateWithRetry(label) {
  if (!PRJ_DB_NPM_WORKSPACE) {
    return;
  }

  const npmArgs  = ["run", "db:generate", "-w", PRJ_DB_NPM_WORKSPACE];
  const attempts = process.platform === "win32" ? 2 : 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    // 2. secondo tentativo su Windows dopo cleanup .tmp e pausa
    if (attempt > 0) {
      console.log("\n=== Prisma generate — secondo tentativo ===\n");
      cleanupPrismaEngineTmpFiles();
      sleepSync(2500);
    } else {
      cleanupPrismaEngineTmpFiles();
      console.log(`\n=== ${label} ===\n`);
    }

    const result = spawnSync(
      process.platform === "win32" ? "npm.cmd" : "npm"
    , npmArgs
    , {
        cwd   : root
      , stdio : "inherit"
      }
    );

    if (result.status === 0) {
      return;
    }

    // exit se ultimo tentativo fallito
    if (attempt >= attempts - 1) {
      process.exit(result.status ?? 1);
    }
  }
}

/** Build workspace in ordine da runner.config.stack.workspaceBuildOrder. */
export function buildWorkspacePackages() {
  for (const step of resolveWorkspaceBuildOrder()) {
    if (step.prismaGen) {
      run(["run", "db:generate", "-w", step.workspace], step.label);
    } else {
      run(["run", "build", "-w", step.workspace], step.label);
    }
  }
}

/**
 * @param {{ workspaces?: string[] | null }} [options]
 */
export function prepareProductRepo(options = {}) {
  const { workspaces = null } = options;

  // 1. prerequisiti comuni — node_modules + .env da runner.config.stack
  ensureNodeModules();
  ensureProductEnvFiles();

  // 2. prepare parziale (web: solo shared/i18n) oppure build order completo
  if (workspaces) {
    for (const pkg of workspaces) {
      const ws = npmWorkspace(PRJ_NPM_SCOPE, pkg);

      run(["run", "build", "-w", ws], `Build ${ws}`);
    }

    return;
  }

  buildWorkspacePackages();
}

/** Dipendenze npm, .env e build workspace prima di nest start --watch. */
export function prepareProductRepoForNestApi() {
  prepareProductRepo();
}

/** Dipendenze npm, .env e build shared/i18n prima di next dev. */
export function prepareProductRepoForWebDev() {
  prepareProductRepo({ workspaces: getRunnerConfig().webPrepareWorkspaces });
}

/**
 * @param {string} workspace
 * @param {string} label
 */
export function runNestApiWorkspaceDev(workspace, label) {
  run(["run", "dev", "-w", workspace], label);
}

/**
 * @param {string} serviceId
 * @param {string} label
 */
export function runDevService(serviceId, label) {
  const svc = getDevService(serviceId);

  run(["run", "dev", "-w", svc.workspace], label);
}

/**
 * @param {string} label
 */
export function runWebWorkspaceDev(label) {
  runDevService("web", label);
}

/** Prepare nest (full) o web (shared/i18n) in base a kind del servizio. */
export function prepareForDevService(serviceId) {
  const svc = getDevService(serviceId);

  if (svc.kind === "web") {
    prepareProductRepoForWebDev();
  } else {
    prepareProductRepoForNestApi();
  }
}

/**
 * Estrae service id da argv (`auth` o `--service auth`).
 *
 * @param {string[]} argv
 * @returns {{ serviceId: string | null, cliArgv: string[] }}
 */
export function parseDevServiceArgv(argv) {
  /** @type {string | null} */
  let serviceId = null;
  const cliArgv   = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--service") {
      serviceId = argv[i + 1] ?? null;
      i++;
      continue;
    }

    // primo argomento posizionale = id servizio (auth | api | web)
    if (!arg.startsWith("-") && !serviceId) {
      serviceId = arg;
      continue;
    }

    cliArgv.push(arg);
  }

  return { serviceId, cliArgv };
}

/**
 * @param {string} serviceId
 * @param {import("./cruscotto.runner.stack.config.overlay.mjs").ResolvedDevService} cfg
 * @param {string} scriptRel
 */
function printDevServiceHelp(serviceId, cfg, scriptRel) {
  const ids     = getDevServices().map((s) => s.id).join(" | ");
  const prepare = cfg.kind === "web"
    ? "npm install, .env e build shared/i18n"
    : "npm install, .env e build workspace";

  console.log(`Uso: node runner/cruscotto.process.start.service.mjs <${ids}> [opzioni]
     node runner/${scriptRel} [opzioni]

Avvia solo ${cfg.label} (${cfg.kind}) su :${cfg.port}.

Opzioni:
  --cleanup     rimuove artefatti compilati prima del prepare (default: no)
  --no-build    salta ${prepare} (avvio rapido)
  --help, -h    questo messaggio

Equivalente:
  npm run dev -w ${cfg.workspace}   (dalla root product, dopo prepare)
`);
}

/**
 * Avvio singolo servizio dev (auth | api | web | … da runner.config.stack).
 *
 * @param {string} serviceId
 * @param {string[]} argv
 * @param {{ scriptRel?: string }} [meta]
 */
export function runDevServiceStart(serviceId, argv, meta = {}) {
  const cfg        = getDevService(serviceId);
  const def        = resolveDevServiceDef(serviceId);
  const opts       = parseApiStartArgs(argv);
  const scriptRel  = meta.scriptRel ?? `cruscotto.process.start.service.mjs ${serviceId}`;
  const totalSteps = opts.cleanup ? 4 : 3;
  let step         = 0;

  if (opts.help) {
    printDevServiceHelp(serviceId, cfg, scriptRel);
    process.exit(0);
  }

  console.log(`start_DEV_Service — ${cfg.label} (${PRJ_NAME})`);
  console.log(`Product: ${root}`);
  console.log(`Portal:  ${portalRoot}`);
  console.log(`Target:  ${cfg.workspace} → :${cfg.port}`);

  // 1. cleanup opzionale prima del prepare
  if (opts.cleanup) {
    step += 1;
    console.log(`\n[${step}/${totalSteps}] Cleanup artefatti compilati…`);
    maybeCleanProductArtifacts(true);
  }

  // 2. prepare nest (full build) o web (shared/i18n) salvo --no-build
  if (!opts.noBuild) {
    step += 1;
    const prepareLabel = cfg.kind === "web"
      ? "Prepare product repo (npm, .env, build shared/i18n)…"
      : "Prepare product repo (npm, .env, build workspace)…";

    console.log(`\n[${step}/${totalSteps}] ${prepareLabel}`);
    prepareForDevService(serviceId);
  } else {
    step += 1;
    console.log(`\n[${step}/${totalSteps}] Prepare saltato (--no-build)`);
  }

  // 3. log endpoint attesi (e servizi correlati da relatedServiceIds)
  step += 1;
  console.log(`\n[${step}/${totalSteps}] Endpoint attesi dopo l'avvio:`);

  if (cfg.kind === "web") {
    console.log(`       UI      ${cfg.openUrl}`);
  } else {
    console.log(`       Health  ${cfg.healthUrl}`);
    console.log(`       Swagger ${cfg.docsUrl}`);
  }

  for (const relatedId of def?.relatedServiceIds ?? []) {
    const related = getDevService(relatedId);

    console.log(`       ${related.label.padEnd(8)} ${related.healthUrl} (servizio correlato)`);
  }

  // 4. avvio npm run dev -w workspace (bloccante)
  step += 1;
  const runLabel = cfg.kind === "web" ? "next dev" : "nest dev";

  console.log(`\n[${step}/${totalSteps}] Avvio ${runLabel} (Ctrl+C per terminare)…\n`);
  runDevService(serviceId, `${cfg.label} — :${cfg.port}`);
}

/**
 * @param {string[]} argv
 */
/** Entrypoint CLI per cruscotto.process.start.service.mjs — parse id e delega a runDevServiceStart. */
export function runDevServiceStartCli(argv) {
  const { serviceId, cliArgv } = parseDevServiceArgv(argv);

  if (!serviceId) {
    const ids = getDevServices().map((s) => s.id).join(", ");

    console.error(`Uso: node runner/cruscotto.process.start.service.mjs <${ids}> [opzioni]`);
    console.error("     node runner/cruscotto.process.start.service.mjs --service <id> [opzioni]");
    process.exit(1);
  }

  runDevServiceStart(serviceId, cliArgv);
}

/**
 * Flag start-dev legacy (cleanup, seed, turbo background).
 *
 * @param {string[]} argv
 */
export function parseStartDevArgs(argv) {
  const allSeeds = parseSeedIds(argv).filter((id) => id !== "db");
  const waitIdx  = argv.findIndex((arg) => arg === "--wait-auth");
  let waitAuthMs = 0;

  if (waitIdx !== -1) {
    const raw = argv[waitIdx + 1];
    waitAuthMs = raw && !raw.startsWith("-") ? Number(raw) : 120_000;
  }

  return {
    help            : argv.includes("--help") || argv.includes("-h")
  , skipClean       : argv.includes("--no-clean")
  , cleanOnly       : argv.includes("--clean-only")
  , skipDb          : argv.includes("--no-db")
  , seedIds         : allSeeds
  , buildOnly       : argv.includes("--build-only")
  , prepareOnly     : argv.includes("--prepare-only")
  , waitAuthMs      : waitAuthMs
  , skipFriendBot   : argv.includes("--no-friend-bot")
  , startBackground : argv.includes("--start-background")
  };
}

export function printStartDevHelp() {
  console.log(`Uso: node runner/start-dev.mjs [opzioni]

Fasi (default: cleanup → build → db:push → avvio stack):

  Cleanup artefatti (dist, .next)
    (default)              esegue cleanup prima del build
    --no-clean             salta cleanup
    --clean-only           solo cleanup, poi esci

  Build workspace
    --build-only           compila senza database né avvio servizi
    --prepare-only         cleanup + build + db:push, senza avvio stack

  Database
    --no-db                salta db:push all'avvio (usa init_Database_DEV.mjs a parte)

  Seed dati funzionali (richiedono stack)
    --seed func            dopo avvio con --start-background --wait-auth
    --seed-func            alias

  Avvio stack
    --no-friend-bot        non avvia daemon opzionali (es. Friend Bot)
    --start-background     turbo dev in background
    --wait-auth [ms]       attende auth+api prima dei seed func

Database dedicato:
  node lib/cruscotto-db/script_seed/init_Database_DEV.mjs --help
  node lib/cruscotto-db/script_seed/run-data-seeds.mjs --seed func --wait-auth
`);
}

export function maybeStartOptionalDaemons() {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  for (const daemon of getRunnerConfig().optionalDaemons) {
    const envKey = `${PRJ_JIRA_PREFIX}${daemon.envDisableSuffix}`;

    if (process.env[envKey] === "0") {
      continue;
    }

    const script = join(root, daemon.scriptRel);

    if (!existsSync(script)) {
      console.warn(`  warn  ${daemon.scriptRel} non trovato — skip ${daemon.id}`);
      continue;
    }

    console.log(`\n=== ${daemon.label} daemon (dev) ===\n`);

    const logDir  = join(root, ".cursor");
    const logPath = join(logDir, `${daemon.id}.log`);

    mkdirSync(logDir, { recursive: true });

    const logFd = openSync(logPath, "a");

    // spawn detached — non blocca lo script chiamante
    const child = spawn(process.execPath, [script], {
      cwd      : root
    , detached : true
    , stdio    : ["ignore", logFd, logFd]
    , env      : process.env
    });

    child.unref();
    console.log(`  avviato  ${daemon.scriptRel} (background)`);
    console.log(`  log      .cursor/${daemon.id}.log`);
  }
}

/** @deprecated Usare maybeStartOptionalDaemons */
export function maybeStartFriendBotDaemon() {
  maybeStartOptionalDaemons();
}

/**
 * @param {{ background?: boolean }} [options]
 */
export function startDevStack(options = {}) {
  const { background = false } = options;
  const runnerCfg              = getRunnerConfig();
  const filters                = resolveDevStackFilters();
  const authPort               = portFromUrl(PRJ_AUTH_HEALTH_URL);
  const apiPort                = portFromUrl(PRJ_API_HEALTH_URL);
  const webPort                = portFromUrl(PRJ_WEB_OPEN_URL);
  const label                  = `Avvio dev stack ${PRJ_NAME} — auth :${authPort}, api :${apiPort}, web :${webPort} (Ctrl+C per uscire)`;

  if (!runnerCfg.useTurbo) {
    console.error("startDevStack — useTurbo disabilitato in runner.config.stack; avvia i servizi singolarmente.");
    process.exit(1);
  }

  // foreground — turbo dev in primo piano (Ctrl+C termina tutto)
  if (!background) {
    runTurbo(
      [
        "run"
      , "dev"
      , ...filters.map((f) => `--filter=${f}`)
      ]
    , label
    );
    return null;
  }

  console.log(`\n=== ${label} (background) ===\n`);

  if (!existsSync(turbo)) {
    console.error("turbo non trovato. Esegui npm install dalla root del repo.");
    process.exit(1);
  }

  const child = spawn(turbo, [
    "run"
  , "dev"
  , ...filters.map((f) => `--filter=${f}`)
  ], {
    cwd   : root
  , stdio : "inherit"
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  return child;
}
