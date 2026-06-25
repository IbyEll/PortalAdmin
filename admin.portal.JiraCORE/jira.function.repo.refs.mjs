/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-18 03:36
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 03:01   by: IbyEll
 * modificato il: 2026-06-18 03:36   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                       Scan citazioni IssueKEY nel product repo configurato (PRODUCT_REPO_PATH).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - L’allineamento backlog Jira vs codice richiede sapere dove ogni key è citata nel repo prodotto.
 *   - Regex progetti e policy di walk (estensioni, skip dir, limite file) devono restare centralizzate.
 *
 *   A cosa serve:
 *   - Attraversa il product repo configurato e raccoglie path relativi per ogni key Jira trovata.
 *   - Espone helper per summary troncate in UI e verifica disponibilità del checkout prodotto.
 *
 * Generalizzazione:
 *   Si — prefissi IssueKEY da JIRA_PROJECT_KEYS (overlay PRJ_NAME) e root da PRODUCT_REPO_PATH.
 *
 * Input:
 *   - PRODUCT_REPO_PATH — root checkout product (portal.paths.resolver)
 *   - JIRA_PROJECT_KEYS — prefissi ammessi (jira.project.config.overlay, da PRJ_NAME)
 *
 * Consumatori:
 *   - cruscotto.jira.backlog.insights.mjs — inspect repo vs stato Jira
 *   - cruscotto.jira.working.insights.mjs — working plan + segnali repo
 *   - cruscotto.jira.my-project.analysis.mjs — analisi progetto
 *   - admin.portal.JiraCORE/JiraCORE.repo.issuekey.signal.analysis.mjs — gap analysis ticket (re-export)
 *   - admin.portal.JiraCORE/JiraCORE.signals.catalog.implementation.mjs — fallback path da scan
 *   - cruscotto.frontend/cruscotto.server.mjs — API dashboard scan riferimenti
 *   - scripts/confluence.pillar.matrix.generate.mjs — matrice pillar Confluence
 *
 * Export principali:
 *   - JIRA_KEY_RE — pattern citazioni da JIRA_PROJECT_KEYS (overlay config)
 *   - walkRepoTextFiles — walk ricorsivo file testuali sotto una directory
 *   - scanRepoJiraReferences — Map key Jira → path relativi nel product repo
 *   - truncateIssueSummary — summary issue troncata per UI
 *   - isProductRepoAvailable — true se PRODUCT_REPO_PATH esiste su disco
 *
 * Variabili d'ambiente:
 *   PRODUCT_REPO_PATH — root product repo (portal.paths.resolver)
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

import { getProductRepoPath } from "../admin.portal.lib/portal.paths.resolver.mjs";
import { JIRA_PROJECT_KEYS } from "./jira.project.config.overlay.mjs";

// --- costanti di modulo (regex, policy walk, limiti scan) ---

/** Regex citazioni IssueKEY — prefissi da jira.project.config.overlay (JIRA_PROJECT_KEYS). */
export const JIRA_KEY_RE = new RegExp(
  `\\b((?:${JIRA_PROJECT_KEYS})-\\d+)\\b`
, "g"
);

/**
 * Directory escluse dal walk — artefatti build, VCS, cache, report storici.
 *
 * @type {ReadonlySet<string>}
 */
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

/**
 * Estensioni considerate file testuali per la ricerca key Jira.
 *
 * @type {ReadonlySet<string>}
 */
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

/** Limite dimensione singolo file — evita letture su bundle o dump enormi. */
const MAX_FILE_BYTES    = 512_000;

/** Massimo path distinti registrati per key — cap memoria e payload insight. */
const MAX_PATHS_PER_KEY = 8;

/**
 * Walk ricorsivo: accumula path assoluti di file testuali sotto `dir`.
 *
 * @param {string} dir — radice walk (tipicamente product repo)
 * @param {string[]} acc — array mutato con i path trovati
 */
export function walkRepoTextFiles(dir, acc) {
  let entries;

  // 1. Lettura directory — permessi mancanti: skip silenzioso
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

    // 2. Filtro dimensione — salta file oltre MAX_FILE_BYTES
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
 * Scansiona il product repo e restituisce le citazioni Jira per key.
 *
 * @returns {Map<string, string[]>} key Jira → path relativi (max MAX_PATHS_PER_KEY)
 */
export function scanRepoJiraReferences() {
  const repoRoot = getProductRepoPath();

  /** @type {string[]} */
  const files = [];

  // 1. Elenco file testuali nel product repo
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

    // 2. Match regex — una occorrenza per key per file, cap path per key
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
 * Tronca il summary issue per display in tabelle e tooltip cruscotto.
 *
 * @param {string} summary
 * @param {number} [maxLen]
 */
export function truncateIssueSummary(summary, maxLen = 72) {
  const text = String(summary ?? "").trim();

  if (text.length <= maxLen) {
    return text;
  }

  // 1. Troncamento con ellissi — display tabelle cruscotto
  return `${text.slice(0, maxLen - 1)}…`;
}

/**
 * Verifica che il checkout product repo sia raggiungibile (path da portal.paths.resolver).
 *
 * @returns {boolean}
 */
export function isProductRepoAvailable() {
  // 1. existsSync su PRODUCT_REPO_PATH — false se path assente o errore resolver
  try {
    return existsSync(getProductRepoPath());
  } catch {
    return false;
  }
}
