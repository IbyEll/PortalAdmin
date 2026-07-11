#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-07-11 06:55
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-07-11 06:55   by: Cursor
 * ticket refirement: ADMIN-198 / ADMIN-226 Discovery run-all — alias path legacy
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * Alias canonico verso cruscotto.lib/test.run.all.mjs — smoke-run-all e docs usano questo path.
 *
 * Uso:
 *   - node admin.portal.lib/test.run.all.mjs --list
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const impl        = join(PORTAL_ROOT, "cruscotto.lib", "test.run.all.mjs");

const child = spawn(process.execPath, [impl, ...process.argv.slice(2)], {
  cwd   : PORTAL_ROOT
, env   : process.env
, stdio : "inherit"
});

child.on("close", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
