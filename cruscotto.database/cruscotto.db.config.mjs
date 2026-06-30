/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-20 07:25
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-20 07:14   by: IbyEll
 * modificato il: 2026-06-20 07:25   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *          Cruscotto SQLite PortalAdmin — path per overlay, URL Prisma e lifecycle client condiviso.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - La cache backlog Jira è per progetto istanziato (PRJ_NAME): path e client Prisma non duplicati in ogni
 *     script di sync, migrate o load backlog.
 *
 *   A cosa serve:
 *   - Risolve PROJECT_{overlay}/cruscotto_{overlay}.db, prepara datasource URL file: e espone singleton Prisma.
 *   - instantiateCruscottoDb crea cartella overlay e file DB se assenti; se presente solo load (no seed, no sync).
 *
 * Generalizzazione:
 *   Si — path DB da PRJ_NAME (PROJECT_{overlay}) o override CRUSCOTTO_DB_PATH; riusabile su ogni overlay.
 *
 * Input:
 *   - PRJ_NAME — overlay attivo (es. JustLastOne, AdminDashBoard)
 *   - CRUSCOTTO_DB_PATH — override path assoluto file SQLite (env, opzionale)
 *
 * Consumatori:
 *   - cruscotto.database/Jira.backlog.sync.mjs — openCruscottoDb, closeCruscottoDb, resolveCruscottoDbPath
 *   - cruscotto.database/migrate.mjs — prepareCruscottoDatabaseUrl, resolveCruscottoDbPath
 *   - admin.portal.JiraCORE/jiraCORE.backlog.sync.mjs — describeCruscottoDbLayout, resolveCruscottoDbPath
 *   - admin.portal.JiraCORE/jiraCORE.backlog.load.mjs — openCruscottoDb via stack DB condiviso
 *   - admin.portal/portal.instance.prepare.mjs — instantiateCruscottoDb
 *   - test.smoke/smoke-cruscotto-db.mjs — smoke cache backlog e layout DB
 *
 * Export principali:
 *   - resolveProjectOverlayDir — cartella PROJECT_{PRJ_NAME} sotto portal root
 *   - resolveCruscottoDbFileName — nome file cruscotto_{PRJ_NAME}.db
 *   - resolveCruscottoDbPath — path assoluto SQLite backlog per overlay istanziato
 *   - getCruscottoDbPath — alias di resolveCruscottoDbPath
 *   - resolveCruscottoDatabaseUrl — URL datasource Prisma file: normalizzato
 *   - prepareCruscottoDatabaseUrl — crea parent dir e restituisce URL per migrate/sync
 *   - cruscottoDbFileExists — true se il file .db esiste su disco
 *   - describeCruscottoDbLayout — stringa diagnostica portal, overlay e path db
 *   - instantiateCruscottoDb — crea DB+schema se assente, altrimenti solo load connessione
 *   - openCruscottoDb — PrismaClient singleton connesso al cruscotto backlog
 *   - closeCruscottoDb — disconnect e reset del singleton
 *   - PrismaClient — re-export tipo client Prisma
 *
 * Variabili d'ambiente:
 *   - PRJ_NAME — overlay product (obbligatorio se CRUSCOTTO_DB_PATH assente)
 *   - CRUSCOTTO_DB_PATH — override path assoluto .db (default PROJECT_{PRJ_NAME}/cruscotto_{PRJ_NAME}.db)
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { PrismaClient, Prisma } from "@prisma/client";

import { resolveProjectOverlayName } from "../admin.portal.lib/project.config.mjs";
import { getPortalRoot } from "../admin.portal.lib/portal.paths.resolver.mjs";
import { runCruscottoMigrateFull } from "./cruscotto.db.migrate.mjs";

// --- costanti di modulo (policy, set, path fissi) ---

/**
 * Cartella overlay PROJECT_{PRJ_NAME} sotto portal root.
 *
 * @returns {string}
 */
export function resolveProjectOverlayDir() {
  const overlay = resolveProjectOverlayName();

  return join(getPortalRoot(), `PROJECT_${overlay}`);
}

/**
 * Nome file SQLite backlog per overlay istanziato.
 *
 * @returns {string}
 */
export function resolveCruscottoDbFileName() {
  const overlay = resolveProjectOverlayName();

  return `cruscotto_${overlay}.db`;
}

/**
 * Risolve path assoluto SQLite cruscotto (env CRUSCOTTO_DB_PATH o PROJECT_{overlay}/cruscotto_{overlay}.db).
 *
 * @returns {string}
 */
export function resolveCruscottoDbPath() {
  const raw = process.env.CRUSCOTTO_DB_PATH?.trim();

  if (raw) {
    return resolve(raw);
  }

  return join(resolveProjectOverlayDir(), resolveCruscottoDbFileName());
}

/**
 * Alias di {@link resolveCruscottoDbPath} — preferire resolve per letture env fresche.
 *
 * @returns {string}
 */
export function getCruscottoDbPath() {
  return resolveCruscottoDbPath();
}

/** @type {PrismaClient | null} */
let activeClient = null;

/** @type {string | null} */
let activeDbPath = null;

/**
 * URL datasource Prisma `file:` normalizzato per Windows.
 *
 * @returns {string}
 */
