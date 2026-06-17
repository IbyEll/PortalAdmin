/**
 * Catalogo testScript — facade overlay `PROJECT_{PRJ_NAME}/test.catalog.{name}.mjs`.
 *
 * Descrizione funzionale:
 *   Perché esiste: discovery e policy blocked/excluded sono specifiche del product;
 *     run-all e dashboard importano un unico modulo generico.
 *   A cosa serve: re-export dal overlay attivo (PRJ_NAME obbligatorio).
 *
 * Consumatori: runner/run-all.mjs, server/dashboard-server.mjs, server/run-manager.mjs
 *
 * Export principali: discoverTestScripts, BLOCKED_SCRIPTS, REPO_ROOT, …
 */

import { resolveProjectOverlayName } from "./config.project.mjs";

const overlayName = resolveProjectOverlayName();

const catalog = await import(`../../PROJECT_${overlayName}/test.catalog.${overlayName}.mjs`);

export const {
  BLOCKED_REASONS
, BLOCKED_SCRIPTS
, EXCLUDED_SCRIPTS
, REPO_ROOT
, TEST_SCRIPT_DIR
, discoverTestScripts
, getRepoRoot
, requireTestScriptDir
} = catalog;
