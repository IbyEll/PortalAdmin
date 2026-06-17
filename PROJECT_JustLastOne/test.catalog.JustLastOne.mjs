/**
 * Catalogo testScript del product repo (JustLastOne).
 *
 * Descrizione funzionale:
 *   Perché esiste: run-all, dashboard e meta tecnici devono condividere la stessa
 *     discovery degli script in testScript/ e le policy blocked/excluded, senza
 *     duplicare walk filesystem e set hardcoded in ogni consumer.
 *   A cosa serve: espone path product repo, liste skip e discoverTestScripts() per
 *     orchestrare la suite (--list, run sequenziale, UI cruscotto, payload meta API).
 *
 * Consumatori: runner/run-all.mjs, server/dashboard-server.mjs, server/run-manager.mjs,
 *   lib/JustLastOne___test-tecnici-meta.mjs, lib/JustLastOne___my-project-analysis.mjs
 *
 * Export principali:
 *   discoverTestScripts — scan ricorsivo testScript/ → ScriptEntry[]
 *   BLOCKED_SCRIPTS / BLOCKED_REASONS — visibili ma non eseguiti
 *   EXCLUDED_SCRIPTS — mai inclusi nel catalogo
 *   REPO_ROOT, TEST_SCRIPT_DIR — path product repo e testScript/
 */

import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";

import {
  getProductRepoPath
, getTestScriptDir
, requireTestScriptDir
} from "../lib/portal-paths.mjs";

/**
 * Product monorepo root (JustLastOne) — non la root di PortalAdmin.
 *
 * @returns {string}
 */
export function getRepoRoot() {
  return getProductRepoPath();
}

/** Compat import legacy (scan product repo). */
export const REPO_ROOT = getProductRepoPath();

/** Path assoluto a `testScript/` nel product repo. */
export const TEST_SCRIPT_DIR = getTestScriptDir();

export { requireTestScriptDir };

/**
 * Script scoperti ma non eseguibili — compaiono in `--list` con tag `[blocked]`.
 * run-all e dashboard li saltano; BLOCKED_REASONS spiega il motivo in UI/report.
 *
 * @type {ReadonlySet<string>} path relativi a testScript/ (es. `auth/test-login.mjs`)
 */
export const BLOCKED_SCRIPTS = new Set([
  "social/test-user-follow-api.mjs"
, "tournament/test-bracket-match-api.mjs"
]);

/**
 * Script esclusi dal catalogo — non scoperti da discoverTestScripts.
 * Utili per benchmark o job non idonei alla suite sequenziale run-all.
 *
 * @type {ReadonlySet<string>}
 */
export const EXCLUDED_SCRIPTS = new Set([
  "web/benchmark-web-routes.mjs"
, "match/evaluate-matches.mjs"
]);

/**
 * Motivo human-readable per ogni entry in BLOCKED_SCRIPTS.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const BLOCKED_REASONS = {
  "social/test-user-follow-api.mjs"     : "blocked — API follow assente"
, "tournament/test-bracket-match-api.mjs": "blocked — dipende JLO-696"
};

/**
 * @typedef {{ rel: string, suite: string, file: string, abs: string }} ScriptEntry
 * @property {string} rel   — path relativo a testScript/ (slash forward)
 * @property {string} suite — prima cartella del path, o `"root"` se in testScript/
 * @property {string} file  — nome file (es. `test-login.mjs`)
 * @property {string} abs   — path assoluto sul filesystem
 */

/**
 * Scansiona testScript/ e restituisce gli script eseguibili dalla suite.
 *
 * Criteri inclusione:
 * - file `.mjs` il cui nome inizia con `test-`;
 * - oppure `funzionali/run-funzionali.mjs` (orchestratore suite funzionali).
 *
 * Esclusioni: cartella `lib/`, EXCLUDED_SCRIPTS, file non `.mjs`.
 * Ordine output: suite alfabetica, poi rel alfabetico.
 *
 * @returns {Promise<ScriptEntry[]>}
 */
export async function discoverTestScripts() {
  // 1. Verifica che testScript/ esista nel product repo — fail-fast prima del walk
  requireTestScriptDir();
  const testScriptDir = getTestScriptDir();

  /** @type {ScriptEntry[]} */
  const found = [];

  /**
   * Visita ricorsiva una directory sotto testScript/.
   *
   * @param {string} dir
   */
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const ent of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, ent.name);

      if (ent.isDirectory()) {
        // 2a. Sottocartella — scendi, salvo lib/ (helper condivisi, non suite)
        if (ent.name === "lib") {
          continue;
        }
        await walk(full);
        continue;
      }

      // 2b. Solo file .mjs; ignora seed, config e altri artefatti
      if (!ent.isFile() || !ent.name.endsWith(".mjs")) {
        continue;
      }

      // 3. Filtro nome: test-*.mjs oppure orchestratore funzionali/run-funzionali.mjs
      const isTestFile = ent.name.startsWith("test-");
      const isFunzionaliOrchestrator =
        ent.name === "run-funzionali.mjs"
        && relative(testScriptDir, dir).replace(/\\/g, "/") === "funzionali";

      if (!isTestFile && !isFunzionaliOrchestrator) {
        continue;
      }

      const rel = relative(testScriptDir, full).replace(/\\/g, "/");

      // 4. Esclusione catalogo — benchmark e job batch non in suite run-all
      if (EXCLUDED_SCRIPTS.has(rel)) {
        continue;
      }

      // 5. Costruisce ScriptEntry — suite = prima cartella del path relativo
      const parts = rel.split("/");
      found.push({
        rel
      , suite : parts.length > 1 ? parts[0] : "root"
      , file  : ent.name
      , abs   : full
      });
    }
  }

  // 6. Walk dalla root testScript/ e ordinamento stabile per consumer UI/CLI
  await walk(testScriptDir);
  found.sort((a, b) => a.suite.localeCompare(b.suite) || a.rel.localeCompare(b.rel));
  return found;
}
