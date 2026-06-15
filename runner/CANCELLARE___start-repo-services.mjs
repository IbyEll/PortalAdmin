#!/usr/bin/env node
/**
 * Avvia i servizi dev di un repo — discovery automatica da manifest o monorepo.
 *
 * Uso:
 *   node runner/start-repo-services.mjs --repo ../JustLastOne
 *   node runner/start-repo-services.mjs --with-portal
 *     (dashboard :3999 + api-portal :4080 — entrambi PortalAdmin)
 *   node runner/start-repo-services.mjs --all-extras
 *     (product + api-portal + friendBOT + cruscotto)
 *   node runner/start-repo-services.mjs --repo . --list
 *   node runner/start-repo-services.mjs --no-db
 *
 * Env: PRODUCT_REPO_PATH (default repo se --repo omesso)
 */

import "../lib/load-env.mjs";

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  discoverRepoServices
, formatStartPlan
, REPO_EXTRAS_ALL
} from "../lib/repo-service-discovery.mjs";
import { getPortalRoot, getProductRepoPath } from "../lib/portal-paths.mjs";
import { spawnShellOption } from "../lib/spawn-shell.mjs";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

/**
 * @returns {string | null}
 */
function parseRepoArg() {
  const idx = process.argv.indexOf("--repo");

  if (idx === -1 || !process.argv[idx + 1]) {
    return null;
  }

  return process.argv[idx + 1];
}

/**
 * @returns {string[]}
 */
function parseExtrasArg() {
  const idx = process.argv.indexOf("--extras");

  if (idx === -1 || !process.argv[idx + 1]) {
    return [];
  }

  return process.argv[idx + 1]
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

const LIST_ONLY   = process.argv.includes("--list");
const DRY_RUN     = process.argv.includes("--dry-run");
const SKIP_DB     = process.argv.includes("--no-db");
const WITH_PORTAL = process.argv.includes("--with-portal");
const ALL_EXTRAS  = process.argv.includes("--all-extras");

/** @type {import("node:child_process").ChildProcess[]} */
const children = [];

/**
 * @param {string} repoRoot
 */
function ensureNodeModules(repoRoot) {
  if (existsSync(join(repoRoot, "node_modules"))) {
    return;
  }

  console.log("\n=== npm install ===\n");

  const result = spawnSync(npm, ["install"], {
    cwd   : repoRoot
  , stdio : "inherit"
  , shell : process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/**
 * @param {string} repoRoot
 */
function maybeSyncDatabase(repoRoot) {
  if (SKIP_DB) {
    console.log("\n=== db:push saltato (--no-db) ===\n");
    return;
  }

  const pkgPath = join(repoRoot, "package.json");

  if (!existsSync(pkgPath)) {
    return;
  }

  let pkg;

  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch {
    return;
  }

  if (!pkg?.scripts?.["db:push"]) {
    return;
  }

  console.log("\n=== Database sync (db:push) ===\n");

  const result = spawnSync(npm, ["run", "db:push"], {
    cwd   : repoRoot
  , stdio : "inherit"
  , shell : process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/**
 * @param {import("../lib/repo-service-discovery.mjs").StartUnit} unit
 * @param {{ foreground?: boolean }} [opts]
 */
function spawnStartUnit(unit, opts = {}) {
  const { foreground = false } = opts;

  if (unit.kind === "turbo-group" && !existsSync(unit.cmd)) {
    throw new Error(`turbo non trovato in ${unit.cwd} — esegui npm install`);
  }

  console.log(`\n=== Avvio ${unit.label} ===`);
  console.log(`cwd: ${unit.cwd}`);
  console.log(`cmd: ${unit.cmd} ${unit.args.join(" ")}\n`);

  const child = spawn(unit.cmd, unit.args, {
    cwd      : unit.cwd
  , stdio    : foreground ? "inherit" : ["ignore", "pipe", "pipe"]
  , shell    : spawnShellOption(unit.cmd)
  , detached : !foreground
  , env      : process.env
  });

  children.push(child);

  if (!foreground && child.stdout && child.stderr) {
    const prefix = `[${unit.id}] `;

    child.stdout.on("data", (chunk) => {
      process.stdout.write(
        String(chunk)
          .split("\n")
          .filter((line) => line.length > 0)
          .map((line) => `${prefix}${line}`)
          .join("\n")
        + "\n"
      );
    });

    child.stderr.on("data", (chunk) => {
      process.stderr.write(
        String(chunk)
          .split("\n")
          .filter((line) => line.length > 0)
          .map((line) => `${prefix}${line}`)
          .join("\n")
        + "\n"
      );
    });
  }

  child.on("exit", (code, signal) => {
    if (foreground) {
      return;
    }

    if (code && code !== 0) {
      console.error(`[${unit.id}] terminato con codice ${code}`);
    }

    if (signal) {
      console.error(`[${unit.id}] terminato per segnale ${signal}`);
    }
  });

  if (!foreground) {
    child.unref();
  }

  return child;
}

function shutdownChildren() {
  for (const child of children) {
    try {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(child.pid), "/f", "/t"], { stdio: "ignore", shell: true });
      } else {
        child.kill("SIGTERM");
      }
    } catch {
      // ignore
    }
  }
}

async function main() {
  const repoArg  = parseRepoArg();
  const repoRoot = repoArg
    ? join(process.cwd(), repoArg)
    : getProductRepoPath();

  let extras = parseExtrasArg();

  if (ALL_EXTRAS) {
    extras = [...REPO_EXTRAS_ALL];
  }

  const discovery = await discoverRepoServices(repoRoot, {
    extras
  , withPortal : WITH_PORTAL
  });

  console.log("Start repo services");
  console.log(`Repo     : ${discovery.repoRoot}`);
  console.log(`Sorgente : ${discovery.manifest}`);
  console.log(`Servizi  : ${discovery.services.map((svc) => svc.id).join(", ") || "—"}`);

  if (discovery.plan.length === 0) {
    console.error("\nNessun servizio avviabile trovato.");
    console.error("Suggerimenti:");
    console.error("  - aggiungi dev-manifest.json con services[].start");
    console.error("  - oppure usa un monorepo turbo con apps/*/package.json (script dev)");
    process.exit(1);
  }

  console.log(`\nPiano avvio:\n\n${formatStartPlan(discovery.plan)}`);

  const portalNote = WITH_PORTAL || extras.includes("dashboard")
    ? `\nPortalAdmin: ${getPortalRoot()}`
    : "";

  for (const svc of discovery.services) {
    if (svc.openUrl) {
      console.log(`  → ${svc.label}: ${svc.openUrl}`);
    } else if (svc.port) {
      console.log(`  → ${svc.label}: http://localhost:${svc.port}`);
    }
  }

  if (portalNote) {
    console.log(portalNote);
  }

  if (LIST_ONLY || DRY_RUN) {
    return;
  }

  ensureNodeModules(discovery.repoRoot);
  maybeSyncDatabase(discovery.repoRoot);

  const background = discovery.plan.filter((unit) => unit.kind !== "turbo-group");
  const foreground = discovery.plan.find((unit) => unit.kind === "turbo-group")
    ?? discovery.plan[discovery.plan.length - 1];

  for (const unit of background) {
    if (unit === foreground) {
      continue;
    }

    spawnStartUnit(unit, { foreground: false });
  }

  process.on("SIGINT", () => {
    console.log("\n\nArresto servizi…");
    shutdownChildren();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    shutdownChildren();
    process.exit(0);
  });

  spawnStartUnit(foreground, { foreground: true });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
