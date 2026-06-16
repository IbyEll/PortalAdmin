#!/usr/bin/env node
/**
 * Smoke ADMIN-93 — portal.config, ADMIN keys, close-story normalizeKey.
 */

import { existsSync } from "node:fs";
import { JIRA_PROJECT_KEYS, REPO_IMPLEMENTATION_SIGNALS } from "../portal.config.mjs";
import { getProjectConfig, portalDevManifestExists, resolveProductSeedPath, resolveProjectOverlayName } from "../lib/config.project.mjs";
import { getPortalRoot, getProductRepoPath } from "../lib/portal-paths.mjs";
import { JIRA_KEY_RE, scanRepoJiraReferences } from "../lib/repo-jira-refs.mjs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const project = getProjectConfig();

if (resolveProjectOverlayName() !== "JustLastOne" || project.PRJ_REPO !== "JustLastOne" || project.PRJ_JIRA_PREFIX !== "JLO") {
  console.error("FAIL: overlay JustLastOne — atteso JustLastOne/JLO", resolveProjectOverlayName(), project);
  process.exit(1);
}

if (!portalDevManifestExists(getPortalRoot())) {
  console.error(`FAIL: dev-manifest assente: ${project.PRJ_DEV_MANIFEST}`);
  process.exit(1);
}

if (!existsSync(resolveProductSeedPath(getProductRepoPath()))) {
  console.error(`FAIL: PRJ_SEED assente: ${project.PRJ_SEED}`);
  process.exit(1);
}

if (!JIRA_PROJECT_KEYS.includes("JLO") || !JIRA_PROJECT_KEYS.includes("ADMIN")) {
  console.error("FAIL: JIRA_PROJECT_KEYS", JIRA_PROJECT_KEYS);
  process.exit(1);
}

const adminSignal = REPO_IMPLEMENTATION_SIGNALS.find((s) => s.key === "ADMIN-81");

if (!adminSignal) {
  console.error("FAIL: ADMIN-81 missing from REPO_IMPLEMENTATION_SIGNALS");
  process.exit(1);
}

const hasAdminPath = adminSignal.paths.every((p) => !p.startsWith("Admin/"));

if (!hasAdminPath) {
  console.error("FAIL: Admin/ prefix in ADMIN-81 paths", adminSignal.paths);
  process.exit(1);
}

for (const rel of adminSignal.paths) {
  if (!existsSync(join(ROOT, rel))) {
    console.error(`FAIL: ADMIN-81 path missing in portal: ${rel}`);
    process.exit(1);
  }
}

const refs = scanRepoJiraReferences();
const productRefKey = "ADMIN-88";
const productRef = refs.get(productRefKey);

if (!productRef?.length) {
  console.error(`FAIL: scan did not find ${productRefKey} in product repo`);
  process.exit(1);
}

if (![... "ADMIN-92 JLO-850".matchAll(JIRA_KEY_RE)].map((m) => m[1]).includes("ADMIN-92")) {
  console.error("FAIL: JIRA_KEY_RE ADMIN");
  process.exit(1);
}

const dry = execFileSync(
  process.execPath
, ["scripts/close-story.mjs", "--key", "ADMIN-92", "--dry-run"]
, { cwd: ROOT, encoding: "utf8" }
);

const parsed = JSON.parse(dry);

if (!parsed.ok || !parsed.branch) {
  console.error("FAIL: close-story --key ADMIN-81 --dry-run", dry);
  process.exit(1);
}

console.log("OK smoke portal.config");
console.log(`  signals: ${REPO_IMPLEMENTATION_SIGNALS.length} (ADMIN-81 paths: ${adminSignal.paths.join(", ")})`);
console.log(`  ${productRefKey} refs: ${productRef.slice(0, 2).join(", ")}`);
console.log(`  close-story dry-run branch: ${parsed.branch}`);
