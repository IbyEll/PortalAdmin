#!/usr/bin/env node
/**
 * Sostituisce prefissi Admin/ → root PortalAdmin (post-migrazione ADMIN-91).
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @type {ReadonlySet<string>} */
const SKIP_DIRS = new Set([
  "node_modules"
, ".git"
]);

/** @type {ReadonlySet<string>} */
const TEXT_EXT = new Set([
  ".mjs"
, ".js"
, ".json"
, ".html"
, ".css"
, ".md"
, ".mdc"
]);

/** @type {ReadonlySet<string>} */
const SKIP_FILES = new Set([
  "fix-admin-prefix.mjs"
, "migrate-admin-tree.mjs"
]);

const REPLACEMENTS = [
  ["Admin/data/", "data/"]
, ["Admin/cruscotto/", "cruscotto/"]
, ["Admin/server/", "server/"]
, ["Admin/lib/", "lib/"]
, ["Admin/runner/", "runner/"]
, ["Admin/scripts/", "scripts/"]
, ["Admin/export/", "export/"]
, ["Admin/report/", "report/"]
, ["Admin/.env", ".env"]
, ["node Admin/server/dashboard-server.mjs", "npm run admin:dashboard"]
, ['join(REPO_ROOT, "Admin", "data", "reports")', "join(getPortalReportsDir())"]
, ['join(REPO_ROOT, "Admin", "cruscotto", "dev-manifest.json")', 'join(getPortalRoot(), "cruscotto", "dev-manifest.json")']
];

/**
 * @param {string} dir
 * @param {string[]} acc
 */
function walk(dir, acc) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) {
      continue;
    }

    const full = join(dir, name);
    const st   = statSync(full);

    if (st.isDirectory()) {
      walk(full, acc);
      continue;
    }

    if (SKIP_FILES.has(name)) {
      continue;
    }

    const ext = extname(name).toLowerCase();

    if (TEXT_EXT.has(ext)) {
      acc.push(full);
    }
  }
}

/** @type {string[]} */
const files = [];
walk(PORTAL_ROOT, files);

let changed = 0;

for (const file of files) {
  let text = readFileSync(file, "utf8");
  let next = text;

  for (const [from, to] of REPLACEMENTS) {
    next = next.split(from).join(to);
  }

  if (next !== text) {
    writeFileSync(file, next, "utf8");
    changed += 1;
  }
}

console.log(`fix-admin-prefix: ${changed} file aggiornati`);
