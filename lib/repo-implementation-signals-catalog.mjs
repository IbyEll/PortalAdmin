/**
 * Aggiorna REPO_IMPLEMENTATION_SIGNALS in jira-backlog-insights.mjs
 * (workflow «chiudi Story/Bug/Todo» e «chiudi fast» via close-story.mjs).
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

import { scanRepoJiraReferences } from "./repo-jira-refs.mjs";
import { getPortalRoot, getProductRepoPath } from "./portal-paths.mjs";

const LIB_DIR        = dirname(fileURLToPath(import.meta.url));
const PRODUCT_ROOT   = getProductRepoPath();
const PORTAL_ROOT    = getPortalRoot();
const INSIGHTS_FILE  = join(LIB_DIR, "jira-backlog-insights.mjs");
const SIGNALS_MARKER = "export const REPO_IMPLEMENTATION_SIGNALS = [";

/** @type {ReadonlySet<string>} */
const SKIP_PATH_PARTS = new Set([
  "node_modules"
, ".next"
, ".git"
, "coverage"
, ".turbo"
, "history"
, "dev.db"
, "archives"
]);

/** @type {ReadonlySet<string>} */
const SKIP_BASENAMES = new Set([
  "package-lock.json"
, "pnpm-lock.yaml"
, "yarn.lock"
]);

const MAX_PATHS = 6;
const MAX_TESTS = 4;

const BRANCH_PREFIXES = ["STORY---", "BUG---", "TODO---"];

const GIT_EVIDENCE_COMMIT_LIMIT = 5;

export { GIT_EVIDENCE_COMMIT_LIMIT };

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ allowFail?: boolean }} [opts]
 */
function runGit(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, {
      cwd       : PRODUCT_ROOT,
      encoding  : "utf8",
      stdio     : ["pipe", "pipe", "pipe"],
      maxBuffer : 10 * 1024 * 1024,
    }).trim();
  } catch (err) {
    if (opts.allowFail) {
      return "";
    }

    const stderr = err.stderr?.toString?.() ?? err.message ?? String(err);
    throw new Error(stderr.trim() || `${cmd} ${args.join(" ")} failed`);
  }
}

/**
 * @param {string} key
 */
