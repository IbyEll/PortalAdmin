#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TESTSCRIPT ** -- commentato il: 2026-06-23 21:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:05   by: IbyEll
 * modificato il: 2026-07-08 17:25   by: IbyEll
 * ticket refirement: ADMIN-90 path resolver e product.manifest · ADMIN-156 rename da smoke-portal-paths
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Smoke paths resolver — root portal, product repo, testScript e manifest.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - DoD ADMIN-90 richiede smoke su path resolver e manifest prima di workflow product.
 *
 *   A cosa serve:
 *   - Verifica getPortalRoot, getProductRepoPath, testScript, REPORTS_DIR e loadProductManifest.
 *
 * Generalizzazione:
 *   Si — dipende da PRODUCT_REPO_PATH e PRJ_TEST_SCRIPT overlay attivo.
 *
 * Input:
 *   - PRODUCT_REPO_PATH — checkout product con package.json e testScript
 *   - PRJ_PRODUCT_MANIFEST — path manifest da project.config
 *
 * Uso:
 *   - node test.smoke/smoke-paths-resolver.mjs
 *
 * Exit code:
 *   0 — tutti i path e manifest validi
 *   1 — almeno un check FAIL
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  getPortalRoot
, getProductRepoPath
, getTestScriptDir
, resolveProductRepoPath
} from "../admin.portal.lib/portal.paths.resolver.mjs";
import { scanRepoJiraReferences } from "../admin.portal.JiraCORE/jira.function.repo.refs.mjs";
import { loadProductManifest, PRODUCT_MANIFEST_PATH } from "../admin.portal.lib/product.manifest.mjs";
import { REPORTS_DIR } from "../admin.portal.lib/reporter.mjs";

const portal = getPortalRoot();

if (!portal.endsWith("PortalAdmin") && !existsSync(join(portal, "package.json"))) {
  console.error("FAIL: getPortalRoot() non punta a PortalAdmin");
  process.exit(1);
}

const product = getProductRepoPath();

if (!existsSync(join(product, "package.json"))) {
  console.error(`FAIL: product repo invalido: ${product}`);
  process.exit(1);
}

const testScript = getTestScriptDir();

if (!existsSync(testScript)) {
  console.error(`FAIL: testScript/ assente in ${product}`);
  process.exit(1);
}

if (!REPORTS_DIR.includes("PortalAdmin") && !REPORTS_DIR.startsWith(portal)) {
  console.error(`FAIL: REPORTS_DIR non sotto portal: ${REPORTS_DIR}`);
  process.exit(1);
}

const manifest = await loadProductManifest();

if (!manifest.requirements || !Array.isArray(manifest.services)) {
  console.error("FAIL: product.manifest.json non valido");
  process.exit(1);
}

if (!PRODUCT_MANIFEST_PATH.startsWith(portal)) {
  console.error(`FAIL: PRODUCT_MANIFEST_PATH non sotto portal: ${PRODUCT_MANIFEST_PATH}`);
  process.exit(1);
}

const refs = scanRepoJiraReferences();
const adminKeys = [...refs.keys()].filter((k) => k.startsWith("ADMIN-"));

console.log("OK paths-resolver smoke");
console.log(`  portal : ${portal}`);
console.log(`  product: ${product}`);
console.log(`  testScript: ${testScript}`);
console.log(`  reports: ${REPORTS_DIR}`);
console.log(`  jira keys scanned: ${refs.size} (ADMIN-* sample: ${adminKeys.slice(0, 3).join(", ") || "—"})`);

if (resolveProductRepoPath({ required: false }) === null) {
  console.error("FAIL: resolveProductRepoPath optional should succeed");
  process.exit(1);
}
