/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-18 16:10
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 16:10   by: IbyEll
 * modificato il: 2026-06-18 16:10   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                                HTTP e assert condivisi per suite admin.portal.testscript
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - I testscript in admin.portal.testscript ripetono assert, fetch HTTP, logging e riepilogo;
 *     centralizzare evita drift tra suite health, portal, jira, repo e funzionali.
 *
 *   A cosa serve:
 *   - assert e runTest per esecuzione singoli check con accumulo TestResult.
 *   - portalFetch verso cruscotto o home con timeout, JSON body e parse risposta.
 *   - logSection, logUnlessJson e printSummary con modalità --json per CI e runner.
 *   - resolveScriptMeta per metadati script nel report JSON finale.
 *
 * Generalizzazione:
 *   Si — modulo condiviso da tutti i test.*.mjs; base URL e flag --json passati dal consumer.
 *
 * Input:
 *   - base, path, opts — portalFetch (method, timeoutMs, body, headers dal test chiamante)
 *   - process.argv — flag --json per output machine-readable
 *   - importMetaUrl — resolveScriptMeta (opzionale, altrimenti argv[1])
 *
 * Consumatori:
 *   - admin.portal.testscript/health, portal, cruscotto, scripts, meta, dev, repo, jira, cursor,
 *     funzionali, home — test.*.mjs che importano assert, runTest, portalFetch, printSummary
 *   - admin.portal.testscript/run-portal-api.mjs — suite indiretta via script figli
 *
 * Export principali:
 *   - assert — fail-fast su condizione falsa
 *   - isJsonMode, logSection, logUnlessJson — output console condizionato a --json
 *   - stripTrailingSlash — normalizza base URL senza slash finale
 *   - resolveScriptMeta — script, suite, startedAt per report JSON
 *   - runTest — esegue fn async e push su results
 *   - printSummary — riepilogo pass/fail; exitCode 1 se fallimenti
 *   - portalFetch — fetch HTTP con AbortSignal.timeout e parse body JSON o testo
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Root suite testscript — path relativo script e suite da import.meta o argv
const TESTSCRIPT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Timestamp avvio processo — startedAt coerente in resolveScriptMeta e printSummary
const SCRIPT_STARTED_MS = Date.now();

/**
 * Fail-fast se la condizione è falsa.
 *
 * @param {unknown} condition
 * @param {string} message
 */
