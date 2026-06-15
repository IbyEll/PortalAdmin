#!/usr/bin/env node
/**
 * start_ALL_Services — avvio stack product (Auth + API + Web)
 *
 * Servizi:
 *   start_API_Auth.ps1     → @justlastone/auth  :4001
 *   start_API_Project.ps1  → @justlastone/api   :4000
 *   start_WEB.ps1          → @justlastone/web   :3000
 *
 * Uso:
 *   node runner/start_ALL_Services.mjs
 *   node runner/start_ALL_Services.mjs --cleanup
 *   node runner/start_ALL_Services.mjs --no-build
 *   node runner/start_ALL_Services.mjs --no-db
 *   node runner/start_ALL_Services.mjs --prepare-only
 *   node runner/start_ALL_Services.mjs --help
 *
 * Env:
 *   PRODUCT_REPO_PATH — root monorepo JustLastOne (default da PortalAdmin)
 */

import { spawn } from "node:child_process";
import { join } from "node:path";

import {
  NEST_API_DEV
, WEB_DEV
, ensureEnvFiles
, ensureNodeModules
, maybeCleanBuildArtifacts
, parseApiStartArgs
, portalRoot
, prepareProductRepoForNestApi
, root
, syncDatabase
} from "../ellaStartScript/lib.mjs";

const opts        = parseApiStartArgs(process.argv.slice(2));
const prepareOnly = process.argv.includes("--prepare-only");
const skipDb      = process.argv.includes("--no-db");

function buildStepCount() {
  let count = 2;

  if (opts.cleanup) {
    count += 1;
  }

  if (!skipDb) {
    count += 1;
  }

  count += 1;

  return count;
}

const totalSteps = buildStepCount();
let step         = 0;

const ELLA_DIR = join(portalRoot, "runner");

const SERVICE_ENTRIES = [
  {
    ps1   : "start_API_Auth.ps1"
  , mjs   : "start_API_Auth.mjs"
  , label : NEST_API_DEV.auth.label
  , port  : NEST_API_DEV.auth.port
  }
, {
    ps1   : "start_API_Project.ps1"
  , mjs   : "start_API_Project.mjs"
  , label : NEST_API_DEV.project.label
  , port  : NEST_API_DEV.project.port
  }
, {
    ps1   : "start_WEB.ps1"
  , mjs   : "start_WEB.mjs"
  , label : WEB_DEV.label
  , port  : WEB_DEV.port
  }
];

if (opts.help) {
  console.log(`Uso: node runner/start_ALL_Services.mjs [opzioni]

Avvia Auth, API dominio e Web in processi separati (su Windows: finestre PowerShell).

Opzioni:
  --cleanup        rimuove artefatti compilati prima del prepare (default: no)
  --no-db          salta refresh database (db:push) prima dell'avvio (default: eseguito)
  --no-build       salta prepare condiviso; i singoli servizi partono con -NoBuild
  --prepare-only   cleanup / db / prepare, senza avviare i servizi
  --help, -h       questo messaggio

Database (default):
  init_Database_DEV — db:push (allinea schema Prisma) prima del prepare

Singoli servizi:
  node runner/start_API_Auth.mjs
  node runner/start_API_Project.mjs
  node runner/start_WEB.mjs
`);
  process.exit(0);
}

/**
 * @param {{ ps1: string, mjs: string }} entry
 */
function spawnServiceEntry(entry) {
  if (process.platform === "win32") {
    const ps1Path = join(ELLA_DIR, entry.ps1);

    return spawn(
      "powershell.exe"
    , [
        "-NoExit"
      , "-ExecutionPolicy"
      , "Bypass"
      , "-File"
      , ps1Path
      , "-NoBuild"
      ]
    , {
        cwd      : portalRoot
      , detached : true
      , stdio    : "ignore"
      , env      : {
          ...process.env
        , PRODUCT_REPO_PATH: root
        }
      }
    );
  }

  const mjsPath = join(ELLA_DIR, entry.mjs);

  return spawn(
    process.execPath
  , [mjsPath, "--no-build"]
  , {
      cwd      : portalRoot
    , detached : true
    , stdio    : "ignore"
    , env      : {
        ...process.env
      , PRODUCT_REPO_PATH: root
      }
    }
  );
}

console.log("start_ALL_Services — stack Auth + API + Web");
console.log(`Product: ${root}`);
console.log(`Portal:  ${portalRoot}`);

if (opts.cleanup) {
  step += 1;
  console.log(`\n[${step}/${totalSteps}] Cleanup artefatti compilati…`);
  maybeCleanBuildArtifacts(true);
}

if (!skipDb) {
  step += 1;
  console.log(`\n[${step}/${totalSteps}] Refresh database (db:push)…`);
  ensureNodeModules();
  ensureEnvFiles();
  syncDatabase();
} else {
  step += 1;
  console.log(`\n[${step}/${totalSteps}] Refresh database saltato (--no-db)`);
}

if (!opts.noBuild) {
  step += 1;
  console.log(`\n[${step}/${totalSteps}] Prepare product repo condiviso (npm, .env, build workspace)…`);
  prepareProductRepoForNestApi();
} else {
  step += 1;
  console.log(`\n[${step}/${totalSteps}] Prepare saltato (--no-build)`);
}

if (prepareOnly) {
  console.log("\nPrepare completato (--prepare-only).");
  console.log("Avvio stack: node runner/start_ALL_Services.mjs --no-build");
  process.exit(0);
}

step += 1;
console.log(`\n[${step}/${totalSteps}] Avvio servizi (prepare già fatto → -NoBuild su ciascuno)…`);

for (const entry of SERVICE_ENTRIES) {
  const child  = spawnServiceEntry(entry);
  const target = process.platform === "win32" ? entry.ps1 : entry.mjs;

  child.unref();

  console.log(`  ${entry.label} (:${entry.port}) ← ${target}${child.pid ? ` · PID ${child.pid}` : ""}`);
}

step += 1;
console.log(`\n[${step}/${totalSteps}] Endpoint attesi:`);
console.log(`       Auth    ${NEST_API_DEV.auth.healthUrl}`);
console.log(`       API     ${NEST_API_DEV.project.healthUrl}`);
console.log(`       Web     ${WEB_DEV.openUrl}`);

if (process.platform === "win32") {
  console.log("\nOgni servizio è in una finestra PowerShell separata (Ctrl+C per terminarlo).");
} else {
  console.log("\nServizi avviati in background (processi detached).");
}

console.log("Kill da Utility cruscotto o: node runner/stop_ALL_services.mjs");
