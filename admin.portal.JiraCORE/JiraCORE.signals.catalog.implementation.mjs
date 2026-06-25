/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-18 21:32
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 03:36   by: IbyEll
 * modificato il: 2026-06-18 21:32   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                 Catalogo segnali implementazione — path, test e evidenza git per ticket Jira (PRJ_NAME).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Collegare ogni key Jira ai path sorgente reali senza duplicare git/scan in ogni script.
 *   - Policy path significativi centralizzata in REPO_SIGNALS_CATALOG_CONFIG (overlay jira.project.config).
 *
 *   A cosa serve:
 *   - Deriva paths, tests e label da branch/commit git sul product repo attivo.
 *   - Legge e aggiorna PROJECT_{overlay}/signals.catalog.{overlay}.mjs.
 *   - Evidenza GitHub (commit/branch) per pillar matrix e inspect backlog.
 *
 * Generalizzazione:
 *   Si — overlay PRJ_NAME, prefisso Jira e path testScript da project.config; policy da REPO_SIGNALS_CATALOG_CONFIG.
 *
 * Input:
 *   - PRJ_NAME — overlay product (resolveProjectOverlayName, getProjectConfig)
 *   - PRODUCT_REPO_PATH — root git product per branch/diff/scan
 *   - REPO_SIGNALS_CATALOG_CONFIG, GIT_EVIDENCE_COMMIT_LIMIT — da jira.project.config.overlay
 *   - key, branch, dryRun — parametri ensureRepoImplementationSignal e funzioni correlate
 *
 * Consumatori:
 *   - admin.portal.JiraCORE/jiraCORE.close.story.mjs — ensureRepoImplementationSignal, commitCatalogUpdate
 *   - admin.portal.JiraCORE/sync-repo-catalog.mjs — signalKeyExistsInFile, listAllTicketBranchKeys
 *   - cruscotto.jira.backlog.insights.mjs — isMeaningfulCitationPath
 *   - admin.script.standalone/confluence.pillar.matrix.generate.mjs — resolveTicketGitEvidence
 *   - admin.portal.JiraCORE/JiraCORE.repo.issuekey.signal.analysis.mjs — via cruscotto.jira.backlog.insights
 *
 * Export principali:
 *   - ensureRepoImplementationSignal / ensureRepoImplementationSignalByKey — voce catalogo
 *   - resolveMeaningfulSignalPaths — paths/tests/label senza scrivere file
 *   - resolveTicketGitEvidence — stack commit GitHub per inspect cruscotto
 *   - writeRepoImplementationSignals, replace/remove/appendSignalInInsightsFile — edit catalogo
 *   - commitCatalogUpdate — commit catalogo su PortalAdmin dopo chiudi ticket
 *   - isMeaningfulCitationPath, collapseChangedPaths — policy path per scan/inspect
 *
 * Variabili d'ambiente:
 *   PRJ_NAME, PRODUCT_REPO_PATH — via portal.paths.resolver e jira.project.config.overlay
 *
 * Config:
 *   REPO_SIGNALS_CATALOG_CONFIG + PROJECT_{overlay}/signals.catalog.*.mjs
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";

import {
  getProjectConfig
, getProjectGithubUrl
, resolveProjectOverlayName
} from "../admin.portal.lib/project.config.mjs";
import { scanRepoJiraReferences } from "./jira.function.repo.refs.mjs";
import { getPortalRoot, getProductRepoPath } from "../admin.portal.lib/portal.paths.resolver.mjs";
import {
  GIT_EVIDENCE_COMMIT_LIMIT
, REPO_SIGNALS_CATALOG_CONFIG
} from "./jira.project.config.overlay.mjs";

export { GIT_EVIDENCE_COMMIT_LIMIT };

