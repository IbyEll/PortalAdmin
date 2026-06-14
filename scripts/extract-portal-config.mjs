#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src  = readFileSync(join(ROOT, "lib/jira-backlog-insights.mjs"), "utf8");
const start = src.indexOf("export const REPO_IMPLEMENTATION_SIGNALS = [");
const end   = src.indexOf("\n];", start) + 3;
const array = src.slice(start);

const header = `/**
 * Configurazione PortalAdmin — segnali repo e progetti Jira (ADMIN-93).
 * Modifica questo file senza editare lib/jira-backlog-insights.mjs.
 */

/** @type {ReadonlyArray<string>} */
export const JIRA_PROJECT_KEYS = [
  "JLO"
, "ADMIN"
];

/**
 * Path noti per ticket JLO/ADMIN — estende scan citazioni nel product repo.
 */
`;

writeFileSync(join(ROOT, "portal.config.mjs"), `${header}${array}\n`);
console.log("portal.config.mjs written");
