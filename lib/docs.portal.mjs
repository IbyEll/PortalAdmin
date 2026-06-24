/**
 * Portal documentazione — elenco, serve path, refresh barrato + commento.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { analyzeRepository, listDocPages } from "./docs.portal.analysis.mjs";
import { ensureDocsChromeMarker, refreshDocHtml } from "./docs.portal.refresh.mjs";

const MODULE_DIR  = dirname(fileURLToPath(import.meta.url));
const PORTAL_ROOT = join(MODULE_DIR, "..");
const DOCS_DIR    = join(PORTAL_ROOT, "docs");

export { analyzeRepository, listDocPages };

/**
 * @returns {string}
 */
export function getDocsDir() {
  return DOCS_DIR;
}

/**
 * @param {string} rel — es. index.html o repo-audit-ridondanze-gap.html
 * @returns {string | null}
 */
export function resolveDocsFile(rel) {
  const normalized = rel.replace(/^\/+/, "").replace(/^docs\//, "");

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
  return readFile(join(DOCS_DIR, "docs-chrome.html"), "utf8");
}

/**
 * @param {string} html
 * @param {string} docRel
 * @returns {Promise<string>}
 */
export async function injectDocsChrome(html, docRel) {
  let out = ensureDocsChromeMarker(html);

  if (!out.includes("docs-chrome.css")) {
    out = out.replace(
      "</head>"
    , '  <link rel="stylesheet" href="/docs/docs-chrome.css" />\n</head>'
    );
  }

  if (!out.includes("docs-chrome.js")) {
    out = out.replace(
      "</body>"
    , '  <script src="/docs/docs-chrome.js" defer></script>\n</body>'
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
    : pages.filter((p) => p.name !== "index.html");

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
