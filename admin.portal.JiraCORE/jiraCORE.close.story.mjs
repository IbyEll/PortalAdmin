#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-18 21:32
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 21:32   by: IbyEll
 * modificato il: 2026-06-18 21:32   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *           Push branch ticket + PR su main — idempotente per chiudi Story/Bug/Todo e chiudi fast.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Il workflow chiudi/chiudi fast e step 8 PUSH: catalogo segnali, push branch e PR in un solo passo.
 *   - Evita comandi git/gh separati dall'agente e mantiene idempotenza su branch già pushate.
 *
 *   A cosa serve:
 *   - Risolve branch ticket, aggiorna REPO_IMPLEMENTATION_SIGNALS (commit), poi push branch, apre PR su main.
 *   - Stampa JSON { ok, branch, prUrl, pushed, commits, catalog?, pillar?, error? } su stdout.
 *
 * Generalizzazione:
 *   Si — key JLO-xxx e ADMIN-xxx; branch STORY/BUG/TODO--- e legacy JLO-n-*; repo PortalAdmin root.
 *
 * Input:
 *   - argv --key, --branch, --dry-run, --pillar — ticket e opzioni chiudi
 *   - git + gh — branch corrente, push origin, pr create/list
 *   - PRODUCT_REPO_PATH — scan path catalogo via signals.catalog.implementation
 *
 * Uso:
 *   - node admin.portal.JiraCORE/jiraCORE.close.story.mjs --key JLO-930
 *   - node admin.portal.JiraCORE/jiraCORE.close.story.mjs --branch STORY---JLO-930-export-excel
 *   - node admin.portal.JiraCORE/jiraCORE.close.story.mjs --dry-run
 *   - node admin.portal.JiraCORE/jiraCORE.close.story.mjs --key JLO-930 --pillar
 *
 * Flag CLI:
 *   --key KEY       ticket JLO-xxx o ADMIN-xxx (o posizionale)
 *   --branch NAME   branch esplicita se più candidate
 *   --dry-run       anteprima JSON senza git write né push
 *   --pillar        aggiorna pillar-matrix (opt-in; escluso dal chiudi default)
 *
 * Output stdout:
 *   catalog — { updated, skipped, reason?, commit? } su signals.catalog overlay
 *   Exit 0 = ok · 1 = errore (working tree sporco, push/gh fallito, branch assente)
 *
 * Consumatori:
 *   - .cursor/rules/JLO-Workflow.mdc — chiudi Story/Bug/Todo dopo subtask Fatto
 *   - test.smoke/smoke-workflow.mjs — --dry-run ADMIN-93
 *   - test.smoke/smoke-portal-config.mjs — --dry-run key di prova
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { execFileSync } from "node:child_process";

import "../admin.portal.lib/portal.load.env.mjs";

import {
  commitCatalogUpdate
, ensureRepoImplementationSignal
} from "./JiraCORE.signals.catalog.implementation.mjs";

import {
  buildChiudiParentContextFromIssue
, buildChiudiParentMarkdown
, syncChiudiParentToJira
} from "./jiraCORE.workflow.description.mjs";

import { getPortalRoot } from "../admin.portal.lib/portal.paths.resolver.mjs";

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
      cwd       : REPO_ROOT
    , encoding  : "utf8"
    , stdio     : ["pipe", "pipe", "pipe"]
    , maxBuffer : 10 * 1024 * 1024
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
  const found            = new Set();

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
    const title = run(
      "gh"
    , ["pr", "view", listed, "--json", "title", "--jq", ".title"]
    , { allowFail: true }
    );

    return {
      prUrl    : listed
    , prTitle  : title || `${branch} -- to main`
    , createdPr: false
    };
  }

  const commits = commitsAheadOfMain(branch);
  const body    = [
    "## Summary"
  , commits.length ? commits.map((c) => `- ${c}`).join("\n") : "- (nessun commit rispetto a main)"
  , ""
  , "## Test plan"
  , "- [ ] Verifica post-merge"
  ].join("\n");

  if (dryRun) {
    return {
      prUrl    : `(dry-run) PR for ${branch}`
    , prTitle  : `${branch} -- to main`
    , createdPr: true
    };
  }

  const url = run("gh", [
    "pr", "create"
  , "--head", branch
  , "--base", "main"
  , "--title", `${branch} -- to main`
  , "--body", body
  ]);

  return {
    prUrl    : url
  , prTitle  : `${branch} -- to main`
  , createdPr: true
  };
}

function hasJiraCredentials() {
  return Boolean(process.env.JIRA_EMAIL?.trim() && process.env.JIRA_API_TOKEN?.trim());
}

/**
 * @param {string[]} commits
 * @returns {string}
 */
