import "../lib/load-env.mjs";

import { spawnSync, spawn } from "node:child_process";
import {
  copyFileSync
, existsSync
, mkdirSync
, openSync
, readFileSync
, readdirSync
, rmSync
} from "node:fs";
import { join } from "node:path";

import { getPortalRoot, getProductRepoPath } from "../lib/portal-paths.mjs";

/** Checkout JustLastOne (PRODUCT_REPO_PATH). */
export const root = getProductRepoPath();

/** Root PortalAdmin — host di questi script. */
export const portalRoot = getPortalRoot();

export const npm   = process.platform === "win32" ? "npm.cmd" : "npm";
export const turbo = join(
  root
, "node_modules"
, ".bin"
, process.platform === "win32" ? "turbo.cmd" : "turbo"
);

/** Cartelle build da rimuovere prima di un nuovo avvio. */
export const CLEAN_PATHS = [
  "packages/shared/dist"
, "packages/i18n/dist"
, "packages/auth-kit/dist"
, "packages/database/dist"
, "apps/api/dist"
, "apps/authentication/dist"
, "apps/web/.next"
];

/** Workspace packages compilati prima di api/auth/web. */
export const WORKSPACE_BUILD_ORDER = [
  { workspace: "@justlastone/shared", label: "Build @justlastone/shared" }
, { workspace: "@justlastone/i18n", label: "Build @justlastone/i18n" }
, { workspace: "@justlastone/auth-kit", label: "Build @justlastone/auth-kit" }
, {
    workspace : "@justlastone/database"
  , label     : "Prisma generate @justlastone/database"
  , prismaGen : true
  }
, { workspace: "@justlastone/database", label: "Build @justlastone/database" }
];

export const DEV_FILTERS = [
  "@justlastone/auth"
, "@justlastone/api"
, "@justlastone/web"
];

/** Copia .env.example → .env se manca. */
export const ENV_FILES = [
  { example: "packages/database/.env.example", target: "packages/database/.env" }
, { example: "apps/api/.env.example", target: "apps/api/.env" }
, { example: "apps/authentication/.env.example", target: "apps/authentication/.env" }
, { example: "apps/web/.env.example", target: "apps/web/.env" }
];

