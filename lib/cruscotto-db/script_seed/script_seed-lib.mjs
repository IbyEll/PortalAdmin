 
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { run, runDbGenerateWithRetry, root, portalRoot } from "../../../runner/runner.stack.mjs";
import { getProjectConfig, getProjectHealthUrls, resolveProductFuncSeedPath, resolveProductSeedPath } from "../../admin/config.project.mjs";

export { parseDbDevArgs, parseSeedIds } from "../../../lib/seed-cli-args.mjs";

export { root, portalRoot };

const {
  PRJ_DB_FILENAME
, PRJ_DB_PACKAGE
, PRJ_DB_PRISMA_DIR
, PRJ_SEED
, PRJ_SEED_FUNC
, PRJ_DB_NPM_WORKSPACE
, PRJ_NAME
, PRJ_REPO
} = getProjectConfig();

/** URL SQLite default — allineato a PRJ_DB_FILENAME in packages/database/.env */
const DEFAULT_DATABASE_URL = `file:./${PRJ_DB_FILENAME}`;

/** Path CLI relativi alla root PortalAdmin (help / manifest). */
export const INIT_DATABASE_DEV_REL = "lib/cruscotto-db/script_seed/init_Database_DEV.mjs";
export const RUN_DATA_SEEDS_REL    = "lib/cruscotto-db/script_seed/run-data-seeds.mjs";

/** Nome file SQLite dev — re-export da config_project (consumer esterni). */
export { PRJ_DB_FILENAME };

/** Allinea schema Prisma al product repo senza toccare i dati esistenti. */
export function syncDatabase() {
  run(["run", "db:push"], "Database sync (db:push)");
}

/**
 * Verifica se il file SQLite principale esiste già sul disco.
 *
 * @returns {boolean}
 */
export function productDatabaseFileExists() {
  const files = resolveSqliteDbFiles();

  return Boolean(files[0] && existsSync(files[0]));
}

/**
 * Garantisce che il file SQLite dev (PRJ_DB_FILENAME) esista prima di un seed senza reset completo.
 * Esegue db:push solo se il file manca (evita push ridondante ad ogni --seed).
 */
export function ensureProductDatabaseFile() {
  if (productDatabaseFileExists()) {
    return;
  }

  console.log(`\n=== ${PRJ_DB_FILENAME} assente — creazione schema (db:push) ===\n`);
  syncDatabase();
}

/** Esegue npm run db:seed nel product repo (PRJ_SEED / PRJ_DB_NPM_WORKSPACE). */
export function seedDatabase() {
  const seedAbs = resolveProductSeedPath(root);

  if (!existsSync(seedAbs)) {
    throw new Error(`Script seed non trovato: ${PRJ_SEED} (atteso in product repo)`);
  }

  run(["run", "db:seed", "-w", PRJ_DB_NPM_WORKSPACE], `Database seed (${PRJ_SEED})`);
}

/**
 * Catalogo seed da config_project — invocabile con --seed db | func | …
 *
 * @returns {Record<string, { id: string, label: string, needsStack: boolean, run?: () => void, script?: string }>}
 */
export function buildDataSeedScripts() {
  return {
    db: {
      id         : "db"
    , label      : `Prisma seed (${PRJ_SEED})`
    , needsStack : false
    , run        : () => seedDatabase()
    }
  , func: {
      id         : "func"
    , label      : `Seed funzionali (${PRJ_SEED_FUNC})`
    , needsStack : true
    , script     : PRJ_SEED_FUNC
    }
  };
}

/** Catalogo seed attivo (config progetto corrente). */
export const DATA_SEED_SCRIPTS = buildDataSeedScripts();

/**
 * @returns {string[]}
 */
export function getAvailableSeedIds() {
  return Object.keys(DATA_SEED_SCRIPTS);
}

/**
 * @param {string[]} seedIds
 * @returns {boolean}
 */
export function seedIdsNeedStack(seedIds) {
  return seedIds.some((id) => DATA_SEED_SCRIPTS[id]?.needsStack);
}

const { auth: DEFAULT_AUTH_HEALTH, api: DEFAULT_API_HEALTH } = getProjectHealthUrls();

