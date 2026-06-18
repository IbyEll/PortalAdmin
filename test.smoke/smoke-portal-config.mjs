#!/usr/bin/env node
/**
 * Smoke ADMIN-93 — portal.config, ADMIN keys, close-story normalizeKey.
 */

import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { JIRA_PROJECT_KEYS, REPO_IMPLEMENTATION_SIGNALS } from "../cruscotto.frontend/jira/jira.project.config.overlay.mjs";
import {
  getProjectConfig
, portalProductManifestExists
, resolveProductSeedPath
, resolveProjectOverlayName
} from "../lib/project.config.mjs";
import { getPortalRoot, getProductRepoPath } from "../lib/portal-paths.mjs";
import { JIRA_KEY_RE, scanRepoJiraReferences } from "../lib/function.repo.jira.refs.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const overlay = resolveProjectOverlayName();
const project = getProjectConfig();

const overlayMatchesProject = overlay === project.PRJ_NAME
  || (overlay === "AdminDashBoard" && project.PRJ_NAME === "AdminDashboard");

if (!overlayMatchesProject) {
  console.error("FAIL: PRJ_NAME / overlay incoerenti", { overlay, PRJ_NAME: project.PRJ_NAME });
  process.exit(1);
}

if (!portalProductManifestExists(getPortalRoot())) {
  console.error(`FAIL: product.manifest assente: ${project.PRJ_PRODUCT_MANIFEST}`);
  process.exit(1);
}

if (!existsSync(resolveProductSeedPath(getProductRepoPath()))) {
  console.error(`FAIL: PRJ_SEED assente: ${project.PRJ_SEED}`);
  process.exit(1);
}

if (!JIRA_PROJECT_KEYS.includes(project.PRJ_JIRA_PREFIX)) {
  console.error("FAIL: JIRA_PROJECT_KEYS non include prefisso progetto attivo", {
    expected : project.PRJ_JIRA_PREFIX
  , keys     : JIRA_PROJECT_KEYS
  });
  process.exit(1);
}

if (project.PRJ_JIRA_PREFIX === "ADMIN") {
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
}

const refs = scanRepoJiraReferences();
const sampleRefKey = project.PRJ_JIRA_PREFIX === "ADMIN" ? "ADMIN-88" : "JLO-850";
const sampleRef    = refs.get(sampleRefKey);

if (sampleRef?.length) {
  console.log(`  ${sampleRefKey} refs: ${sampleRef.slice(0, 2).join(", ")}`);
}

const dryKey = project.PRJ_JIRA_PREFIX === "ADMIN" ? "ADMIN-92" : "JLO-850";
const dry    = execFileSync(
  process.execPath
, ["JiraCORE/close-story.mjs", "--key", dryKey, "--dry-run"]
, { cwd: ROOT, encoding: "utf8" }
);

const parsed = JSON.parse(dry);

if (!parsed.ok || !parsed.branch) {
  console.error(`FAIL: close-story --key ${dryKey} --dry-run`, dry);
  process.exit(1);
}

const jiraSample = `${project.PRJ_JIRA_PREFIX}-92`;
const jiraMatched = [...jiraSample.matchAll(JIRA_KEY_RE)].map((m) => m[1]);

if (!jiraMatched.includes(jiraSample)) {
  console.error("FAIL: JIRA_KEY_RE prefisso progetto", { sample: jiraSample, matched: jiraMatched });
  process.exit(1);
}

console.log("OK smoke portal.config");
console.log(`  overlay: ${overlay} (${project.PRJ_JIRA_PREFIX})`);
console.log(`  signals: ${REPO_IMPLEMENTATION_SIGNALS.length}`);
console.log(`  JIRA_PROJECT_KEYS: ${JIRA_PROJECT_KEYS.join(", ")}`);
console.log(`  close-story dry-run branch: ${parsed.branch}`);
