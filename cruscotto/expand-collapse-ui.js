/**
 * Bottoni icona Espandi/Collassa tutto (SVG) — uso condiviso in cruscotto e pagine Admin.
 */
(function expandCollapseUiModule(global) {
  const EXPAND_ICON_SVG = `<svg class="tree-toolbar-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 5.83 15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/></svg>`;

  const COLLAPSE_ICON_SVG = `<svg class="tree-toolbar-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M7.41 18.59 8.83 20 12 16.83 15.17 20l1.41-1.41L12 14l-4.59 4.59zM7.41 5.41 8.83 4 12 7.17 15.17 4l1.41 1.41L12 10 7.41 5.41z"/></svg>`;

  /**
   * @param {string} id
   * @param {string} label
   * @param {string} svg
   */
  function iconButton(id, label, svg) {
    return `<button type="button" class="action btn-tree-icon" id="${id}" title="${label}" aria-label="${label}">${svg}</button>`;
  }

  /**
   * @param {string} expandId
   * @param {string} collapseId
   * @param {{ expandLabel?: string, collapseLabel?: string, groupLabel?: string }} [labels]
   */
  function pair(expandId, collapseId, labels = {}) {
    const expandLabel   = labels.expandLabel ?? "Espandi tutto";
    const collapseLabel = labels.collapseLabel ?? "Collassa tutto";
    const groupLabel    = labels.groupLabel ?? "Espandi o collassa tutto";

    return `<span class="tree-bulk-toggle" role="group" aria-label="${groupLabel}">${iconButton(expandId, expandLabel, EXPAND_ICON_SVG)}${iconButton(collapseId, collapseLabel, COLLAPSE_ICON_SVG)}</span>`;
  }

  global.JloExpandCollapseUi = {
    EXPAND_ICON_SVG,
    COLLAPSE_ICON_SVG,
    iconButton,
    pair,
  };
})(typeof window !== "undefined" ? window : globalThis);
