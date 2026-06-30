#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-27 02:00
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-27 02:00   by: IbyEll
 * modificato il: 2026-06-27 02:00   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                          Genera report piano lavoro da backlog — gap repo e bozza WORKING_PLAN.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Grooming backlog richiede vista strutturata: blocchi sprint, key aperte fuori piano, gap repo.
 *   - Automatizza analisi che altrimenti richiede pagina working e ispezione manuale issue key.
 *
 *   A cosa serve:
 *   - buildWorkingPlanGenerationReport su cache o fetch live — output JSON o markdown.
 *   - buildAutoWorkingPlanDraft con --auto-draft o piano WORKING_PLAN assente.
 *   - Opzionale rigenerazione HTML working (--regenerate-html) se modulo PARKING presente.
 *
 * Generalizzazione:
 *   Si — overlay PRJ_NAME, sorgente backlog db|api e formato json|md via argv.
 *
 * Input:
 *   - argv — --source, --format, --auto-draft, --out, --regenerate-html, --help
 *   - PRJ_NAME — overlay per WORKING_PLAN (working.plan.loader)
 *   - CRUSCOTTO_DB_PATH — cache SQLite se --source db
 *   - credenziali Jira env — fetchJiraBacklog se --source api
 *
 * Uso:
 *   - node admin.portal.JiraCORE/jiraCORE.working.plan.generate.mjs
 *   - node admin.portal.JiraCORE/jiraCORE.working.plan.generate.mjs --source api --format md
 *   - node admin.portal.JiraCORE/jiraCORE.working.plan.generate.mjs --auto-draft --out plan.draft.json
 *   - npm run working:plan
 *
 * Flag CLI:
 *   --help, -h           riepilogo ed exit 0
 *   --source db|api        backlog da cache cruscotto (default db) o API Jira
 *   --format json|md       serializzazione stdout/file (default json)
 *   --auto-draft           include bozza WORKING_PLAN raggruppata per epic
 *   --out path             scrive report su file invece di solo stdout
 *   --regenerate-html      tenta regenerateWorkingPlanHtml da PARKING working.plan
 *
 * Prerequisiti:
 *   - --source db: npm run db:sync eseguito (loadJiraBacklog)
 *   - --source api: credenziali Jira e stack raggiungibile
 *
 * Consumatori:
 *   - package.json script working:plan — grooming manuale e CI locale
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import "../admin.portal.lib/portal.load.env.mjs";
import { fetchJiraBacklog, loadJiraBacklog } from "../cruscotto.frontend/cruscotto.jira.backlog.mjs";
import {
  buildWorkingPlanGenerationReport
} from "../cruscotto.lib/backlog.working.plan.analysis.mjs";
import { issueTypeShortLabel } from "../admin.portal.lib/issue.display.mjs";
import { ensureWorkingPlanLoaded, loadWorkingPlan } from "../cruscotto.lib/backlog.working.plan.loader.mjs";
import { getProjectConfig } from "../admin.portal.lib/project.config.mjs";

/**
 * Parsing argv CLI — help termina con exit 0 senza side effect.
 *
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ source: "db" | "api", format: "json" | "md", autoDraft: boolean, out?: string, regenerate: boolean }} */
  const out = {
    source  : "db"
  , format  : "json"
  , autoDraft: false
  , regenerate: false
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

    if (arg === "--auto-draft") {
      out.autoDraft = true;
      continue;
    }

    if (arg === "--out" && argv[i + 1]) {
      out.out = argv[++i];
      continue;
    }

    if (arg === "--regenerate-html") {
      out.regenerate = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log([
        "Uso: node admin.portal.JiraCORE/jiraCORE.working.plan.generate.mjs [opzioni]"
      , "  --source db|api     default db (cache cruscotto)"
      , "  --format json|md     default json"
      , "  --auto-draft        bozza WORKING_PLAN da epic aperte"
      , "  --out path.json     scrive report/bozza su file"
      , "  --regenerate-html   rigenera cruscotto.jira.working.html se modulo presente"
      ].join("\n"));
      // Help richiesto — exit 0 senza fetch backlog né write file
      process.exit(0);
    }
  }

  return out;
}

/**
 * Report markdown leggibile — blocchi sprint, fuori piano, suggestedNext e bozza.
 *
 * @param {Awaited<ReturnType<typeof buildWorkingPlanGenerationReport>>} report
 * @param {ReturnType<typeof buildAutoWorkingPlanDraft> | null} draft
 */