export function run(npmArgs, label) {
  console.log(`\n=== ${label} ===\n`);

  const result = spawnSync(npm, npmArgs, {
    cwd   : root
  , stdio : "inherit"
  , shell : process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/**
 * @param {number} ms
 */
function sleepSync(ms) {
  if (process.platform === "win32") {
    spawnSync(
      "powershell"
    , ["-NoProfile", "-Command", `Start-Sleep -Milliseconds ${ms}`]
    , { stdio: "ignore" }
    );
  } else {
    spawnSync("sleep", [String(Math.max(1, Math.ceil(ms / 1000)))], { stdio: "ignore" });
  }
}

/** Rimuove file .tmp bloccati da generate precedenti (Windows). */
export function cleanupPrismaEngineTmpFiles() {
  const clientDir = join(root, "node_modules", ".prisma", "client");

  if (!existsSync(clientDir)) {
    return;
  }

  let removed = 0;

  try {
    for (const name of readdirSync(clientDir)) {
      if (!/\.tmp/i.test(name)) {
        continue;
      }

      try {
        rmSync(join(clientDir, name), { force: true });
        removed += 1;
      } catch {
        // ancora in uso
      }
    }
  } catch {
    // ignore
  }

  if (removed > 0) {
    console.log(`  puliti ${removed} file .tmp in node_modules/.prisma/client`);
  }
}

/**
 * @param {string} label
 */
export function runDbGenerateWithRetry(label) {
  const npmArgs  = ["run", "db:generate", "-w", "@justlastone/database"];
  const attempts = process.platform === "win32" ? 2 : 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      console.log("\n=== Prisma generate — secondo tentativo ===\n");
      cleanupPrismaEngineTmpFiles();
      sleepSync(2500);
    } else {
      cleanupPrismaEngineTmpFiles();
      console.log(`\n=== ${label} ===\n`);
    }

    const result = spawnSync(npm, npmArgs, {
      cwd   : root
    , stdio : "inherit"
    , shell : process.platform === "win32"
    });

    if (result.status === 0) {
      return;
    }

    if (attempt >= attempts - 1) {
      process.exit(result.status ?? 1);
    }
  }
}

export function runTurbo(turboArgs, label) {
  console.log(`\n=== ${label} ===\n`);

  if (!existsSync(turbo)) {
    console.error("turbo non trovato. Esegui npm install dalla root del repo.");
    process.exit(1);
  }

  const result = spawnSync(turbo, turboArgs, {
    cwd   : root
  , stdio : "inherit"
  , shell : process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/** Metadati web Next.js avviabile singolarmente dal product repo. */
export const WEB_DEV = {
  workspace : "@justlastone/web"
, label     : "Web"
, port      : 3000
, openUrl   : "http://localhost:3000/it"
, healthUrl : "http://localhost:3000/it"
};

/** Metadati API NestJS avviabili singolarmente dal product repo. */
export const NEST_API_DEV = {
  auth : {
    workspace : "@justlastone/auth"
  , label     : "API Auth"
  , port      : 4001
  , docsUrl   : "http://localhost:4001/api/v1/docs"
  , healthUrl : "http://localhost:4001/api/v1/health"
  }
, project : {
    workspace : "@justlastone/api"
  , label     : "API Project"
  , port      : 4000
  , docsUrl   : "http://localhost:4000/api/v1/docs"
  , healthUrl : "http://localhost:4000/api/v1/health"
  }
};

/**
 * @param {string[]} argv
 */
export function parseApiStartArgs(argv) {
  return {
    help    : argv.includes("--help") || argv.includes("-h")
  , noBuild : argv.includes("--no-build")
  , cleanup : argv.includes("--cleanup")
  };
}

/**
 * @param {boolean} cleanup
 */
export function maybeCleanBuildArtifacts(cleanup) {
  if (!cleanup) {
    return;
  }

  cleanBuildArtifacts();
}

/** Dipendenze npm, .env e build workspace prima di nest start --watch. */
export function prepareProductRepoForNestApi() {
  ensureNodeModules();
  ensureEnvFiles();
  buildWorkspacePackages();
}

/** Dipendenze npm, .env e build shared/i18n prima di next dev. */
export function prepareProductRepoForWebDev() {
  ensureNodeModules();
  ensureEnvFiles();
  run(["run", "build", "-w", "@justlastone/shared"], "Build @justlastone/shared");
  run(["run", "build", "-w", "@justlastone/i18n"], "Build @justlastone/i18n");
}

/**
 * @param {string} workspace
 * @param {string} label
 */
export function runNestApiWorkspaceDev(workspace, label) {
  run(["run", "dev", "-w", workspace], label);
}

/**
 * @param {string} label
 */
export function runWebWorkspaceDev(label) {
  run(["run", "dev", "-w", WEB_DEV.workspace], label);
}

export function cleanBuildArtifacts() {
  console.log("\n=== Cleanup artefatti compilati ===\n");

  for (const rel of CLEAN_PATHS) {
    const abs = join(root, rel);

    if (!existsSync(abs)) {
      console.log(`  skip  ${rel} (assente)`);
      continue;
    }

    try {
      rmSync(abs, { recursive: true, force: true });
      console.log(`  rimosso  ${rel}`);
    } catch (err) {
      console.warn(`  warn  ${rel}: ${err.message}`);
    }
  }
}

export function ensureEnvFiles() {
  console.log("\n=== Verifica file .env ===\n");

  for (const { example, target } of ENV_FILES) {
    const examplePath = join(root, example);
    const targetPath  = join(root, target);

    if (existsSync(targetPath)) {
      console.log(`  ok  ${target}`);
      continue;
    }

    if (!existsSync(examplePath)) {
      console.warn(`  warn  ${example} non trovato`);
      continue;
    }

    copyFileSync(examplePath, targetPath);
    console.log(`  creato  ${target} da ${example}`);
  }
}

export function ensureNodeModules() {
  if (!existsSync(join(root, "node_modules"))) {
    run(["install"], "npm install");
  }
}

export function buildWorkspacePackages() {
  for (const step of WORKSPACE_BUILD_ORDER) {
    if (step.prismaGen) {
      run(["run", "db:generate", "-w", step.workspace], step.label);
    } else {
      run(["run", "build", "-w", step.workspace], step.label);
    }
  }
}

export function syncDatabase() {
  run(["run", "db:push"], "Database sync (db:push)");
}

/**
 * @returns {boolean}
 */
export function productDatabaseFileExists() {
  const files = resolveSqliteDbFiles();

  return Boolean(files[0] && existsSync(files[0]));
}

/**
 * db:push solo se dev.db non esiste ancora (es. prima seed senza reset).
 */
export function ensureProductDatabaseFile() {
  if (productDatabaseFileExists()) {
    return;
  }

  console.log("\n=== dev.db assente — creazione schema (db:push) ===\n");
  syncDatabase();
}

export function seedDatabase() {
  run(["run", "db:seed"], "Database seed (db:seed)");
}

/** Script di alimentazione dati opzionali (oltre a prisma seed). */
export const DATA_SEED_SCRIPTS = {
  db: {
    id         : "db"
  , label      : "Prisma seed (host/player)"
  , needsStack : false
  , run        : () => seedDatabase()
  }
, func: {
    id         : "func"
  , label      : "Utenti funzionali — test-seed-utenti.mjs"
  , needsStack : true
  , script     : "testScript/funzionali/test-seed-utenti.mjs"
  }
};

const DEFAULT_AUTH_HEALTH = "http://localhost:4001/api/v1/health";
const DEFAULT_API_HEALTH  = "http://localhost:4000/api/v1/health";

/**
 * @param {string} url
 * @param {number} timeoutMs
 */
async function probeHealth(url, timeoutMs) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });

      if (res.ok) {
        return true;
      }
    } catch {
      // retry
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return false;
}

/**
 * @param {{ timeoutMs?: number }} [options]
 */
export async function waitForDevStack(options = {}) {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const authUrl   = process.env.AUTH_HEALTH_URL ?? DEFAULT_AUTH_HEALTH;
  const apiUrl    = process.env.API_HEALTH_URL ?? DEFAULT_API_HEALTH;

  console.log(`\n=== Attesa stack dev (auth + api) — max ${Math.round(timeoutMs / 1000)}s ===\n`);

  const authOk = await probeHealth(authUrl, timeoutMs);

  if (!authOk) {
    throw new Error(`Auth non raggiungibile: ${authUrl}`);
  }

  console.log(`  ok  auth`);

  const apiOk = await probeHealth(apiUrl, Math.max(5000, timeoutMs - 5000));

  if (!apiOk) {
    throw new Error(`API non raggiungibile: ${apiUrl}`);
  }

  console.log(`  ok  api`);
}

/**
 * @param {string} relScript
 */
function runNodeSeedScript(relScript) {
  const abs = join(root, relScript);

  if (!existsSync(abs)) {
    throw new Error(`Script non trovato: ${relScript}`);
  }

  console.log(`\n=== ${relScript} ===\n`);

  const result = spawnSync(process.execPath, [abs], {
    cwd   : root
  , stdio : "inherit"
  , env   : process.env
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/**
 * @param {string[]} seedIds
 */
export async function runDataSeeds(seedIds) {
  const unique = [...new Set(seedIds.filter(Boolean))];

  for (const id of unique) {
    const entry = DATA_SEED_SCRIPTS[id];

    if (!entry) {
      console.warn(`  warn  seed sconosciuto: ${id} — disponibili: ${Object.keys(DATA_SEED_SCRIPTS).join(", ")}`);
      continue;
    }

    console.log(`\n=== Data seed: ${entry.label} ===`);

    if (entry.run) {
      entry.run();
      continue;
    }

    if (entry.script) {
      runNodeSeedScript(entry.script);
    }
  }
}

/**
 * @param {string[]} argv
 * @returns {string[]}
 */
export function parseSeedIds(argv) {
  /** @type {string[]} */
  const ids = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--db-seed" || arg === "--seed-db") {
      ids.push("db");
      continue;
    }

    if (arg === "--seed-func" || arg === "--seed-funcionali") {
      ids.push("func");
      continue;
    }

    if (arg === "--seed" || arg.startsWith("--seed=")) {
      const inline = arg.startsWith("--seed=") ? arg.slice("--seed=".length) : argv[i + 1];

      if (!arg.startsWith("--seed=")) {
        i++;
      }

      if (inline) {
        ids.push(
          ...inline
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
        );
      }
    }
  }

  return ids;
}

/**
 * @param {string[]} argv
 */
export function parseDbDevArgs(argv) {
  const reset = argv.includes("--reset")
    || argv.includes("--db-reset")
    || argv.includes("--db-force");
  const seed  = argv.includes("--seed") || argv.includes("--db-seed");
  const push  = argv.includes("--push") || argv.includes("--db-push");

  return {
    help      : argv.includes("--help") || argv.includes("-h")
  , reset
  , seed
  , pushOnly  : push && !reset && !seed
  };
}

/**
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
    help           : argv.includes("--help") || argv.includes("-h")
  , skipClean      : argv.includes("--no-clean")
  , cleanOnly      : argv.includes("--clean-only")
  , skipDb         : argv.includes("--no-db")
  , seedIds        : allSeeds
  , buildOnly      : argv.includes("--build-only")
  , prepareOnly    : argv.includes("--prepare-only")
  , waitAuthMs     : waitAuthMs
  , skipFriendBot  : argv.includes("--no-friend-bot")
  , startBackground: argv.includes("--start-background")
  };
}

/**
 * Path assoluto del file SQLite da DATABASE_URL (packages/database).
 */
export function resolveSqliteDbFiles() {
  const envPath = join(root, "packages", "database", ".env");
  let databaseUrl = "file:./dev.db";

  if (existsSync(envPath)) {
    const text = readFileSync(envPath, "utf8");
    const match = text.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);

    if (match?.[1]) {
      databaseUrl = match[1].trim();
    }
  }

  let rel = databaseUrl.replace(/^file:/, "").replace(/^\.\//, "");

  if (!rel.endsWith(".db")) {
    rel = "dev.db";
  }

  const prismaDir = join(root, "packages", "database", "prisma");
  const dbFile    = join(prismaDir, rel);
  const suffixes  = ["", "-journal", "-wal", "-shm"];

  return suffixes.map((suffix) => `${dbFile}${suffix}`);
}

export function resetDatabase() {
  console.log("\n=== Database reset (drop SQLite + generate + push) ===\n");

  for (const abs of resolveSqliteDbFiles()) {
    if (!existsSync(abs)) {
      console.log(`  skip  ${abs.replace(root + "\\", "").replace(root + "/", "")} (assente)`);
      continue;
    }

    try {
      rmSync(abs, { force: true });
      console.log(`  rimosso  ${abs.replace(root + "\\", "").replace(root + "/", "")}`);
    } catch (err) {
      console.warn(`  warn  ${abs}: ${err.message}`);
    }
  }

  runDbGenerateWithRetry("Prisma generate dopo reset");
  run(["run", "db:push", "-w", "@justlastone/database"], "Database create (db:push)");
}

/**
 * @param {{ dbReset?: boolean, dbSeed?: boolean }} options
 */
export function runDatabasePhase(options = {}) {
  const { dbReset = false, dbSeed = false } = options;

  if (dbReset) {
    resetDatabase();
  } else if (dbSeed) {
    ensureProductDatabaseFile();
  }

  if (dbSeed) {
    seedDatabase();
  }
}

export function printDbDevHelp() {
  console.log(`Uso: node ellaStartScript/init_Database_DEV.mjs [opzioni]

Operazioni sul database SQLite del product repo (packages/database/prisma):

  (default)              nessuna operazione — usa un flag esplicito sotto
  --push, --db-push      db:push — allinea schema (crea dev.db se assente)
  --reset, --db-reset    elimina dev.db (+ journal/wal/shm) e ricrea schema
  --seed, --db-seed      npm run db:seed (host@ / player@); push solo se dev.db manca
  --reset --seed         delete & create + seed

Esempi:
  node ellaStartScript/init_Database_DEV.mjs --push
  node ellaStartScript/init_Database_DEV.mjs --reset
  node ellaStartScript/init_Database_DEV.mjs --seed
  node ellaStartScript/init_Database_DEV.mjs --reset --seed
`);
}

export function printStartDevHelp() {
  console.log(`Uso: node ellaStartScript/start-dev.mjs [opzioni]

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
    --no-friend-bot        non avvia il daemon Friend Bot
    --start-background     turbo dev in background
    --wait-auth [ms]       attende auth+api prima dei seed func

Database dedicato:
  node ellaStartScript/init_Database_DEV.mjs --help
  node ellaStartScript/run-data-seeds.mjs --seed func --wait-auth

Esempi:
  node ellaStartScript/start-dev.mjs --clean-only
  node ellaStartScript/start-dev.mjs --prepare-only
  node ellaStartScript/start-dev.mjs --no-db
  node ellaStartScript/init_Database_DEV.mjs --reset --seed
  node ellaStartScript/run-data-seeds.mjs --seed func --wait-auth 180
`);
}

export function printDataSeedsHelp() {
  console.log(`Uso: node ellaStartScript/run-data-seeds.mjs --seed <id>[,<id>...]

Script disponibili:
  db    Prisma seed — host@ / player@ (changeme123)
  func  testScript/funzionali/test-seed-utenti.mjs (12 utenti, richiede auth :4001)

Opzioni:
  --wait-auth [ms]   attende health auth+api prima di eseguire (default 120000 se flag senza valore)
  --help             questo messaggio
`);
}

export function maybeStartFriendBotDaemon() {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  if (process.env.JLO_FRIEND_BOT === "0") {
    return;
  }

  const script = join(root, "testScript", "funzionali", "friend-bot.mjs");

  if (!existsSync(script)) {
    console.warn("  warn  friend-bot.mjs non trovato — skip daemon");
    return;
  }

  console.log("\n=== Friend Bot daemon (dev) ===\n");

  const logDir  = join(root, ".cursor");
  const logPath = join(logDir, "friend-bot.log");

  mkdirSync(logDir, { recursive: true });

  const logFd = openSync(logPath, "a");

  const child = spawn(process.execPath, [script], {
    cwd      : root
  , detached : true
  , stdio    : ["ignore", logFd, logFd]
  , env      : process.env
  });

  child.unref();
  console.log("  avviato  testScript/funzionali/friend-bot.mjs (background)");
  console.log(`  log      .cursor/friend-bot.log`);
}

export function startDevStack(options = {}) {
  const { background = false } = options;
  const label = "Avvio dev stack — auth :4001, api :4000, web :3000 (Ctrl+C per uscire)";

  if (!background) {
    runTurbo(
      [
        "run"
      , "dev"
      , ...DEV_FILTERS.map((f) => `--filter=${f}`)
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
  , ...DEV_FILTERS.map((f) => `--filter=${f}`)
  ], {
    cwd   : root
  , stdio : "inherit"
  , shell : process.platform === "win32"
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  return child;
}
