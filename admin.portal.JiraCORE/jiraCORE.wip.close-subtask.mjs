/**
 * Ok chiudi subtask su jira_issue_wip — step 5 workflow database (gogo/procedi).
 */

import { execFileSync } from "node:child_process";

import { buildWipAdvancementEntry } from "../cruscotto.frontend/cruscotto.jira.backlog.wip.mjs";
import { openCruscottoDb } from "../cruscotto.database/cruscotto.db.config.mjs";
import { getProductRepoPath } from "../admin.portal.lib/portal.paths.resolver.mjs";
import { readGitWorkflowInfo, resolvePrUrlForIssueKey } from "../admin.portal/portal.cursor.agent.workflow.mjs";
import {
  loadWipPushBundle
, normalizeIssueKey
, parseWipRawFields
} from "./jiraCORE.wip.db.mjs";

const DONE_STATUS = "Fatto";
const ISSUE_KEY_IN_TEXT_RE = /\b(ADMIN|JLO)-\d+\b/gi;

/**
 * @param {string} text
 * @returns {string[]}
 */
function parseIssueKeysFromText(text) {
  /** @type {string[]} */
  const keys = [];

  for (const match of String(text ?? "").matchAll(ISSUE_KEY_IN_TEXT_RE)) {
    keys.push(match[0].toUpperCase());
  }

  return [...new Set(keys)];
}

/**
 * @param {string} parentKey
 * @returns {string}
 */
function shortHeadHash(parentKey) {
  const git = readGitWorkflowInfo(parentKey);

  return git.hash !== "—" ? git.hash : "";
}

/**
 * @param {import("@prisma/client").PrismaClient} db
 * @param {string} parentKey
 */
async function loadWipChildren(db, parentKey) {
  return db.jiraIssueWip.findMany({
    where  : { parentJiraKey: parentKey }
  , orderBy: [{ devSort: "asc" }, { jiraKey: "asc" }]
  });
}

/**
 * @param {Array<{ isDone?: boolean }>} subtasks
 * @returns {boolean}
 */
export function areAllWipSubtasksDone(subtasks) {
  if (!subtasks.length) {
    return true;
  }

  return subtasks.every((row) => row.isDone === true);
}

/**
 * Chiude subtask in jira_issue_wip (ok chiudi — solo DB, no Jira live).
 *
 * @param {string} subKey
 * @param {{
 *   commitHash?: string | null
 *   parentKey?: string | null
 *   veveDescription?: string | null
 *   statoRepo?: unknown
 *   skipParentFinalize?: boolean
 * }} [opts]
 */
export async function closeWipSubtask(subKey, opts = {}) {
  const key = normalizeIssueKey(subKey);
  const db  = await openCruscottoDb();
  const row = await db.jiraIssueWip.findUnique({ where: { jiraKey: key } });

  if (!row) {
    throw new Error(`Subtask assente in jira_issue_wip: ${key} — esegui enroll gogo`);
  }

  if (!row.parentJiraKey) {
    throw new Error(`${key} non è una subtask WIP (parent_jira_key assente)`);
  }

  if (row.isDone === true) {
    return {
      key
    , parentKey : row.parentJiraKey
    , alreadyDone: true
    , advancement: buildWipAdvancementEntry(row, [])
    };
  }

  const raw        = parseWipRawFields(row.rawFields);
  const now        = new Date().toISOString();
  const parentKey  = opts.parentKey ?? row.parentJiraKey;
  const commitHash = opts.commitHash
    ?? (typeof raw.commitHash === "string" && raw.commitHash.trim() ? raw.commitHash.trim() : null)
    ?? shortHeadHash(parentKey)
    ?? null;

  /** @type {Record<string, unknown>} */
  const nextRaw = {
    ...raw
  , closedAt  : raw.closedAt ?? now
  , commitHash: commitHash ?? raw.commitHash ?? null
  };

  if (opts.statoRepo != null) {
    nextRaw.statoRepo = opts.statoRepo;
  }

  if (typeof opts.veveDescription === "string" && opts.veveDescription.trim()) {
    nextRaw.veveDescription = opts.veveDescription.trim();
  }

  const updated = await db.jiraIssueWip.update({
    where: { jiraKey: key }
  , data : {
      status   : DONE_STATUS
    , isDone   : true
    , rawFields: JSON.stringify(nextRaw)
    , syncedAt : new Date()
    }
  });

  /** @type {import("../cruscotto.frontend/cruscotto.jira.backlog.wip.mjs").WipAdvancementEntry | null} */
  let parentAdvancement = null;

  if (!opts.skipParentFinalize && parentKey) {
    parentAdvancement = await closeParentWipForPush(parentKey);
  }

  return {
    key
  , parentKey
  , closed       : true
  , advancement  : buildWipAdvancementEntry(updated, [])
  , parentAdvancement
  };
}

/**
 * Scansiona commit git del branch ticket e chiude subtask WIP citate nel messaggio.
 *
 * @param {string} parentKey
 * @returns {Promise<{ parentKey: string, closed: string[] }>}
 */
