#!/usr/bin/env node
/**
 * Smoke test path resolver (ADMIN-90 DoD).
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  getPortalDataDir
, getPortalRoot
, getProductRepoPath
, getTestScriptDir
, resolveProductRepoPath
} from "../lib/portal-paths.mjs";
import { scanRepoJiraReferences } from "../lib/repo-jira-refs.mjs";
import { buildDevManifest } from "../lib/dev-manifest.mjs";
import { REPORTS_DIR } from "../lib/reporter.mjs";

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

const manifest = buildDevManifest();

if (manifest.productRoot !== product || manifest.portalRoot !== portal) {
  console.error("FAIL: dev-manifest root mismatch");
  process.exit(1);
}

const refs = scanRepoJiraReferences();
const adminKeys = [...refs.keys()].filter((k) => k.startsWith("ADMIN-"));

console.log("OK portal-paths smoke");
console.log(`  portal : ${portal}`);
console.log(`  product: ${product}`);
console.log(`  testScript: ${testScript}`);
console.log(`  reports: ${REPORTS_DIR}`);
console.log(`  jira keys scanned: ${refs.size} (ADMIN-* sample: ${adminKeys.slice(0, 3).join(", ") || "—"})`);

if (resolveProductRepoPath({ required: false }) === null) {
  console.error("FAIL: resolveProductRepoPath optional should succeed");
  process.exit(1);
}
