#!/usr/bin/env node

/**

 * Setup dev JustLastOne — cleanup, build, db:push opzionale, avvio stack.

 *

 * Uso:

 *   node ellaStartScript/start-dev.mjs

 *   node ellaStartScript/start-dev.mjs --help

 *

 * Database (script dedicato):

 *   node ellaStartScript/db-dev.mjs --reset --seed

 *

 * Cleanup:

 *   node ellaStartScript/start-dev.mjs --clean-only

 *

 * Prep senza avvio servizi:

 *   node ellaStartScript/start-dev.mjs --prepare-only

 *

 * Seed funzionali (stack avviato):

 *   node ellaStartScript/run-data-seeds.mjs --seed func --wait-auth

 *

 * Variabili:

 *   JLO_FRIEND_BOT=0   disabilita daemon Friend Bot

 */



import {

  buildWorkspacePackages

, cleanBuildArtifacts

, DATA_SEED_SCRIPTS

, ensureEnvFiles

, ensureNodeModules

, maybeStartFriendBotDaemon

, parseStartDevArgs

, portalRoot

, printStartDevHelp

, root

, runDataSeeds

, syncDatabase

, startDevStack

, waitForDevStack

} from "./lib.mjs";



const opts = parseStartDevArgs(process.argv.slice(2));



// 1. Help

if (opts.help) {

  printStartDevHelp();

  process.exit(0);

}



console.log("Ella — avvio JustLastOne (web + api + auth)");

console.log(`Product: ${root}`);

console.log(`Portal:  ${portalRoot}`);



// 2. Solo cleanup

if (opts.cleanOnly) {

  cleanBuildArtifacts();

  process.exit(0);

}



// 3. Dipendenze e artefatti

ensureNodeModules();



if (!opts.skipClean) {

  cleanBuildArtifacts();

} else {

  console.log("\n=== Cleanup saltato (--no-clean) ===");

}



ensureEnvFiles();

buildWorkspacePackages();



// 4. Solo build

if (opts.buildOnly) {

  console.log("\nBuild completata (--build-only). Avvio manuale:");

  console.log("  node_modules/.bin/turbo run dev --filter=@justlastone/auth --filter=@justlastone/api --filter=@justlastone/web");

  console.log("  node ellaStartScript/serve-api-portal.mjs  →  API Portal (PortalAdmin) http://localhost:4080");

  console.log("  node ellaStartScript/db-dev.mjs --reset --seed");

  console.log("  node ellaStartScript/run-data-seeds.mjs --seed func --wait-auth");

  process.exit(0);

}



// 5. db:push leggero (reset/seed → db-dev.mjs)

if (!opts.skipDb) {

  syncDatabase();

} else {

  console.log("\n=== Database saltato (--no-db) ===");

}



const stackSeeds = opts.seedIds.filter((id) => DATA_SEED_SCRIPTS[id]?.needsStack);



// 6. Prepare senza avvio stack

if (opts.prepareOnly) {

  if (stackSeeds.length > 0) {

    console.log("\n=== Seed che richiedono stack (func) ===");

    console.log("  Avvia i servizi, poi:");

    console.log(`  node ellaStartScript/run-data-seeds.mjs --seed ${stackSeeds.join(",")} --wait-auth`);

  }



  console.log("\nPrepare completato (--prepare-only). Avvio stack:");

  console.log("  node ellaStartScript/start-dev.mjs --no-clean --no-db");

  console.log("Database reset/seed:");

  console.log("  node ellaStartScript/db-dev.mjs --reset --seed");

  process.exit(0);

}



console.log("\nAPI Portal (PortalAdmin, config da PRODUCT_REPO_PATH): node ellaStartScript/serve-api-portal.mjs → http://localhost:4080");



// 7. Avvio stack dev

if (!opts.skipFriendBot) {

  maybeStartFriendBotDaemon();

}



const needsWait  = stackSeeds.length > 0 && opts.waitAuthMs > 0;

const background = opts.startBackground || needsWait;



if (needsWait && !opts.startBackground) {

  console.warn("\n  warn  --seed func: uso --start-background oppure run-data-seeds.mjs dopo l'avvio\n");

}



const child = startDevStack({ background });



if (background) {

  if (needsWait) {

    await waitForDevStack({ timeoutMs: opts.waitAuthMs });

    await runDataSeeds(stackSeeds);

  }



  if (child) {

    await new Promise((resolve) => {

      child.on("exit", () => resolve(undefined));

    });

  }

}