export async function syncWipSubtasksFromGitCommits(parentKey) {
  const key    = normalizeIssueKey(parentKey);
  const db     = await openCruscottoDb();
  const git    = readGitWorkflowInfo(key);
  const repo   = getProductRepoPath();
  const children = await loadWipChildren(db, key);
  const childKeys = new Set(children.map((row) => row.jiraKey));

  /** @type {string[]} */
  const branches = [];

  for (const branch of git.storyBranches) {
    if (!branches.includes(branch)) {
      branches.push(branch);
    }
  }

  if (git.branch && git.branch !== "—" && !branches.includes(git.branch)) {
    branches.push(git.branch);
  }

  /** @type {string[]} */
  const closed = [];

  for (const branch of branches) {
    /** @type {string} */
    let logRaw = "";

    try {
      logRaw = execFileSync(
        "git"
      , ["log", branch, "--format=%H|%s", "-40"]
      , { cwd: repo, encoding: "utf8" }
      ).trim();
    } catch {
      continue;
    }

    for (const line of logRaw.split("\n").filter(Boolean)) {
      const pipeIdx = line.indexOf("|");
      const hash    = pipeIdx === -1 ? "" : line.slice(0, pipeIdx).trim();
      const message = pipeIdx === -1 ? line : line.slice(pipeIdx + 1);

      for (const issueKey of parseIssueKeysFromText(message)) {
        if (issueKey === key || !childKeys.has(issueKey)) {
          continue;
        }

        const child = children.find((row) => row.jiraKey === issueKey);

        if (!child || child.isDone === true) {
          continue;
        }

        await closeWipSubtask(issueKey, {
          parentKey         : key
        , commitHash        : hash ? hash.slice(0, 12) : null
        , skipParentFinalize: true
        });
        closed.push(issueKey);
        child.isDone = true;
      }
    }
  }

  if (closed.length > 0) {
    await closeParentWipForPush(key);
  }

  return { parentKey: key, closed: [...new Set(closed)] };
}

/**
 * Step 7 locale — tutte le subtask Fatto: parent in attesa PUSH (chiudi story allo step 8).
 *
 * @param {string} parentKey
 * @param {{
 *   git?: ReturnType<typeof readGitWorkflowInfo>
 *   pr?: ReturnType<typeof resolvePrUrlForIssueKey>
 *   now?: string
 * }} [opts]
 * @returns {Promise<import("../cruscotto.frontend/cruscotto.jira.backlog.wip.mjs").WipAdvancementEntry | null>}
 */
export async function closeParentWipForPush(parentKey, opts = {}) {
  const key = normalizeIssueKey(parentKey);
  const db  = await openCruscottoDb();

  let bundle;

  try {
    bundle = await loadWipPushBundle(key);
  } catch {
    return null;
  }

  const { parent, subtasks } = bundle;

  if (!areAllWipSubtasksDone(subtasks)) {
    return null;
  }

  const raw  = parseWipRawFields(parent.rawFields);
  const now  = opts.now ?? new Date().toISOString();
  const git  = opts.git ?? readGitWorkflowInfo(key);
  const pr   = opts.pr ?? resolvePrUrlForIssueKey(key);
  const branch = typeof raw.branch === "string" && raw.branch.trim()
    ? raw.branch.trim()
    : (pr.branch ?? git.storyBranches[0] ?? (git.branch !== "—" ? git.branch : null));

  /** @type {Record<string, unknown>} */
  const nextRaw = {
    ...raw
  , gogoCompletedAt: raw.gogoCompletedAt ?? now
  , branch
  , commitHash     : raw.commitHash ?? (git.hash !== "—" ? git.hash : null)
  , chiudiParent   : true
  , wipClosedAt    : raw.wipClosedAt ?? now
  };

  if (pr.prUrl) {
    nextRaw.prUrl        = pr.prUrl;
    nextRaw.awaitingPush = false;
    nextRaw.pushedAt     = raw.pushedAt ?? now;
    nextRaw.jiraSyncedAt = raw.jiraSyncedAt ?? now;
  } else {
    nextRaw.awaitingPush = true;
  }

  const updated = await db.jiraIssueWip.update({
    where: { jiraKey: key }
  , data : {
      status   : DONE_STATUS
    , isDone   : true
    , rawFields: JSON.stringify(nextRaw)
    , syncedAt : new Date()
    }
  });

  const wipChildren = await loadWipChildren(db, key);

  return buildWipAdvancementEntry(updated, wipChildren);
}

// 1. Argomenti CLI — help ed exit 0
const isMain = process.argv[1]
  && /jiraCORE\.wip\.close-subtask\.mjs$/i.test(process.argv[1]);

if (isMain) {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log([
      "Uso:"
    , "  node admin.portal.JiraCORE/jiraCORE.wip.close-subtask.mjs --key ADMIN-121"
    , "  node admin.portal.JiraCORE/jiraCORE.wip.close-subtask.mjs --sync-parent ADMIN-96"
    , ""
    , "  --key          subtask da chiudere in jira_issue_wip (ok chiudi)"
    , "  --sync-parent  parent: chiude subtask da commit git + parent PUSH se complete"
    , "  --commit       hash commit (opzionale)"
    ].join("\n"));
    process.exit(0);
  }

  /** @type {string | undefined} */
  let subKey;
  /** @type {string | undefined} */
  let parentKey;
  /** @type {string | undefined} */
  let commitHash;

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--key" && args[i + 1]) {
      subKey = args[++i];
    } else if (args[i] === "--sync-parent" && args[i + 1]) {
      parentKey = args[++i];
    } else if (args[i] === "--commit" && args[i + 1]) {
      commitHash = args[++i];
    }
  }

  // 2. Esecuzione — exit 1 su errore validazione o WIP
  (async () => {
    try {
      if (parentKey) {
        const synced = await syncWipSubtasksFromGitCommits(parentKey);
        const parent = await closeParentWipForPush(parentKey);
        console.log(JSON.stringify({ ok: true, synced, parent }, null, 2));
        process.exit(0);
      }

      if (!subKey) {
        console.error("Specificare --key SUB-xxx o --sync-parent PARENT-xxx");
        process.exit(1);
      }

      const result = await closeWipSubtask(subKey, { commitHash });
      console.log(JSON.stringify({ ok: true, ...result }, null, 2));
      process.exit(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(message);
      process.exit(1);
    }
  })();
}
