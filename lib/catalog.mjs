import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

import {
  getProductRepoPath
, getTestScriptDir
} from "./portal-paths.mjs";

/**
 * Product monorepo root (JustLastOne) — non la root di PortalAdmin.
 *
 * @returns {string}
 */
export function getRepoRoot() {
  return getProductRepoPath();
}

export { getTestScriptDir } from "./portal-paths.mjs";

/** @type {ReadonlySet<string>} */
export const BLOCKED_SCRIPTS = new Set([
  "social/test-user-follow-api.mjs"
, "tournament/test-bracket-match-api.mjs"
]);

/** @type {ReadonlySet<string>} */
export const EXCLUDED_SCRIPTS = new Set([
  "web/benchmark-web-routes.mjs"
, "match/evaluate-matches.mjs"
]);

/** @type {Readonly<Record<string, string>>} */
export const BLOCKED_REASONS = {
  "social/test-user-follow-api.mjs"     : "blocked — API follow assente"
, "tournament/test-bracket-match-api.mjs": "blocked — dipende JLO-696"
};

/**
 * @typedef {{ rel: string, suite: string, file: string, abs: string }} ScriptEntry
 */

/**
 * @returns {Promise<ScriptEntry[]>}
 */
export async function discoverTestScripts() {
  const testScriptDir = getTestScriptDir();

  /** @type {ScriptEntry[]} */
  const found = [];

  /**
   * @param {string} dir
   */
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const ent of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, ent.name);

      if (ent.isDirectory()) {
        if (ent.name === "lib") {
          continue;
        }
        await walk(full);
        continue;
      }

      if (!ent.isFile() || !ent.name.endsWith(".mjs")) {
        continue;
      }

      const isTestFile = ent.name.startsWith("test-");
      const isFunzionaliOrchestrator =
        ent.name === "run-funzionali.mjs"
        && relative(testScriptDir, dir).replace(/\\/g, "/") === "funzionali";

      if (!isTestFile && !isFunzionaliOrchestrator) {
        continue;
      }

      const rel = relative(testScriptDir, full).replace(/\\/g, "/");

      if (EXCLUDED_SCRIPTS.has(rel)) {
        continue;
      }

      const parts = rel.split("/");
      found.push({
        rel
      , suite : parts.length > 1 ? parts[0] : "root"
      , file  : ent.name
      , abs   : full
      });
    }
  }

  await walk(testScriptDir);
  found.sort((a, b) => a.suite.localeCompare(b.suite) || a.rel.localeCompare(b.rel));
  return found;
}
