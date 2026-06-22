#!/usr/bin/env node
/**
 * Suite read-only — esegue i test API PortalAdmin (cruscotto già avviato).
 *
 * Uso:
 *   node admin.portal.testscript/run-portal-api.mjs --overlay JustLastOne
 *   DASHBOARD_URL=http://127.0.0.1:3999 node admin.portal.testscript/run-portal-api.mjs
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseOverlayCli
, printOverlayCliHelp
} from "./lib/portal-context.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));

const CRUSCOTTO_SCRIPTS = [
  "health/test.api.health.mjs"
, "health/test.api.status.mjs"
, "portal/test.portal.projects.mjs"
, "portal/test.portal.instance.mjs"
, "cruscotto/test.cruscotto.project.mjs"
, "scripts/test.scripts.catalog.mjs"
, "meta/test.tecnici.meta.mjs"
, "meta/test.funzionali.meta.mjs"
, "dev/test.dev.requirements.mjs"
, "dev/test.dev.services.mjs"
, "repo/test.repo.services.discover.mjs"
, "repo/test.repo.services.status.mjs"
, "jira/test.jira.backlog.mjs"
, "cursor/test.api.cursor.agent.mjs"
, "cursor/test.cruscotto.backlog.push.mjs"
];

const HOME_SCRIPTS = [
  "home/test.portal.home.health.mjs"
, "home/test.portal.home.projects.mjs"
];

/**
 * @param {string} rel
 * @param {string[]} extraArgs
 */
function runScript(rel, extraArgs) {
  return new Promise((resolve, reject) => {
    const abs   = join(ROOT, rel);
    const child = spawn(process.execPath, [abs, ...extraArgs], {
      cwd   : join(ROOT, "..")
    , env   : process.env
    , stdio : "inherit"
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${rel} exit ${code ?? 1}`));
    });
  });
}

async function main() {
  const cli = parseOverlayCli(process.argv);

  if (cli.help) {
    printOverlayCliHelp("run-portal-api");
    return;
  }

  const extra = [];

  if (cli.overlay) {
    extra.push("--overlay", cli.overlay);
  }

  if (cli.base) {
    extra.push("--base", cli.base);
  }

  if (cli.port) {
    extra.push("--port", String(cli.port));
  }

  for (const rel of CRUSCOTTO_SCRIPTS) {
    await runScript(rel, extra);
  }

  if (!process.argv.includes("--skip-home")) {
    try {
      for (const rel of HOME_SCRIPTS) {
        await runScript(rel, []);
      }
    } catch (err) {
      console.warn("HOME skip:", err instanceof Error ? err.message : err);
    }
  }

  console.log("OK run-portal-api");
}

main().catch((err) => {
  console.error("FAIL run-portal-api:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