// --- costanti di modulo — progetto attivo (PRJ_NAME) ---
const CATALOG              = REPO_SIGNALS_CATALOG_CONFIG;
const PROJECT              = getProjectConfig();
const JIRA_PREFIX          = PROJECT.PRJ_JIRA_PREFIX;
const REPO_ROOT            = getProductRepoPath();
const PORTAL_ROOT          = getPortalRoot();
const TEST_SCRIPT_PREFIX   = `${PROJECT.PRJ_TEST_SCRIPT}/`;
const GITHUB_REPO_URL      = getProjectGithubUrl();
const MAX_PATHS            = CATALOG.maxPaths;
const MAX_TESTS            = CATALOG.maxTests;
const BRANCH_PREFIXES      = CATALOG.branchTypePrefixes.map((t) => `${t}${CATALOG.branchKeySeparator}`);
const SKIP_PATH_PARTS      = new Set([...CATALOG.skipPathParts, PROJECT.PRJ_DB_FILENAME]);
const SKIP_BASENAMES       = new Set(CATALOG.skipBasenames);
const SKIP_EXACT_PATHS     = new Set(CATALOG.skipExactPaths);
const PATH_PRIORITY_RULES  = [
  ...CATALOG.pathPriority.filter((rule) => rule.prefix !== "testScript/")
, { prefix: TEST_SCRIPT_PREFIX, priority: 2 }
];

const BRANCH_KEY_PATTERN = JIRA_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** @type {ReadonlyArray<string>} */
const JIRA_PREFIXES = [JIRA_PREFIX];

const RE_TYPED_BRANCH = new RegExp(
  `(?:${CATALOG.branchTypePrefixes.join("|")})---(${BRANCH_KEY_PATTERN}-\\d+)-`
, "i"
);
const RE_LEGACY_BRANCH     = new RegExp(`^${BRANCH_KEY_PATTERN}-(\\d+)-`, "i");
const RE_JIRA_TICKET_KEY   = new RegExp(`^(${BRANCH_KEY_PATTERN})-(\\d+)$`, "i");
const RE_BRANCH_TYPE_PREFIX = new RegExp(
  `^(?:${CATALOG.branchTypePrefixes.join("|")})${CATALOG.branchKeySeparator}`
, "i"
);

/**
 * Path file segnali del progetto attivo (overlay PROJECT_{PRJ_NAME}/signals.catalog.*.mjs).
 *
 * @returns {string}
 */
function projectSignalsFile() {
  const overlay = resolveProjectOverlayName();

  return join(PORTAL_ROOT, `PROJECT_${overlay}`, `signals.catalog.${overlay}.mjs`);
}

/**
 * File catalogo e marker array per key Jira.
 *
 * @param {string} key
 * @returns {{ file: string, marker: string }}
 */
function resolveSignalsFileForKey(key) {
  void key;

  return {
    file   : projectSignalsFile()
  , marker : CATALOG.productSignalsMarker
  };
}

/**
 * @returns {string[]}
 */
function listSignalsCatalogFiles() {
  return [projectSignalsFile()];
}

/**
 * @param {string} text
 * @returns {string}
 */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {string} key
 * @returns {RegExp}
 */
function keyInFileRegex(key) {
  return new RegExp(`key\\s*:\\s*"${escapeRegExp(key)}"`);
}

/**
 * Rimuove prefissi Jira noti da subject commit o slug branch.
 *
 * @param {string} text
 * @returns {string}
 */
function stripKnownJiraPrefixes(text) {
  let out = text;

  for (const prefix of JIRA_PREFIXES) {
    out = out.replace(new RegExp(`^${prefix}-\\d+\\s*[-—:]?\\s*`, "i"), "");
    out = out.replace(new RegExp(`^${prefix}-\\d+-`, "i"), "");
  }

  return out;
}

// --- git — exec wrapper e scelta root product vs portal ---
/**
 * Esegue un comando git nel repository indicato; fail-fast o stringa vuota.
 *
 * @param {string} cwd
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ allowFail?: boolean }} [opts]
 * @returns {string}
 */
function runGitIn(cwd, cmd, args, opts = {}) {
  try {
    // 1. Esecuzione sincrona — stdout utf8, buffer ampio per log lunghi
    return execFileSync(cmd, args, {
      cwd
    , encoding  : "utf8"
    , stdio     : ["pipe", "pipe", "pipe"]
    , maxBuffer : 10 * 1024 * 1024
    }).trim();
  } catch (err) {
    // 2. allowFail — ritorno vuoto per probe opzionali (branch assente, ecc.)
    if (opts.allowFail) {
      return "";
    }

    const stderr = err.stderr?.toString?.() ?? err.message ?? String(err);
    throw new Error(stderr.trim() || `${cmd} ${args.join(" ")} failed`);
  }
}

