// ═══ SCHEMA comcom — script-entrypoint ═══
// Non copiare queste righe // nel file target. Compilare testata con testo reale; zero {…} nel target.
// Re-comcom: preservare creato il / by (riga creato); aggiornare solo commentato il e modificato il (+ by modificato).
// Titolo: max 120 caratteri/riga; a capo su spazio; centrato nella banda 120 — mai spezzare parole.
// Testo: max 120 caratteri/riga; a capo su spazio — mai spezzare parole (escluso titolo stellato).

 
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: yyyy-mm-dd HH:mm
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: yyyy-mm-dd HH:mm   by: 
 * modificato il: yyyy-mm-dd HH:mm   by:  
 * ticket refirement: issueKey + issueTitle
 * ------------------------------------------------------------------------------------------------------------------------
 *  
 * ************************************************************************************************************************
 *      Titolo breve — cosa fa lo script (esempio centrato in banda).
 * ************************************************************************************************************************
 * 
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - gap di processo che questo script colma
 *
 *   A cosa serve:
 *   - risultato per chi lo esegue (avvio stack, seed DB, migrate, …)
 *
 * Generalizzazione:
 *   Si | No — il comportamento dipende da overlay/env/argv o è fisso per questo script?
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - argv / flag CLI   — es. --key JLO-xxx, --dry-run
 *   - PRJ_NAME          — overlay product (PROJECT_*)
 *   - PRODUCT_REPO_PATH — root repo product
 *   - JIRA_EMAIL, …     — env per fetch Jira
 *
 * Uso:
 *   - node path/script.mjs
 *   - node path/script.mjs --help
 *   - node path/script.mjs altri-esempi-reali
 *
 * Flag CLI:
 *   --help, -h     riepilogo ed exit 0
 *   --flag         descrizione flag reale
 *
 * Variabili d'ambiente:
 *   NOME_VAR       scopo — default se noto
 *
 * npm (se applicabile):
 *   npm run script -- argomenti
 *
 * Prerequisiti (se applicabile):
 *   - API :4000, product repo, DB seed, …
 * 
 * ------------------------------------------------------------------------------------------------------------------------
 */

// import dipendenze Node e moduli locali
// import { fn } from "../lib/modulo.mjs";

const HELP    = process.argv.includes("--help");
const DRY_RUN = process.argv.includes("--dry-run");

// 1. Help — esci subito senza side effect
if (HELP) {
  process.exit(0);
}

// 2. Validazione input / path obbligatori — exit 1 se mancanti
// 3. Setup contesto (env, product repo, connessioni)
// 4. Fase principale A — es. attesa stack, fetch, lettura file
// 5. Fase principale B — es. esecuzione, trasformazione, write
// 6. Report esito / cleanup — exit 0 o 1
