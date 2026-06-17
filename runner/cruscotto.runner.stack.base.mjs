/**
 * Runner generico PortalAdmin — npm/turbo, path repo, utility I/O.
 *
 * Descrizione funzionale:
 *   Perché esiste: run, cleanup e .env nel product repo non devono essere
 *     duplicati in ogni entrypoint né legati a layout monorepo / config product.
 *   A cosa serve: primitivi shell riusabili da cruscotto.runner.stack e script che
 *     eseguono npm nel checkout PRODUCT_REPO_PATH con exit su errore.
 *
 * Consumatori: runner/cruscotto.runner.stack.mjs
 *
 * Export principali:
 *   root, portalRoot, npm, turbo — path product repo e binari spawn
 *   run, runTurbo — spawnSync npm/turbo in root
 *   sleepSync — pausa cross-platform (retry Prisma)
 *   ensureNodeModules, ensureEnvFiles, cleanBuildArtifacts, maybeCleanBuildArtifacts
 *   parseApiStartArgs — flag --help, --no-build, --cleanup
 *
 * Env: PRODUCT_REPO_PATH (via portal-paths)
 * Product-specific: runner/cruscotto.runner.stack.mjs + runner/runner.config.stack.mjs
 */

import "../lib/portal.load.env.mjs";

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

import { getPortalRoot, getProductRepoPath } from "../lib/portal-paths.mjs";

/** Checkout product repo (PRODUCT_REPO_PATH). */
export const root       = getProductRepoPath();
/** Root PortalAdmin — host degli script runner. */
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

  // exit con codice npm — nessun recovery
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

  if (!existsSync(turbo)) {
    console.error("turbo non trovato. Esegui npm install dalla root del repo.");
    process.exit(1);
  }

  const result = spawnSync(turbo, turboArgs, {
    cwd   : root
  , stdio : "inherit"
  });

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
  if (process.platform === "win32") {
    // Windows — Start-Sleep via PowerShell
    spawnSync(
      "powershell"
    , ["-NoProfile", "-Command", `Start-Sleep -Milliseconds ${ms}`]
    , { stdio: "ignore" }
    );
  } else {
    spawnSync("sleep", [String(Math.max(1, Math.ceil(ms / 1000)))], { stdio: "ignore" });
  }
}

/** npm install nella root product se node_modules manca. */
export function ensureNodeModules() {
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
