#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-18 21:32
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 06:15   by: IbyEll
 * modificato il: 2026-06-18 21:32   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Sincronizza REPO_IMPLEMENTATION_SIGNALS con piano MVP e branch ticket git (PRJ_JIRA_PREFIX).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Il catalogo segnali in signals.catalog.*.mjs deve restare allineato alle key del piano di lavoro
 *     e alle branch STORY/BUG/TODO presenti nei repo senza edit manuale.
 *   - Evita ticket orfani in gap analysis e in close-story senza path implementazione noti.
 *
 *   A cosa serve:
 *   - Per ogni key target verifica se già in catalogo; altrimenti deriva path da git e appende
 *     la voce via ensureRepoImplementationSignalByKey (o simula con --dry-run).
 *   - Stampa JSON con totali added/skipped/failed e dettaglio per key.
 *
 * Generalizzazione:
 *   Si — prefisso IssueKEY da PRJ_JIRA_PREFIX; piano MVP via collectWorkingPlanTicketKeys; branch da
 *     listAllTicketBranchKeys (overlay PRJ_NAME).
 *
 * Input:
 *   - PRJ_NAME, PRODUCT_REPO_PATH — overlay product e root git (portal.paths.resolver)
 *   - PRJ_JIRA_PREFIX — pattern argv --key e key posizionali
 *   - collectWorkingPlanTicketKeys — key dal piano MVP (cruscotto.jira.working.order.mjs)
 *   - listAllTicketBranchKeys — scan branch STORY/BUG/TODO sul product repo
 *
 * Uso:
 *   - node admin.portal.JiraCORE/sync-repo-catalog.mjs
 *   - node admin.portal.JiraCORE/sync-repo-catalog.mjs --dry-run
 *   - node admin.portal.JiraCORE/sync-repo-catalog.mjs --key {PREFIX}-775
 *
 * Flag CLI:
 *   --dry-run           non scrive il catalogo — solo anteprima esito per key
 *   --key {PREFIX}-xxx  limita o aggiunge key esplicite (ripetibile)
 *   {PREFIX}-xxx        key posizionale accettata come argomento singolo
 *
 * Prerequisiti:
 *   - Git disponibile su product repo e PortalAdmin per scan branch e path
 *   - PARKING_tocheck\cruscotto.jira.working.order.mjs — piano MVP (default key set)
 *
 * Consumatori:
 *   - Grooming manuale backlog / pillar matrix prima di chiudi story
 *   - JiraCORE.signals.catalog.implementation.mjs — ensureRepoImplementationSignalByKey
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { getProjectConfig } from "../admin.portal.lib/project.config.mjs";
import { collectWorkingPlanTicketKeys } from "../PARKING_tocheck/cruscotto.jira.working.order.mjs";
import {
  ensureRepoImplementationSignalByKey
, listAllTicketBranchKeys
, signalKeyExistsInFile
} from "./JiraCORE.signals.catalog.implementation.mjs";

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Regex IssueKEY per il prefisso progetto attivo.
 *
 * @param {string} jiraPrefix
 */
function buildTicketKeyPattern(jiraPrefix) {
  const prefix = escapeRegExp(String(jiraPrefix).trim());

  if (!prefix) {
    throw new Error("sync-repo-catalog — jiraPrefix mancante (PRJ_JIRA_PREFIX)");
  }

  return {
    full  : new RegExp(`^${prefix}-\\d+$`, "i")
  , chunk : new RegExp(`${prefix}-\\d+`, "i")
  };
}

/**
 * @param {string[]} keys
 * @returns {string[]}
 */
function sortTicketKeys(keys) {
  return [...keys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * Parsa --dry-run, --key e key posizionali {PREFIX}-nnn.
 *
 * @param {string[]} argv
 * @param {string} jiraPrefix
 */
function parseArgs(argv, jiraPrefix) {
  const dryRun         = argv.includes("--dry-run");
  const { full, chunk } = buildTicketKeyPattern(jiraPrefix);
  /** @type {string[]} */
  const keys           = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--key" && argv[i + 1]) {
      const m = String(argv[++i]).toUpperCase().match(chunk);

      if (m) {
        keys.push(m[0]);
      }
    } else if (full.test(argv[i])) {
      keys.push(String(argv[i]).toUpperCase());
    }
  }

  return { dryRun, keys };
}

/**
 * Key esplicite da argv, oppure unione piano MVP + branch ticket git.
 *
 * @param {string[]} explicit
 * @returns {string[]}
 */
function collectTargetKeys(explicit) {
  if (explicit.length > 0) {
    return sortTicketKeys([...new Set(explicit)]);
  }

  const fromPlan     = collectWorkingPlanTicketKeys();
  const fromBranches = listAllTicketBranchKeys();

  return sortTicketKeys([...new Set([...fromPlan, ...fromBranches])]);
}

function main() {
  const { PRJ_JIRA_PREFIX } = getProjectConfig();

  // 1. Parse argv — dry-run e key opzionali (prefisso da overlay)
  const { dryRun, keys: explicit } = parseArgs(process.argv.slice(2), PRJ_JIRA_PREFIX);

  // 2. Target key — piano + branch oppure solo esplicite
  const keys = collectTargetKeys(explicit);

  /** @type {Array<{ key: string, result: object }>} */
  const results = [];
  let added   = 0;
  let skipped = 0;
  let failed  = 0;

  // 3. Loop catalogo — skip se già presente, altrimenti ensure per key
  for (const key of keys) {
    if (signalKeyExistsInFile(key)) {
      results.push({ key, result: { updated: false, skipped: true, reason: "already-listed" } });
      skipped++;
      continue;
    }

    const result = ensureRepoImplementationSignalByKey(key, { dryRun });

    results.push({ key, result });

    if (result.updated) {
      added++;
    } else if (result.skipped) {
      skipped++;
    } else {
      failed++;
    }
  }

  // 4. Report esito — JSON su stdout
  const out = {
    ok           : true
  , jiraPrefix   : PRJ_JIRA_PREFIX
  , dryRun
  , total        : keys.length
  , added
  , skipped
  , failed
  , results
  };

  console.log(JSON.stringify(out, null, 2));
}

main();
