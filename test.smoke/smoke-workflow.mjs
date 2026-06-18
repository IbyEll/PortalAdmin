#!/usr/bin/env node
/**
 * Smoke ADMIN-96 — Cursor workflow rules + close-story/catalog ADMIN keys.
 */

import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveTicketBranch } from "../lib/repo.implementation.signals.catalog.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const RULES = [
  ".cursor/rules/ADMIN-Workflow.mdc"
, ".cursor/rules/ADMIN-Silence.mdc"
, ".cursor/rules/ADMIN-AnalizzaRepo.mdc"
, ".cursor/skills/jlo-jira-auto/SKILL.md"
, ".cursor/skills/jlo-analizza-repo/SKILL.md"
];

for (const rel of RULES) {
  if (!existsSync(join(ROOT, rel))) {
    console.error(`FAIL: missing ${rel}`);
    process.exit(1);
  }
}

const branch93 = resolveTicketBranch("ADMIN-93");

if (!branch93 || !branch93.includes("ADMIN-93")) {
  console.error("FAIL: resolveTicketBranch ADMIN-93", branch93);
  process.exit(1);
}

const dryClose = execFileSync(
  process.execPath
, ["JiraCORE/close-story.mjs", "--key", "ADMIN-93", "--dry-run"]
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
