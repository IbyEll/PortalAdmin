#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TESTSCRIPT ** -- commentato il: 2026-06-23 21:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:05   by: IbyEll
 * modificato il: 2026-06-23 21:05   by: IbyEll
 * ticket refirement: ADMIN-92 run-all discovery --list
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Smoke run-all — discovery --list da PortalAdmin root e REPORTS_DIR.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Verifica che run-all trovi almeno uno script testScript nel product repo attivo.
 *
 *   A cosa serve:
 *   - Spawn runner/run-all.mjs --list e controlla stdout e path reports sotto portal.
 *
 * Generalizzazione:
 *   Si — requireTestScriptDir e env product da overlay PRJ_NAME.
 *
 * Input:
 *   - PRODUCT_REPO_PATH — product con directory testScript
 *
 * Uso:
 *   - node test.smoke/smoke-run-all.mjs
 *
 * Exit code:
 *   0 — almeno 1 script in discovery e REPORTS_DIR valido
 *   1 — exit code child o discovery vuota
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { requireTestScriptDir } from "../lib/portal.paths.resolver.mjs";
import { REPORTS_DIR } from "../lib/reporter.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

requireTestScriptDir();

const child = spawn(process.execPath, ["runner/run-all.mjs", "--list"], {
  cwd       : PORTAL_ROOT
, stdio     : ["ignore", "pipe", "pipe"]
, env       : process.env
});

let stdout = "";
let stderr = "";

child.stdout.on("data", (c) => { stdout += String(c); });
child.stderr.on("data", (c) => { stderr += String(c); });

const code = await new Promise((resolve) => {
  child.on("close", resolve);
});

if (code !== 0) {
  console.error("FAIL smoke run-all --list", stderr || stdout);
  process.exit(1);
}

const match = stdout.match(/\((\d+)\)/);

if (!match || Number(match[1]) < 1) {
  console.error("FAIL smoke run-all: nessuno script discovery", stdout);
  process.exit(1);
}

if (!REPORTS_DIR.includes("PortalAdmin") && !REPORTS_DIR.includes("data")) {
  console.error(`FAIL REPORTS_DIR: ${REPORTS_DIR}`);
  process.exit(1);
}

console.log(`OK smoke run-all — ${match[1]} script, reports → ${REPORTS_DIR}`);