/**
 * Git sul product repo (JLO) — wrapper di {@link runGitIn}.
 *
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ allowFail?: boolean }} [opts]
 * @returns {string}
 */
function runGit(cmd, args, opts = {}) {
  return runGitIn(REPO_ROOT, cmd, args, opts);
}

/**
 * Verifica se la key è già presente nei file catalogo segnali (idempotenza chiudi/sync).
 *
 * @param {string} key
 * @returns {boolean}
 */
export function signalKeyExistsInFile(key) {
  const re = keyInFileRegex(key);

  return listSignalsCatalogFiles().some((file) => re.test(readFileSync(file, "utf8")));
}

/**
 * Root git del progetto attivo (PRJ_NAME).
 *
 * @param {string} key
 * @returns {string}
 */
function gitRootForKey(key) {
  void key;

  return REPO_ROOT;
}

/**
 * Root git da nome branch (solo prefisso progetto attivo).
 *
 * @param {string} branch
 * @returns {string}
 */
function gitRootForBranch(branch) {
  void branch;

  return REPO_ROOT;
}

/**
 * URL repo GitHub per link commit/tree in cruscotto.
 *
 * @param {string} key
 * @returns {string}
 */
function githubUrlForKey(key) {
  void key;

  return GITHUB_REPO_URL;
}

// --- path policy — citazioni significative e collapse directory ---
/**
 * Path sorgente che conta come implementazione (esclude citazioni solo cruscotto/Jira tooling).
 *
 * @param {string} rel
 * @returns {boolean}
 */
export function isMeaningfulCitationPath(rel) {
  const norm = rel.replace(/\\/g, "/");

  // 1. Esclusioni basename, segmenti path e prefissi da REPO_SIGNALS_CATALOG_CONFIG
  if (!norm || SKIP_BASENAMES.has(norm.split("/").pop() ?? "")) {
    return false;
  }

  for (const part of SKIP_PATH_PARTS) {
    if (norm.split("/").includes(part)) {
      return false;
    }
  }

  for (const prefix of CATALOG.skipPathPrefixes) {
    if (norm.startsWith(prefix)) {
      return false;
    }
  }

  if (SKIP_EXACT_PATHS.has(norm)) {
    return false;
  }

  // 2. Whitelist prefissi significativi (testScript da PRJ_TEST_SCRIPT overlay)
  const prefixes = CATALOG.meaningfulPathPrefixes.map((prefix) =>
    prefix === "testScript/" ? TEST_SCRIPT_PREFIX : prefix
  );

  return prefixes.some((prefix) => norm.startsWith(prefix));
}

/**
 * Riduce elenco file git a pochi path rappresentativi (bucket per directory, max {@link MAX_PATHS}).
 *
 * @param {string[]} files
 * @returns {string[]}
 */
export function collapseChangedPaths(files) {
  // 1. Conta file significativi per prefisso directory (es. apps/api/src)
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

  // 2. Sceglie path senza sovrapposizione padre/figlio, fino a MAX_PATHS
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
    // 3. Fallback: singoli file se nessun bucket utile
    for (const raw of files) {
      const rel = raw.replace(/\\/g, "/");

      if (isMeaningfulCitationPath(rel) && out.length < MAX_PATHS) {
        out.push(rel);
      }
    }
  }

  return out;
}

// --- git scan — file da branch, main e commit grep key ---
/**
 * File toccati dagli ultimi commit sulla branch (name-only).
 *
 * @param {string} branch
 * @param {number} [limit]
 * @returns {string[]}
 */
export function listBranchCommitFiles(branch, limit = 80) {
  const root = gitRootForBranch(branch);
  const log = runGitIn(
    root
  , "git"
  , ["log", branch, "--name-only", "--format=", `-n`, String(limit)]
  , { allowFail: true }
  );

  if (!log) {
    return [];
  }

  return [...new Set(log.split("\n").map((line) => line.trim()).filter(Boolean))];
}

