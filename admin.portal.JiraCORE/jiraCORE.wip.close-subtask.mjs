/**
 * Ok chiudi subtask su jira_issue_wip — step 5 workflow database (gogo/procedi).
 */

import { execFileSync } from "node:child_process";

import { buildWipAdvancementEntry } from "../cruscotto.frontend/cruscotto.jira.backlog.wip.mjs";
import { openCruscottoDb } from "../cruscotto.database/cruscotto.db.config.mjs";
import { getProductRepoPath } from "../admin.portal.lib/portal.paths.resolver.mjs";
import { readGitWorkflowInfo, resolvePrUrlForIssueKey, isTicketWorkflowBranch } from "../admin.portal/portal.cursor.agent.workflow.mjs";
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
 * Ultimo commit sul branch ticket rispetto a main — null se main..branch è vuoto.
 *
 * @param {string} parentKey
 * @param {ReturnType<typeof readGitWorkflowInfo>} [git]
 * @returns {string | null}
 */
function shortBranchTipHash(parentKey, git = readGitWorkflowInfo(parentKey)) {
  const ticketBranch = resolveTicketBranchName(parentKey, git);
  const commits      = listBranchCommitsSinceMain(ticketBranch);

  if (!commits.length) {
    return null;
  }

  const last = commits[commits.length - 1].hash;

  return last ? last.slice(0, 12) : null;
}

/**
 * Hash commit da associare a subtask — solo commit reali su main..branch, mai HEAD di main.
 *
 * @param {string} parentKey
 * @param {{ hash?: string } | null | undefined} mappedCommit
 * @param {ReturnType<typeof readGitWorkflowInfo>} [git]
 * @returns {string | null}
 */
function resolveSubtaskCommitHash(parentKey, mappedCommit, git = readGitWorkflowInfo(parentKey)) {
  if (mappedCommit?.hash) {
    return mappedCommit.hash.slice(0, 12);
  }

  return shortBranchTipHash(parentKey, git);
}

/**
 * @param {string} parentKey
 * @param {ReturnType<typeof readGitWorkflowInfo>} git
 * @returns {string | null}
 */
function resolveTicketBranchName(parentKey, git) {
  for (const branch of git.storyBranches) {
    if (isTicketWorkflowBranch(branch, parentKey)) {
      return branch;
    }
  }

  if (git.branch && git.branch !== "—" && isTicketWorkflowBranch(git.branch, parentKey)) {
    return git.branch;
  }

  return git.storyBranches[0] ?? null;
}

/**
 * Commit sul branch ticket non ancora su main (ordine cronologico).
 *
 * @param {string | null | undefined} branch
 * @returns {Array<{ hash: string, message: string }>}
 */
