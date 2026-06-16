#!/usr/bin/env node
/**
 * start_ALL_Services — avvio stack product (Auth + API + Web)
 */

import { spawn } from "node:child_process";
import { join } from "node:path";

import {
  START_DEV_SERVICE_PS1
} from "./runner.config.stack.mjs";
import { syncDatabase } from "../lib/cruscotto-db/script_seed/script_seed-lib.mjs";
import {
  ensureNodeModules
, ensureProductEnvFiles
, getDevServices
, getStackRunnerEntries
, maybeCleanProductArtifacts
, parseApiStartArgs
, portalRoot
, prepareProductRepoForNestApi
, root
} from "./runner.stack.mjs";

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

const totalSteps      = buildStepCount();
let step              = 0;
const ELLA_DIR        = join(portalRoot, "runner");
const SERVICE_ENTRIES = getStackRunnerEntries();

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
  node runner/start_DEV_Service.mjs auth
  node runner/start_DEV_Service.mjs api
  node runner/start_DEV_Service.mjs web
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
      , entry.serviceId
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
  , [mjsPath, entry.serviceId, "--no-build"]
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
  maybeCleanProductArtifacts(true);
}

if (!skipDb) {
  step += 1;
  console.log(`\n[${step}/${totalSteps}] Refresh database (db:push)…`);
  ensureNodeModules();
  ensureProductEnvFiles();
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

for (const svc of getDevServices()) {
  const url = svc.openUrl ?? svc.healthUrl ?? "";

  console.log(`       ${svc.label.padEnd(8)} ${url}`);
}

if (process.platform === "win32") {
  console.log("\nOgni servizio è in una finestra PowerShell separata (Ctrl+C per terminarlo).");
} else {
  console.log("\nServizi avviati in background (processi detached).");
}

console.log("Kill da Utility cruscotto o: node runner/stop_ALL_services.mjs");
