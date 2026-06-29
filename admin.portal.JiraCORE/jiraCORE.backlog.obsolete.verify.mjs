#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-27 02:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-27 02:05   by: IbyEll
 * modificato il: 2026-06-27 02:05   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                          Verifica backlog Da fare — candidati obsoleti e apply isObsolete in cache.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Ticket Jira ancora Da fare possono essere obsoleti se repo completo, epic chiusa o fuori piano.
 *   - Serve CLI per grooming prima di chiudere in Jira o ripulire la colonna ordine backlog.
 *
 *   A cosa serve:
 *   - verifyBacklogTodoItems su cache o fetch live — report JSON o markdown con motivi obsolescenza.
 *   - --apply scrive isObsolete in jira_issue SQLite e azzera devOrder/devSort (propaga subtask).
 *
 * Generalizzazione:
 *   Si — overlay PRJ_NAME, scan repo product, sorgente backlog db|api e apply opzionale via argv.
 *
 * Input:
 *   - argv — --source, --format, --apply, --dry-run, --out, --help
 *   - PRJ_NAME — overlay per WORKING_PLAN (ensureWorkingPlanLoaded)
 *   - CRUSCOTTO_DB_PATH — cache SQLite se --source db o --apply
 *   - credenziali Jira env — fetchJiraBacklog se --source api
 *
 * Uso:
 *   - node admin.portal.JiraCORE/jiraCORE.backlog.obsolete.verify.mjs
 *   - node admin.portal.JiraCORE/jiraCORE.backlog.obsolete.verify.mjs --format md
 *   - node admin.portal.JiraCORE/jiraCORE.backlog.obsolete.verify.mjs --apply --dry-run
 *   - npm run backlog:obsolete
 *
 * Flag CLI:
 *   --help, -h           riepilogo ed exit 0
 *   --source db|api        backlog da cache cruscotto (default db) o API Jira
 *   --format json|md       serializzazione stdout/file (default json)
 *   --apply                marca isObsolete su candidati in cache SQLite
 *   --dry-run              con --apply: elenco key senza updateMany Prisma
 *   --out path             salva report su file
 *
 * Prerequisiti:
 *   - --source db e --apply: npm run db:sync eseguito
 *   - --source api: credenziali Jira e stack raggiungibile
 *
 * Consumatori:
 *   - package.json script backlog:obsolete — grooming backlog e CI locale
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import "../admin.portal.lib/portal.load.env.mjs";
import { fetchJiraBacklog, loadJiraBacklog } from "../cruscotto.frontend/cruscotto.jira.backlog.mjs";
import {
  applyObsoleteMarksToDb
, verifyBacklogTodoItems
} from "../cruscotto.lib/backlog.working.plan.analysis.mjs";
import { ensureWorkingPlanLoaded } from "../cruscotto.lib/backlog.working.plan.loader.mjs";
import { getProjectConfig } from "../admin.portal.lib/project.config.mjs";

/**
 * Parsing argv CLI — help termina con exit 0 senza side effect.
 *
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ source: "db" | "api", format: "json" | "md", apply: boolean, dryRun: boolean, out?: string }} */
  const out = {
    source : "db"
  , format : "json"
  , apply  : false
  , dryRun : false
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--source" && argv[i + 1]) {
      out.source = argv[++i] === "api" ? "api" : "db";
      continue;
    }

    if (arg === "--format" && argv[i + 1]) {
      out.format = argv[++i] === "md" ? "md" : "json";
      continue;
    }

    if (arg === "--apply") {
      out.apply = true;
      continue;
    }

    if (arg === "--dry-run") {
      out.dryRun = true;
      continue;
    }

    if (arg === "--out" && argv[i + 1]) {
      out.out = argv[++i];
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log([
        "Uso: node admin.portal.JiraCORE/jiraCORE.backlog.obsolete.verify.mjs [opzioni]"
      , "  --source db|api       default db"
      , "  --format json|md       default json"
      , "  --apply               marca is_obsolete in cache SQLite"
      , "  --dry-run             con --apply: solo elenco key, no write DB"
      , "  --out path            salva report su file"
      , ""
      , "Motivi obsolescenza:"
      , "  repo-complete-open, epic-done-repo-complete, all-subtasks-done,"
      , "  summary-obsoleto, not-in-working-plan (+ repo ok)"
      ].join("\n"));
      // Help richiesto — exit 0 senza verify né applyObsoleteMarksToDb
      process.exit(0);
    }
  }

  return out;
}

/**
 * Report markdown — tabella candidati obsoleti e campione ticket ancora validi.
 *
 * @param {ReturnType<typeof verifyBacklogTodoItems>} report
 */
function formatMarkdown(report) {
  const cfg = getProjectConfig();
  const lines = [
    `# Verifica backlog Da fare — ${cfg.PRJ_JIRA_PREFIX}`
  , ""
  , `Scansionato: ${report.scannedAt}`
  , `Aperti: ${report.openCount} · validi: ${report.validCount} · obsoleti: ${report.obsoleteCount}`
  , ""
  , "## Candidati obsoleti"
  , ""
  , "| Key | Esito repo | Motivi | Summary |"
  , "| --- | --- | --- | --- |"
  ];

  for (const row of report.obsoleteCandidates) {
    lines.push(
      `| ${row.key} | ${row.esito} | ${(row.reasons ?? []).join(", ")} | ${String(row.summary).slice(0, 50)} |`
    );
  }

  if (report.validOpen.length > 0) {
    lines.push("", "## Ancora validi (Da fare)", "", "| Key | Esito | Summary |", "| --- | --- | --- |");

    for (const row of report.validOpen.slice(0, 60)) {
      lines.push(`| ${row.key} | ${row.esito} | ${String(row.summary).slice(0, 50)} |`);
    }
  }

  return lines.join("\n");
}

// 1. Argomenti CLI — parseArgs; --help esce 0 prima di I/O
const args = parseArgs(process.argv.slice(2));

// 2. Precarica WORKING_PLAN overlay — regola not-in-working-plan in verify
await ensureWorkingPlanLoaded();

// 3. Backlog — cache SQLite (default) o fetch API Jira live
const backlog = args.source === "api"
  ? await fetchJiraBacklog()
  : await loadJiraBacklog({ dbOnly: true });

if (!backlog) {
  console.error("Backlog assente — esegui npm run db:sync oppure usa --source api");
  process.exit(1);
}

// 4. Verifica ticket aperti — classifica validi vs candidati obsoleti
const report = verifyBacklogTodoItems({ issues: backlog.issues });

/** @type {Record<string, unknown>} */
const payload = {
  ok       : true
, source   : args.source
, fetchedAt: backlog.fetchedAt
, report
};

// 5. Apply opzionale — isObsolete in jira_issue; --dry-run solo elenco key
if (args.apply && report.obsoleteCandidates.length > 0) {
  const keys = report.obsoleteCandidates.map((row) => String(row.key));
  const applyResult = await applyObsoleteMarksToDb(keys, { dryRun: args.dryRun });

  payload.apply = applyResult;
}

// 6. Serializza json|md — scrive --out su stderr log; stdout sempre payload testuale
const text = args.format === "md"
  ? formatMarkdown(report)
  : JSON.stringify(payload, null, 2);

if (args.out) {
  writeFileSync(resolve(args.out), text, "utf8");
  console.error(`Scritto ${resolve(args.out)}`);
}

console.log(text);