/**
 * File modificati rispetto a main (diff o log main..branch).
 *
 * @param {string} branch
 * @returns {string[]}
 */
export function listBranchChangedFiles(branch) {
  const root = gitRootForBranch(branch);
  // 1. Preferisce diff main...branch (file effettivamente introdotti sulla ticket branch)
  const fromDiff = runGitIn(root, "git", ["diff", "--name-only", `main...${branch}`], { allowFail: true });

  if (fromDiff) {
    return fromDiff.split("\n").map((line) => line.trim()).filter(Boolean);
  }

  // 2. Fallback — log name-only se diff non disponibile (branch non merge-base)
  const fromLog = runGitIn(
    root
  , "git"
  , ["log", `main..${branch}`, "--name-only", "--format="]
  , { allowFail: true }
  );

  if (fromLog) {
    return [...new Set(fromLog.split("\n").map((line) => line.trim()).filter(Boolean))];
  }

  return [];
}

/**
 * File nei commit della branch il cui messaggio contiene la key.
 *
 * @param {string} key
 * @param {string} branch
 * @returns {string[]}
 */
export function listFilesFromKeyCommits(key, branch) {
  const root = gitRootForBranch(branch);
  const log = runGitIn(
    root
  , "git"
  , ["log", branch, "--grep", key, "-30", "--name-only", "--format="]
  , { allowFail: true }
  );

  if (!log) {
    return [];
  }

  return [...new Set(log.split("\n").map((line) => line.trim()).filter(Boolean))];
}

/**
 * File nei commit --all --grep key (senza branch nota).
 *
 * @param {string} key
 * @returns {string[]}
 */
