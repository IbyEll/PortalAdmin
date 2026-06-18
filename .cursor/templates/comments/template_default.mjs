// ═══ SCHEMA comcom — template_default (fallback) ═══
// Non copiare queste righe // nel file target.
// Re-comcom: preservare creato il / by (riga creato); aggiornare solo commentato il e modificato il (+ by modificato).
// Titolo: max 120 caratteri/riga; a capo su spazio; centrato nella banda 120 — mai spezzare parole.
// Testo: max 120 caratteri/riga; a capo su spazio — mai spezzare parole (escluso titolo stellato).
// Usare la testata /** */ come schema: sezioni pertinenti, bullet con "-", testo reale da codice + consumer.
// Vietato nel target: placeholder {…}, testo guida tipo "sostituire", righe vuote di esempio.

/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** DEFAULT TEMPLATE ** -- commentato il: yyyy-mm-dd HH:mm
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: yyyy-mm-dd HH:mm   by: 
 * modificato il: yyyy-mm-dd HH:mm   by:  
 * ticket refirement: issueKey + issueTitle
 * ------------------------------------------------------------------------------------------------------------------------
 * 
 * ************************************************************************************************************************
 *      Titolo — responsabilità del file (esempio centrato in banda).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - motivo concreto (duplicazione evitata, policy centralizzata, entrypoint unico, …)
 *
 *   A cosa serve:
 *   - risultato concreto per chi importa o esegue il file
 *
 * Generalizzazione:
 *   Si | No — parametrizzato (overlay, env, argv) o comportamento fisso?
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - elencare ogni ingresso esterno: env, argv, config, req, path overlay, …
 *
 * Consumatori:
 *   - path/relativo/repo — ruolo breve
 *
 * Export principali:
 *   - nomeSimbolo — scopo (omettere intera sezione se il file non esporta)
 *
 * Uso:
 *   - comando o invocazione reale (solo script, CLI, wrapper)
 *
 * Flag CLI:
 *   --help, -h     riepilogo ed exit 0
 *   --flag         descrizione flag reale
 *
 * Route o endpoint:
 *   - GET  /percorso — scopo (solo server/handler)
 *
 * Variabili d'ambiente:
 *   NOME_VAR       scopo e default se noto
 *
 * npm:
 *   npm run script -- argomenti
 *
 * Prerequisiti:
 *   - dipendenze runtime (stack, DB, product repo, …)
 * 
 * ------------------------------------------------------------------------------------------------------------------------
 */

// --- costanti di modulo (solo se il file dichiara policy, set, path fissi) ---
/**
 * Perché esiste questa costante — una frase.
 */
// export const NOME = …;

// 1. Primo step logico nel flusso — perché in questa fase
// 2. Step successivo — perché
// N. Cleanup / risposta / exit — perché
