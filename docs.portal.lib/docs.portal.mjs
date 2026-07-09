/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-26 08:40
 * ------------------------------------------------------------------------------------------------------------------------
 * creato il: 2026-06-26 08:40 by: IbyEll
 * modificato il: 2026-06-26 08:40 by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Portal documentazione — elenco pagine, path file, refresh Aggiorna e chrome
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Il server HOME e i generatori docs condividono path docs.portal, elenco HTML e flusso
 *     refresh senza duplicare logica in portal.home.server.mjs.
 *
 *   A cosa serve:
 *   - Espone DOCS_PUBLIC_PREFIX, resolveDocsFile, injectDocsChrome, refreshDocs e re-export
 *     analisi, elenco pagine e registry RIGENERA per API portal.
 *
 * Generalizzazione:
 *   No — root PortalAdmin fissa (MODULE_DIR parent); catalogo pagine da docs.portal/.
 *
 * Input: —
 *
 * Consumatori:
 *   - admin.portal/portal.home.server.mjs — GET /docs, POST refresh e regenerate
 *
 * Export principali:
 *   - getDocsDir, resolveDocsFile, injectDocsChrome — serve statico e chrome
 *   - refreshDocs — loop Aggiorna su pagine docs
 *   - listDocPages, analyzeRepository, getDocsRegenerateRegistry — re-export
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeRepository, listDocPages } from "./docs.portal.analysis.mjs";
import { ensureDocsChromeMarker, refreshDocHtml } from "./docs.portal.refresh.mjs";
import { getDocsRegenerateRegistry, regenerateDoc } from "./registry.regenerate.mjs";

const MODULE_DIR  = dirname(fileURLToPath(import.meta.url));
const PORTAL_ROOT = join(MODULE_DIR, "..");
const DOCS_DIR    = join(PORTAL_ROOT, "docs.portal");

/** Indice catalogo documenti (ex index.html). */
export const DOCS_INDEX_FILE = "1.document.index.html";

/** File chrome toolbar (ex docs-chrome.*). */
export const DOCS_CHROME_HTML = "utility.toolbar.document.html";
export const DOCS_CHROME_JS   = "utility.toolbar.document.js";

/** Alias URL legacy → file attuali in docs.portal/. */
const DOC_FILE_ALIASES = {
  "index.html"                        : DOCS_INDEX_FILE
, "docs-chrome.html"                  : DOCS_CHROME_HTML
, "docs-chrome.js"                    : DOCS_CHROME_JS
, "matrix.avanzamento.gap.feature.html": "matrix.portal.gap.html"
, "Avanzamento_Gap_Feature.html"      : "matrix.portal.gap.html"
};

/** Prefisso URL pubblico per pagine e asset documentazione. */
export const DOCS_PUBLIC_PREFIX = "/docs";

export { analyzeRepository, listDocPages };
export { getDocsRegenerateRegistry, regenerateDoc };

/**
 * @returns {string}
 */
export function getDocsDir() {
  return DOCS_DIR;
}

/**
 * @param {string} rel
 * @returns {string}
 */
export function normalizeDocsRel(rel) {
  const normalized = rel
    .replace(/^\/+/, "")
    .replace(/^docs\.portal\//, "")
    .replace(/^docs\//, "");

  return DOC_FILE_ALIASES[normalized] ?? normalized;
}

/**
 * @param {string} rel — es. index.html o repo-audit-ridondanze-gap.html
 * @returns {string | null}
 */
export function resolveDocsFile(rel) {
  const normalized = normalizeDocsRel(rel);

  if (!normalized || normalized.includes("..")) {
    return null;
  }

  const file = join(DOCS_DIR, normalized);

  if (!file.startsWith(DOCS_DIR) || !existsSync(file)) {
    return null;
  }

  return file;
}

/**
 * @returns {Promise<string>}
 */
async function readDocsChromeFragment() {
  return readFile(join(DOCS_DIR, DOCS_CHROME_HTML), "utf8");
}

/**
 * @param {string} html
 * @param {string} docRel
 * @returns {Promise<string>}
 */
export async function injectDocsChrome(html, docRel) {
  let out = ensureDocsChromeMarker(html);

  if (!out.includes("docs.style.css")) {
    out = out.replace(
      "</head>"
    , '  <link rel="stylesheet" href="/docs/docs.style.css" />\n</head>'
    );
  }

  if (!out.includes(DOCS_CHROME_JS) && !out.includes("docs-chrome.js")) {
    out = out.replace(
      "</body>"
    , `  <script src="/docs/${DOCS_CHROME_JS}" defer></script>\n</body>`
    );
  }

  if (!out.includes("<!-- DOCS-CHROME -->")) {
    return out;
  }

  const chrome = await readDocsChromeFragment();

  return out.replace("<!-- DOCS-CHROME -->", chrome.replaceAll("{{DOC_REL}}", docRel));
}

/**
 * @param {string} [filename]
 * @returns {Promise<{ analysis: ReturnType<typeof analyzeRepository>, updated: string[], skipped: string[] }>}
 */
export async function refreshDocs({ filename } = {}) {
  const analysis = analyzeRepository(PORTAL_ROOT);
  const pages    = listDocPages(PORTAL_ROOT);
  const targets  = filename
    ? pages.filter((p) => p.name === filename)
    : pages.filter((p) => p.name !== DOCS_INDEX_FILE && p.name !== "index.html");

  if (filename && targets.length === 0) {
    throw new Error(`Documento non trovato: ${filename}`);
  }

  /** @type {string[]} */
  const updated = [];
  /** @type {string[]} */
  const skipped = [];

  for (const page of targets) {
    const file = resolveDocsFile(page.name);

    if (!file) {
      skipped.push(page.name);
      continue;
    }

    const raw     = await readFile(file, "utf8");
    const { html, changed } = await refreshDocHtml(raw, page.name, analysis);

    if (changed) {
      await writeFile(file, html, "utf8");
      updated.push(page.name);
    } else {
      skipped.push(page.name);
    }
  }

  return { analysis, updated, skipped };
}
