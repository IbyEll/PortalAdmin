#!/usr/bin/env node
/**
 * Sync Jira backlog into PortalAdmin data/cruscotto.db (ADMIN-82 / ADMIN-142).
 *
 * Uso: node scripts/sync-jira-backlog.mjs
 * Env: JIRA_EMAIL, JIRA_API_TOKEN, CRUSCOTTO_DB_PATH (optional)
 */

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describeCruscottoDbLayout, resolveCruscottoDbPath } from "../lib/cruscotto-db/index.mjs";
import { syncJiraBacklogFromApi } from "../lib/cruscotto-db/sync-backlog.mjs";

const ROOT       = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATE    = join(ROOT, "lib", "cruscotto-db", "migrate.mjs");

execFileSync(process.execPath, [MIGRATE], { stdio: "inherit", cwd: ROOT });

const result = await syncJiraBacklogFromApi();

console.log("OK sync-jira-backlog");
console.log(`  layout : ${describeCruscottoDbLayout()}`);
console.log(`  db     : ${resolveCruscottoDbPath()}`);
console.log(`  issues : ${result.issueCount}`);
console.log(`  syncRun: ${result.syncRunId}`);
console.log(`  fetched: ${result.fetchedAt}`);