function primaryCommitHash(commits) {
  const first = commits[0] ?? "";
  const hash  = first.match(/\b([0-9a-f]{7,40})\b/i)?.[1];

  if (hash) {
    return hash.slice(0, 12);
  }

  return run("git", ["rev-parse", "--short", "HEAD"], { allowFail: true }) || "—";
}

function parseArgs(argv) {
  const dryRun     = argv.includes("--dry-run");
  const withPillar = argv.includes("--pillar");
  const noJiraSync = argv.includes("--no-jira-sync");
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

  return { dryRun, withPillar, noJiraSync, key, branch };
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
    , commit        : commit.committed ? commit.commit : undefined
    , skippedCommit : commit.committed ? undefined : commit.reason
    };
  } catch (err) {
    return {
      ok    : false
    , error : err instanceof Error ? err.message : String(err)
    };
  }
}

async function main() {
  // 1. Parse argv — key, branch, dry-run, pillar opt-in
  const { dryRun, withPillar, noJiraSync, key, branch: branchArg } = parseArgs(process.argv.slice(2));
  const skipPillar                                     = !withPillar;
  /** @type {{ ok: boolean, branch?: string, prUrl?: string, pushed?: boolean, createdPr?: boolean, commits?: string[], catalog?: object, pillar?: object, error?: string }} */
  const out                                            = { ok: false };

  try {
    // 2. Working tree pulito — stop se modifiche non committate (salvo dry-run)
    const porcelain = run("git", ["status", "--porcelain"], { allowFail: true });

    if (porcelain && !dryRun) {
      throw new Error("working tree non pulito — committa o stash manualmente");
    }

    // 3. Branch ticket — da argv, corrente o lista git per key
    const branch    = resolveBranch({ key, branch: branchArg });
    const ticketKey = key ?? branch.match(/(JLO|ADMIN)-\d+/i)?.[0]?.toUpperCase() ?? null;

    if (dryRun) {
      out.ok        = true;
      out.branch    = branch;
      out.pushed    = false;
      out.createdPr = false;
      out.commits   = commitsAheadOfMain(branch);

      if (ticketKey) {
        out.catalog = updateImplementationCatalog(ticketKey, branch, true);
        out.pillar  = await runPillarPortalUpdate(ticketKey, { dryRun: true, skip: skipPillar });
        const ctx  = await buildChiudiParentContextFromIssue(ticketKey, {
          branch         : branch
        , commit         : primaryCommitHash(out.commits ?? [])
        , prUrl          : null
        , catalogUpdated : Boolean(out.catalog?.updated)
        });
        out.parentDescriptionMarkdown = buildChiudiParentMarkdown(ctx);
      }

      console.log(JSON.stringify(out, null, 2));
      return;
    }

    // 4. Checkout branch ticket — fetch origin poi checkout se necessario
    run("git", ["fetch", "origin"]);

    const current = run("git", ["branch", "--show-current"], { allowFail: true });

    if (current !== branch) {
      run("git", ["checkout", branch]);
    }

    // 5. Catalogo segnali (+ pillar opzionale) — commit su branch ticket **prima** del push
    if (ticketKey) {
      out.catalog = updateImplementationCatalog(ticketKey, branch, false);
      out.pillar  = await runPillarPortalUpdate(ticketKey, { skip: skipPillar });
    }

    const hasRemote = Boolean(run("git", ["rev-parse", `origin/${branch}`], { allowFail: true }));
    const aheadRaw  = hasRemote
      ? run("git", ["rev-list", "--count", `origin/${branch}..HEAD`], { allowFail: true })
      : "1";
    const ahead     = Number(aheadRaw) || 0;

    // 6. Push origin — solo dopo catalogo; se assente su remote o ahead
    let pushed = false;

    if (!hasRemote || ahead > 0) {
      run("git", ["push", "-u", "origin", branch]);
      pushed = true;
    }

    // 7. PR su main — riusa open esistente o gh pr create
    const { prUrl, prTitle, createdPr } = ensurePr(branch, false);
    const commits                       = commitsAheadOfMain(branch);

    out.ok        = true;
    out.branch    = branch;
    out.prUrl     = prUrl;
    out.prTitle   = prTitle ?? null;
    out.pushed    = pushed;
    out.createdPr = createdPr;
    out.commits   = commits;

    if (ticketKey) {
      const ctx = await buildChiudiParentContextFromIssue(ticketKey, {
        branch         : branch
      , commit         : primaryCommitHash(commits)
      , prUrl
      , catalogUpdated : Boolean(out.catalog?.updated)
      });
      out.parentDescriptionMarkdown = buildChiudiParentMarkdown(ctx);

      if (!noJiraSync && hasJiraCredentials()) {
        out.jira = await syncChiudiParentToJira(ticketKey, ctx, {
          dryRun    : false
        , transition: true
        });
      }
    }

    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    out.error = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }
}

main();