/**
 * Poll HTTP su endpoint health fino a risposta ok o timeout.
 *
 * @param {string} url
 * @param {number} timeoutMs
 */
async function probeHealth(url, timeoutMs) {
  const started = Date.now();

  // Step 1 — retry con intervallo fisso fino a ok o scadenza timeout
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });

      if (res.ok) {
        return true;
      }
    } catch {
      // servizio non ancora in ascolto — riprova
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return false;
}

/**
 * Attende che auth e api (PRJ_AUTH_HEALTH_URL / PRJ_API_HEALTH_URL) rispondano prima dei seed func.
 *
 * @param {{ timeoutMs?: number }} [options]
 */
export async function waitForDevStack(options = {}) {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const authUrl   = process.env.AUTH_HEALTH_URL ?? DEFAULT_AUTH_HEALTH;
  const apiUrl    = process.env.API_HEALTH_URL ?? DEFAULT_API_HEALTH;

  console.log(`\n=== Attesa stack dev (auth + api) — max ${Math.round(timeoutMs / 1000)}s ===\n`);

  // Step 1 — auth deve essere su per registrazione utenti funzionali
  const authOk = await probeHealth(authUrl, timeoutMs);

  if (!authOk) {
    throw new Error(`Auth non raggiungibile: ${authUrl}`);
  }

  console.log(`  ok  auth`);

  // Step 2 — api per flussi che dipendono dal dominio applicativo
  const apiOk = await probeHealth(apiUrl, Math.max(5000, timeoutMs - 5000));

  if (!apiOk) {
    throw new Error(`API non raggiungibile: ${apiUrl}`);
  }

  console.log(`  ok  api`);
}

/**
 * Esegue uno script Node nel product repo (path relativo a root).
 *
 * @param {string} relScript
 */
