// ═══ SCHEMA comcom — app-module ═══
// Non copiare queste righe // nel file target. Compilare testata con testo reale; zero {…} nel target.
// Re-comcom: preservare creato il / by (riga creato); aggiornare solo commentato il e modificato il (+ by modificato).
// Titolo: max 120 caratteri/riga; a capo su spazio; centrato nella banda 120 — mai spezzare parole.
// Testo: max 120 caratteri/riga; a capo su spazio — mai spezzare parole (escluso titolo stellato).

/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** APPLICATION MODULE ** -- commentato il: yyyy-mm-dd HH:mm
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: yyyy-mm-dd HH:mm   by: 
 * modificato il: yyyy-mm-dd HH:mm   by:  
 * ticket refirement: issueKey + issueTitle
 * ------------------------------------------------------------------------------------------------------------------------
 * 
 * ************************************************************************************************************************
 *   Titolo — ruolo nel portale, cruscotto o server (es. centrato).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - UI dev, API cruscotto, orchestrazione run test, …
 *
 *   A cosa serve:
 *   - avvio servizi da browser, stato backlog, proxy product, …
 *
 * Generalizzazione:
 *   Si | No — handler/parametri per overlay o route fissa?
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - req.params / query / body — parametri HTTP per richiesta
 *   - PRJ_NAME, PRODUCT_REPO_PATH — contesto product da env o middleware
 *   - env PORT, CRUSCOTTO_DB_PATH — configurazione runtime server
 *
 * Route o endpoint (se server):
 *   - GET  /api/esempio — scopo
 *   - POST /api/esempio — scopo
 *
 * Consumatori:
 *   - pagina HTML, bundle JS, altro handler
 *
 * Dipendenze:
 *   - lib/, env, PRODUCT_REPO_PATH
 * 
 * ------------------------------------------------------------------------------------------------------------------------
 */


// import express/handler o moduli UI
// import express from "express";



/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export async function handlerEsempio(req, res) {
  // 1. Parse query/body e validazione
  const id = req.params.id?.trim();

  if (!id) {
    // 400 — input mancante
    res.status(400).json({ error: "id mancante" });
    return;
  }

  // 2. Caricamento dati (DB, filesystem, spawn)
  // 3. Trasformazione / business rule
  // 4. Risposta JSON o stream
  res.json({ ok: true, id });
}

// --- init modulo (IIFE o registerRoutes) ---
// 1. Montaggio router / listener
// 2. Middleware condiviso
// 3. Avvio server (solo entrypoint)
