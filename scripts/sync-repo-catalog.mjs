#!/usr/bin/env node
/**
 * Sincronizza REPO_IMPLEMENTATION_SIGNALS con piano MVP + branch ticket.
 *
 * Uso:
 *   node scripts/sync-repo-catalog.mjs
 *   node scripts/sync-repo-catalog.mjs --dry-run
 *   node scripts/sync-repo-catalog.mjs --key JLO-775
 */

import { JLO_WORKING_PLAN } from "../lib/jira-working-order.mjs";
import {
  ensureRepoImplementationSignalByKey
, listAllTicketBranchKeys
, signalKeyExistsInFile
} from "../lib/repo.implementation.signals.catalog.mjs";

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  /** @type {string[]} */
  const keys = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--key" && argv[i + 1]) {
      const m = String(argv[++i]).toUpperCase().match(/JLO-\d+/);

      if (m) {
        keys.push(m[0]);
      }
    } else if (/^JLO-\d+$/i.test(argv[i])) {
      keys.push(argv[i].toUpperCase());
    }
  }

  return { dryRun, keys };
}

function collectTargetKeys(explicit) {
  if (explicit.length > 0) {
    return [...new Set(explicit)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  const fromPlan = JLO_WORKING_PLAN.flatMap((block) => block.keys);
  const fromBranches = listAllTicketBranchKeys();

  return [...new Set([...fromPlan, ...fromBranches])].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
}

function main() {
  const { dryRun, keys: explicit } = parseArgs(process.argv.slice(2));
  const keys = collectTargetKeys(explicit);

  /** @type {Array<{ key: string, result: object }>} */
  const results = [];
  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const key of keys) {
    if (signalKeyExistsInFile(key)) {
      results.push({ key, result: { updated: false, skipped: true, reason: "already-listed" } });
      skipped++;
      continue;
    }

    const result = ensureRepoImplementationSignalByKey(key, { dryRun });

    results.push({ key, result });

    if (result.updated) {
      added++;
    } else if (result.skipped) {
      skipped++;
    } else {
      failed++;
    }
  }

  const out = {
    ok     : true
  , dryRun
  , total  : keys.length
  , added
  , skipped
  , failed
  , results
  };

  console.log(JSON.stringify(out, null, 2));
}

main();
