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
, MATRIX_KIND_PORTAL_GAP
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
 * @returns {Promise<Map<string, FindingIssueLink>>}
 */
export async function loadFindingIssueLinks() {
  if (canUseMatrixDb()) {
    try {
      await openCruscottoDb();

      return loadFindingIssueLinksDb(MATRIX_KIND_PORTAL_GAP);
    } catch {
      // fallback JSON
    }
  }

  return loadFindingIssueLinksJson();
}

/**
 * @returns {Record<string, FindingIssueLink>}
 */
export async function loadFindingIssueLinksObject() {
  return Object.fromEntries(await loadFindingIssueLinks());
}

/**
 * @param {string} findingId
 * @param {{ key: string, issueType: string }} link
 * @returns {Promise<FindingIssueLink>}
 */
export async function persistFindingIssueLink(findingId, link) {
  const id  = String(findingId ?? "").trim();
  const key = String(link.key ?? "").trim().toUpperCase();

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
      await upsertFindingIssueLink(id, MATRIX_KIND_PORTAL_GAP, {
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
