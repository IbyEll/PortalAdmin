// ═══ SCHEMA comcom — testscript ═══
// Non copiare queste righe // nel file target. Compilare testata con testo reale; zero {…} nel target.
// Re-comcom: preservare creato il / by (riga creato); aggiornare solo commentato il e modificato il (+ by modificato).
// Titolo: max 120 caratteri/riga; a capo su spazio; centrato nella banda 120 — mai spezzare parole.
// Testo: max 120 caratteri/riga; a capo su spazio — mai spezzare parole (escluso titolo stellato).

/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** TESTSCRIPT ** -- commentato il: yyyy-mm-dd HH:mm
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: yyyy-mm-dd HH:mm   by:
 * modificato il: yyyy-mm-dd HH:mm   by:
 * ticket refirement: issueKey + issueTitle
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *      Titolo breve — area e comportamento verificato (es. API auth, cruscotto startup, UI web).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - regressione automatica su comportamento prodotto o cruscotto (ticket, AC, DoD)
 *
 *   A cosa serve:
 *   - esito pass/fail eseguibile da CLI, cruscotto TestTecnici o CI (exit 0 / 1)
 *
 * Generalizzazione:
 *   Si | No — dipende da overlay, env base URL o argv, oppure scenario fisso su un solo stack?
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - API_URL / AUTH_URL / DASHBOARD_URL — base HTTP servizi sotto test
 *   - PRJ_NAME / PRODUCT_REPO_PATH       — overlay e product repo (smoke PortalAdmin)
 *   - argv / flag CLI                    — es. --overlay, --no-spawn, --json
 *
 * Scenari verificati:
 *   - nome runTest — cosa asserta (status HTTP, campo JSON, testo HTML, …)
 *   - altro scenario — prerequisito o edge case coperto
 *
 * Uso:
 *   - node testScript/area/test-nome.mjs
 *   - node admin.portal.testscript/test-nome.mjs --flag valore
 *   - npm run test:nome -- --flag
 *
 * Flag CLI:
 *   --help, -h     riepilogo ed exit 0
 *   --json         report JSON (se supportato da testScript/lib/http.mjs)
 *   --flag         descrizione flag reale
 *
 * Variabili d'ambiente:
 *   API_URL        base API product (default http://localhost:4000/api/v1)
 *   AUTH_URL       base auth (default http://localhost:4001/api/v1)
 *   DASHBOARD_URL  base cruscotto (default http://127.0.0.1:3999)
 *
 * Integrazione cruscotto:
 *   - path catalogo testScript (es. auth/test-api-health.mjs) o admin.portal.testscript/
 *   - area TestTecnici / TestFunzionali / smoke npm se registrato
 *
 * Prerequisiti:
 *   - stack dev avviato (API :4000, auth :4001, web :5173) o spawn gestito dallo script
 *   - seed DB / utenti fixture se il caso lo richiede
 *
 * Exit code:
 *   0 — tutti gli scenari runTest passati
 *   1 — almeno un fallimento, prerequisito mancante o errore non gestito
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

// import dipendenze Node, lib http.mjs (product) o moduli PortalAdmin per smoke
// import { assert, logSection, printSummary, resolveScriptMeta, runTest } from "../lib/http.mjs";

/** Accumulatore esiti runTest per riepilogo finale. */
/** @type {{ name: string, ok: boolean, detail?: string }[]} */
// const results = [];

// 1. Help / parse argv — esci 0 senza side effect né spawn
// 2. Meta script (resolveScriptMeta) e logSection precondizioni
// 3. Verifica prerequisiti — servizi raggiungibili, path overlay/product repo
// 4. Setup opzionale — fixture, token, spawn child con env PRJ_NAME e DASHBOARD_PORT
// 5. Scenari — await runTest("nome caso", async () => { assert(...); }, results)
// 6. Riepilogo — printSummary(results, { meta }) o emitJsonReport; exit 1 se fail
// 7. Cleanup — termina processo spawnato (salvo flag --keep)

/**
 * Helper locale — una frase su cosa verifica (es. polling health, parse payload JSON).
 */
// async function assertScenario(base) { … }

// async function main() { … }

// main().catch((err) => { … process.exitCode = 1; }).finally(() => { … cleanup … });
