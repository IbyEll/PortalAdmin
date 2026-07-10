#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TESTSCRIPT ** -- commentato il: 2026-06-23 21:30
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:30   by: IbyEll
 * modificato il: 2026-06-23 21:30   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Suite read-only — test API PortalAdmin con cruscotto già avviato.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Smoke regressione API cruscotto senza eseguire manualmente ogni testscript singolo.
 *
 *   A cosa serve:
 *   - Spawn sequenziale health, portal, jira, cursor test sotto admin.portal.testscript.
 *
 * Generalizzazione:
 *   Si — DASHBOARD_URL e --overlay per istanza cruscotto target.
 *
 * Input:
 *   - DASHBOARD_URL — base HTTP cruscotto (default 127.0.0.1:3999)
 *   - argv --overlay — contesto PRJ_NAME per portal-context
 *
 * Uso:
 *   - node admin.portal.testscript/run-portal-api.mjs --overlay AdminDashBoard
 *
 * Exit code:
 *   0 — tutti gli script figli exit 0
 *   1 — almeno uno script fallito
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PORTAL_API_CRUSCOTTO_SCRIPTS
, PORTAL_API_HOME_SCRIPTS
} from "../admin.portal.lib/portal.api.suite.mjs";
import {
  parseOverlayCli
, printOverlayCliHelp
} from "./lib/portal-context.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));

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

  for (const rel of PORTAL_API_CRUSCOTTO_SCRIPTS) {
    await runScript(rel, extra);
  }

  if (!process.argv.includes("--skip-home")) {
    try {
      for (const rel of PORTAL_API_HOME_SCRIPTS) {
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
