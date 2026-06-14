#!/usr/bin/env node
/**
 * CLI — analisi repo per una o più Jira key (output JSON o markdown).
 *
 *   node scripts/analyze-repo-keys.mjs --parent JLO-507
 *   node scripts/analyze-repo-keys.mjs --keys JLO-524,JLO-525
 *   node scripts/analyze-repo-keys.mjs --key JLO-507 --format md
 */

import { fetchJiraBacklog, isStoryLikeType } from "../lib/jira-backlog.mjs";
import {
  analyzeIssueKeys
, formatRepoAnalysisMarkdown
, suggestSubtaskOrder
} from "../lib/jira-repo-analysis.mjs";

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeIssueKey(raw) {
  const m = String(raw).trim().toUpperCase().match(/^(JLO|ADMIN)-\d+$/);

  if (!m) {
    throw new Error(`Key non valida: ${raw} — attese JLO-xxx o ADMIN-xxx`);
  }

  return m[0];
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ parent?: string, keys: string[], key?: string, format: "json" | "md" }} */
  const out = { keys: [], format: "json" };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--parent" && argv[i + 1]) {
      out.parent = normalizeIssueKey(argv[++i]);
      continue;
    }

    if (arg === "--keys" && argv[i + 1]) {
      out.keys = argv[++i].split(",").map((k) => normalizeIssueKey(k.trim())).filter(Boolean);
      continue;
    }

    if (arg === "--key" && argv[i + 1]) {
      out.key = normalizeIssueKey(argv[++i]);
      continue;
    }

    if (arg === "--format" && argv[i + 1]) {
      const f = argv[++i];

      if (f === "md" || f === "json") {
        out.format = f;
      }
    }
  }

  return out;
}

/**
 * @param {string} parentKey
 */
async function keysForParent(parentKey) {
  const backlog = await fetchJiraBacklog();
  const issues  = backlog.issues ?? [];
  const parent  = issues.find((row) => row.key === parentKey);

  if (!parent) {
    throw new Error(`Key non trovata nel backlog: ${parentKey}`);
  }

  const children = issues.filter((row) => row.parentKey === parentKey);
  const keys     = [parentKey, ...children.map((row) => row.key)];

  /** @type {Record<string, string>} */
  const jiraStatusByKey = {};

  for (const row of [parent, ...children]) {
    jiraStatusByKey[row.key] = row.status;
  }

  const subtaskOrder = suggestSubtaskOrder(
    children.map((row) => ({ key: row.key, summary: row.summary }))
  );

  return {
    keys
  , jiraStatusByKey
  , subtaskOrder
  , subtasks: children.map((row) => ({
      key     : row.key
    , summary : row.summary
    , status  : row.status
    , type    : row.type
    , storyLike: isStoryLikeType(row.type)
    }))
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.parent && args.keys.length === 0 && !args.key) {
    console.error(
      "Uso: analyze-repo-keys.mjs --parent JLO-xxx|ADMIN-xxx | --keys K1,K2 | --key K [--format json|md]"
    );
    process.exit(1);
  }

  /** @type {string[]} */
  let keys = args.keys;

  if (args.key) {
    keys = [args.key, ...keys];
  }

  /** @type {Record<string, string>} */
  let jiraStatusByKey = {};
  /** @type {string[] | undefined} */
  let subtaskOrder;
  /** @type {string | undefined} */
  let parentKey = args.parent;

  if (args.parent) {
    const parentCtx = await keysForParent(args.parent);
    keys              = parentCtx.keys;
    jiraStatusByKey   = parentCtx.jiraStatusByKey;
    subtaskOrder      = parentCtx.subtaskOrder;
  }

  const report = analyzeIssueKeys(keys, { jiraStatusByKey });

  if (args.format === "md") {
    process.stdout.write(
      formatRepoAnalysisMarkdown(report, { parentKey, subtaskOrder })
    );

    return;
  }

  console.log(JSON.stringify({
    ok           : true
  , parentKey
  , subtaskOrder
  , ...report
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
