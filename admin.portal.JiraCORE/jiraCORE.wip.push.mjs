#!/usr/bin/env node
/**
 * Step 8 PUSH — sync Jira live da jira_issue_wip + close-story (PR/catalogo).
 */

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { syncIssueFromWipMarkdown, transitionIssueToDone } from "./jiraCORE.jira.live.mjs";
import {
  assertWipReadyForPush
, loadWipPushBundle
, markWipPushed
, parseWipRawFields
, normalizeIssueKey
} from "./jiraCORE.wip.db.mjs";
import { getPortalRoot } from "../lib/portal.paths.resolver.mjs";

import "../lib/portal.load.env.mjs";

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ key?: string, dryRun: boolean, skipJira: boolean, skipClose: boolean }} */
  const out = {
    dryRun    : false
  , skipJira  : false
  , skipClose : false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--dry-run") {
      out.dryRun = true;
      continue;
    }

    if (arg === "--skip-jira") {
      out.skipJira = true;
      continue;
    }

    if (arg === "--skip-close") {
      out.skipClose = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(
        "Uso: node admin.portal.JiraCORE/jiraCORE.wip.push.mjs --key ADMIN-96 [--dry-run] [--skip-jira] [--skip-close]"
      );
      process.exit(0);
    }

    if (arg === "--key") {
      out.key = argv[i + 1];
      i += 1;
      continue;
    }

    if (/^(ADMIN|JLO)-\d+$/i.test(arg)) {
      out.key = arg;
    }
  }

  return out;
}

/**
 * @param {string} key
 * @param {boolean} dryRun
 */
function runCloseStory(key, dryRun) {
  /** @type {string[]} */
  const args = ["admin.portal.JiraCORE/jiraCORE.close.story.mjs", "--key", key];

  if (dryRun) {
    args.push("--dry-run");
  }

  const stdout = execFileSync(process.execPath, args, {
    cwd      : getPortalRoot()
  , encoding : "utf8"
  , stdio    : ["pipe", "pipe", "pipe"]
  });

  return JSON.parse(stdout.trim());
}

/**
 * @param {Array<{ jiraKey: string, rawFields?: string | null, isDone?: boolean }>} subtasks
 * @param {{ dryRun?: boolean }} opts
 */
async function syncWipSubtasksToJira(subtasks, opts = {}) {
  /** @type {Array<Record<string, unknown>>} */
  const results = [];

  for (const row of subtasks) {
    const raw = parseWipRawFields(row.rawFields);
    const markdown = typeof raw.veveDescription === "string" ? raw.veveDescription : "";

    if (!markdown.trim()) {
      results.push({
        key    : row.jiraKey
      , skipped: true
      , reason : "empty_veveDescription"
      });
      continue;
    }

    const sync = await syncIssueFromWipMarkdown(row.jiraKey, markdown, opts);
    results.push({ key: row.jiraKey, ...sync });
  }

  return results;
}

/**
 * @param {string} parentKey
 * @param {{ dryRun?: boolean, skipJira?: boolean, skipClose?: boolean }} [opts]
 */
export async function pushWipStory(parentKey, opts = {}) {
  const key = normalizeIssueKey(parentKey);
  const dryRun = opts.dryRun === true;
  const skipJira = opts.skipJira === true;
  const skipClose = opts.skipClose === true;

  const { parent, subtasks } = await loadWipPushBundle(key);
  const parentRaw = parseWipRawFields(parent.rawFields);

  assertWipReadyForPush(parent, parentRaw);

  /** @type {Record<string, unknown>} */
  const out = {
    ok       : false
  , key
  , dryRun
  , jira     : { subtasks: [], parent: null }
  , close    : null
  , wip      : null
  };

  if (!skipJira) {
    out.jira = {
      subtasks: await syncWipSubtasksToJira(subtasks, { dryRun })
    , parent  : null
    };

    const parentMarkdown = typeof parentRaw.veveDescription === "string"
      ? parentRaw.veveDescription
      : "";

    if (parentMarkdown.trim()) {
      out.jira.parent = await syncIssueFromWipMarkdown(key, parentMarkdown, { dryRun });
    } else {
      out.jira.parent = {
        key
      , description: { skipped: true, reason: "empty_veveDescription" }
      , transition : await transitionIssueToDone(key, { dryRun })
      };
    }
  }

  if (!skipClose) {
    out.close = runCloseStory(key, dryRun);

    if (!out.close?.ok) {
      out.error = typeof out.close?.error === "string"
        ? out.close.error
        : "close-story fallito";
      return out;
    }
  } else {
    out.close = { ok: true, skipped: true };
  }

  const prUrl = typeof out.close?.prUrl === "string" && out.close.prUrl.startsWith("http")
    ? out.close.prUrl
    : null;

  out.wip = await markWipPushed(key, { prUrl, dryRun });
  out.ok = true;
  out.prUrl = prUrl;

  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.key) {
    console.error("Errore: --key ADMIN-xxx o JLO-xxx obbligatorio");
    process.exit(1);
  }

  try {
    const result = await pushWipStory(args.key, {
      dryRun    : args.dryRun
    , skipJira  : args.skipJira
    , skipClose : args.skipClose
    });
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({ ok: false, error: message }, null, 2));
    process.exit(1);
  }
}

if (
  process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  void main();
}