function formatMarkdown(report, draft) {
  const cfg = getProjectConfig();
  const lines = [
    `# Piano di lavoro — ${cfg.PRJ_JIRA_PREFIX}`
  , ""
  , `Generato: ${report.generatedAt}`
  , `Story/epic aperte: ${report.openStoryCount} · scan repo: ${report.repoRefsScanned} key`
  , ""
  , "## Blocchi piano corrente"
  , ""
  , "| Sprint | Nome | Aperti | Fatto | Key aperte |"
  , "| --- | --- | ---: | ---: | --- |"
  ];

  for (const block of report.workingPlanBlocks) {
    const open = Array.isArray(block.openKeys) ? block.openKeys.join(", ") : "—";

    lines.push(
      `| ${block.sprint} | ${block.name} | ${block.openCount} | ${block.doneCount}/${block.total} | ${open || "—"} |`
    );
  }

  if ((report.orderedDevelopmentQueue ?? []).length > 0) {
    lines.push(
      ""
    , "## Ordine sviluppo proposto"
    , ""
    , "| # | Ordine | Issue | Titolo | Esito | Epic | Sprint |"
    , "| ---: | --- | --- | --- | --- | --- | ---: |"
    );

    for (const row of report.orderedDevelopmentQueue) {
      const typeLabel = issueTypeShortLabel(String(row.type ?? "")) ?? "";
      const issueCell = typeLabel ? `${typeLabel} ${row.key}` : row.key;
      const epicTypeLabel = issueTypeShortLabel(String(row.epicType ?? "Epic")) ?? "EPIC";
      const epicCell = row.epicKey
        ? `${epicTypeLabel} ${row.epicKey} — ${String(row.epicSummary ?? row.epicKey).slice(0, 40)}`
        : "—";

      lines.push(
        `| ${row.rank} | ${row.devOrder} | ${issueCell} | ${String(row.summary).slice(0, 60)} | ${row.esito} | ${epicCell} | ${row.sprint} |`
      );
    }
  }

  if ((report.doneSprintMismatchQueue ?? []).length > 0) {
    lines.push(
      ""
    , "## Fatto ma sprint non allineato"
    , ""
    , "| # | Sprint | Ordine | Issue | Stato Jira | Titolo | Esito | Epic |"
    , "| ---: | ---: | --- | --- | --- | --- | --- | --- |"
    );

    for (const row of report.doneSprintMismatchQueue) {
      const typeLabel = issueTypeShortLabel(String(row.type ?? "")) ?? "";
      const issueCell = typeLabel ? `${typeLabel} ${row.key}` : row.key;
      const epicTypeLabel = issueTypeShortLabel(String(row.epicType ?? "Epic")) ?? "EPIC";
      const epicCell = row.epicKey
        ? `${epicTypeLabel} ${row.epicKey} — ${String(row.epicSummary ?? row.epicKey).slice(0, 40)}`
        : "—";

      lines.push(
        `| ${row.rank} | ${row.sprint} | ${row.devOrder} | ${issueCell} | ${row.status ?? "—"} | ${String(row.summary).slice(0, 60)} | ${row.esito} | ${epicCell} |`
      );
    }
  }

  if ((report.proposedSprints ?? []).length > 0) {
    lines.push("", "## Sprint proposti", "");

    for (const block of report.proposedSprints) {
      lines.push(`### Sprint ${block.sprint} — ${block.name}`, "", block.description, "", "**Punti da smarcare:**", "");

      for (const milestone of block.milestones ?? []) {
        lines.push(`- ${milestone}`);
      }

      lines.push("", `Key: ${(block.keys ?? []).join(", ")}`, "");
    }
  }

  if (report.openOutsidePlan.length > 0) {
    lines.push("", "## Aperti fuori piano", "", "| Key | Epic | Esito repo | Summary |", "| --- | --- | --- | --- |");

    for (const row of report.openOutsidePlan) {
      lines.push(`| ${row.key} | ${row.epicKey ?? "—"} | ${row.esito} | ${String(row.summary).slice(0, 60)} |`);
    }
  }

  if (draft?.length) {
    lines.push("", "## Export bozza WORKING_PLAN", "", "```json", JSON.stringify(draft, null, 2), "```");
  }

  return lines.join("\n");
}

// 1. Argomenti CLI — parseArgs; --help esce 0 prima di I/O
const args = parseArgs(process.argv.slice(2));

// 2. Precarica WORKING_PLAN overlay in cache per report e confronto blocchi
await ensureWorkingPlanLoaded();

// 3. Backlog — cache SQLite (default) o fetch API Jira live
const backlog = args.source === "api"
  ? await fetchJiraBacklog()
  : await loadJiraBacklog({ dbOnly: true });

if (!backlog) {
  console.error("Backlog assente — esegui npm run db:sync oppure usa --source api");
  process.exit(1);
}

// 4. Report generazione piano + bozza auto se richiesta o piano statico vuoto
const workingPlan = await loadWorkingPlan();
const report      = await buildWorkingPlanGenerationReport({
  issues: backlog.issues
, boardSprintKeysByPlanName: backlog.boardSprintKeysByPlanName
, workingPlan
});
const draft = args.autoDraft || report.proposedSprints?.length
  ? report.proposedSprints
  : null;

const payload = {
  ok         : true
, source     : args.source
, fetchedAt  : backlog.fetchedAt
, report
, autoDraft  : draft
};

// 5. Rigenerazione HTML working opzionale — non blocca exit se modulo assente
if (args.regenerate) {
  try {
    const mod = await import("../PARKING_tocheck/cruscotto.jira.working.plan.mjs");
    const html = await mod.regenerateWorkingPlanHtml();

    payload.regeneratedHtml = html;
  } catch (err) {
    payload.regenerateError = err instanceof Error ? err.message : String(err);
  }
}

// 6. Serializza json|md — scrive --out su stderr log; stdout sempre payload testuale
const text = args.format === "md"
  ? formatMarkdown(report, draft)
  : JSON.stringify(payload, null, 2);

if (args.out) {
  writeFileSync(resolve(args.out), text, "utf8");
  console.error(`Scritto ${resolve(args.out)}`);
}

console.log(text);
