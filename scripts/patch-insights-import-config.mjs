#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const INSIGHTS = join(dirname(fileURLToPath(import.meta.url)), "..", "lib/jira-backlog-insights.mjs");
const src      = readFileSync(INSIGHTS, "utf8");
const marker   = "export const REPO_IMPLEMENTATION_SIGNALS = [";
const start    = src.indexOf(marker);

if (start === -1) {
  console.error("marker not found");
  process.exit(1);
}

let depth = 0;
let end   = start + marker.length - 1;

for (let i = end; i < src.length; i++) {
  const ch = src[i];

  if (ch === "[") {
    depth += 1;
  } else if (ch === "]") {
    depth -= 1;

    if (depth === 0) {
      end = src[i + 1] === ";" ? i + 2 : i + 1;
      break;
    }
  }
}

const commentStart = src.lastIndexOf("/**", start);
const replacement  = `export {
  JIRA_PROJECT_KEYS
, REPO_IMPLEMENTATION_SIGNALS
} from "../portal.config.mjs";
`;

writeFileSync(INSIGHTS, src.slice(0, commentStart) + replacement + src.slice(end));
console.log("replaced bytes", end - start);
