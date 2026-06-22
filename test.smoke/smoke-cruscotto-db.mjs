#!/usr/bin/env node
/**
 * Smoke ADMIN-99 — cruscotto DB path, migrate, loadJiraBacklog fallback.
 */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  describeCruscottoDbLayout
, prepareCruscottoDatabaseUrl
, resolveCruscottoDbPath
} from "../cruscotto.database/cruscotto.db.config.mjs";
import { loadJiraBacklogFromDb } from "../admin.portal.JiraCORE/jiraCORE.backlog.load.mjs";
import { getPortalRoot } from "../lib/portal-paths.mjs";
import { resolveProjectOverlayName } from "../lib/project.config.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const overlay     = resolveProjectOverlayName();
const defaultPath = resolveCruscottoDbPath();
const expectedRel = `PROJECT_${overlay}/cruscotto_${overlay}.db`;

if (!defaultPath.startsWith(getPortalRoot())) {
  console.error("FAIL: default cruscotto DB not under portal root", defaultPath);
  process.exit(1);
}

if (!defaultPath.replace(/\\/g, "/").endsWith(expectedRel.replace(/\\/g, "/"))) {
  console.error("FAIL: default path not PROJECT overlay layout", defaultPath, "expected", expectedRel);
  process.exit(1);
}

const layout = describeCruscottoDbLayout();

if (!layout.includes(getPortalRoot())) {
  console.error("FAIL: describeCruscottoDbLayout", layout);
  process.exit(1);
}

const empty = await loadJiraBacklogFromDb();

if (empty !== null && !existsSync(resolveCruscottoDbPath())) {
  console.error("FAIL: loadJiraBacklogFromDb returned data without db file");
  process.exit(1);
}

const tempDir = mkdtempSync(join(tmpdir(), "portal-admin-cruscotto-"));
const tempDb  = join(tempDir, "smoke-cruscotto.db");

process.env.CRUSCOTTO_DB_PATH = tempDb;

try {
  prepareCruscottoDatabaseUrl();
  execFileSync(process.execPath, ["cruscotto.database/migrate.mjs"], {
    cwd   : ROOT
  , stdio : "inherit"
  , env   : { ...process.env, CRUSCOTTO_DB_PATH: tempDb }
  });

  if (!existsSync(tempDb)) {
    console.error("FAIL: migrate did not create db", tempDb);
    process.exit(1);
  }

  const cached = await loadJiraBacklogFromDb();

  if (cached !== null) {
    console.error("FAIL: expected null backlog on fresh empty db");
    process.exit(1);
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env.CRUSCOTTO_DB_PATH;
}

console.log("OK smoke cruscotto-db");
console.log(`  default path: ${defaultPath}`);
console.log(`  layout: ${layout}`);