export function resolveCruscottoDatabaseUrl() {
  const normalized = resolveCruscottoDbPath().replace(/\\/g, "/");

  return `file:${normalized}?busy_timeout=10000`;
}

/**
 * Crea parent dir se manca e restituisce URL per Prisma CLI.
 *
 * @returns {string}
 */
export function prepareCruscottoDatabaseUrl() {
  const path = resolveCruscottoDbPath();

  mkdirSync(dirname(path), { recursive: true });

  return resolveCruscottoDatabaseUrl();
}

/**
 * @returns {boolean}
 */
export function cruscottoDbFileExists() {
  return existsSync(resolveCruscottoDbPath());
}

/**
 * Riga diagnostica portal root, overlay e path db (smoke, sync-jira-backlog).
 *
 * @returns {string}
 */
export function describeCruscottoDbLayout() {
  const overlay = process.env.CRUSCOTTO_DB_PATH?.trim()
    ? "(override)"
    : resolveProjectOverlayName();

  return `portal=${getPortalRoot()} overlay=${overlay} db=${resolveCruscottoDbPath()}`;
}

/**
 * Applica migrate Prisma completo (deploy + generate) sul path corrente.
 */
function runCruscottoMigrate() {
  runCruscottoMigrateFull();
}

/**
 * Istanza DB backlog per overlay: crea PROJECT_{overlay} e file se assenti (solo schema);
 * se già presente apre connessione senza seed né sync Jira.
 *
 * @returns {Promise<{ dbPath: string, created: boolean, overlay: string }>}
 */
export async function instantiateCruscottoDb() {
  const overlay = resolveProjectOverlayName();

  // 1. Cartella overlay — solo con path default per progetto
  if (!process.env.CRUSCOTTO_DB_PATH?.trim()) {
    mkdirSync(resolveProjectOverlayDir(), { recursive: true });
  }

  const dbPath  = resolveCruscottoDbPath();
  const created = !cruscottoDbFileExists();

  // 2. Nuovo file — migrate schema; esistente — solo load (no seed, no sync)
  if (created) {
    prepareCruscottoDatabaseUrl();
    runCruscottoMigrate();
  }

  // 3. Verifica connessione Prisma sul file istanziato
  await openCruscottoDb();
  await closeCruscottoDb();

  return { dbPath, created, overlay };
}

/**
 * Apre (o riusa) PrismaClient sul cruscotto backlog dell'overlay corrente.
 *
 * @returns {Promise<PrismaClient>}
 */
export async function openCruscottoDb() {
  const dbPath = resolveCruscottoDbPath();

  // 1. Singleton — riusa client se stesso path; $connect idempotente se engine disconnesso
  if (activeClient && activeDbPath === dbPath) {
    await activeClient.$connect();
    return activeClient;
  }

  // 2. Cambio overlay/path — chiude client precedente
  if (activeClient) {
    await activeClient.$disconnect();
    activeClient = null;
    activeDbPath   = null;
  }

  // 3. Garantisce directory parent e costruisce datasource file: per Prisma
  prepareCruscottoDatabaseUrl();

  activeClient = new PrismaClient({
    datasources: {
      db: { url: resolveCruscottoDatabaseUrl() },
    },
  });

  await activeClient.$connect();
  activeDbPath = dbPath;

  return activeClient;
}

/**
 * Disconnette e azzera il client condiviso.
 *
 * @returns {Promise<void>}
 */
export async function closeCruscottoDb() {
  if (!activeClient) {
    return;
  }

  await activeClient.$disconnect();
  activeClient = null;
  activeDbPath   = null;
}

const CRUSCOTTO_PRISMA_RESTART_HINT =
  "Esegui npm run db:migrate, poi riavvia il cruscotto (npm run admin:dashboard) e ripeti Sync.";

/**
 * Verifica che il Prisma Client caricato esponga `isObsolete` su JiraIssue (post-rename schema).
 *
 * @throws {Error} se il processo usa ancora un client generato prima del rename
 */
export function assertCruscottoPrismaClientCurrent() {
  const fields = Prisma.JiraIssueScalarFieldEnum;

  if (!Object.prototype.hasOwnProperty.call(fields, "isObsolete")) {
    throw new Error(`Prisma Client obsoleto (manca isObsolete su jira_issue). ${CRUSCOTTO_PRISMA_RESTART_HINT}`);
  }
}

/**
 * Messaggio utente per errori Prisma dovuti a client/schema disallineati.
 *
 * @param {unknown} err
 * @returns {string | null}
 */
export function formatCruscottoPrismaSchemaError(err) {
  const message = err instanceof Error ? err.message : String(err ?? "");

  if (/Unknown argument [`']isObsolete[`']/.test(message)) {
    return `Prisma Client in memoria non allineato allo schema DB. ${CRUSCOTTO_PRISMA_RESTART_HINT}`;
  }

  if (/Unknown argument [`']isSprint6Obsolete[`']/.test(message)) {
    return `Codice sync non allineato allo schema DB. ${CRUSCOTTO_PRISMA_RESTART_HINT}`;
  }

  if (/no such column: .*is_sprint6_obsolete/i.test(message)) {
    return `Colonna obsoleta nel DB: migrazione applicata ma client vecchio. ${CRUSCOTTO_PRISMA_RESTART_HINT}`;
  }

  return null;
}

export { PrismaClient };
