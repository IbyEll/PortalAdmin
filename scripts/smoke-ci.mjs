#!/usr/bin/env node
/**
 * Smoke ADMIN-95 — CI aggregate (paths, config, workflow, run-all, dashboard).
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveProductRepoPath } from "../lib/portal-paths.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const STEPS = [
  "scripts/smoke-portal-paths.mjs"
, "scripts/smoke-portal-config.mjs"
, "scripts/smoke-workflow.mjs"
, "scripts/smoke-run-all.mjs"
, "scripts/smoke-dashboard.mjs"
];

try {
  resolveProductRepoPath({ required: true });
} catch (err) {
  console.error("FAIL smoke-ci: PRODUCT_REPO_PATH invalid before steps");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

for (const rel of STEPS) {
  const res = spawnSync(process.execPath, [rel], {
    cwd   : ROOT
  , env   : process.env
  , stdio : "inherit"
  });

  if (res.status !== 0) {
    console.error(`FAIL smoke-ci step: ${rel}`);
    process.exit(res.status ?? 1);
  }
}

console.log("OK smoke-ci — all steps passed");
