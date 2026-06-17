#!/usr/bin/env node
/**
 * Push branch ticket + PR aperta su main (idempotente).
 * Usato da workflow JLO «chiudi Story/Bug/Todo» e «chiudi fast» — push, PR, catalogo repo.
 *
 * Uso:
 *   node scripts/close-story.mjs --key JLO-930
 *   node scripts/close-story.mjs --branch STORY---JLO-930-export-excel-latest-json
 *   node scripts/close-story.mjs          (branch corrente se è una ticket branch)
 *   node scripts/close-story.mjs --dry-run
 *   node scripts/close-story.mjs --key JLO-930 --pillar
 *
 * Output stdout: JSON { ok, branch, prUrl, pushed, createdPr, commits, catalog?, pillar?, error? }
 * catalog: { updated, skipped, reason?, commit? } — REPO_IMPLEMENTATION_SIGNALS
 * pillar: aggiornamento mirato cruscotto/pillar-matrix/ (solo con --pillar; escluso dal chiudi di default)
 * Exit 0 = ok · 1 = errore (working tree sporco, push/gh fallito, branch non trovata)
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  commitCatalogUpdate
, ensureRepoImplementationSignal
} from "../lib/repo.implementation.signals.catalog.mjs";
import {
  commitPillarPortalUpdate
, updatePillarPortalForTicket
} from "../lib/pillar-matrix-targeted.mjs";
import { getPortalRoot } from "../lib/portal-paths.mjs";

const REPO_ROOT = getPortalRoot();

const PREFIXES = ["STORY---", "BUG---", "TODO---"];
const LEGACY_KEY_RE = /^(JLO|ADMIN)-\d+/;

/** @param {string} key */
function parseTicketKey(key) {
  const m = String(key).trim().toUpperCase().match(/^(JLO|ADMIN)-(\d+)$/);

  if (!m) {
    return null;
  }

  return {
    project : m[1]
  , num     : m[2]
  , full    : `${m[1]}-${m[2]}`
  };
}

/**
 * @param {string} key e.g. JLO-930 or ADMIN-81
 */
function normalizeKey(key) {
  const parsed = parseTicketKey(key);

  if (!parsed) {
    throw new Error(`Key ticket non valida: ${key} (attese JLO-xxx o ADMIN-xxx)`);
  }

  return parsed.full;
}

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ allowFail?: boolean }} [opts]
 */
