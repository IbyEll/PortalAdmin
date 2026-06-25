// ═══ SCHEMA comcom — page-html.mjs ═══
// Script client servito come static asset insieme a una pagina HTML (browser, non Node).
// Non copiare queste righe // nel file target. Compilare testata con testo reale; zero {…} nel target.
// Re-comcom: preservare creato il / by (riga creato); aggiornare solo commentato il e modificato il (+ by modificato).
// Titolo: max 120 caratteri/riga; a capo su spazio; centrato nella banda 120 — mai spezzare parole.
// Testo: max 120 caratteri/riga; a capo su spazio — mai spezzare parole (escluso titolo stellato).

/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** PAGE SCRIPT ** -- commentato il: yyyy-mm-dd HH:mm
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: yyyy-mm-dd HH:mm   by: 
 * modificato il: yyyy-mm-dd HH:mm   by:  
 * ticket refirement: issueKey + issueTitle
 * ------------------------------------------------------------------------------------------------------------------------
 * 
 * ************************************************************************************************************************
 *  Titolo — companion di nome-pagina.html (esempio centrato in banda).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - la pagina HTML è shell statica; fetch, stato e interazioni vivono in questo script
 *   - evita framework build per tooling dev locale
 *
 *   A cosa serve:
 *   - bind DOM, chiamate API same-origin, aggiornamento sezioni/tab
 *   - eventuale hash routing o iframe verso altre pagine cruscotto
 *
 * Generalizzazione:
 *   Si | No — la pagina companion si adatta all'overlay o è hardcoded su un solo progetto?
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - window.CRUSCOTTO_PROJECT — config iniettata da bootstrap/server
 *   - hash / query URL           — tab o filtro da location
 *   - risposte API same-origin   — payload /api/… usati dal render
 *
 * Pagina HTML:
 *   - cruscotto.frontend/nome-pagina.html — route /app.html
 *
 * Servito da:
 *   - cruscotto.frontend/cruscotto.server.mjs — static root cruscotto.frontend/
 *   - admin.portal/portal.home.server.mjs — static root admin.portal/ (se home)
 *
 * Asset correlati:
 *   - nome-pagina.css — stili (link in HTML)
 *   - cruscotto.project.bootstrap.js — window.CRUSCOTTO_PROJECT (se presente)
 *
 * API (fetch same-origin):
 *   - GET  /api/status — stato iniziale
 *   - POST /api/run — azione utente
 *
 * Dipendenze runtime:
 *   - window.CRUSCOTTO_PROJECT o __CRUSCOTTO_PROJECT__ — label progetto (opzionale)
 *   - elementi DOM con id noti dalla HTML companion
 * ------------------------------------------------------------------------------------------------------------------------
 */

// --- refs DOM — elementi usati in più funzioni ---
const rootEl     = document.getElementById("main");
const statusEl   = document.getElementById("status-line");
const actionBtn  = document.getElementById("btn-action");

/** @type {Record<string, unknown> | null} */
let pageConfig = null;

/**
 * Legge config progetto iniettata dal server o da bootstrap.js.
 *
 * @returns {Record<string, unknown>}
 */
function getPageConfig() {
  const w = /** @type {Window & { CRUSCOTTO_PROJECT?: Record<string, unknown> }} */ (window);

  return w.CRUSCOTTO_PROJECT ?? pageConfig ?? {};
}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function api(path, init) {
  // 1. Fetch same-origin — errori HTTP → throw con messaggio API
  const res = await fetch(path, init);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(String(body.error ?? `HTTP ${res.status}`));
  }

  return res.json();
}

/**
 * Primo render / refresh dati da API.
 */
async function loadPageData() {
  // 1. Guard — DOM minimo presente
  if (!rootEl) {
    return;
  }

  // 2. Fetch stato iniziale
  // 3. Aggiorna DOM (innerHTML, textContent, disabled su bottoni)
}

/**
 * Registra listener click, hashchange, submit form.
 */
function bindPageEvents() {
  actionBtn?.addEventListener("click", () => {
    // delega azione — conferma utente se distruttiva
  });
}

// --- init pagina ---
// 1. Ascolta cruscotto:project-ready se bootstrap async
document.addEventListener("cruscotto:project-ready", () => {
  pageConfig = getPageConfig();
});

// 2. Bind eventi e primo caricamento
bindPageEvents();
loadPageData().catch((err) => {
  console.error(err);
  if (statusEl) {
    statusEl.textContent = err instanceof Error ? err.message : String(err);
  }
});
