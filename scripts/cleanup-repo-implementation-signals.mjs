#!/usr/bin/env node
/**
 * Pulizia REPO_IMPLEMENTATION_SIGNALS — sostituisce path cruscotto/archivi
 * con path prodotto/admin significativi (git merge main, branch, citazioni).
 *
 * Uso:
 *   node scripts/cleanup-repo-implementation-signals.mjs [--dry-run]
 *   node scripts/cleanup-repo-implementation-signals.mjs --keys JLO-100,JLO-913
 */

import { REPO_IMPLEMENTATION_SIGNALS } from "../lib/jira-backlog-insights.mjs";
import {
  isMeaningfulCitationPath
, removeSignalFromInsightsFile
, replaceSignalInInsightsFile
, resolveMeaningfulSignalPaths
} from "../lib/repo-implementation-signals-catalog.mjs";

const DRY_RUN = process.argv.includes("--dry-run");
const keysArg = process.argv.find((a) => a.startsWith("--keys="));
/** @type {Set<string> | null} */
const onlyKeys = keysArg
  ? new Set(keysArg.slice("--keys=".length).split(",").map((k) => k.trim().toUpperCase()))
  : null;

/** Path mirati quando il collapse git restituisce bucket troppo larghi. */
const CURATED = {
  "JLO-3" : {
    label : "Tornei Kill Race epic"
  , paths : ["apps/api/src/tournaments"]
  }
, "JLO-100" : {
    label : "iscrizione torneo"
  , paths : [
      "apps/api/src/tournaments/tournaments.service.ts"
    , "apps/web/src/lib/tournaments-api.ts"
    ]
  , tests : ["tournament/test-tournament-join-api.mjs"]
  }
, "JLO-103" : {
    label : "generazione bracket automatico"
  , paths : [
      "apps/api/src/tournaments/bracket.service.ts"
    , "apps/api/src/tournaments/bracket-matches.controller.ts"
    ]
  , tests : ["tournament/test-tournament-bracket-api.mjs"]
  }
, "JLO-256" : {
    label : "avvio torneo"
  , paths : ["apps/api/src/tournaments/tournaments.service.ts"]
  , tests : ["tournament/test-tournament-start-api.mjs"]
  }
, "JLO-257" : {
    label : "sicurezza permessi torneo"
  , paths : ["apps/api/src/tournaments/tournament-organizer.ts"]
  , tests : ["tournament/test-tournament-organizer-auth.mjs"]
  }
, "JLO-500" : {
    label : "integrazione torneo kill race"
  , paths : [
      "apps/api/src/tournaments"
    , "testScript/tournament"
    ]
  }
, "JLO-913" : {
    label : "Cruscotto Dev UI"
  , paths : [
      "server/dashboard-server.mjs"
    , "lib/dev-manifest.mjs"
    ]
  , tests : ["dashboard/test-dev-cruscotto.mjs"]
  }
};

/**
 * @param {string[]} paths
 */
function tightenPaths(paths) {
  return paths.filter((p) =>
    p !== "Admin"
    && p !== "testScript"
    && p !== "apps/web/src"
    && p !== "apps/api/src"
    && p !== "apps/authentication/src"
    && p !== "packages/database/prisma"
    && p !== "packages/shared/src"
    && p !== "packages/i18n/locales"
  );
}

/**
 * @param {string} key
 * @param {{ label: string, paths: string[], tests?: string[] }} signal
 */
function buildEntry(key, signal) {
  const curated = CURATED[key];
  const resolved = resolveMeaningfulSignalPaths(key);

  if (curated) {
    return {
      label : curated.label ?? resolved.label ?? signal.label
    , paths : curated.paths
    , tests : curated.tests ?? resolved.tests
    };
  }

  const paths = tightenPaths(resolved.paths);

  /** @type {{ label: string, paths: string[], tests?: string[] }} */
  const entry = {
    label : resolved.label !== key ? resolved.label : signal.label
  , paths
  };

  if (resolved.tests.length > 0) {
    entry.tests = resolved.tests;
  }

  return entry;
}

/** @type {Array<{ key: string, action: string, paths?: string[], reason?: string }>} */
const report = [];

for (const signal of REPO_IMPLEMENTATION_SIGNALS) {
  if (onlyKeys && !onlyKeys.has(signal.key)) {
    continue;
  }

  const hasMeaningful = signal.paths.some(isMeaningfulCitationPath);

  if (hasMeaningful && !CURATED[signal.key]) {
    continue;
  }

  const entry = buildEntry(signal.key, signal);

  if (entry.paths.length === 0) {
    const result = removeSignalFromInsightsFile(signal.key, { dryRun: DRY_RUN });

    report.push({
      key    : signal.key
    , action : result.removed ? "remove" : "skip"
    , reason : result.removed ? "no meaningful paths" : result.reason
    });
    continue;
  }

  const result = replaceSignalInInsightsFile(signal.key, entry, { dryRun: DRY_RUN });

  report.push({
    key    : signal.key
  , action : result.updated ? "update" : "skip"
  , paths  : entry.paths
  , reason : result.updated ? undefined : result.reason
  });
}

console.log(JSON.stringify({ dryRun: DRY_RUN, report }, null, 2));
