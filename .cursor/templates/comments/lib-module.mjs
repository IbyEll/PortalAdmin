/**
 * {Titolo modulo — responsabilità in una riga.}
 *
 * Descrizione funzionale:
 *   Perché esiste: {duplicazione evitata, policy centralizzata, …}
 *   A cosa serve: {cosa ottengono i consumer — path product repo, meta Jira, …}
 *
 * Consumatori: {runner/…, server/…}
 *
 * Export principali:
 *   {nomeExport} — {scopo breve}
 */
// import solo ciò che serve al modulo
// import { helper } from "./altro-modulo.mjs";

// --- costanti di modulo (policy, set, path fissi) ---
/**
 * {Perché esiste questa costante — es. script blocked ma visibili in --list.}
 *
 * @type {ReadonlySet<string>}
 */
export const ESEMPIO_POLICY = new Set([
  "suite/esempio.mjs"
  // aggiungere path relativi reali
]);

/**
 * {Cosa fa — una frase.}
 *
 * @param {{ id?: string }} [opts]
 * @returns {Promise<object[]>}
 */
export async function funzionePubblica(opts = {}) {
  // 1. Validazione input / guard clause — fail-fast prima di I/O
  // 2. Preparazione stato locale
  const risultato = [];
  // 3. Loop / delega — core del modulo
  // 4. Normalizzazione output (sort, map, filter finale)
  return risultato;
}

/**
 * Helper interno — JSDoc solo se logica non ovvia.
 *
 * @param {string} input
 * @returns {string}
 */
function helperInterno(input) {
  // step unico o sotto-step se ramo complesso
  return input;
}
