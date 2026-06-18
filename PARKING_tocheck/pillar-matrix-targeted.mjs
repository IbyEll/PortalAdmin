/**
 * Aggiornamento mirato matrice pilastri cruscotto per ticket JLO (chiudi story).
 */

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findPillarsForKey, generatePillarMatrixHtml } from "../scripts/generate-confluence-pillar-matrix.mjs";
import { writePillarMatrixPortalTargeted } from "../cruscotto.frontend/cruscotto.jira.pillar.matrix.portal.generate.mjs";

import { getPortalRoot } from "../lib/portal.paths.mjs";

const REPO_ROOT   = getPortalRoot();
const PORTAL_DIR  = "cruscotto/pillar-matrix";

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ allowFail?: boolean }} [opts]
 */
function runGit(cmd, args, opts = {}) {
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
 * @param {string} ticketKey
 */
function normalizeTicketKey(ticketKey) {
  return String(ticketKey).trim().toUpperCase().match(/JLO-\d+/)?.[0] ?? null;
}

/**
 * @param {string} ticketKey
 * @param {{ dryRun?: boolean, bundle?: Awaited<ReturnType<typeof generatePillarMatrixHtml>> }} [opts]
 */
export async function updatePillarPortalForTicket(ticketKey, opts = {}) {
  const key = normalizeTicketKey(ticketKey);

  if (!key) {
    throw new Error(`Key ticket non valida per pillar cruscotto: ${ticketKey}`);
  }

  if (opts.dryRun) {
    return {
      ok        : true
    , mode      : "targeted"
    , ticketKey : key
    , dryRun    : true
    , pillars   : []
    , written   : []
    , note      : "dry-run — nessuna chiamata Jira / scrittura HTML"
    };
  }

  const bundle   = opts.bundle ?? await generatePillarMatrixHtml({ closingKey: key });
  const matching = findPillarsForKey(key, bundle.allPillars ?? [], bundle.issues ?? []);

  if (matching.length === 0) {
    return {
      ok        : false
    , mode      : "targeted"
    , ticketKey : key
    , error     : `Nessun pilastro mappa ${key}`
    , pillars   : []
    , written   : []
    };
  }

  const pillarIds = matching.map((pillar) => pillar.id);
  const result    = writePillarMatrixPortalTargeted(bundle, pillarIds, { includeIndex: true });

  return {
    ok        : true
  , mode      : "targeted"
  , ticketKey : key
  , pillars   : matching.map((pillar) => ({
      id    : pillar.id
    , title : pillar.pillar
    }))
  , fetchedAt : bundle.fetchedAt
  , written   : result.written
  , pages     : result.pages
  };
}

/**
 * @param {string} ticketKey
 */
export function commitPillarPortalUpdate(ticketKey) {
  const porcelain = runGit("git", ["status", "--porcelain", PORTAL_DIR], { allowFail: true });

  if (!porcelain) {
    return { committed: false, reason: "unchanged" };
  }

  runGit("git", ["add", PORTAL_DIR]);
  runGit("git", ["commit", "-m", `${ticketKey} pillar matrix cruscotto`]);

  return {
    committed : true
  , commit    : runGit("git", ["rev-parse", "--short", "HEAD"], { allowFail: true }) || "committed"
  };
}
