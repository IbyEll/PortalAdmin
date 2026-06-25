/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-18 05:42
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 05:25   by: IbyEll
 * modificato il: 2026-06-18 05:42   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Primitivi npm/turbo — run, env e cleanup nel product repo (base runner stack)
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - run, cleanup e .env nel product repo non devono essere duplicati in ogni entrypoint runner.
 *   - Policy spawn npm/turbo e utility I/O restano fuori da overlay PRJ_NAME e da devStack.
 *
 *   A cosa serve:
 *   - Espone root/portalRoot, run/runTurbo e helper ensure/clean per prepare stack dev.
 *   - Parse flag CLI comuni (--help, --no-build, --cleanup) agli script start_*.
 *
 * Generalizzazione:
 *   Si — nessun path monorepo hardcoded; cwd spawn = PRODUCT_REPO_PATH; liste .env/clean da consumer.
 *
 * Input:
 *   - PRODUCT_REPO_PATH — checkout product (admin.portal.lib/portal.paths.resolver.mjs → root)
 *   - envFiles          — coppie example/target relative a root (passate a ensureEnvFiles)
 *   - cleanPaths        — path dist/.next da rimuovere (passate a cleanBuildArtifacts)
 *   - argv              — slice process.argv per parseApiStartArgs
 *
 * Consumatori:
 *   - cruscotto.frontend/cruscotto.runner.stack.mjs — re-export e prepare/avvio dev
 *   - cruscotto.database/product.database.init.mjs — ensureNodeModules via stack
 *   - cruscotto.database/product.database.seed.run.mjs — run/root via stack
 *
 * Export principali:
 *   - root, portalRoot, npm, turbo — path repo e binari spawn
 *   - run, runTurbo — spawnSync npm/turbo in root con exit su errore
 *   - sleepSync — pausa cross-platform (retry Prisma)
 *   - ensureNodeModules, ensureEnvFiles, cleanBuildArtifacts, maybeCleanBuildArtifacts
 *   - parseApiStartArgs — flag --help, --no-build, --cleanup
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import "../admin.portal.lib/portal.load.env.mjs";

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

import { getPortalRoot, getProductRepoPath } from "../admin.portal.lib/portal.paths.resolver.mjs";

// --- path product e binari spawn (valutati all'import) ---
/** Checkout product repo (PRODUCT_REPO_PATH). */
export const root       = getProductRepoPath();
/** Root PortalAdmin — host degli script runner/cruscotto. */
export const portalRoot = getPortalRoot();
/** Binario npm — .cmd su Windows per spawn senza shell. */
export const npm        = process.platform === "win32" ? "npm.cmd" : "npm";
/** Path turbo locale nel monorepo product. */
export const turbo      = join(
  root
, "node_modules"
, ".bin"
, process.platform === "win32" ? "turbo.cmd" : "turbo"
);

/**
 * Esegue npm nel product repo; exit immediato se status ≠ 0.
 *
 * @param {string[]} npmArgs
 * @param {string} label
 */
export function run(npmArgs, label) {
  console.log(`\n=== ${label} ===\n`);

  // 1. spawn sincrono — stdio ereditato per log build/dev
  const result = spawnSync(npm, npmArgs, {
    cwd   : root
  , stdio : "inherit"
  });

  // 2. exit con codice npm — nessun recovery
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/**
 * Esegue turbo nel product repo; verifica binario prima dello spawn.
 *
 * @param {string[]} turboArgs
 * @param {string} label
 */
export function runTurbo(turboArgs, label) {
  console.log(`\n=== ${label} ===\n`);

  // 1. prerequisito — turbo installato in node_modules/.bin
  if (!existsSync(turbo)) {
    console.error("turbo non trovato. Esegui npm install dalla root del repo.");
    process.exit(1);
  }

  // 2. spawn turbo in root product
  const result = spawnSync(turbo, turboArgs, {
    cwd   : root
  , stdio : "inherit"
  });

  // 3. exit su fallimento build
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/**
 * Pausa sincrona cross-platform (retry Prisma su Windows).
 *
 * @param {number} ms
 */
export function sleepSync(ms) {
  // 1. branch OS — PowerShell Start-Sleep vs sleep Unix
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

/**
 * npm install nella root product se node_modules manca.
 */
export function ensureNodeModules() {
  // 1. skip se dipendenze già presenti
  if (!existsSync(join(root, "node_modules"))) {
    run(["install"], "npm install");
  }
}

/**
 * Copia .env.example → .env per ogni coppia (path relativi a root).
 *
 * @param {{ example: string, target: string }[]} envFiles
 */
export function ensureEnvFiles(envFiles) {
  console.log("\n=== Verifica file .env ===\n");

  for (const { example, target } of envFiles) {
    const examplePath = join(root, example);
    const targetPath  = join(root, target);

    // 1. .env presente — non sovrascrivere config locale
    if (existsSync(targetPath)) {
      console.log(`  ok  ${target}`);
      continue;
    }

    // 2. example assente — warn e prossima coppia
    if (!existsSync(examplePath)) {
      console.warn(`  warn  ${example} non trovato`);
      continue;
    }

    // 3. copia example → target
    copyFileSync(examplePath, targetPath);
    console.log(`  creato  ${target} da ${example}`);
  }
}

/**
 * Rimuove ricorsivamente path relativi a root (dist, .next, …).
 *
 * @param {string[]} cleanPaths
 */
export function cleanBuildArtifacts(cleanPaths) {
  console.log("\n=== Cleanup artefatti compilati ===\n");

  for (const rel of cleanPaths) {
    const abs = join(root, rel);

    // 1. path assente — skip silenzioso
    if (!existsSync(abs)) {
      console.log(`  skip  ${rel} (assente)`);
      continue;
    }

    // 2. rm ricorsivo — warn su errore I/O
    try {
      rmSync(abs, { recursive: true, force: true });
      console.log(`  rimosso  ${rel}`);
    } catch (err) {
      console.warn(`  warn  ${rel}: ${err.message}`);
    }
  }
}

/**
 * Cleanup condizionato da flag CLI --cleanup.
 *
 * @param {boolean} cleanup
 * @param {string[]} cleanPaths
 */
export function maybeCleanBuildArtifacts(cleanup, cleanPaths) {
  if (cleanup) {
    cleanBuildArtifacts(cleanPaths);
  }
}

/**
 * Flag comuni entrypoint start_* (singolo servizio e stack).
 *
 * @param {string[]} argv
 * @returns {{ help: boolean, noBuild: boolean, cleanup: boolean }}
 */
export function parseApiStartArgs(argv) {
  return {
    help    : argv.includes("--help") || argv.includes("-h")
  , noBuild : argv.includes("--no-build")
  , cleanup : argv.includes("--cleanup")
  };
}
