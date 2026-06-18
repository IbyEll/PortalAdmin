/**
 * Parse argv CLI condiviso — seed e database dev (modulo neutro, senza runner).
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - flag --seed / --push / --reset condivisi senza import circolari verso runner stack
 *
 *   A cosa serve:
 *   - estrae id seed e booleani dev DB da argv per entrypoint prepare/seed
 *
 * Consumatori:
 *   - runner/cruscotto.runner.stack.mjs — parseSeedIds in prepare stack
 *   - cruscotto.database/script_seed/script_seed-lib.mjs — re-export verso init_Database_DEV e run-data-seeds
 *
 * Export principali:
 *   - parseSeedIds — id seed da --seed, --seed-db, --seed-func, …
 *   - parseDbDevArgs — help / reset / seed / pushOnly per init_Database_DEV.mjs
 */

/**
 * Estrae gli id seed da argv CLI (--seed db,func, alias --seed-func, …).
 *
 * @param {string[]} argv
 * @returns {string[]}
 */
export function parseSeedIds(argv) {
  /** @type {string[]} */
  const ids = [];

  // 1. Scan argv — alias espliciti e forma --seed[=lista]
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--db-seed" || arg === "--seed-db") {
      ids.push("db");
      continue;
    }

    if (arg === "--seed-func" || arg === "--seed-funcionali") {
      ids.push("func");
      continue;
    }

    if (arg === "--seed" || arg.startsWith("--seed=")) {
      const inline = arg.startsWith("--seed=") ? arg.slice("--seed=".length) : argv[i + 1];

      if (!arg.startsWith("--seed=")) {
        i++;
      }

      // 2. Lista comma-separated — trim e skip vuoti
      if (inline) {
        ids.push(
          ...inline
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
        );
      }
    }
  }

  return ids;
}

/**
 * Parse flag CLI per init_Database_DEV.mjs (--push / --reset / --seed).
 *
 * @param {string[]} argv
 * @returns {{ help: boolean, reset: boolean, seed: boolean, pushOnly: boolean }}
 */
export function parseDbDevArgs(argv) {
  // 1. Reset distruttivo — alias storici CLI
  const reset = argv.includes("--reset")
    || argv.includes("--db-reset")
    || argv.includes("--db-force");
  const seed  = argv.includes("--seed") || argv.includes("--db-seed");
  const push  = argv.includes("--push") || argv.includes("--db-push");

  // 2. pushOnly — migrate senza seed né reset (default dev veloce)
  return {
    help     : argv.includes("--help") || argv.includes("-h")
  , reset
  , seed
  , pushOnly : push && !reset && !seed
  };
}
