/**
 * Scan citazioni JLO-xxx e ADMIN-xxx nel product repo (JustLastOne).
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { getProductRepoPath } from "./portal.paths.resolver.mjs";
import { JIRA_PROJECT_KEYS } from "./jira/jira.config.export.mjs";

/** Regex citazioni JLO-xxx / ADMIN-xxx — progetti da portal.config.mjs */
export const JIRA_KEY_RE = new RegExp(
  `\\b((?:${JIRA_PROJECT_KEYS})-\\d+)\\b`
, "g"
);

/** @type {ReadonlySet<string>} */
const SKIP_DIRS = new Set([
  "node_modules"
, ".next"
, ".git"
, "dist"
, "coverage"
, ".cursor"
, "history"
, ".turbo"
]);

/** @type {ReadonlySet<string>} */
const TEXT_EXT = new Set([
  ".ts"
, ".tsx"
, ".js"
, ".jsx"
, ".mjs"
, ".cjs"
, ".json"
, ".md"
, ".mdc"
, ".prisma"
, ".css"
, ".html"
, ".yml"
, ".yaml"
]);

const MAX_FILE_BYTES    = 512_000;
const MAX_PATHS_PER_KEY = 8;

/**
 * @param {string} dir
 * @param {string[]} acc
 */
export function walkRepoTextFiles(dir, acc) {
  let entries;

  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const ent of entries) {
    if (SKIP_DIRS.has(ent.name)) {
      continue;
    }

    const full = join(dir, ent.name);

    if (ent.isDirectory()) {
      walkRepoTextFiles(full, acc);
      continue;
    }

    if (!ent.isFile()) {
      continue;
    }

    const ext = extname(ent.name).toLowerCase();

    if (!TEXT_EXT.has(ext)) {
      continue;
    }

    try {
      const size = statSync(full).size;

      if (size > MAX_FILE_BYTES) {
        continue;
      }

      acc.push(full);
    } catch {
      /* skip */
    }
  }
}

/**
 * @returns {Map<string, string[]>}
 */
export function scanRepoJiraReferences() {
  const repoRoot = getProductRepoPath();

  /** @type {string[]} */
  const files = [];

  walkRepoTextFiles(repoRoot, files);

  /** @type {Map<string, string[]>} */
  const byKey = new Map();

  for (const abs of files) {
    let content;

    try {
      content = readFileSync(abs, "utf8");
    } catch {
      continue;
    }

    const rel = relative(repoRoot, abs).replace(/\\/g, "/");
    const seenInFile = new Set();

    for (const match of content.matchAll(JIRA_KEY_RE)) {
      const key = match[1];

      if (seenInFile.has(key)) {
        continue;
      }

      seenInFile.add(key);

      const list = byKey.get(key) ?? [];

      if (list.length < MAX_PATHS_PER_KEY && !list.includes(rel)) {
        list.push(rel);
        byKey.set(key, list);
      }
    }
  }

  return byKey;
}

/**
 * @param {string} summary
 * @param {number} [maxLen]
 */
export function truncateIssueSummary(summary, maxLen = 72) {
  const text = String(summary ?? "").trim();

  if (text.length <= maxLen) {
    return text;
  }

  return `${text.slice(0, maxLen - 1)}…`;
}

/**
 * @returns {boolean}
 */
export function isProductRepoAvailable() {
  try {
    return existsSync(getProductRepoPath());
  } catch {
    return false;
  }
}
