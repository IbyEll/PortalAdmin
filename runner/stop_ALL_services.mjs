#!/usr/bin/env node
/**
 * stop_ALL_services — ferma servizi dev del product stack (porte da dev-manifest).
 * Non termina il cruscotto su :3999 (salvo --include-dashboard).
 *
 * Uso:
 *   node runner/stop_ALL_services.mjs
 *   node runner/stop_ALL_services.mjs --include-dashboard
 */

import "../lib/load-env.mjs";

import { stopRepoServices } from "../server/repo-services-manager.mjs";

const includeDashboard = process.argv.includes("--include-dashboard");

const result = await stopRepoServices({ includeDashboard });

for (const line of result.lines ?? []) {
  const prefix = line.stream === "stderr" ? "ERR " : line.stream === "system" ? ">> " : "   ";
  console.log(`${prefix}${line.text}`);
}

console.log("");
console.log(result.summary);