function listBranchCommitsSinceMain(branch) {
  if (!branch) {
    return [];
  }

  const repo = getProductRepoPath();

  try {
    const logRaw = execFileSync(
      "git"
    , ["log", `main..${branch}`, "--format=%H|%s", "--reverse"]
    , { cwd: repo, encoding: "utf8" }
    ).trim();

    if (!logRaw) {
      return [];
    }

    return logRaw.split("\n").filter(Boolean).map((line) => {
      const pipeIdx = line.indexOf("|");

      return {
        hash    : pipeIdx === -1 ? line.trim() : line.slice(0, pipeIdx).trim()
      , message : pipeIdx === -1 ? "" : line.slice(pipeIdx + 1)
      };
    });
  } catch {
    return [];
  }
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
    ?? resolveSubtaskCommitHash(parentKey, null)
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
    const freshSiblings = await loadWipChildren(db, parentKey);

    if (areAllWipSubtasksDone(freshSiblings)) {
      parentAdvancement = await closeParentWipForPush(parentKey);
    } else {
      parentAdvancement = await touchParentWipProgress(parentKey);
    }
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
 * @returns {Promise<{ parentKey: string, closed: string[], advancement: import("../cruscotto.frontend/cruscotto.jira.backlog.wip.mjs").WipAdvancementEntry | null }>}
 */
export async function syncWipSubtasksFromGitCommits(parentKey) {
  const key          = normalizeIssueKey(parentKey);
  const db           = await openCruscottoDb();
  const git          = readGitWorkflowInfo(key);
  const ticketBranch = resolveTicketBranchName(key, git);
  const children     = await loadWipChildren(db, key);
  const childKeys    = new Set(children.map((row) => row.jiraKey));

  /** @type {string[]} */
  const closed = [];

  const commits = listBranchCommitsSinceMain(ticketBranch);

  for (const { hash, message } of commits) {
    for (const issueKey of parseIssueKeysFromText(message)) {
      if (issueKey === key || !childKeys.has(issueKey)) {
        continue;
      }

      const child = children.find((row) => row.jiraKey === issueKey);

      if (!child) {
        continue;
      }

      const shortHash = hash ? hash.slice(0, 12) : null;

      if (child.isDone === true) {
        continue;
      }

      await closeWipSubtask(issueKey, {
        parentKey         : key
      , commitHash        : shortHash
      , skipParentFinalize: true
      });
      closed.push(issueKey);
      child.isDone = true;
    }
  }

  const openChildren = children.filter((row) => row.isDone !== true);
  const unmapped     = commits.filter((commit) => {
    const keys = parseIssueKeysFromText(commit.message);

    return keys.length === 0 || keys.every((issueKey) => issueKey === key || !childKeys.has(issueKey));
  });

  let commitIdx = 0;

  for (const child of openChildren) {
    if (child.isDone === true) {
      continue;
    }

    const keyed = commits.find((commit) => parseIssueKeysFromText(commit.message).includes(child.jiraKey));

    if (keyed) {
      continue;
    }

    const mapped = unmapped[commitIdx];

    if (!mapped) {
      break;
    }

    commitIdx += 1;

    await closeWipSubtask(child.jiraKey, {
      parentKey         : key
    , commitHash        : resolveSubtaskCommitHash(key, mapped ?? null, git)
    , skipParentFinalize: true
    });
    closed.push(child.jiraKey);
    child.isDone = true;
  }

  await resyncWipCommitHashesFromGit(key);

  const freshChildren = await loadWipChildren(db, key);
  /** @type {import("../cruscotto.frontend/cruscotto.jira.backlog.wip.mjs").WipAdvancementEntry | null} */
  let advancement = null;

  if (areAllWipSubtasksDone(freshChildren)) {
    advancement = await closeParentWipForPush(key);
  } else {
    advancement = await touchParentWipProgress(key, { git });
  }

  return {
    parentKey: key
  , closed   : [...new Set(closed)]
  , advancement
  };
}

/**
 * Allinea commitHash subtask/parent WIP dai commit git su main..branch (anche se già Fatto).
 *
 * @param {string} parentKey
 */
export async function resyncWipCommitHashesFromGit(parentKey) {
  const key          = normalizeIssueKey(parentKey);
  const db           = await openCruscottoDb();
  const git          = readGitWorkflowInfo(key);
  const ticketBranch = resolveTicketBranchName(key, git);
  const commits      = listBranchCommitsSinceMain(ticketBranch);
  const children     = await loadWipChildren(db, key);
  const childKeys    = new Set(children.map((row) => row.jiraKey));

  for (const { hash, message } of commits) {
    const shortHash = hash ? hash.slice(0, 12) : null;

    if (!shortHash) {
      continue;
    }

    for (const issueKey of parseIssueKeysFromText(message)) {
      if (issueKey === key || !childKeys.has(issueKey)) {
        continue;
      }

      const child = children.find((row) => row.jiraKey === issueKey);

      if (!child) {
        continue;
      }

      const raw = parseWipRawFields(child.rawFields);

      if (raw.commitHash === shortHash) {
        continue;
      }

      await db.jiraIssueWip.update({
        where: { jiraKey: issueKey }
      , data : {
          rawFields: JSON.stringify({ ...raw, commitHash: shortHash })
        , syncedAt : new Date()
        }
      });
    }
  }

  const parent = await db.jiraIssueWip.findUnique({ where: { jiraKey: key } });

  if (!parent) {
    return;
  }

  const branchTip = shortBranchTipHash(key, git);

  if (!branchTip) {
    return;
  }

  const raw = parseWipRawFields(parent.rawFields);

  if (raw.commitHash === branchTip) {
    return;
  }

  await db.jiraIssueWip.update({
    where: { jiraKey: key }
  , data : {
      rawFields: JSON.stringify({ ...raw, commitHash: branchTip })
    , syncedAt : new Date()
    }
  });
}

/**
 * Parent WIP in corso — branch, commit e subtask chiuse (ripresa dopo interruzione).
 *
 * @param {string} parentKey
 * @param {{
 *   git?: ReturnType<typeof readGitWorkflowInfo>
 *   pr?: ReturnType<typeof resolvePrUrlForIssueKey>
 *   now?: string
 * }} [opts]
 * @returns {Promise<import("../cruscotto.frontend/cruscotto.jira.backlog.wip.mjs").WipAdvancementEntry | null>}
 */
export async function touchParentWipProgress(parentKey, opts = {}) {
  const key = normalizeIssueKey(parentKey);
  const db  = await openCruscottoDb();
  const parent = await db.jiraIssueWip.findUnique({ where: { jiraKey: key } });

  if (!parent) {
    return null;
  }

  const git      = opts.git ?? readGitWorkflowInfo(key);
  const pr       = opts.pr ?? resolvePrUrlForIssueKey(key);
  const now      = opts.now ?? new Date().toISOString();
  const children = await loadWipChildren(db, key);
  const raw      = parseWipRawFields(parent.rawFields);
  const storedBranch = typeof raw.branch === "string" ? raw.branch.trim() : "";
  const branch = isTicketWorkflowBranch(storedBranch, key)
    ? storedBranch
    : (pr.branch ?? resolveTicketBranchName(key, git) ?? (git.branch !== "—" ? git.branch : null));
  const branchTip = shortBranchTipHash(key, git);
  const closedSubtasks = children
    .filter((row) => row.isDone === true)
    .map((row) => row.jiraKey);

  /** @type {Record<string, unknown>} */
  const nextRaw = {
    ...raw
  , gogoInProgress   : true
  , wipLastSyncAt    : now
  , wipClosedSubtasks: closedSubtasks
  , branch           : branch ?? raw.branch ?? null
  , commitHash       : branchTip ?? raw.commitHash ?? null
  };

  const updated = await db.jiraIssueWip.update({
    where: { jiraKey: key }
  , data : {
      rawFields: JSON.stringify(nextRaw)
    , syncedAt : new Date()
    }
  });

  return buildWipAdvancementEntry(updated, children, { inWip: true });
}

/**
 * Sync progresso WIP da git — alias esplicito per API/UI durante gogo.
 *
 * @param {string} parentKey
 */
export async function syncWipProgressFromGit(parentKey) {
  return syncWipSubtasksFromGitCommits(parentKey);
}

/**
 * Chiude subtask WIP ancora aperte dopo gogo END-A.
 *
 * @param {string} parentKey
 * @param {{
 *   git?: ReturnType<typeof readGitWorkflowInfo>
 *   pr?: ReturnType<typeof resolvePrUrlForIssueKey>
 *   now?: string
 * }} [opts]
 */
export async function closeRemainingWipSubtasksAfterGogo(parentKey, opts = {}) {
  const key      = normalizeIssueKey(parentKey);
  const db       = await openCruscottoDb();
  const git      = opts.git ?? readGitWorkflowInfo(key);
  const pr       = opts.pr ?? resolvePrUrlForIssueKey(key);
  const now      = opts.now ?? new Date().toISOString();
  const children = await loadWipChildren(db, key);
  const open     = children.filter((row) => row.isDone !== true);

  if (!open.length) {
    return { parentKey: key, closed: [] };
  }

  const ticketBranch = resolveTicketBranchName(key, git);
  const commits      = listBranchCommitsSinceMain(ticketBranch);
  /** @type {string[]} */
  const closed       = [];

  let commitIdx = 0;

  for (const child of open) {
    const keyed  = commits.find((commit) => parseIssueKeysFromText(commit.message).includes(child.jiraKey));
    const mapped = keyed ?? commits[commitIdx];
    const hash   = resolveSubtaskCommitHash(key, mapped ?? null, git);

    if (!keyed && mapped) {
      commitIdx += 1;
    }

    if (!hash) {
      continue;
    }

    await closeWipSubtask(child.jiraKey, {
      parentKey         : key
    , commitHash        : hash
    , skipParentFinalize: true
    });
    closed.push(child.jiraKey);
  }

  const parentAdvancement = await closeParentWipForPush(key, { git, pr, now });

  return { parentKey: key, closed, parentAdvancement };
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
  const storedBranch = typeof raw.branch === "string" ? raw.branch.trim() : "";
  const branch = isTicketWorkflowBranch(storedBranch, key)
    ? storedBranch
    : (pr.branch ?? resolveTicketBranchName(key, git) ?? (git.branch !== "—" ? git.branch : null));

  const branchTip = shortBranchTipHash(key, git);

  /** @type {Record<string, unknown>} */
  const nextRaw = {
    ...raw
  , gogoCompletedAt: raw.gogoCompletedAt ?? now
  , branch
  , commitHash     : branchTip ?? raw.commitHash ?? null
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
