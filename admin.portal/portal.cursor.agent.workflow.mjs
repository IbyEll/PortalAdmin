/**
 * Workflow gogo/procedi — blocchi START/END formattati per log tab Cursor Agent.
 */

import { execFileSync } from "node:child_process";

import { analyzeParentForWorkflow } from "../admin.portal.JiraCORE/jiraCORE.repo..issuekey.gap.analysis.mjs";
import { formatRepoAnalysisMarkdown } from "../admin.portal.JiraCORE/JiraCORE.repo.issuekey.signal.analysis.mjs";
import { getProjectConfig } from "../lib/project.config.mjs";
import { getProductRepoPath } from "../lib/portal-paths.mjs";

const RULE = "─".repeat(72);
const JIRA_SITE = process.env.JIRA_SITE?.trim() || "myfuturejobsearch.atlassian.net";

/**
 * @param {string} prompt
 * @returns {{ kind: "gogo" | "procedi", parentKey: string } | null}
 */
export function parseWorkflowPrompt(prompt) {
  const text = String(prompt ?? "").trim();
  const m    = text.match(
    /^(gogo|procedi(?:\s+(?:Story|Bug|Todo))?)\s+((?:ADMIN|JLO)-\d+)\b/i
  );

  if (!m) {
    return null;
  }

  return {
    kind      : m[1].toLowerCase().startsWith("procedi") ? "procedi" : "gogo"
  , parentKey : m[2].toUpperCase()
  };
}

/**
 * @returns {{ branch: string, hash: string, repo: string, storyBranches: string[] }}
 */
function readGitWorkflowInfo(parentKey) {
  const repo = getProductRepoPath();
  const num  = parentKey.split("-")[1];
  const prefix = getProjectConfig().PRJ_JIRA_PREFIX;

  try {
    const branch = execFileSync("git", ["branch", "--show-current"], {
      cwd      : repo
    , encoding : "utf8"
    }).trim();

    const hash = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd      : repo
    , encoding : "utf8"
    }).trim();

    const branchesRaw = execFileSync(
      "git"
    , ["branch", "--list", `STORY---${prefix}-${num}-*`, `BUG---${prefix}-${num}-*`, `TODO---${prefix}-${num}-*`]
    , { cwd: repo, encoding: "utf8" }
    ).trim();

    const storyBranches = branchesRaw
      ? branchesRaw.split("\n").map((line) => line.replace(/^\*?\s+/, "").trim()).filter(Boolean)
      : [];

    return { branch, hash, repo, storyBranches };
  } catch {
    return { branch: "—", hash: "—", repo, storyBranches: [] };
  }
}

/**
 * @param {string} branch
 * @param {string} repo
 * @returns {string | null}
 */
function ghPrUrlForBranch(branch, repo) {
  if (!branch || branch === "—") {
    return null;
  }

  for (const state of ["open", "merged", "closed"]) {
    try {
      const url = execFileSync(
        "gh"
      , [
          "pr"
        , "list"
        , "--head"
        , branch
        , "--base"
        , "main"
        , "--state"
        , state
        , "--json"
        , "url"
        , "--jq"
        , ".[0].url"
        ]
      , { cwd: repo, encoding: "utf8" }
      ).trim();

      if (url.startsWith("http")) {
        return url;
      }
    } catch {
      // gh assente o branch senza PR
    }
  }

  return null;
}

/**
 * @param {string} branch
 * @param {string} parentKey
 * @returns {boolean}
 */
function isTicketWorkflowBranch(branch, parentKey) {
  const num    = parentKey.split("-")[1];
  const prefix = getProjectConfig().PRJ_JIRA_PREFIX;

  return new RegExp(`^(STORY|BUG|TODO)---${prefix}-${num}-`, "i").test(branch);
}

/**
 * Risolve URL PR GitHub per ticket workflow (branch STORY/BUG/TODO---KEY-*).
 *
 * @param {string} parentKey
 * @returns {{ prUrl: string | null, branch: string | null }}
 */
export function resolvePrUrlForIssueKey(parentKey) {
  const key = String(parentKey ?? "").trim().toUpperCase();

  if (!/^(ADMIN|JLO)-\d+$/.test(key)) {
    return { prUrl: null, branch: null };
  }

  const git = readGitWorkflowInfo(key);

  /** @type {string[]} */
  const candidates = [];

  if (git.branch && isTicketWorkflowBranch(git.branch, key)) {
    candidates.push(git.branch);
  }

  for (const branch of git.storyBranches) {
    if (!candidates.includes(branch)) {
      candidates.push(branch);
    }
  }

  for (const branch of candidates) {
    const prUrl = ghPrUrlForBranch(branch, git.repo);

    if (prUrl) {
      return { prUrl, branch };
    }
  }

  return { prUrl: null, branch: candidates[0] ?? null };
}

