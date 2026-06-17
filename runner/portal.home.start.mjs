#!/usr/bin/env node
/**
 * Avvio PortalAdmin — solo pagina HOME (istanzia progetto).
 *
 * Uso:
 *   node runner/start-portal-home.mjs
 *   npm run admin:home
 */

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverPath  = join(PORTAL_ROOT, "server", "portal-home-server.mjs");

const child = spawn(process.execPath, [serverPath], {
  cwd       : PORTAL_ROOT
, env       : process.env
, stdio     : "inherit"
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
