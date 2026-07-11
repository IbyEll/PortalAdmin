#!/usr/bin/env node
/**
 * Allinea catalogo segnali per issue Jira Fatto con repoAlign gap (⚠ backlog).
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { openCruscottoDb } from "../cruscotto.database/cruscotto.db.config.mjs";
import { scanRepoJiraReferences } from "./jira.function.repo.refs.mjs";
import { REPO_IMPLEMENTATION_SIGNALS } from "./jira.project.config.overlay.mjs";
import {
  buildRepoAlignMap
, resolveRepoAlignStatus
} from "../cruscotto.frontend/cruscotto.jira.backlog.insights.mjs";
import {
  isMeaningfulCitationPath
, replaceSignalInInsightsFile
, resolveMeaningfulSignalPaths
, appendSignalToInsightsFile
, signalKeyExistsInFile
} from "./JiraCORE.signals.catalog.implementation.mjs";
import { getProductRepoPath } from "../admin.portal.lib/portal.paths.resolver.mjs";

const REPO_ROOT = getProductRepoPath();
const MAX_PATHS = 8;

/** Path noti — chiavi per numero issue (evita citazioni spurie nello scan repo). */
const FALLBACK_BY_NUM = {
  97 : ["admin.portal.testscript/lib/http.mjs"]
, 100: ["test.smoke/smoke-portal-e2e.mjs"]
, 154: ["test.smoke/smoke-paths-resolver.mjs"]
, 171: [
    "cruscotto.database/prisma/schema.prisma"
  , "cruscotto.database/prisma/migrations/20260709030000_matrix_tables/migration.sql"
  ]
, 195: ["admin.portal.JiraCORE/jira.project.config.mjs"]
, 196: [
    "admin.portal.JiraCORE/jira.project.config.mjs"
  , "admin.portal.JiraCORE/jira.function.repo.refs.mjs"
  ]
};

/**
 * @param {string} rel
 */
function catalogPathExists(rel) {
  const abs = join(REPO_ROOT, rel);

  if (!existsSync(abs)) {
    return false;
  }

  try {
    const st = statSync(abs);

    if (st.isFile()) {
      return true;
    }

    return readdirSync(abs).some((name) => name !== ".gitkeep");
  } catch {
    return false;
  }
}

/**
 * @param {string} key
 * @param {{ paths?: string[], tests?: string[], label?: string } | undefined} signal
 * @param {Map<string, string[]>} refs
 */
function buildFixedPaths(key, signal, refs) {
  /** @type {string[]} */
  const out = [];

  for (const rel of refs.get(key) ?? []) {
    if (isMeaningfulCitationPath(rel) && catalogPathExists(rel) && !out.includes(rel)) {
      out.push(rel);
    }
  }

  for (const rel of signal?.paths ?? []) {
    if (isMeaningfulCitationPath(rel) && catalogPathExists(rel) && !out.includes(rel)) {
      out.push(rel);
    }
  }

  try {
    const git = resolveMeaningfulSignalPaths(key);

    for (const rel of git.paths ?? []) {
      if (isMeaningfulCitationPath(rel) && catalogPathExists(rel) && !out.includes(rel)) {
        out.push(rel);
      }
    }
  } catch {
    // branch assente — solo refs/cache
  }

  for (const rel of FALLBACK_BY_NUM[key.split("-")[1] ?? ""] ?? []) {
    if (isMeaningfulCitationPath(rel) && catalogPathExists(rel) && !out.includes(rel)) {
      out.push(rel);
    }
  }

  return out.slice(0, MAX_PATHS);
}

/**
 * @param {ReturnType<typeof buildFixedPaths>} paths
 * @param {Map<string, string[]>} refs
 * @param {string} key
 */
function pathsAlign(key, paths, refs) {
  const meaningful = (refs.get(key) ?? []).filter(isMeaningfulCitationPath);
  const signal     = { paths };
  let pathScan     = null;

  if (paths.length > 0) {
    /** @type {string[]} */
    const found   = [];
    /** @type {string[]} */
    const missing = [];

    for (const rel of paths) {
      if (catalogPathExists(rel)) {
        found.push(rel);
      } else {
        missing.push(rel);
      }
    }

    pathScan = {
      found
    , missing
    , complete: missing.length === 0 && found.length > 0
    };
  }

  return resolveRepoAlignStatus({
    refs             : refs.get(key) ?? []
  , meaningfulRefs   : meaningful
  , refCount         : meaningful.length
  , pathScan
  , pathComplete     : Boolean(pathScan?.complete)
  , hasEvidence      : meaningful.length > 0 || Boolean(pathScan?.complete)
  , signal
  }, true);
}

/**
 * @param {boolean} dryRun
 */
async function main(dryRun = false) {
  const db      = await openCruscottoDb();
  const syncRun = await db.syncRun.findFirst({
    where  : { status: "success", issueCount: { gt: 0 } }
  , orderBy: { finishedAt: "desc" }
  });

  if (!syncRun) {
    throw new Error("Nessun sync_run success in cruscotto.db");
  }

  const issues = await db.jiraIssue.findMany({
    where  : { syncRunId: syncRun.id, isStoryLike: true }
  , select : { jiraKey: true, issueType: true, status: true, summary: true }
  });

  const refs  = scanRepoJiraReferences();
  const align = buildRepoAlignMap(
    issues.map((row) => ({
      key    : row.jiraKey
    , type   : row.issueType
    , status : row.status
    }))
  , refs
  );

  const gaps = issues.filter((row) => align[row.jiraKey] === "gap");

  /** @type {Array<{ key: string, action: string, paths: string[], align: string | null }>} */
  const report = [];

  for (const row of gaps) {
    const key    = row.jiraKey;
    const signal = REPO_IMPLEMENTATION_SIGNALS.find((entry) => entry.key === key);
    const paths  = buildFixedPaths(key, signal, refs);
    const nextAlign = paths.length > 0 ? pathsAlign(key, paths, refs) : "gap";

    if (nextAlign !== "aligned" || paths.length === 0) {
      report.push({
        key
      , action: paths.length === 0 ? "skip-no-paths" : "still-gap"
      , paths
      , align : nextAlign
      });
      continue;
    }

    /** @type {{ label: string, paths: string[], tests?: string[] }} */
    const entry = {
      label : signal?.label ?? String(row.summary ?? key).slice(0, 120)
    , paths
    };

    if (signal?.tests?.length) {
      entry.tests = signal.tests;
    } else {
      try {
        const git = resolveMeaningfulSignalPaths(key);

        if (git.tests?.length) {
          entry.tests = git.tests;
        }
      } catch {
        // ignore
      }
    }

    if (signalKeyExistsInFile(key)) {
      replaceSignalInInsightsFile(key, entry, { dryRun });
    } else {
      if (!dryRun) {
        appendSignalToInsightsFile(key, entry);
      }
    }

    report.push({ key, action: signal ? "replace" : "append", paths, align: nextAlign });
  }

  console.log(JSON.stringify({
    dryRun
  , gapBefore : gaps.length
  , fixed     : report.filter((row) => row.action === "replace" || row.action === "append").length
  , skipped   : report.filter((row) => row.action !== "replace" && row.action !== "append").length
  , details   : report
  }, null, 2));
}

const dryRun = process.argv.includes("--dry-run");

main(dryRun).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