/**
 * @param {string} status
 */
function isTodoJiraStatus(status) {
  const s = String(status ?? "").toLowerCase();

  return !(s.includes("fatto") || s.includes("done") || s.includes("complet"));
}

/**
 * @param {{ kind: string, parentKey: string }} workflow
 * @returns {Promise<string>}
 */
export async function buildWorkflowStartBlock(workflow) {
  const { kind, parentKey } = workflow;
  const ctx                 = await analyzeParentForWorkflow(parentKey);
  const git           = readGitWorkflowInfo(parentKey);
  const parentStatus  = ctx.parentStatus ?? ctx.jiraStatusByKey[parentKey] ?? "—";
  const parentSummary = ctx.parentSummary ?? "—";

  const ordered = ctx.subtaskOrder?.length
    ? ctx.subtaskOrder.map((key) => ctx.subtasks.find((row) => row.key === key)).filter(Boolean)
    : ctx.subtasks;

  const todoSubtasks = ordered.filter(
    (row) => row && isTodoJiraStatus(row.status)
  );

  /** @type {string[]} */
  const subtaskLines = [];

  if (todoSubtasks.length === 0) {
    subtaskLines.push("  (nessuna subtask Da fare — verifica Jira o esegui veve per crearle)");
  } else {
    todoSubtasks.forEach((row, idx) => {
      subtaskLines.push(
        `  ${idx + 1}. ${row.key} · ${row.status} · ${row.summary}`
      );
    });
  }

  const gapMd = formatRepoAnalysisMarkdown(ctx.report, {
    parentKey
  , subtaskOrder: ctx.subtaskOrder
  }).trim();

  const branchHint = git.storyBranches.length
    ? git.storyBranches.join(", ")
    : `STORY---${getProjectConfig().PRJ_JIRA_PREFIX}-${parentKey.split("-")[1]}-* (non trovata)`;

  return [
    RULE
  , `START — ${kind} ${parentKey}`
  , RULE
  , ""
  , `Parent   : ${parentKey} — ${parentSummary}`
  , `Stato    : ${parentStatus}`
  , `Jira     : https://${JIRA_SITE}/browse/${parentKey}`
  , `Repo     : ${git.repo}`
  , `Branch   : ${git.branch} @ ${git.hash}`
  , `Ticket   : ${branchHint}`
  , ""
  , "Subtask da fare"
  , ...subtaskLines
  , ""
  , "Macrostep"
  , "  | Step                         | Stato |"
  , "  |------------------------------|-------|"
  , "  | Step 0 piano Jira + gap repo | ✅    |"
  , "  | Implementazione (agent)      | ⬜    |"
  , "  | ok chiudi subtask            | ⬜    |"
  , "  | chiudi parent                | ⬜    |"
  , ""
  , "Stato repo"
  , gapMd
  , ""
  , RULE
  ].join("\n");
}

/**
 * @param {{
 *   kind: string
 *   parentKey: string
 *   status: "finished" | "error" | "idle"
 *   error?: string | null
 * }} workflow
 * @returns {string}
 */
export function buildWorkflowEndBlock(workflow) {
  const git     = readGitWorkflowInfo(workflow.parentKey);
  const cfg     = getProjectConfig();
  const owner   = cfg.PRJ_GITHUB_OWNER;
  const repoName = cfg.PRJ_GITHUB_REPO;
  const label   = workflow.status === "error" ? "END-B (errori)" : "END-A";
  const pr      = resolvePrUrlForIssueKey(workflow.parentKey);

  /** @type {string[]} */
  const lines = [
    RULE
  , `${label} — ${workflow.kind} ${workflow.parentKey}`
  , RULE
  , ""
  , `Agent    : ${workflow.status}`
  , `Repo     : ${git.repo}`
  , `Branch   : ${git.branch}`
  , `Commit   : ${git.hash}`
  , `Jira     : https://${JIRA_SITE}/browse/${workflow.parentKey}`
  , `GitHub   : https://github.com/${owner}/${repoName}`
  ];

  if (pr.prUrl) {
    lines.push(`PR       : ${pr.prUrl}`);
  }

  if (workflow.error) {
    lines.push(`Errori   : ${workflow.error}`);
  }

  if (workflow.status === "finished") {
    lines.push("", "Prossimo : ok chiudi subtask · poi chiudi Story " + workflow.parentKey);
  } else {
    lines.push("", "Prossimo : correggi errori e rilancia gogo " + workflow.parentKey);
  }

  lines.push("", RULE);

  return lines.join("\n");
}
