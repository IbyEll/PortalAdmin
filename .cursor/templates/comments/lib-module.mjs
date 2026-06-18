// ═══ SCHEMA comcom — lib-module ═══
// Non copiare queste righe // nel file target. Compilare testata con testo reale; zero {…} nel target.
// Re-comcom: preservare creato il / by (riga creato); aggiornare solo commentato il e modificato il (+ by modificato).
// Titolo: max 120 caratteri/riga; a capo su spazio; centrato nella banda 120 — mai spezzare parole.
// Testo: max 120 caratteri/riga; a capo su spazio — mai spezzare parole (escluso titolo stellato).

/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: yyyy-mm-dd HH:mm
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: yyyy-mm-dd HH:mm   by: 
 * modificato il: yyyy-mm-dd HH:mm   by:  
 * ticket refirement: issueKey + issueTitle
 * ------------------------------------------------------------------------------------------------------------------------
 * 
 * ************************************************************************************************************************
 *     Titolo modulo — responsabilità (esempio centrato in banda 120).
 * ************************************************************************************************************************
 * 
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - duplicazione evitata, policy centralizzata, …
 *
 *   A cosa serve:
 *   - cosa ottengono i consumer (path product repo, meta Jira, …)
 *
 * Generalizzazione:
 *   Si | No — il modulo è riusabile su più overlay/progetti o è monolite dedicato?
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - PRJ_NAME / productOverlay — overlay attivo (env o argomento loadConfig)
 *   - PRODUCT_REPO_PATH       — root repo product
 *   - JIRA_PROJECT_KEYS       — prefissi IssueKEY ammessi
 *   - parametri funzione opts — es. key, branch, repoRefs passati dal consumer
 *
 * Consumatori:
 *   - runner/…, server/…, scripts/…
 *
 * Export principali:
 *   - nomeExport — scopo breve
 * 
 * ------------------------------------------------------------------------------------------------------------------------
 */

// import solo ciò che serve al modulo
// import { helper } from "./altro-modulo.mjs";


// --- costanti di modulo (policy, set, path fissi) ---
/**
 * Perché esiste questa costante — es. script blocked ma visibili in --list.
 *
 * @type {ReadonlySet<string>}
 */
export const ESEMPIO_POLICY = new Set([
  "suite/esempio.mjs"
  // aggiungere path relativi reali
]);

/**
 * Cosa fa — una frase.
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