export function signalKeyExistsInFile(key) {
  const content = readFileSync(INSIGHTS_FILE, "utf8");

  return new RegExp(`key\\s*:\\s*"${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(content);
}

const GITHUB_REPO_URL = "https://github.com/IbyEll/JustLastOne";

/**
 * Path sorgente che conta come implementazione (esclude citazioni solo cruscotto/Jira tooling).
 * @param {string} rel
 */
export function isMeaningfulCitationPath(rel) {
  const norm = rel.replace(/\\/g, "/");

  if (!norm || SKIP_BASENAMES.has(norm.split("/").pop() ?? "")) {
    return false;
  }

  for (const part of SKIP_PATH_PARTS) {
    if (norm.split("/").includes(part)) {
      return false;
    }
  }

  if (norm.startsWith("data/")) {
    return false;
  }

  if (norm.startsWith("cruscotto/")) {
    return false;
  }

  if (
    norm === "lib/jira-working-order.mjs"
    || norm === "lib/jira-working-insights.mjs"
    || norm === "lib/jira-project-tree-plan.mjs"
    || norm === "scripts/confluence-pillar-matrix-body.html"
    || norm === "scripts/generate-confluence-pillar-matrix.mjs"
    || norm === "scripts/publish-confluence-pillar-matrix.mjs"
    || norm === "lib/pillar-matrix-portal.mjs"
    || norm === "scripts/generate-pillar-matrix-portal.mjs"
    || norm === "lib/pillar-matrix-regenerate.mjs"
  ) {
    return false;
  }

  return (
    norm.startsWith("apps/")
    || norm.startsWith("packages/")
    || norm.startsWith("Admin/")
    || norm.startsWith("lib/")
    || norm.startsWith("server/")
    || norm.startsWith("cruscotto/")
    || norm.startsWith("scripts/")
    || norm.startsWith("testScript/")
  );
}

/**
 * @param {string[]} files
 * @returns {string[]}
 */
export function collapseChangedPaths(files) {
  /** @type {Map<string, number>} */
  const dirCounts = new Map();

  for (const raw of files) {
    const rel = raw.replace(/\\/g, "/");

    if (!isMeaningfulCitationPath(rel)) {
      continue;
    }

    const parts = rel.split("/");
    const bucket = parts.length >= 3
      ? parts.slice(0, 3).join("/")
      : parts.slice(0, -1).join("/") || rel;

    dirCounts.set(bucket, (dirCounts.get(bucket) ?? 0) + 1);
  }

  const ranked = [...dirCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([path]) => path);

  /** @type {string[]} */
  const out = [];

  for (const path of ranked) {
    if (out.length >= MAX_PATHS) {
      break;
    }

    if (!out.some((p) => path.startsWith(`${p}/`) || p.startsWith(`${path}/`))) {
      out.push(path);
    }
  }

  if (out.length === 0) {
    for (const raw of files) {
      const rel = raw.replace(/\\/g, "/");

      if (isMeaningfulCitationPath(rel) && out.length < MAX_PATHS) {
        out.push(rel);
      }
    }
  }

  return out;
}

/**
 * @param {string} branch
 * @param {number} [limit]
 * @returns {string[]}
 */
export function listBranchCommitFiles(branch, limit = 80) {
  const log = runGit(
    "git"
  , ["log", branch, "--name-only", "--format=", `-n`, String(limit)]
  , { allowFail: true }
  );

  if (!log) {
    return [];
  }

  return [...new Set(log.split("\n").map((line) => line.trim()).filter(Boolean))];
}

/**
 * @param {string} branch
 * @returns {string[]}
 */
export function listBranchChangedFiles(branch) {
  const fromDiff = runGit("git", ["diff", "--name-only", `main...${branch}`], { allowFail: true });

  if (fromDiff) {
    return fromDiff.split("\n").map((line) => line.trim()).filter(Boolean);
  }

  const fromLog = runGit(
    "git"
  , ["log", `main..${branch}`, "--name-only", "--format="]
  , { allowFail: true }
  );

  if (fromLog) {
    return [...new Set(fromLog.split("\n").map((line) => line.trim()).filter(Boolean))];
  }

  return [];
}

/**
 * @param {string} key
 * @param {string} branch
 * @returns {string[]}
 */
export function listFilesFromKeyCommits(key, branch) {
  const log = runGit(
    "git"
  , ["log", branch, "--grep", key, "-30", "--name-only", "--format="]
  , { allowFail: true }
  );

  if (!log) {
    return [];
  }

  return [...new Set(log.split("\n").map((line) => line.trim()).filter(Boolean))];
}

/**
 * @param {string} key
 * @returns {string[]}
 */
export function listFilesFromKeyCommitsAnywhere(key) {
  const log = runGit(
    "git"
  , ["log", "--all", "--grep", key, "-50", "--name-only", "--format="]
  , { allowFail: true }
  );

  if (!log) {
    return [];
  }

  return [...new Set(log.split("\n").map((line) => line.trim()).filter(Boolean))];
}

/**
 * File toccati da merge commit su main il cui subject contiene la key.
 * @param {string} key
 * @param {number} [limit]
 * @returns {string[]}
 */
export function listFilesFromMainMergeCommits(key, limit = 8) {
  const hashes = runGit(
    "git"
  , ["log", "main", "--grep", key, `--format=%H`, `-n`, String(limit)]
  , { allowFail: true }
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  /** @type {Set<string>} */
  const files = new Set();

  for (const hash of hashes) {
    const names = runGit(
      "git"
    , ["show", hash, "-m", "--name-only", "--format="]
    , { allowFail: true }
    );

    for (const line of names.split("\n")) {
      const rel = line.trim();

      if (rel) {
        files.add(rel);
      }
    }
  }

  return [...files];
}

/** @type {Map<string, string> | null} */
let ticketBranchCache = null;

/**
 * @returns {Map<string, string>}
 */
function branchMapForAllTickets() {
  if (ticketBranchCache) {
    return ticketBranchCache;
  }

  /** @type {Map<string, string>} */
  const map = new Map();
  const reTyped = /(?:STORY|BUG|TODO)---(JLO-\d+)-/i;
  const reLegacy = /^JLO-(\d+)-/i;

  for (const line of runGit("git", ["branch", "-a"], { allowFail: true }).split("\n")) {
    const name = line
      .replace(/^\*?\s+/, "")
      .trim()
      .replace(/^remotes\/origin\//, "")
      .replace(/^origin\//, "");

    if (!name || name.includes("HEAD")) {
      continue;
    }

    const typed = name.match(reTyped);
    const legacy = name.match(reLegacy);
    const key = typed?.[1]?.toUpperCase() ?? (legacy ? `JLO-${legacy[1]}` : null);

    if (key && !map.has(key)) {
      map.set(key, name);
    }
  }

  ticketBranchCache = map;
  return map;
}

/**
 * @param {string} candidate
 * @param {number} [limit]
 * @returns {Array<{ hash: string, subject: string }>}
 */
function mainCommitsForKey(candidate, limit = GIT_EVIDENCE_COMMIT_LIMIT) {
  return runGit(
    "git"
  , ["log", "main", "--grep", candidate, `-n`, String(limit), "--format=%H|%s"]
  , { allowFail: true }
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const pipe    = line.indexOf("|");
      const hash    = pipe >= 0 ? line.slice(0, pipe) : line;
      const subject = pipe >= 0 ? line.slice(pipe + 1) : "";

      return { hash, subject: subject.trim() };
    });
}

/**
 * @param {string} branch
 * @param {number} [limit]
 * @returns {Array<{ hash: string, subject: string }>}
 */
function branchCommitsForRef(branch, limit = GIT_EVIDENCE_COMMIT_LIMIT) {
  return runGit(
    "git"
  , ["log", branch, `-n`, String(limit), "--format=%H|%s"]
  , { allowFail: true }
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const pipe    = line.indexOf("|");
      const hash    = pipe >= 0 ? line.slice(0, pipe) : line;
      const subject = pipe >= 0 ? line.slice(pipe + 1) : "";

      return { hash, subject: subject.trim() };
    });
}

/**
 * @param {Array<{ hash: string, subject: string }>} rows
 * @returns {Array<{ commitShort: string, commitSubject: string | null, githubUrl: string }>}
 */
function mapCommitRows(rows) {
  return rows.map((row) => ({
    commitShort   : row.hash.slice(0, 7)
  , commitSubject : row.subject || null
  , githubUrl     : `${GITHUB_REPO_URL}/commit/${row.hash}`
  }));
}

/**
 * @param {string} candidate
 * @returns {{ hash: string, subject: string } | null}
 */
function mainCommitForKey(candidate) {
  return mainCommitsForKey(candidate, 1)[0] ?? null;
}

/**
 * Branch GitHub + commit su main o tip branch per key JLO.
 * Per subtask prova anche parent story/epic (`fallbackKeys`).
 * Restituisce fino a {@link GIT_EVIDENCE_COMMIT_LIMIT} commit (non solo l'ultimo).
 *
 * @param {string} key
 * @param {string[]} [fallbackKeys]
 * @returns {{
 *   source        : "main" | "branch"
 *   branch        : string | null
 *   commits       : Array<{ commitShort: string, commitSubject: string | null, githubUrl: string }>
 *   commitShort   : string | null
 *   commitSubject : string | null
 *   githubUrl     : string | null
 *   matchedKey?   : string
 * } | null}
 */
export function resolveTicketGitEvidence(key, fallbackKeys = []) {
  const candidates = [
    key
  , ...fallbackKeys.filter((candidate) => candidate && candidate !== key)
  ];

  for (const candidate of candidates) {
    const mainRows = mainCommitsForKey(candidate);

    if (mainRows.length > 0) {
      const commits = mapCommitRows(mainRows);
      const first   = commits[0];

      return {
        source        : "main"
      , branch        : resolveTicketBranch(candidate)
      , commits
      , commitShort   : first.commitShort
      , commitSubject : first.commitSubject
      , githubUrl     : first.githubUrl
      , matchedKey    : candidate
      };
    }
  }

  for (const candidate of candidates) {
    const branch = resolveTicketBranch(candidate);

    if (!branch) {
      continue;
    }

    const branchRows = branchCommitsForRef(branch);
    const commits    = mapCommitRows(branchRows);
    const first      = commits[0] ?? null;

    return {
      source        : "branch"
    , branch
    , commits
    , commitShort   : first?.commitShort ?? null
    , commitSubject : first?.commitSubject ?? null
    , githubUrl     : `${GITHUB_REPO_URL}/tree/${encodeURIComponent(branch)}`
    , matchedKey    : candidate
    };
  }

  return null;
}

export function resolveTicketBranch(key) {
  const cached = branchMapForAllTickets().get(key.toUpperCase());

  if (cached) {
    return cached;
  }

  const num = key.replace(/^JLO-/i, "");
  /** @type {string[]} */
  const found = [];

  for (const prefix of BRANCH_PREFIXES) {
    const pattern = `${prefix}JLO-${num}-*`;

    for (const line of runGit("git", ["branch", "--list", pattern], { allowFail: true }).split("\n")) {
      const name = line.replace(/^\*?\s+/, "").trim();

      if (name) {
        found.push(name);
      }
    }

    for (const line of runGit("git", ["branch", "-r", "--list", `origin/${pattern}`], { allowFail: true }).split("\n")) {
      const name = line.replace(/^\*?\s+/, "").trim().replace(/^origin\//, "");

      if (name && !name.includes("HEAD")) {
        found.push(name);
      }
    }
  }

  for (const line of runGit("git", ["branch", "--list", `JLO-${num}-*`], { allowFail: true }).split("\n")) {
    const name = line.replace(/^\*?\s+/, "").trim();

    if (name) {
      found.push(name);
    }
  }

  const unique = [...new Set(found)];

  return unique[0] ?? null;
}

/**
 * @returns {string[]}
 */
export function listAllTicketBranchKeys() {
  /** @type {Set<string>} */
  const keys = new Set();
  const re = /(?:STORY|BUG|TODO)---(JLO-\d+)-/i;

  for (const line of runGit("git", ["branch", "-a"], { allowFail: true }).split("\n")) {
    const name = line.replace(/^\*?\s+/, "").trim().replace(/^remotes\/origin\//, "");
    const m = name.match(re);

    if (m) {
      keys.add(m[1].toUpperCase());
    }
  }

  return [...keys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * @param {string} key
 * @param {string} branch
 * @returns {string[]}
 */
export function deriveTestsForKey(key, branch) {
  const files = listBranchChangedFiles(branch)
    .filter((p) => p.replace(/\\/g, "/").startsWith("testScript/"));

  /** @type {string[]} */
  const fromDiff = [];

  for (const rel of files) {
    const norm = rel.replace(/\\/g, "/");

    try {
      const content = readFileSync(join(PRODUCT_ROOT, norm), "utf8");

      if (content.includes(key)) {
        fromDiff.push(norm.replace(/^testScript\//, ""));
      }
    } catch {
      /* skip */
    }

    if (fromDiff.length >= MAX_TESTS) {
      break;
    }
  }

  return fromDiff;
}

/**
 * @param {string} rel
 */
function pathPriority(rel) {
  const norm = rel.replace(/\\/g, "/");

  if (norm.startsWith("apps/")) {
    return 0;
  }

  if (norm.startsWith("packages/")) {
    return 1;
  }

  if (norm.startsWith("testScript/")) {
    return 2;
  }

  if (
    norm.startsWith("lib/")
    || norm.startsWith("server/")
    || norm.startsWith("cruscotto/")
    || norm.startsWith("scripts/")
  ) {
    return 3;
  }

  if (norm.startsWith("Admin/") && !norm.includes("cruscotto/jira-working")) {
    return 3;
  }

  if (norm.startsWith("docs/")) {
    return 9;
  }

  return 5;
}

/**
 * @param {string[]} paths
 */
function sortPathsByRelevance(paths) {
  return [...paths].sort((a, b) => pathPriority(a) - pathPriority(b) || a.localeCompare(b));
}

/**
 * @param {string} key
 * @param {string} branch
 */
export function deriveLabelFromCommits(key, branch) {
  const log = runGit(
    "git"
  , ["log", `main..${branch}`, "--reverse", "--format=%s", "-n", "1"]
  , { allowFail: true }
  );

  if (log) {
    const stripped = log
      .replace(new RegExp(`^${key}\\s*[-—:]?\\s*`, "i"), "")
      .replace(/^JLO-\d+\s*[-—:]?\s*/i, "")
      .trim();

    if (stripped) {
      return stripped;
    }
  }

  const slug = branch
    .replace(/^(?:STORY|BUG|TODO)---/i, "")
    .replace(new RegExp(`^${key}-`, "i"), "")
    .replace(/^JLO-\d+-/i, "")
    .replace(/-/g, " ")
    .trim();

  return slug || key;
}

/**
 * @param {string} key
 */
function deriveLabelFromAnywhere(key) {
  const log = runGit(
    "git"
  , ["log", "--all", "--grep", key, "--reverse", "--format=%s", "-n", "1"]
  , { allowFail: true }
  );

  if (!log) {
    return key;
  }

  const stripped = log
    .replace(new RegExp(`^${key}\\s*[-—:]?\\s*`, "i"), "")
    .replace(/^JLO-\d+\s*[-—:]?\s*/i, "")
    .trim();

  return stripped || key;
}

/**
 * @param {string} key
 * @param {string[]} files
 * @returns {string[]}
 */
function deriveTestsFromFiles(key, files) {
  /** @type {string[]} */
  const out = [];

  for (const rel of files) {
    const norm = rel.replace(/\\/g, "/");

    if (!norm.startsWith("testScript/")) {
      continue;
    }

    try {
      const content = readFileSync(join(PRODUCT_ROOT, norm), "utf8");

      if (content.includes(key)) {
        out.push(norm.replace(/^testScript\//, ""));
      }
    } catch {
      /* skip */
    }

    if (out.length >= MAX_TESTS) {
      break;
    }
  }

  return out;
}

/**
 * @param {string} key
 * @param {{ dryRun?: boolean, branch?: string | null }} [opts]
 */
export function ensureRepoImplementationSignalByKey(key, opts = {}) {
  const branch = opts.branch === undefined
    ? resolveTicketBranch(key)
    : opts.branch;

  return ensureRepoImplementationSignal(key, branch ?? "", {
    ...opts
    , noBranch : !branch
  });
}

/**
 * Path prodotto/admin significativi per key — branch, merge main, git, citazioni repo.
 * @param {string} key
 * @param {{ branch?: string | null }} [opts]
 * @returns {{ paths: string[], tests: string[], label: string }}
 */
export function resolveMeaningfulSignalPaths(key, opts = {}) {
  const branch = opts.branch === undefined
    ? resolveTicketBranch(key)
    : opts.branch;

  /** @type {Set<string>} */
  const files = new Set([
    ...listFilesFromMainMergeCommits(key)
  , ...listFilesFromKeyCommitsAnywhere(key)
  ]);

  if (branch) {
    for (const rel of [
      ...listBranchChangedFiles(branch)
    , ...listFilesFromKeyCommits(key, branch)
    , ...listBranchCommitFiles(branch)
    ]) {
      files.add(rel);
    }
  }

  let paths = collapseChangedPaths([...files]);
  let tests = branch
    ? deriveTestsForKey(key, branch)
    : deriveTestsFromFiles(key, [...files]);
  const label = branch
    ? deriveLabelFromCommits(key, branch)
    : deriveLabelFromAnywhere(key);

  if (paths.length === 0) {
    const refs = (scanRepoJiraReferences().get(key) ?? [])
      .filter(isMeaningfulCitationPath);

    if (refs.length > 0) {
      paths = sortPathsByRelevance(refs).slice(0, MAX_PATHS);
    }
  }

  if (tests.length === 0 && files.size > 0) {
    tests = deriveTestsFromFiles(key, [...files]);
  }

  return { paths, tests, label: label || key };
}

/**
 * @param {string} key
 * @param {{ label: string, paths: string[], tests?: string[] }} entry
 */
function formatSignalEntry(key, entry, { leadingComma = true } = {}) {
  const pathsLines = entry.paths.length === 1
    ? `  , paths : ["${entry.paths[0]}"]`
    : [
        "  , paths : ["
      , ...entry.paths.map((p, i) => `      ${i === 0 ? "" : ", "}"${p}"`)
      , "    ]"
      ].join("\n");

  let testsBlock = "";

  if (entry.tests?.length) {
    testsBlock = entry.tests.length === 1
      ? `\n  , tests : ["${entry.tests[0]}"]`
      : `\n  , tests : [\n${entry.tests.map((t, i) => `      ${i === 0 ? "" : ", "}"${t}"`).join("\n")}\n    ]`;
  }

  const prefix = leadingComma ? ", {" : "  {";

  return `${prefix}
    key   : "${key}"
  , label : "${entry.label.replace(/"/g, '\\"')}"