export function assert(condition, message) {
  // 1. Valuta condizione — throw Error con messaggio se falsa
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * True se stdout deve essere solo JSON (--json in argv).
 *
 * @returns {boolean}
 */
export function isJsonMode() {
  // 1. Cerca --json in process.argv — modalità report senza log testuale
  return process.argv.includes("--json");
}

/**
 * Stampa intestazione sezione su console (no-op in modalità JSON).
 *
 * @param {string} title
 */
export function logSection(title) {
  // 1. Salta output se --json — evita rumore nel parse CI
  if (isJsonMode()) {
    return;
  }

  console.log("");
  console.log(`── ${title} ──`);
}

/**
 * console.log condizionato — soppresso in modalità JSON.
 *
 * @param {...unknown} args
 */
export function logUnlessJson(...args) {
  // 1. Log solo fuori da --json — dettaglio umano durante run locale
  if (!isJsonMode()) {
    console.log(...args);
  }
}

/**
 * Rimuove slash finale da base URL.
 *
 * @param {string} url
 */
export function stripTrailingSlash(url) {
  // 1. Normalizza base — concat path senza doppio slash
  return url.replace(/\/$/, "");
}

/**
 * Metadati script per report JSON (path relativo, suite, timestamp avvio).
 *
 * @param {import("node:url").URL | string} [importMetaUrl]
 */
export function resolveScriptMeta(importMetaUrl) {
  // 1. Timestamp avvio processo — coerente per tutta la sessione test
  const startedAtMs = SCRIPT_STARTED_MS;
  const startedAt   = new Date(startedAtMs).toISOString();

  // 2. Da import.meta.url — path relativo a TESTSCRIPT_ROOT e nome suite
  if (importMetaUrl) {
    const full = fileURLToPath(
      typeof importMetaUrl === "string" ? importMetaUrl : importMetaUrl
    );
    const rel   = relative(TESTSCRIPT_ROOT, full).replace(/\\/g, "/");
    const parts = rel.split("/");

    return {
      script      : rel
    , suite       : parts.length > 1 ? parts[0] : "root"
    , startedAt
    , startedAtMs
    };
  }

  // 3. Fallback argv[1] — script lanciato senza import.meta esplicito
  const argv1 = process.argv[1] ?? "";
  const rel   = argv1.includes("admin.portal.testscript")
    ? argv1.replace(/.*admin\.portal\.testscript[\\/]/, "").replace(/\\/g, "/")
    : basename(argv1);
  const parts = rel.split("/");

  return {
    script      : rel
  , suite       : parts.length > 1 ? parts[0] : "root"
  , startedAt
  , startedAtMs
  };
}

/**
 * @typedef {{ name: string, ok: boolean, detail?: string }} TestResult
 */

/**
 * Esegue un singolo test async e accumula esito in results.
 *
 * @param {string} name
 * @param {() => Promise<string[] | void>} fn
 * @param {TestResult[]} results
 */
export async function runTest(name, fn, results) {
  // 1. Esegui fn — cattura detailLines o messaggio errore
  try {
    const detailLines = await fn();
    results.push({ name, ok: true, detail: detailLines?.join("; ") });

    // 2. Log ✓ su console se non --json
    if (!isJsonMode()) {
      console.log(`  ✓ ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ name, ok: false, detail: message });

    // 3. Log ✗ con messaggio — run continua sugli altri test
    if (!isJsonMode()) {
      console.log(`  ✗ ${name} — ${message}`);
    }
  }
}

/**
 * Stampa riepilogo test; JSON completo se --json, altrimenti conteggio pass/fail.
 *
 * @param {TestResult[]} results
 * @param {{ title?: string, meta?: Record<string, unknown> }} [options]
 */
export function printSummary(results, options = {}) {
  // 1. Conta fallimenti e titolo sezione
  const failed = results.filter((row) => !row.ok).length;
  const title  = options.title ?? "Riepilogo";

  // 2. Modalità JSON — meta script + results su stdout
  if (isJsonMode()) {
    console.log(JSON.stringify({
      ...resolveScriptMeta()
    , ...options.meta
    , results
    , failed
    , passed: results.length - failed
    }, null, 2));
    return;
  }

  // 3. Riepilogo testuale — exitCode 1 se almeno un fallimento
  console.log("");
  console.log(`── ${title} ──`);
  console.log(`  ${results.length - failed}/${results.length} pass`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

/**
 * HTTP verso cruscotto o home — timeout, body JSON opzionale, parse risposta.
 *
 * @param {string} base
 * @param {string} path
 * @param {{ method?: string, timeoutMs?: number, body?: unknown, headers?: Record<string, string> }} [opts]
 */
export async function portalFetch(base, path, opts = {}) {
  // 1. Prepara RequestInit — method, AbortSignal.timeout, headers
  const method    = opts.method ?? "GET";
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const headers   = { ...(opts.headers ?? {}) };
  /** @type {RequestInit} */
  const init      = {
    method
  , signal  : AbortSignal.timeout(timeoutMs)
  , headers
  };

  // 2. Serializza body e Content-Type se presente
  if (opts.body !== undefined) {
    init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);

    if (!headers["Content-Type"] && !headers["content-type"]) {
      init.headers = { ...headers, "Content-Type": "application/json" };
    }
  }

  // 3. Fetch e parse body — JSON se possibile, altrimenti testo grezzo
  const res = await fetch(`${stripTrailingSlash(base)}${path}`, init);

  const text = await res.text();
  /** @type {unknown} */
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { res, body, text };
}
