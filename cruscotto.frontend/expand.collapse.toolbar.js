/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** PAGE SCRIPT ** -- commentato il: 2026-06-18 05:45
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 05:45   by: IbyEll
 * modificato il: 2026-06-18 05:45   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *           Toolbar espandi/collassa — factory bottoni icona SVG per alberi cruscotto e pillar matrix.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Più pagine HTML (home, pillar matrix) condividono lo stesso markup toolbar espandi/collassa.
 *   - Evita duplicare SVG e attributi accessibilità in ogni HTML o script inline.
 *
 *   A cosa serve:
 *   - Espone window.JloExpandCollapseUi (pair, iconButton, costanti SVG).
 *   - Genera HTML bottoni con classi tree-bulk-toggle e btn-tree-icon.
 *
 * Generalizzazione:
 *   Si — riusato su cruscotto.home e tutte le pagine pillar-matrix; label opzionali via parametri.
 *
 * Input:
 *   - expandId, collapseId — id DOM dei bottoni (obbligatori per pair)
 *   - labels.expandLabel, labels.collapseLabel, labels.groupLabel — testi aria (opzionali)
 *
 * Pagina HTML:
 *   - cruscotto.home.html — toolbar alberi dashboard
 *   - pillar-matrix/cruscotto.pillar.*.html — toggle sezioni e nodi albero
 *
 * Servito da:
 *   - cruscotto.frontend/cruscotto.server.mjs — static root cruscotto.frontend/
 *   - URL legacy nelle HTML: /expand-collapse-ui.js (nome file storico)
 *
 * Asset correlati:
 *   - expand.collapse.toolbar.css — stili tree-bulk-toggle e btn-tree-icon
 *
 * Consumatori runtime:
 *   - cruscotto.home.js, pillar-matrix/pillar-matrix.js — window.JloExpandCollapseUi.pair()
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */
(function expandCollapseUiModule(global) {
  const EXPAND_ICON_SVG = `<svg class="tree-toolbar-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 5.83 15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/></svg>`;

  const COLLAPSE_ICON_SVG = `<svg class="tree-toolbar-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M7.41 18.59 8.83 20 12 16.83 15.17 20l1.41-1.41L12 14l-4.59 4.59zM7.41 5.41 8.83 4 12 7.17 15.17 4l1.41 1.41L12 10 7.41 5.41z"/></svg>`;

  /**
   * Bottone icona singolo con title e aria-label.
   *
   * @param {string} id
   * @param {string} label
   * @param {string} svg
   */
  function iconButton(id, label, svg) {
    // 1. Markup bottone — classi condivise con expand.collapse.toolbar.css
    return `<button type="button" class="action btn-tree-icon" id="${id}" title="${label}" aria-label="${label}">${svg}</button>`;
  }

  /**
   * Coppia espandi/collassa con role=group per accessibilità.
   *
   * @param {string} expandId
   * @param {string} collapseId
   * @param {{ expandLabel?: string, collapseLabel?: string, groupLabel?: string }} [labels]
   */
  function pair(expandId, collapseId, labels = {}) {
    // 1. Label default italiane — override opzionale da consumer (home, pillar matrix)
    const expandLabel   = labels.expandLabel ?? "Espandi tutto";
    const collapseLabel = labels.collapseLabel ?? "Collassa tutto";
    const groupLabel    = labels.groupLabel ?? "Espandi o collassa tutto";

    // 2. Span group + due bottoni icona SVG
    return `<span class="tree-bulk-toggle" role="group" aria-label="${groupLabel}">${iconButton(expandId, expandLabel, EXPAND_ICON_SVG)}${iconButton(collapseId, collapseLabel, COLLAPSE_ICON_SVG)}</span>`;
  }

  // 1. Export globale — IIFE compatibile browser e Node test
  global.JloExpandCollapseUi = {
    EXPAND_ICON_SVG,
    COLLAPSE_ICON_SVG,
    iconButton,
    pair,
  };
})(typeof window !== "undefined" ? window : globalThis);