${pathsLines}${testsBlock}
  }`;
}

/**
 * @param {Array<{ key: string, label: string, paths: string[], tests?: string[] }>} signals
 * @param {{ dryRun?: boolean }} [opts]
 */
export function writeRepoImplementationSignals(signals, opts = {}) {
  const markerIdx = readFileSync(INSIGHTS_FILE, "utf8").indexOf(SIGNALS_MARKER);

  if (markerIdx < 0) {
    throw new Error("REPO_IMPLEMENTATION_SIGNALS non trovato in jira-backlog-insights.mjs");
  }

  const content = readFileSync(INSIGHTS_FILE, "utf8");
  const closeIdx  = content.indexOf("\n];", markerIdx);

  if (closeIdx < 0) {
    throw new Error("Chiusura array REPO_IMPLEMENTATION_SIGNALS non trovata");
  }

  const blocks = signals.map((signal, index) =>
    formatSignalEntry(signal.key, signal, { leadingComma: index > 0 })
  );

  const next = `${content.slice(0, markerIdx + SIGNALS_MARKER.length)}\n${blocks.join("\n")}\n${content.slice(closeIdx)}`;

  if (!opts.dryRun) {
    writeFileSync(INSIGHTS_FILE, next, "utf8");
  }

  return { count: signals.length };
}

/**
 * @param {string} key
 * @param {{ label: string, paths: string[], tests?: string[] }} entry
 * @param {{ dryRun?: boolean }} [opts]
 */
export function replaceSignalInInsightsFile(key, entry, opts = {}) {
  const content   = readFileSync(INSIGHTS_FILE, "utf8");
  const escaped   = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockRe   = new RegExp(
    `,\\s*\\{\\s*key\\s*:\\s*"${escaped}"[\\s\\S]*?\\n\\s*\\}`
  , "m"
  );
  const firstRe   = new RegExp(
    `(export const REPO_IMPLEMENTATION_SIGNALS = \\[\\s*)\\{\\s*key\\s*:\\s*"${escaped}"[\\s\\S]*?\\n\\s*\\}`
  , "m"
  );

  const replacement = formatSignalEntry(key, entry, { leadingComma: true });

  if (blockRe.test(content)) {
    const next = content.replace(blockRe, replacement);

    if (!opts.dryRun) {
      writeFileSync(INSIGHTS_FILE, next, "utf8");
    }

    return { updated: true };
  }

  if (firstRe.test(content)) {
    const next = content.replace(firstRe, `$1${formatSignalEntry(key, entry, { leadingComma: false })}`);

    if (!opts.dryRun) {
      writeFileSync(INSIGHTS_FILE, next, "utf8");
    }

    return { updated: true };
  }

  return { updated: false, reason: "not-found" };
}

/**
 * @param {string} key
 * @param {{ dryRun?: boolean }} [opts]
 */
export function removeSignalFromInsightsFile(key, opts = {}) {
  const content = readFileSync(INSIGHTS_FILE, "utf8");
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockRe = new RegExp(
    `,\\s*\\{\\s*key\\s*:\\s*"${escaped}"[\\s\\S]*?\\n\\s*\\}\\s*`
  , "m"
  );
  const firstRe = new RegExp(
    `(export const REPO_IMPLEMENTATION_SIGNALS = \\[\\s*)\\{\\s*key\\s*:\\s*"${escaped}"[\\s\\S]*?\\n\\s*\\}\\s*,?`
  , "m"
  );

  let next = content;

  if (blockRe.test(content)) {
    next = content.replace(blockRe, "");
  } else if (firstRe.test(content)) {
    next = content.replace(firstRe, "$1");
  } else {
    return { removed: false, reason: "not-found" };
  }

  if (!opts.dryRun) {
    writeFileSync(INSIGHTS_FILE, next, "utf8");
  }

  return { removed: true };
}

/**
 * @param {string} key
 * @param {{ label: string, paths: string[], tests?: string[] }} entry
 */
export function appendSignalToInsightsFile(key, entry) {
  const content = readFileSync(INSIGHTS_FILE, "utf8");
  const markerIdx = content.indexOf(SIGNALS_MARKER);

  if (markerIdx < 0) {
    throw new Error("REPO_IMPLEMENTATION_SIGNALS non trovato in jira-backlog-insights.mjs");
  }

  const closeIdx = content.indexOf("\n];", markerIdx);

  if (closeIdx < 0) {
    throw new Error("Chiusura array REPO_IMPLEMENTATION_SIGNALS non trovata");
  }

  const block = formatSignalEntry(key, entry);
  const next = `${content.slice(0, closeIdx)}\n${block}\n${content.slice(closeIdx)}`;

  writeFileSync(INSIGHTS_FILE, next, "utf8");
}

/**
 * @param {string} key
 * @param {string} branch
 * @param {{ dryRun?: boolean }} [opts]
 * @returns {{ updated: boolean, skipped: boolean, reason?: string, entry?: { label: string, paths: string[], tests?: string[] } }}
 */
export function ensureRepoImplementationSignal(key, branch, opts = {}) {
  if (signalKeyExistsInFile(key)) {
    return { updated: false, skipped: true, reason: "already-listed" };
  }

  const useBranch = branch && !opts.noBranch;

  let files = useBranch ? listBranchChangedFiles(branch) : [];

  if (useBranch) {
    files = [
      ...new Set([
        ...files
      , ...listFilesFromKeyCommits(key, branch)
      , ...listBranchCommitFiles(branch)
      ])
    ];
  }

  if (files.length === 0) {
    files = listFilesFromKeyCommitsAnywhere(key);
  }

  const paths   = collapseChangedPaths(files);
  const tests   = useBranch
    ? deriveTestsForKey(key, branch)
    : deriveTestsFromFiles(key, files);
  const label   = useBranch
    ? deriveLabelFromCommits(key, branch)
    : deriveLabelFromAnywhere(key);

  if (paths.length === 0) {
    const refs = (scanRepoJiraReferences().get(key) ?? [])
      .filter(isMeaningfulCitationPath);

    if (refs.length > 0) {
      paths.push(...sortPathsByRelevance(refs).slice(0, MAX_PATHS));
    }
  }

  if (paths.length === 0) {
    return {
      updated : false
    , skipped : true
    , reason  : "no-paths"
    };
  }

  /** @type {{ label: string, paths: string[], tests?: string[] }} */
  const entry = {
    label
  , paths
  };

  if (tests.length > 0) {
    entry.tests = tests;
  }

  if (!opts.dryRun) {
    appendSignalToInsightsFile(key, entry);
  }

  return { updated: true, skipped: false, entry };
}

/**
 * @param {string} key
 */
export function commitCatalogUpdate(key) {
  const rel = posix.normalize("lib/jira-backlog-insights.mjs").replace(/^\.\//, "");
  const porcelain = runGit("git", ["status", "--porcelain", rel], { allowFail: true });

  if (!porcelain) {
    return null;
  }

  runGit("git", ["add", rel]);
  runGit("git", ["commit", "-m", `${key} REPO_IMPLEMENTATION_SIGNALS catalogo`]);

  return runGit("git", ["rev-parse", "--short", "HEAD"], { allowFail: true }) || "committed";
}