export function listFilesFromKeyCommitsAnywhere(key) {
  const root = gitRootForKey(key);
  const log = runGitIn(
    root
  , "git"
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
 *
 * @param {string} key
 * @param {number} [limit]
 * @returns {string[]}
 */
export function listFilesFromMainMergeCommits(key, limit = 8) {
  const root = gitRootForKey(key);
  const hashes = runGitIn(
    root
  , "git"
  , ["log", "main", "--grep", key, `--format=%H`, `-n`, String(limit)]
  , { allowFail: true }
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  /** @type {Set<string>} */
  const files = new Set();

  for (const hash of hashes) {
    const names = runGitIn(
      root
    , "git"
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

/** Cache branch per key — evita re-scan git ad ogni lookup nella stessa sessione. */
/** @type {Map<string, string> | null} */
let ticketBranchCache = null;

// --- branch map — cache key → branch tipizzata/legacy ---
/**
 * Mappa key → nome branch (product + PortalAdmin, tipizzate e legacy).
 * Risultato memorizzato in {@link ticketBranchCache} per la durata del processo.
 *
 * @returns {Map<string, string>}
 */
function branchMapForAllTickets() {
  if (ticketBranchCache) {
    return ticketBranchCache;
  }

  // 1. Scan branch -a sul repo progetto — pattern tipizzati e legacy
  /** @type {Map<string, string>} */
  const map = new Map();

  for (const root of [REPO_ROOT]) {
    for (const line of runGitIn(root, "git", ["branch", "-a"], { allowFail: true }).split("\n")) {
      const name = line
        .replace(/^\*?\s+/, "")
        .trim()
        .replace(/^remotes\/origin\//, "")
        .replace(/^origin\//, "");

      if (!name || name.includes("HEAD")) {
        continue;
      }

      const typed  = name.match(RE_TYPED_BRANCH);
      const legacy = name.match(RE_LEGACY_BRANCH);
      const key    = typed?.[1]?.toUpperCase()
        ?? (legacy ? `${JIRA_PREFIX}-${legacy[1]}` : null);

      if (key && !map.has(key)) {
        map.set(key, name);
      }
    }
  }

  // 2. Memoizza per sessione — evita git branch ripetuti
  ticketBranchCache = map;
  return map;
}

/**
 * Commit su main che citano la key (grep --format=%H|%s).
 *
 * @param {string} candidate
 * @param {number} [limit]
 * @returns {Array<{ hash: string, subject: string }>}
 */
function mainCommitsForKey(candidate, limit = GIT_EVIDENCE_COMMIT_LIMIT) {
  const root = gitRootForKey(candidate);

  return runGitIn(
    root
  , "git"
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
 * Commit sulla branch (tip, non solo main) per evidenza pre-merge.
 *
 * @param {string} branch
 * @param {number} [limit]
 * @returns {Array<{ hash: string, subject: string }>}
 */
function branchCommitsForRef(branch, limit = GIT_EVIDENCE_COMMIT_LIMIT) {
  const root = gitRootForBranch(branch);

  return runGitIn(
    root
  , "git"
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
 * Converte righe git log in commit con short-hash e link GitHub.
 *
 * @param {Array<{ hash: string, subject: string }>} rows
 * @param {string} githubUrl
 * @returns {Array<{ commitShort: string, commitSubject: string | null, githubUrl: string }>}
 */
function mapCommitRows(rows, githubUrl) {
  return rows.map((row) => ({
    commitShort   : row.hash.slice(0, 7)
  , commitSubject : row.subject || null
  , githubUrl     : `${githubUrl}/commit/${row.hash}`
  }));
}

/**
 * Primo commit su main per la key (convenienza, usato internamente).
 *
 * @param {string} candidate
 * @returns {{ hash: string, subject: string } | null}
 */
function mainCommitForKey(candidate) {
  return mainCommitsForKey(candidate, 1)[0] ?? null;
}

// --- git evidence GitHub — pillar matrix e inspect backlog ---
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

  // 1. Commit su main che citano la key (o fallback parent/epic)
  for (const candidate of candidates) {
    const mainRows = mainCommitsForKey(candidate);

    if (mainRows.length > 0) {
      const repoUrl = githubUrlForKey(candidate);
      const commits = mapCommitRows(mainRows, repoUrl);
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

  // 2. Branch ticket aperta — tree link se main non ha ancora merge
  for (const candidate of candidates) {
    const branch = resolveTicketBranch(candidate);

    if (!branch) {
      continue;
    }

    const branchRows = branchCommitsForRef(branch);
    const repoUrl    = githubUrlForKey(candidate);
    const commits    = mapCommitRows(branchRows, repoUrl);
    const first      = commits[0] ?? null;

    return {
      source        : "branch"
    , branch
    , commits
    , commitShort   : first?.commitShort ?? null
    , commitSubject : first?.commitSubject ?? null
    , githubUrl     : `${repoUrl}/tree/${encodeURIComponent(branch)}`
    , matchedKey    : candidate
    };
  }

  return null;
}

/**
 * Branch attiva per la key (product o ADMIN): cerca pattern tipizzati poi legacy.
 *
 * @param {string} key
 * @returns {string | null}
 */
export function resolveTicketBranch(key) {
  const cached = branchMapForAllTickets().get(key.toUpperCase());

  if (cached) {
    return cached;
  }

  // 1. Parse key — repo corretto da prefisso Jira (ADMIN vs product)
  const parsed = String(key).trim().toUpperCase().match(RE_JIRA_TICKET_KEY);

  if (!parsed) {
    return null;
  }

  const [, project, num] = parsed;
  const root             = REPO_ROOT;
  /** @type {string[]} */
  const found = [];

  // 2. Pattern STORY/BUG/TODO--- e legacy JLO-n- / ADMIN-n-
  for (const prefix of BRANCH_PREFIXES) {
    const pattern = `${prefix}${project}-${num}-*`;

    for (const line of runGitIn(root, "git", ["branch", "--list", pattern], { allowFail: true }).split("\n")) {
      const name = line.replace(/^\*?\s+/, "").trim();

      if (name) {
        found.push(name);
      }
    }

    for (const line of runGitIn(root, "git", ["branch", "-r", "--list", `origin/${pattern}`], { allowFail: true }).split("\n")) {
      const name = line.replace(/^\*?\s+/, "").trim().replace(/^origin\//, "");

      if (name && !name.includes("HEAD")) {
        found.push(name);
      }
    }
  }

  const legacyPattern = `${project}-${num}-*`;

  for (const line of runGitIn(root, "git", ["branch", "--list", legacyPattern], { allowFail: true }).split("\n")) {
    const name = line.replace(/^\*?\s+/, "").trim();

    if (name) {
      found.push(name);
    }
  }

  const unique = [...new Set(found)];

  return unique[0] ?? null;
}

/**
 * Tutte le key ticket con branch attiva (STORY/BUG/TODO---) nel repo progetto.
 *
 * @returns {string[]}
 */
export function listAllTicketBranchKeys() {
  /** @type {Set<string>} */
  const keys = new Set();
  const re   = new RegExp(`(?:STORY|BUG|TODO)---(${BRANCH_KEY_PATTERN}-\\d+)-`, "i");

  for (const line of runGitIn(REPO_ROOT, "git", ["branch", "-a"], { allowFail: true }).split("\n")) {
    const name = line.replace(/^\*?\s+/, "").trim().replace(/^remotes\/origin\//, "");
    const m    = name.match(re);

    if (m) {
      keys.add(m[1].toUpperCase());
    }
  }

  return [...keys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

// --- derive label/tests da branch o scan repo ---
/**
 * Script testScript/ dalla branch che citano la key — max {@link MAX_TESTS}.
 *
 * @param {string} key
 * @param {string} branch
 * @returns {string[]}
 */
export function deriveTestsForKey(key, branch) {
  const files = listBranchChangedFiles(branch)
    .filter((p) => p.replace(/\\/g, "/").startsWith(TEST_SCRIPT_PREFIX));

  /** @type {string[]} */
  const fromDiff = [];

  for (const rel of files) {
    const norm = rel.replace(/\\/g, "/");

    try {
      const content = readFileSync(join(REPO_ROOT, norm), "utf8");

      if (content.includes(key)) {
        fromDiff.push(norm.replace(new RegExp(`^${TEST_SCRIPT_PREFIX}`), ""));
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
 * Priorità path per sort significatività (apps < packages < testScript < lib/server < docs).
 *
 * @param {string} rel
 * @returns {number}
 */
function pathPriority(rel) {
  const norm = rel.replace(/\\/g, "/");

  for (const rule of PATH_PRIORITY_RULES) {
    if (!norm.startsWith(rule.prefix)) {
      continue;
    }

    if (rule.excludeContains && norm.includes(rule.excludeContains)) {
      continue;
    }

    return rule.priority;
  }

  return CATALOG.defaultPathPriority;
}

/**
 * Ordina path per rilevanza tecnica (via {@link pathPriority}).
 *
 * @param {string[]} paths
 * @returns {string[]}
 */
function sortPathsByRelevance(paths) {
  return [...paths].sort((a, b) => pathPriority(a) - pathPriority(b) || a.localeCompare(b));
}

/**
 * Label leggibile della key da primo commit sulla branch (strip key/prefisso).
 *
 * @param {string} key
 * @param {string} branch
 * @returns {string}
 */
export function deriveLabelFromCommits(key, branch) {
  const root = gitRootForBranch(branch);
  const log = runGitIn(
    root
  , "git"
  , ["log", `main..${branch}`, "--reverse", "--format=%s", "-n", "1"]
  , { allowFail: true }
  );

  if (log) {
    const stripped = stripKnownJiraPrefixes(
      log.replace(new RegExp(`^${key}\\s*[-—:]?\\s*`, "i"), "")
    ).trim();

    if (stripped) {
      return stripped;
    }
  }

  const slug = stripKnownJiraPrefixes(
    branch
      .replace(RE_BRANCH_TYPE_PREFIX, "")
      .replace(new RegExp(`^${key}-`, "i"), "")
  )
    .replace(/-/g, " ")
    .trim();

  return slug || key;
}

/**
 * Label da --all --grep (senza branch nota, fallback a key).
 *
 * @param {string} key
 * @returns {string}
 */
function deriveLabelFromAnywhere(key) {
  const root = gitRootForKey(key);
  const log = runGitIn(
    root
  , "git"
  , ["log", "--all", "--grep", key, "--reverse", "--format=%s", "-n", "1"]
  , { allowFail: true }
  );

  if (!log) {
    return key;
  }

  const stripped = stripKnownJiraPrefixes(
    log.replace(new RegExp(`^${key}\\s*[-—:]?\\s*`, "i"), "")
  ).trim();

  return stripped || key;
}

/**
 * Script testScript/ citati in elenco file arbitrario (fallback senza branch).
 *
 * @param {string} key
 * @param {string[]} files
 * @returns {string[]}
 */
function deriveTestsFromFiles(key, files) {
  /** @type {string[]} */
  const out = [];

  for (const rel of files) {
    const norm = rel.replace(/\\/g, "/");

    if (!norm.startsWith(TEST_SCRIPT_PREFIX)) {
      continue;
    }

    try {
      const content = readFileSync(join(REPO_ROOT, norm), "utf8");

      if (content.includes(key)) {
        out.push(norm.replace(new RegExp(`^${TEST_SCRIPT_PREFIX}`), ""));
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

// --- ensure / sync catalogo — append voce da git o scan ---
/**
 * Come {@link ensureRepoImplementationSignal} ma risolve la branch automaticamente.
 *
 * @param {string} key
 * @param {{ dryRun?: boolean, branch?: string | null }} [opts]
 * @returns {{ updated: boolean, skipped: boolean, reason?: string, entry?: { label: string, paths: string[], tests?: string[] } }}
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

// --- signals.catalog.*.mjs — serializzazione e rewrite array segnali ---
/**
 * Riscrive l'array segnali in un singolo file catalogo.
 *
 * @param {string} file
 * @param {string} marker
 * @param {Array<{ key: string, label: string, paths: string[], tests?: string[] }>} signals
 * @param {{ dryRun?: boolean }} [opts]
 */
function writeSignalsToFile(file, marker, signals, opts = {}) {
  const content   = readFileSync(file, "utf8");
  const markerIdx = content.indexOf(marker);

  if (markerIdx < 0) {
    throw new Error(`Marker segnali non trovato in ${file}`);
  }

  const closeIdx = content.indexOf("\n];", markerIdx);

  if (closeIdx < 0) {
    throw new Error(`Chiusura array segnali non trovata in ${file}`);
  }

  const blocks = signals.map((signal, index) =>
    formatSignalEntry(signal.key, signal, { leadingComma: index > 0 })
  );

  const next = `${content.slice(0, markerIdx + marker.length)}\n${blocks.join("\n")}\n${content.slice(closeIdx)}`;

  if (!opts.dryRun) {
    writeFileSync(file, next, "utf8");
  }

  return signals.length;
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
 * Riscrive gli array segnali product e portal (file dedicati).
 *
 * @param {Array<{ key: string, label: string, paths: string[], tests?: string[] }>} signals
 * @param {{ dryRun?: boolean }} [opts]
 */
export function writeRepoImplementationSignals(signals, opts = {}) {
  const projectSignals = signals.filter((s) =>
    String(s.key).toUpperCase().startsWith(`${JIRA_PREFIX}-`)
  );

  writeSignalsToFile(projectSignalsFile(), CATALOG.productSignalsMarker, projectSignals, opts);

  return { count: projectSignals.length };
}

/**
 * Sostituisce la voce esistente per la key nel file catalogo corretto.
 *
 * @param {string} key
 * @param {{ label: string, paths: string[], tests?: string[] }} entry
 * @param {{ dryRun?: boolean }} [opts]
 * @returns {{ updated: boolean, reason?: string }}
 */
export function replaceSignalInInsightsFile(key, entry, opts = {}) {
  const { file, marker } = resolveSignalsFileForKey(key);
  const content          = readFileSync(file, "utf8");
  const escaped          = escapeRegExp(key);
  const blockRe          = new RegExp(
    `,\\s*\\{\\s*key\\s*:\\s*"${escaped}"[\\s\\S]*?\\n\\s*\\}`
  , "m"
  );
  const firstRe          = new RegExp(
    `(${escapeRegExp(marker)}\\s*)\\{\\s*key\\s*:\\s*"${escaped}"[\\s\\S]*?\\n\\s*\\}`
  , "m"
  );

  const replacement = formatSignalEntry(key, entry, { leadingComma: true });

  if (blockRe.test(content)) {
    const next = content.replace(blockRe, replacement);

    if (!opts.dryRun) {
      writeFileSync(file, next, "utf8");
    }

    return { updated: true };
  }

  if (firstRe.test(content)) {
    const next = content.replace(firstRe, `$1${formatSignalEntry(key, entry, { leadingComma: false })}`);

    if (!opts.dryRun) {
      writeFileSync(file, next, "utf8");
    }

    return { updated: true };
  }

  return { updated: false, reason: "not-found" };
}

/**
 * Rimuove la voce della key dal file catalogo corretto.
 *
 * @param {string} key
 * @param {{ dryRun?: boolean }} [opts]
 */
export function removeSignalFromInsightsFile(key, opts = {}) {
  const { file, marker } = resolveSignalsFileForKey(key);
  const content          = readFileSync(file, "utf8");
  const escaped          = escapeRegExp(key);
  const blockRe          = new RegExp(
    `,\\s*\\{\\s*key\\s*:\\s*"${escaped}"[\\s\\S]*?\\n\\s*\\}\\s*`
  , "m"
  );
  const firstRe          = new RegExp(
    `(${escapeRegExp(marker)}\\s*)\\{\\s*key\\s*:\\s*"${escaped}"[\\s\\S]*?\\n\\s*\\}\\s*,?`
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
    writeFileSync(file, next, "utf8");
  }

  return { removed: true };
}

/**
 * Appende una nuova voce in fondo all'array segnali del file corretto.
 * Non verifica duplicati — usa {@link signalKeyExistsInFile} prima se necessario.
 *
 * @param {string} key
 * @param {{ label: string, paths: string[], tests?: string[] }} entry
 */
export function appendSignalToInsightsFile(key, entry) {
  const { file, marker } = resolveSignalsFileForKey(key);
  const content          = readFileSync(file, "utf8");
  const markerIdx        = content.indexOf(marker);

  if (markerIdx < 0) {
    throw new Error(`Marker segnali non trovato in ${file}`);
  }

  const closeIdx = content.indexOf("\n];", markerIdx);

  if (closeIdx < 0) {
    throw new Error(`Chiusura array segnali non trovata in ${file}`);
  }

  const block = formatSignalEntry(key, entry);
  const next  = `${content.slice(0, closeIdx)}\n${block}\n${content.slice(closeIdx)}`;

  writeFileSync(file, next, "utf8");
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

  // 1. Raccoglie file da diff branch, commit grep key, log branch
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

  // 2. Collapse path, derive tests/label — fallback scan citazioni repo
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

  // 3. Append nel file catalogo product o portal (salvo dryRun)
  if (!opts.dryRun) {
    appendSignalToInsightsFile(key, entry);
  }

  return { updated: true, skipped: false, entry };
}

/**
 * Esegue git add + commit sui file catalogo segnali modificati.
 * Usato da admin.portal.JiraCORE/jiraCORE.close.story.mjs dopo aggiornamento PRODUCT_REPO_SIGNALS / PORTAL_ADMIN_REPO_SIGNALS.
 *
 * @param {string} key
 * @returns {string | null} short-hash del commit, oppure null se nessuna modifica
 */
export function commitCatalogUpdate(key) {
  const dirty = listSignalsCatalogFiles()
    .map((abs) => posix.relative(PORTAL_ROOT, abs).split("\\").join("/"))
    .filter((rel) => runGitIn(PORTAL_ROOT, "git", ["status", "--porcelain", rel], { allowFail: true }));

  if (dirty.length === 0) {
    return null;
  }

  runGitIn(PORTAL_ROOT, "git", ["add", ...dirty]);
  runGitIn(PORTAL_ROOT, "git", ["commit", "-m", `${key} REPO_IMPLEMENTATION_SIGNALS catalogo`]);

  return runGitIn(PORTAL_ROOT, "git", ["rev-parse", "--short", "HEAD"], { allowFail: true }) || "committed";
}
