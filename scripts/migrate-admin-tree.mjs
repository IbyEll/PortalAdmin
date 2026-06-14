#!/usr/bin/env node
/**
 * Copia tree Admin/ da JustLastOne → PortalAdmin (ADMIN-109).
 */

import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN_SRC   = process.env.PRODUCT_REPO_PATH
  ? join(process.env.PRODUCT_REPO_PATH, "Admin")
  : join(PORTAL_ROOT, "..", "JustLastOne", "Admin");

/** @type {ReadonlySet<string>} */
const SKIP_NAMES = new Set([
  "node_modules"
, ".env"
, "desktop.ini"
]);

/** @type {ReadonlySet<string>} */
const PRESERVE_LIB = new Set([
  "portal-paths.mjs"
, "catalog.mjs"
, "repo-jira-refs.mjs"
]);

/**
 * @param {string} src
 * @param {string} dest
 */
function copyTree(src, dest) {
  if (!existsSync(src)) {
    throw new Error(`Sorgente assente: ${src}`);
  }

  mkdirSync(dest, { recursive: true });

  for (const name of readdirSync(src)) {
    if (SKIP_NAMES.has(name)) {
      continue;
    }

    const from = join(src, name);
    const to   = join(dest, name);
    const st   = statSync(from);

    if (st.isDirectory()) {
      copyTree(from, to);
      continue;
    }

    cpSync(from, to, { force: true });
  }
}

if (!existsSync(ADMIN_SRC)) {
  console.error(`Admin sorgente non trovato: ${ADMIN_SRC}`);
  process.exit(1);
}

for (const dir of ["server", "cruscotto", "runner", "report", "export", "scripts"]) {
  copyTree(join(ADMIN_SRC, dir), join(PORTAL_ROOT, dir));
  console.log(`copiato ${dir}/`);
}

mkdirSync(join(PORTAL_ROOT, "lib"), { recursive: true });

for (const name of readdirSync(join(ADMIN_SRC, "lib"))) {
  if (PRESERVE_LIB.has(name)) {
    console.log(`skip lib/${name} (preservato ADMIN-90)`);
    continue;
  }

  const from = join(ADMIN_SRC, "lib", name);
  const to   = join(PORTAL_ROOT, "lib", name);
  const st   = statSync(from);

  if (st.isDirectory()) {
    copyTree(from, to);
  } else {
    cpSync(from, to, { force: true });
  }

  console.log(`copiato lib/${name}`);
}

console.log("migrate-admin-tree: completato");