function runNodeSeedScript(relScript) {
  const abs = relScript === PRJ_SEED_FUNC
    ? resolveProductFuncSeedPath(root)
    : join(root, relScript);

  if (!existsSync(abs)) {
    throw new Error(`Script non trovato: ${relScript} (product ${PRJ_NAME})`);
  }

  console.log(`\n=== ${relScript} ===\n`);

  const result = spawnSync(process.execPath, [abs], {
    cwd   : root
  , stdio : "inherit"
  , env   : process.env
  });

  // exit immediato — errore seed non recuperabile in batch
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/**
 * Esegue in sequenza i seed richiesti (id da DATA_SEED_SCRIPTS).
 *
 * @param {string[]} seedIds
 */
export async function runDataSeeds(seedIds) {
  // Step 1 — deduplica id mantenendo ordine di richiesta CLI
  const unique = [...new Set(seedIds.filter(Boolean))];

  for (const id of unique) {
    const entry = DATA_SEED_SCRIPTS[id];

    // id sconosciuto: avviso e passa al successivo (non blocca gli altri seed)
    if (!entry) {
      console.warn(`  warn  seed sconosciuto: ${id} — disponibili: ${Object.keys(DATA_SEED_SCRIPTS).join(", ")}`);
      continue;
    }

    console.log(`\n=== Data seed: ${entry.label} ===`);

    // Step 2a — callback npm (es. db:seed)
    if (entry.run) {
      entry.run();
      continue;
    }

    // Step 2b — script Node nel product repo (es. test-seed-utenti.mjs)
    if (entry.script) {
      runNodeSeedScript(entry.script);
    }
  }
}

/**
 * Risolve path assoluti del file SQLite e sidecar (-journal, -wal, -shm)
 * da DATABASE_URL in packages/database/.env.
 */
export function resolveSqliteDbFiles() {
  const envPath     = join(root, PRJ_DB_PACKAGE, ".env");
  let databaseUrl   = DEFAULT_DATABASE_URL;

  // Step 1 — legge DATABASE_URL dal .env del product repo se presente
  if (existsSync(envPath)) {
    const text = readFileSync(envPath, "utf8");
    const match = text.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);

    if (match?.[1]) {
      databaseUrl = match[1].trim();
    }
  }

  // Step 2 — normalizza path relativo rispetto a packages/database/prisma
  let rel = databaseUrl.replace(/^file:/, "").replace(/^\.\//, "");

  if (!rel.endsWith(".db")) {
    rel = PRJ_DB_FILENAME;
  }

  const prismaDir = join(root, PRJ_DB_PRISMA_DIR);
  const dbFile    = join(prismaDir, rel);
  const suffixes  = ["", "-journal", "-wal", "-shm"];

  return suffixes.map((suffix) => `${dbFile}${suffix}`);
}

/**
 * Delete & create: rimuove SQLite + sidecar, rigenera client Prisma, db:push.
 * Usato da Utility «Delete & create» e da init_Database_DEV --reset.
 */
export function resetDatabase() {
  console.log("\n=== Database reset (drop SQLite + generate + push) ===\n");

  // Step 1 — elimina file db e journal/wal/shm (skip se assenti)
  for (const abs of resolveSqliteDbFiles()) {
    if (!existsSync(abs)) {
      console.log(`  skip  ${abs.replace(root + "\\", "").replace(root + "/", "")} (assente)`);
      continue;
    }

    try {
      rmSync(abs, { force: true });
      console.log(`  rimosso  ${abs.replace(root + "\\", "").replace(root + "/", "")}`);
    } catch (err) {
      console.warn(`  warn  ${abs}: ${err.message}`);
    }
  }

  // Step 2 — client Prisma aggiornato + schema ricreato su file vuoto
  runDbGenerateWithRetry("Prisma generate dopo reset");
  run(["run", "db:push", "-w", PRJ_DB_NPM_WORKSPACE], "Database create (db:push)");
}

/**
 * Orchestrazione reset e/o seed per init_Database_DEV.mjs.
 *
 * @param {{ dbReset?: boolean, dbSeed?: boolean }} options
 */
export function runDatabasePhase(options = {}) {
  const { dbReset = false, dbSeed = false } = options;

  // Step 1 — reset completo oppure solo ensure file prima del seed
  if (dbReset) {
    resetDatabase();
  } else if (dbSeed) {
    ensureProductDatabaseFile();
  }

  // Step 2 — seed Prisma (host/player) se richiesto
  if (dbSeed) {
    seedDatabase();
  }
}

/** Testo help per init_Database_DEV.mjs (--help). */
export function printDbDevHelp() {
  console.log(`Uso: node ${INIT_DATABASE_DEV_REL} [opzioni]

Operazioni sul database SQLite del product repo (${PRJ_DB_PRISMA_DIR}):

  (default)              nessuna operazione — usa un flag esplicito sotto
  --push, --db-push      db:push — allinea schema (crea ${PRJ_DB_FILENAME} se assente)
  --reset, --db-reset    elimina ${PRJ_DB_FILENAME} (+ journal/wal/shm) e ricrea schema
  --seed, --db-seed      npm run db:seed (host@ / player@); push solo se ${PRJ_DB_FILENAME} manca
  --reset --seed         delete & create + seed

Esempi:
  node ${INIT_DATABASE_DEV_REL} --push
  node ${INIT_DATABASE_DEV_REL} --reset
  node ${INIT_DATABASE_DEV_REL} --seed
  node ${INIT_DATABASE_DEV_REL} --reset --seed
`);
}

/** Testo help per run-data-seeds.mjs (--help). */
export function printDataSeedsHelp() {
  const { auth, api } = getProjectHealthUrls();
  const ids           = getAvailableSeedIds().join(" | ");

  console.log(`Uso: node ${RUN_DATA_SEEDS_REL} --seed <id>[,<id>...]

Progetto: ${PRJ_NAME} (repo ${PRJ_REPO})

Script disponibili:
  db    Prisma seed — ${PRJ_SEED}
        npm run db:seed -w ${PRJ_DB_NPM_WORKSPACE}
  func  ${PRJ_SEED_FUNC}
        richiede stack dev (auth + api)

Opzioni:
  --seed <id>        id ammessi: ${ids}
  --wait-auth [ms]   attende health auth (${auth}) e api (${api}); default 120000 ms se flag senza valore
  --help             questo messaggio

Esempi:
  node ${RUN_DATA_SEEDS_REL} --seed db
  node ${RUN_DATA_SEEDS_REL} --seed func --wait-auth
  node ${RUN_DATA_SEEDS_REL} --seed db,func --wait-auth 180
`);
}