function run(cmd, args, opts = {}) {
  try {
    return execFileSync(cmd, args, {
      cwd       : REPO_ROOT,
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
function listTicketBranches(key) {
  const parsed = parseTicketKey(key);

  if (!parsed) {
    return [];
  }

  const { project, num } = parsed;
  const found = new Set();

  for (const prefix of PREFIXES) {
    const pattern = `${prefix}${project}-${num}-*`;

    for (const line of run("git", ["branch", "--list", pattern], { allowFail: true }).split("\n")) {
      const name = line.replace(/^\*?\s+/, "").trim();

      if (name) {
        found.add(name);
      }
    }

    for (const line of run("git", ["branch", "-r", "--list", `origin/${pattern}`], { allowFail: true }).split("\n")) {
      const name = line.replace(/^\*?\s+/, "").trim().replace(/^origin\//, "");

      if (name && !name.includes("HEAD")) {
        found.add(name);
      }
    }
  }

  if (project === "JLO") {
    for (const line of run("git", ["branch", "--list", `JLO-${num}-*`], { allowFail: true }).split("\n")) {
      const name = line.replace(/^\*?\s+/, "").trim();

      if (name) {
        found.add(name);
      }
    }
  }

  return [...found];
}

/**
 * @param {string} branch
 */
function isTicketBranch(branch) {
  if (!branch) {
    return false;
  }

  if (PREFIXES.some((p) => branch.startsWith(p))) {
    return true;
  }

  return LEGACY_KEY_RE.test(branch) || /^(STORY|BUG|TODO)---(JLO|ADMIN)-\d+/i.test(branch);
}

/**
 * @param {string} branch
 */
function commitsAheadOfMain(branch) {
  try {
    run("git", ["rev-parse", "--verify", "main"]);
  } catch {
    return [];
  }

  const log = run("git", ["log", "main..HEAD", "--oneline"], { allowFail: true });

  if (!log) {
    return [];
  }

  return log.split("\n").map((line) => line.trim()).filter(Boolean);
}

/**
 * @param {string} branch
 */
function ensurePr(branch, dryRun) {
  const listed = run(
    "gh"
  , ["pr", "list", "--head", branch, "--base", "main", "--state", "open", "--json", "url", "--jq", ".[0].url"]
  , { allowFail: true }
  );

  if (listed) {
    return { prUrl: listed, createdPr: false };
  }

  const commits = commitsAheadOfMain(branch);
  const body = [
    "## Summary",
    commits.length ? commits.map((c) => `- ${c}`).join("\n") : "- (nessun commit rispetto a main)",
    "",
    "## Test plan",
    "- [ ] Verifica post-merge",
  ].join("\n");

  if (dryRun) {
    return { prUrl: `(dry-run) PR for ${branch}`, createdPr: true };
  }

  const url = run("gh", [
    "pr", "create",
    "--head", branch,
    "--base", "main",
    "--title", `${branch} -- to main`,
    "--body", body,
  ]);

  return { prUrl: url, createdPr: true };
}

function parseArgs(argv) {
  const dryRun     = argv.includes("--dry-run");
  const withPillar = argv.includes("--pillar");
  let key          = null;
  let branch       = null;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--key" && argv[i + 1]) {
      key = normalizeKey(argv[++i]);
    } else if (argv[i] === "--branch" && argv[i + 1]) {
      branch = argv[++i].trim();
    } else if (/^(JLO|ADMIN)-\d+$/i.test(argv[i])) {
      key = normalizeKey(argv[i]);
    }
  }

  return { dryRun, withPillar, key, branch };
}

/**
 * @param {string} ticketKey
 * @param {string} branch
 * @param {boolean} dryRun
 */
function updateImplementationCatalog(ticketKey, branch, dryRun) {
  const catalog = ensureRepoImplementationSignal(ticketKey, branch, { dryRun });

  if (!catalog.updated || dryRun) {
    return catalog;
  }

  const commit = commitCatalogUpdate(ticketKey);

  return { ...catalog, commit: commit ?? undefined };
}

function resolveBranch({ key, branch }) {
  if (branch) {
    return branch;
  }

  const current = run("git", ["branch", "--show-current"], { allowFail: true });

  if (isTicketBranch(current)) {
    if (!key || current.toUpperCase().includes(key.toUpperCase())) {
      return current;
    }
  }

  if (!key) {
    throw new Error("Specifica --key JLO-xxx o --branch oppure esegui da una ticket branch");
  }

  const candidates = listTicketBranches(key);

  if (candidates.length === 0) {
    throw new Error(`Nessuna branch per ${key}`);
  }

  if (candidates.length === 1) {
    return candidates[0];
  }

  if (current && candidates.includes(current)) {
    return current;
  }

  throw new Error(
    `Più branch per ${key}: ${candidates.join(", ")}. Usa --branch o fai checkout.`
  );
}

/**
 * @param {string | null} ticketKey
 * @param {{ dryRun?: boolean, skip?: boolean }} opts
 */
async function runPillarPortalUpdate(ticketKey, opts = {}) {
  if (opts.skip || !ticketKey) {
    return undefined;
  }

  try {
    const pillar = await updatePillarPortalForTicket(ticketKey, { dryRun: opts.dryRun });

    if (opts.dryRun || !pillar.ok) {
      return pillar;
    }

    const commit = commitPillarPortalUpdate(ticketKey);

    return {
      ...pillar
    , commit: commit.committed ? commit.commit : undefined
    , skippedCommit: commit.committed ? undefined : commit.reason
    };
  } catch (err) {
    return {
      ok    : false
    , error : err instanceof Error ? err.message : String(err)
    };
  }
}

async function main() {
  const { dryRun, withPillar, key, branch: branchArg } = parseArgs(process.argv.slice(2));
  const skipPillar = !withPillar;
  /** @type {{ ok: boolean, branch?: string, prUrl?: string, pushed?: boolean, createdPr?: boolean, commits?: string[], catalog?: object, pillar?: object, error?: string }} */
  const out = { ok: false };

  try {
    const porcelain = run("git", ["status", "--porcelain"], { allowFail: true });

    if (porcelain && !dryRun) {
      throw new Error("working tree non pulito — committa o stash manualmente");
    }

    const branch = resolveBranch({ key, branch: branchArg });
    const ticketKey = key ?? branch.match(/(JLO|ADMIN)-\d+/i)?.[0]?.toUpperCase() ?? null;

    if (dryRun) {
      out.ok = true;
      out.branch = branch;
      out.pushed = false;
      out.createdPr = false;
      out.commits = commitsAheadOfMain(branch);

      if (ticketKey) {
        out.catalog = updateImplementationCatalog(ticketKey, branch, true);
        out.pillar  = await runPillarPortalUpdate(ticketKey, { dryRun: true, skip: skipPillar });
      }

      console.log(JSON.stringify(out, null, 2));
      return;
    }

    run("git", ["fetch", "origin"]);

    const current = run("git", ["branch", "--show-current"], { allowFail: true });

    if (current !== branch) {
      run("git", ["checkout", branch]);
    }

    if (ticketKey) {
      out.catalog = updateImplementationCatalog(ticketKey, branch, false);
      out.pillar  = await runPillarPortalUpdate(ticketKey, { skip: skipPillar });
    }

    const hasRemote = Boolean(run("git", ["rev-parse", `origin/${branch}`], { allowFail: true }));
    const aheadRaw = hasRemote
      ? run("git", ["rev-list", "--count", `origin/${branch}..HEAD`], { allowFail: true })
      : "1";
    const ahead = Number(aheadRaw) || 0;

    let pushed = false;

    if (!hasRemote || ahead > 0) {
      run("git", ["push", "-u", "origin", branch]);
      pushed = true;
    }

    const { prUrl, createdPr } = ensurePr(branch, false);
    const commits = commitsAheadOfMain(branch);

    out.ok = true;
    out.branch = branch;
    out.prUrl = prUrl;
    out.pushed = pushed;
    out.createdPr = createdPr;
    out.commits = commits;
    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    out.error = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }
}

main();
