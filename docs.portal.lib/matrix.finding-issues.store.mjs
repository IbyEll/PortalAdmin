/**
 * Store findingId → issue Jira creata dal pulsante Crea sulle matrici docs.
 *
 * Delega a matrix_finding_issue su DB cruscotto; fallback JSON se DB assente.
 * Modalità MATRIX_PERSIST=dual scrive entrambi.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  cruscottoDbFileExists
, openCruscottoDb
} from "../cruscotto.database/cruscotto.db.config.mjs";
import {
  loadFindingIssueLinks as loadFindingIssueLinksDb
, upsertFindingIssueLink
, deleteFindingIssueLink as deleteFindingIssueLinkDb
, MATRIX_KIND_PORTAL_GAP
, MATRIX_KIND_TEST_COVERAGE
} from "../cruscotto.database/matrix.db.mjs";
import { shouldWriteMatrixDb, shouldWriteMatrixJson } from "./matrix.persist.config.mjs";

const STORE_DIR   = dirname(fileURLToPath(import.meta.url));
const STORE_FILE  = join(STORE_DIR, "matrix.finding-issues.json");
const LEGACY_FILE = join(STORE_DIR, "advancement.finding-issues.json");

/**
 * @typedef {{ key: string, issueType: string, createdAt?: string }} FindingIssueLink
 */

/**
 * @returns {boolean}
 */
function canUseMatrixDb() {
  return shouldWriteMatrixDb() && cruscottoDbFileExists();
}

/**
 * @returns {string}
 */
function resolveStoreFile() {
  if (existsSync(STORE_FILE)) {
    return STORE_FILE;
  }

  if (existsSync(LEGACY_FILE)) {
    return LEGACY_FILE;
  }

  return STORE_FILE;
}

/**
 * @returns {Map<string, FindingIssueLink>}
 */
function loadFindingIssueLinksJson() {
  /** @type {Map<string, FindingIssueLink>} */
  const map  = new Map();
  const file = resolveStoreFile();

  if (!existsSync(file)) {
    return map;
  }

  try {
    const raw = JSON.parse(readFileSync(file, "utf8"));

    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const [findingId, entry] of Object.entries(raw)) {
        const key = String(entry?.key ?? "").trim().toUpperCase();

        if (!findingId || !key) {
          continue;
        }

        map.set(findingId, {
          key
        , issueType: String(entry?.issueType ?? "").trim() || "Bug"
        , createdAt: typeof entry?.createdAt === "string" ? entry.createdAt : undefined
        });
      }
    }
  } catch {
    // store corrotto — riparte vuoto
  }

  return map;
}

/**
 * @param {string} findingId
 */
function removeFindingIssueLinkJson(findingId) {
  const id = String(findingId ?? "").trim();

  if (!id || !existsSync(resolveStoreFile())) {
    return;
  }

  const map = loadFindingIssueLinksJson();

  if (!map.has(id)) {
    return;
  }

  map.delete(id);
  writeFileSync(STORE_FILE, `${JSON.stringify(Object.fromEntries(map), null, 2)}\n`, "utf8");
}

/**
 * @param {string} [matrixKind]
 * @returns {Promise<Map<string, FindingIssueLink>>}
 */
export async function loadFindingIssueLinks(matrixKind = MATRIX_KIND_PORTAL_GAP) {
  const kind = String(matrixKind ?? MATRIX_KIND_PORTAL_GAP).trim();

  if (canUseMatrixDb()) {
    try {
      await openCruscottoDb();

      return loadFindingIssueLinksDb(kind);
    } catch {
      // fallback JSON solo per portal_gap legacy
    }
  }

  if (kind === MATRIX_KIND_PORTAL_GAP) {
    return loadFindingIssueLinksJson();
  }

  return new Map();
}

/**
 * Rimuove link finding ↔ Jira obsoleti (issue cancellata o assente da Jira/cache).
 *
 * @param {{ matrixKinds?: string[] }} [opts]
 * @returns {Promise<{ removed: Array<{ findingId: string, matrixKind: string, jiraKey: string }>, count: number }>}
 */
export async function pruneStaleMatrixFindingIssueLinks(opts = {}) {
  const matrixKinds = opts.matrixKinds ?? [MATRIX_KIND_PORTAL_GAP, MATRIX_KIND_TEST_COVERAGE];
  const { isJiraIssueKeyAlive } = await import("./matrix.finding.issues.mjs");
  /** @type {Array<{ findingId: string, matrixKind: string, jiraKey: string }>} */
  const removed = [];

  for (const matrixKind of matrixKinds) {
    const links = await loadFindingIssueLinks(matrixKind);

    for (const [findingId, link] of links) {
      const alive = await isJiraIssueKeyAlive(link.key);

      if (alive) {
        continue;
      }

      if (canUseMatrixDb()) {
        try {
          await openCruscottoDb();
          await deleteFindingIssueLinkDb(findingId, matrixKind);
        } catch {
          // continua con JSON
        }
      }

      if (shouldWriteMatrixJson() && matrixKind === MATRIX_KIND_PORTAL_GAP) {
        removeFindingIssueLinkJson(findingId);
      }

      removed.push({ findingId, matrixKind, jiraKey: link.key });
    }
  }

  return { removed, count: removed.length };
}

/**
 * @param {string} [matrixKind]
 * @returns {Record<string, FindingIssueLink>}
 */
export async function loadFindingIssueLinksObject(matrixKind) {
  if (matrixKind) {
    return Object.fromEntries(await loadFindingIssueLinks(matrixKind));
  }

  return Object.fromEntries(await loadFindingIssueLinks());
}

/**
 * @param {string} findingId
 * @param {{ key: string, issueType: string }} link
 * @param {string} [matrixKind]
 * @returns {Promise<FindingIssueLink>}
 */
export async function persistFindingIssueLink(findingId, link, matrixKind = MATRIX_KIND_PORTAL_GAP) {
  const id  = String(findingId ?? "").trim();
  const key = String(link.key ?? "").trim().toUpperCase();
  const kind = String(matrixKind ?? MATRIX_KIND_PORTAL_GAP).trim();

  if (!id || !key) {
    throw new Error("findingId e key obbligatori per persistenza link matrice");
  }

  const entry = {
    key
  , issueType: String(link.issueType ?? "").trim() || "Bug"
  , createdAt: new Date().toISOString()
  };

  if (canUseMatrixDb()) {
    try {
      await openCruscottoDb();
      await upsertFindingIssueLink(id, kind, {
        ...entry
      , linkedSource: "create_button"
      });
    } catch {
      // continua con JSON se DB fallisce
    }
  }

  if (shouldWriteMatrixJson()) {
    const map = loadFindingIssueLinksJson();

    map.set(id, entry);
    writeFileSync(STORE_FILE, `${JSON.stringify(Object.fromEntries(map), null, 2)}\n`, "utf8");
  }

  return entry;
}
