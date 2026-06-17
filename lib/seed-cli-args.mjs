/**
 * Parse argv CLI condiviso — seed e database dev (senza dipendenze runner/script_seed).
 *
 * Descrizione funzionale:
 *   Perché esiste: runner-product-lib e script_seed-lib usavano parseSeedIds in ciclo
 *     circolare — la logica flag CLI va in un modulo neutro.
 *   A cosa serve: estrae --seed / --push / --reset da argv per entrypoint dev.
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
 */
export function parseDbDevArgs(argv) {
  const reset = argv.includes("--reset")
    || argv.includes("--db-reset")
    || argv.includes("--db-force");
  const seed  = argv.includes("--seed") || argv.includes("--db-seed");
  const push  = argv.includes("--push") || argv.includes("--db-push");

  return {
    help     : argv.includes("--help") || argv.includes("-h")
  , reset
  , seed
  , pushOnly : push && !reset && !seed
  };
}