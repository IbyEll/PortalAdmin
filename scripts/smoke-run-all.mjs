#!/usr/bin/env node
/**
 * Smoke ADMIN-92 — run-all discovery da PortalAdmin root.
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { requireTestScriptDir } from "../lib/portal-paths.mjs";
import { REPORTS_DIR } from "../lib/reporter.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

requireTestScriptDir();

const child = spawn(process.execPath, ["runner/JustLastOne___run-all.mjs", "--list"], {
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
