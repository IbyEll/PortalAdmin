#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-18 05:06
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 05:06   by: IbyEll
 * modificato il: 2026-06-18 05:06   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                 Avvio stack dev product — cleanup, build, db:push, turbo e seed opzionali.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Un solo comando per preparare e avviare lo stack JustLastOne da terminale o npm run start:dev.
 *   - Evita di ricordare l'ordine cleanup → build → db:push → turbo → seed funzionali.
 *
 *   A cosa serve:
 *   - Orchestrazione fasi dev: artefatti, workspace build, sync DB, daemon opzionali, stack in foreground/background.
 *   - Seed dati (--seed func) dopo attesa auth/api quando lo stack è in background.
 *
 * Generalizzazione:
 *   Si — overlay e path product da PRODUCT_REPO_PATH / PRJ_NAME; flag CLI per saltare fasi.
 *
 * Input:
 *   - argv — parseStartDevArgs (runner/cruscotto.runner.stack.mjs)
 *   - PRODUCT_REPO_PATH — root repo product per build e turbo
 *   - PRJ_NAME — overlay runner.config e seed catalog
 *
 * Uso:
 *   - node runner/start-dev.mjs
 *   - node runner/start-dev.mjs --prepare-only
 *   - node runner/start-dev.mjs --start-background --seed func --wait-auth
 *
 * Flag CLI:
 *   --help, -h           riepilogo fasi ed exit 0
 *   --clean-only         solo cleanup artefatti, poi esci
 *   --no-clean           salta cleanup iniziale
 *   --build-only         build workspace senza DB né avvio stack
 *   --prepare-only       cleanup + build + db:push, senza avvio stack
 *   --no-db              salta db:push
 *   --no-friend-bot      non avvia daemon opzionali (friendBOT)
 *   --start-background   turbo dev in background
 *   --wait-auth [ms]     attende auth+api prima dei seed func
 *   --seed func          seed funzionali (richiede --start-background)
 *
 * Variabili d'ambiente:
 *   PRODUCT_REPO_PATH — repo product (portal.load.env)
 *   PRJ_NAME          — overlay PROJECT_* / runner.config
 *   NODE_ENV          — production salta daemon opzionali
 *
 * npm (se applicabile):
 *   npm run start:dev
 *   npm run dev:prepare
 *
 * Prerequisiti:
 *   - Product repo con package.json e workspace turbo/nest
 *   - cruscotto.database/product.database.seed.run.mjs per sync e seed
 *
 * Consumatori:
 *   - package.json start:dev, dev:prepare
 *   - cruscotto.frontend/cruscotto.home.js — hint UI tab Servizi
 *
 * Dipendenze:
 *   - runner/cruscotto.runner.stack.mjs — parseStartDevArgs, prepareProductRepo, startDevStack
 *   - cruscotto.database/product.database.seed.run.mjs — syncDatabase, runDataSeeds, waitForDevStack
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import "../lib/portal.load.env.mjs";

import {
  runDataSeeds
, seedIdsNeedStack
, syncDatabase
, waitForDevStack
} from "../cruscotto.database/product.database.seed.run.mjs";

import {
  maybeCleanProductArtifacts
, maybeStartOptionalDaemons
, parseStartDevArgs
, prepareProductRepo
, printStartDevHelp
, startDevStack
} from "../cruscotto.frontend/cruscotto.runner.stack.mjs";

// 1. Parse argv — help, fasi opzionali, seed e background
const opts = parseStartDevArgs(process.argv.slice(2));

if (opts.help) {
  printStartDevHelp();
  process.exit(0);
}

// 2. Solo cleanup — exit senza build né stack
if (opts.cleanOnly) {
  maybeCleanProductArtifacts(true);
  process.exit(0);
}

// 3. Cleanup artefatti (default) prima del build
if (!opts.skipClean) {
  maybeCleanProductArtifacts(true);
}

// 4. Build workspace product (pnpm/npm workspace)
prepareProductRepo();

if (opts.buildOnly) {
  process.exit(0);
}

// 5. db:push Prisma sul product repo (salvo --no-db)
if (!opts.skipDb) {
  syncDatabase();
}

if (opts.prepareOnly) {
  process.exit(0);
}

// 6. Daemon opzionali dev (es. friendBOT) se non disabilitati
if (!opts.skipFriendBot) {
  maybeStartOptionalDaemons();
}

const runSeedsAfterStack = opts.seedIds.length > 0;

if (runSeedsAfterStack && !opts.startBackground) {
  console.error("I seed richiedono --start-background (stack in background) oppure usa product.database.seed.run.call.mjs a parte.");
  process.exit(1);
}

// 7. Avvio stack turbo/nest — foreground o background
startDevStack({ background: opts.startBackground });

if (!runSeedsAfterStack) {
  if (!opts.startBackground) {
    process.exit(0);
  }

  return;
}

// 8. Seed func — attesa auth/api poi runDataSeeds
let waitAuthMs = opts.waitAuthMs;

if (waitAuthMs <= 0 && seedIdsNeedStack(opts.seedIds)) {
  waitAuthMs = 120_000;
  console.log("\n=== Seed func richiede stack — attesa auth/api ===\n");
}

try {
  if (waitAuthMs > 0) {
    await waitForDevStack({ timeoutMs: waitAuthMs });
  }

  await runDataSeeds(opts.seedIds);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
