/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-26 08:40
 * ------------------------------------------------------------------------------------------------------------------------
 * creato il: 2026-06-26 08:40 by: IbyEll
 * modificato il: 2026-06-26 08:40 by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Registry RIGENERA — mapping pagina HTML → script generator merge-safe
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Il pulsante RIGENERA in docs-chrome deve invocare lo script corretto per ogni matrice senza
 *     hardcodare path nel server o nel client.
 *
 *   A cosa serve:
 *   - DOCS_REGENERATE_REGISTRY elenca filename → script relativo a portal root; regenerateDoc
 *     esegue node in spawn e restituisce log stdout per API POST /api/docs/regenerate.
 *
 * Generalizzazione:
 *   No — registry fisso per le quattro matrici docs.portal attuali.
 *
 * Input: —
 *
 * Consumatori:
 *   - admin.portal/portal.home.server.mjs — GET registry e POST regenerate
 *   - docs.portal.lib/docs.portal.mjs — re-export getDocsRegenerateRegistry, regenerateDoc
 *
 * Export principali:
 *   - DOCS_REGENERATE_REGISTRY — mapping statico pagina → script
 *   - getDocsRegenerateRegistry, getRegenerateConfig — lookup registry
 *   - regenerateDoc — spawn script e ritorno log
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR  = dirname(fileURLToPath(import.meta.url));
const PORTAL_ROOT = join(MODULE_DIR, "..");

/** @type {Record<string, { script: string, label?: string }>} */
export const DOCS_REGENERATE_REGISTRY = {
  "matrix.portal.gap.html"                : { script: "docs.portal/matrix.portal.gap.analysis.mjs"        , label: "Avanzamento / gap" }
, "matrix.test.coverage.html"             : { script: "docs.portal/matrix.test.coverage.mjs"              , label: "Copertura test" }
, "matrix.repo.audit.ridondanze.gap.html" : { script: "docs.portal/matrix.repo.audit.ridondanze.gap.mjs"  , label: "Audit ridondanze" }
};

/**
 * @returns {Record<string, { script: string, label: string }>}
 */
export function getDocsRegenerateRegistry() {
  /** @type {Record<string, { script: string, label: string }>} */
  const out = {};

  for (const [file, cfg] of Object.entries(DOCS_REGENERATE_REGISTRY)) {
    out[file] = {
      script: cfg.script
    , label : cfg.label ?? file
    };
  }

  return out;
}

/**
 * @param {string} filename
 * @returns {{ script: string, label: string } | null}
 */
export function getRegenerateConfig(filename) {
  const cfg = DOCS_REGENERATE_REGISTRY[filename];

  if (!cfg) {
    return null;
  }

  return { script: cfg.script, label: cfg.label ?? filename };
}

/**
 * @param {string} scriptRel — relativo a PORTAL_ROOT
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
function runNodeScript(scriptRel) {
  const scriptPath = join(PORTAL_ROOT, scriptRel.replace(/^\/+/, ""));

  if (!existsSync(scriptPath)) {
    return Promise.reject(new Error(`Script non trovato: ${scriptRel}`));
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd  : PORTAL_ROOT
    , env  : process.env
    , stdio: ["ignore", "pipe", "pipe"]
    });

    /** @type {string[]} */
    const stdout = [];
    /** @type {string[]} */
    const stderr = [];

    child.stdout.on("data", (chunk) => stdout.push(String(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(String(chunk)));

    child.on("error", reject);

    child.on("close", (code) => {
      const outStr = stdout.join("").trim();
      const errStr = stderr.join("").trim();

      if (code !== 0) {
        reject(new Error(errStr || outStr || `Script exit ${code}`));
        return;
      }

      resolve({ stdout: outStr, stderr: errStr });
    });
  });
}

/**
 * @param {{ filename: string }} opts
 * @returns {Promise<{ file: string, script: string, label: string, log: string }>}
 */
export async function regenerateDoc({ filename }) {
  const cfg = getRegenerateConfig(filename);

  if (!cfg) {
    throw new Error(`Pagina senza script di rigenerazione: ${filename}`);
  }

  const { stdout } = await runNodeScript(cfg.script);

  return {
    file  : filename
  , script: cfg.script
  , label : cfg.label
  , log   : stdout
  };
}
