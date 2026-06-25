#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TESTSCRIPT ** -- commentato il: 2026-06-23 21:05
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:05   by: IbyEll
 * modificato il: 2026-06-23 21:05   by: IbyEll
 * ticket refinement: ADMIN-96 workflow rules e close-story dry-run
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Smoke workflow — regole Cursor ADMIN e close-story/catalog dry-run.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Garantisce presenza regole workflow e skill Jira Auto prima di procedi/gogo su ADMIN.
 *
 *   A cosa serve:
 *   - Verifica file .cursor/rules e resolveTicketBranch + close-story --dry-run ADMIN-93.
 *
 * Generalizzazione:
 *   No — campioni e path fissi su ticket ADMIN-93/96 e regole PortalAdmin.
 *
 * Input:
 *   - —
 *
 * Uso:
 *   - node test.smoke/smoke-workflow.mjs
 *
 * Exit code:
 *   0 — regole presenti e dry-run close-story ok
 *   1 — file mancante o dry-run fallito
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveTicketBranch } from "../admin.portal.JiraCORE/JiraCORE.signals.catalog.implementation.mjs";
import { checkNoOpenPullRequests } from "../admin.portal/portal.cursor.agent.workflow.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const RULES = [
  ".cursor/rules/ADMIN-Workflow.mdc"
, ".cursor/rules/ADMIN-Silence.mdc"
, ".cursor/rules/ADMIN-AnalizzaRepo.mdc"
, ".cursor/skills/jlo-jira-auto/SKILL.md"
, ".cursor/skills/jlo-analizza-repo/SKILL.md"
, "admin.portal/portal.cursor.agent.workflow.mjs"
];

for (const rel of RULES) {
  if (!existsSync(join(ROOT, rel))) {
    console.error(`FAIL: missing ${rel}`);
    process.exit(1);
  }
}

const workflowRule = readFileSync(join(ROOT, ".cursor/rules/ADMIN-Workflow.mdc"), "utf8");

if (!workflowRule.includes("Gate PR aperte")) {
  console.error("FAIL: ADMIN-Workflow.mdc missing Gate PR aperte (step 2.3)");
  process.exit(1);
}

if (typeof checkNoOpenPullRequests !== "function") {
  console.error("FAIL: checkNoOpenPullRequests not exported");
  process.exit(1);
}

const branch93 = resolveTicketBranch("ADMIN-93");

if (!branch93 || !branch93.includes("ADMIN-93")) {
  console.error("FAIL: resolveTicketBranch ADMIN-93", branch93);
  process.exit(1);
}

const dryClose = execFileSync(
  process.execPath
, ["admin.portal.JiraCORE/jiraCORE.close.story.mjs", "--key", "ADMIN-93", "--dry-run"]
, { cwd: ROOT, encoding: "utf8" }
);

const closeParsed = JSON.parse(dryClose);

if (!closeParsed.ok || !closeParsed.branch) {
  console.error("FAIL: close-story --key ADMIN-93 --dry-run", dryClose);
  process.exit(1);
}

const dryCatalog = closeParsed.catalog;

if (!dryCatalog) {
  console.error("FAIL: close-story dry-run missing catalog block");
  process.exit(1);
}

console.log("OK smoke workflow");
console.log(`  rules: ${RULES.length} files present`);
console.log(`  resolveTicketBranch ADMIN-93 → ${branch93}`);
console.log(`  close-story dry-run branch: ${closeParsed.branch}`);
console.log(`  catalog: ${JSON.stringify(dryCatalog)}`);
