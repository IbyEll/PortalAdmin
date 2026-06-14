/**
 * Matrice pilastri — UI cruscotto (albero, raggruppamento, colonne ridimensionabili).
 * Rigenerazione HTML: CLI node scripts/generate-pillar-matrix-portal.mjs
 */

/** Rigenerazione da UI cruscotto disabilitata — solo CLI. */
const PILLAR_REGENERATE_ENABLED = false;

/** @type {Record<number, number[]>} */
const DEFAULT_WIDTHS_BY_COLS = {
  7 : [12, 26, 10, 8, 8, 22, 14]
, 6 : [28, 12, 15, 15, 15, 15]
, 2 : [35, 65]
};

const MIN_COL_WIDTH_PCT = 4;
const COL_WIDTHS_STORAGE_PREFIX = "pillar-matrix-col-widths-v1:";

/**
 * @param {number} colCount
 * @returns {number[]}
 */
function defaultColWidths(colCount) {
  const preset = DEFAULT_WIDTHS_BY_COLS[colCount];

  if (preset) {
    return [...preset];
  }

  const even = 100 / colCount;

  return Array.from({ length: colCount }, () => even);
}

/**
 * @param {number[]} widths
 * @returns {number[]}
 */
function normalizeColWidths(widths) {
  const sum = widths.reduce((total, value) => total + value, 0);

  if (!Number.isFinite(sum) || sum <= 0) {
    return defaultColWidths(widths.length);
  }

  return widths.map((value) => (value / sum) * 100);
}

/**
 * @param {HTMLTableElement} table
 * @returns {string}
 */
function tableStorageKey(table) {
  const headers = [...table.querySelectorAll("thead th")].map(
    (th) => th.textContent?.trim() ?? ""
  );

  const page = window.location.pathname.replace(/\.html$/, "");

  return `${COL_WIDTHS_STORAGE_PREFIX}${page}:${headers.join("|")}`;
}

/**
 * @param {string} storageKey
 * @param {number} colCount
 * @returns {number[]}
 */
function loadColWidths(storageKey, colCount) {
  const defaults = defaultColWidths(colCount);

  try {
    const raw = localStorage.getItem(storageKey);

    if (!raw) {
      return defaults;
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed) || parsed.length !== colCount) {
      return defaults;
    }

    return normalizeColWidths(parsed.map((value) => Number(value)));
  } catch {
    return defaults;
  }
}

/**
 * @param {string} storageKey
 * @param {number[]} widths
 */
function saveColWidths(storageKey, widths) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(normalizeColWidths(widths)));
  } catch {
    /* quota / private mode */
  }
}

/**
 * @param {HTMLTableElement} table
 * @param {number[]} widths
 */
function applyColWidths(table, widths) {
  table.querySelectorAll("colgroup col").forEach((colEl, index) => {
    if (!(colEl instanceof HTMLTableColElement) || index >= widths.length) {
      return;
    }

    colEl.style.width = `${widths[index].toFixed(2)}%`;
  });
}

/**
 * @param {HTMLTableElement} table
 */
function ensureResizableTable(table) {
  if (table.dataset.colResizeReady === "1") {
    return;
  }

  const headers = [...table.querySelectorAll("thead th")];

  if (headers.length < 2) {
    return;
  }

  if (!(table.parentElement instanceof HTMLElement)
    || !table.parentElement.classList.contains("matrix-table-wrap")) {
    const wrap = document.createElement("div");

    wrap.className = "matrix-table-wrap";
    table.parentNode?.insertBefore(wrap, table);
    wrap.appendChild(table);
  }

  table.classList.add("matrix-table-resizable");

  let colgroup = table.querySelector("colgroup");

  if (!(colgroup instanceof HTMLTableColGroupElement)) {
    colgroup = document.createElement("colgroup");
    table.insertBefore(colgroup, table.firstChild);
  }

  colgroup.replaceChildren();

  for (let index = 0; index < headers.length; index += 1) {
    const col = document.createElement("col");

    col.className = `col-${index}`;
    colgroup.appendChild(col);
  }

  headers.forEach((th) => {
    if (th instanceof HTMLElement) {
      th.classList.add("col-resize-head");
    }
  });

  table.dataset.colResizeReady = "1";
}

/**
 * @param {HTMLTableElement} table
 */
function initColumnResizersForTable(table) {
  ensureResizableTable(table);

  const headers = [...table.querySelectorAll("thead th.col-resize-head")];

  if (headers.length < 2) {
    return;
  }

  const storageKey = tableStorageKey(table);
  const colCount   = headers.length;
  let widths       = loadColWidths(storageKey, colCount);

  applyColWidths(table, widths);

  headers.forEach((th, index) => {
    if (!(th instanceof HTMLElement) || index >= colCount - 1) {
      return;
    }

    if (th.querySelector(".col-resize-handle")) {
      return;
    }

    const handle = document.createElement("span");

    handle.className = "col-resize-handle";
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-label", `Ridimensiona colonna ${index + 1}`);
    handle.title = "Trascina per ridimensionare · doppio clic per ripristinare";

    handle.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const tableWidth = table.getBoundingClientRect().width || 1;
      const startX     = event.clientX;
      const startLeft  = widths[index];
      const startRight = widths[index + 1];

      handle.classList.add("is-dragging");
      document.body.classList.add("is-col-resizing");

      /** @param {MouseEvent} ev */
      const onMove = (ev) => {
        const deltaPct = ((ev.clientX - startX) / tableWidth) * 100;
        let newLeft    = startLeft + deltaPct;
        let newRight   = startRight - deltaPct;

        if (newLeft < MIN_COL_WIDTH_PCT) {
          const shift = MIN_COL_WIDTH_PCT - newLeft;

          newLeft  = MIN_COL_WIDTH_PCT;
          newRight -= shift;
        }

        if (newRight < MIN_COL_WIDTH_PCT) {
          const shift = MIN_COL_WIDTH_PCT - newRight;

          newRight = MIN_COL_WIDTH_PCT;
          newLeft -= shift;
        }

        if (newLeft < MIN_COL_WIDTH_PCT) {
          newLeft = MIN_COL_WIDTH_PCT;
        }

        widths = [...widths];
        widths[index]     = newLeft;
        widths[index + 1] = newRight;
        applyColWidths(table, widths);
      };

      const onUp = () => {
        handle.classList.remove("is-dragging");
        document.body.classList.remove("is-col-resizing");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        saveColWidths(storageKey, widths);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    handle.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();

      widths = defaultColWidths(colCount);
      applyColWidths(table, widths);
      saveColWidths(storageKey, widths);
    });

    th.appendChild(handle);
  });
}

function initPillarMatrixColumnResizers() {
  document.querySelectorAll("main table").forEach((table) => {
    if (table instanceof HTMLTableElement) {
      initColumnResizersForTable(table);
    }
  });
}

const GROUP_COLLAPSE_STORAGE_PREFIX = "pillar-matrix-group-collapsed-v1:";

const EXPAND_ICON_SVG = `<svg class="tree-toolbar-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 5.83 15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/></svg>`;

const COLLAPSE_ICON_SVG = `<svg class="tree-toolbar-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M7.41 18.59 8.83 20 12 16.83 15.17 20l1.41-1.41L12 14l-4.59 4.59zM7.41 5.41 8.83 4 12 7.17 15.17 4l1.41 1.41L12 10 7.41 5.41z"/></svg>`;

/**
 * @param {string} expandId
 * @param {string} collapseId
 * @returns {string}
 */
function matrixGroupToolbarButtons(expandId, collapseId) {
  const ui = window.JloExpandCollapseUi;

  if (ui?.pair) {
    return ui.pair(expandId, collapseId);
  }

  return [
    `<span class="tree-bulk-toggle" role="group" aria-label="Espandi o collassa tutti i gruppi">`
  , `<button type="button" class="action btn-tree-icon" id="${expandId}" title="Espandi tutto" aria-label="Espandi tutto">${EXPAND_ICON_SVG}</button>`
  , `<button type="button" class="action btn-tree-icon" id="${collapseId}" title="Collassa tutto" aria-label="Collassa tutto">${COLLAPSE_ICON_SVG}</button>`
  , `</span>`
  ].join("");
}

/**
 * @param {HTMLTableCellElement} cell
 * @param {string} groupKey
 */
function ensureMatrixGroupToggleCell(cell, groupKey) {
  if (cell.querySelector(".matrix-group-toggle")) {
    return;
  }

  const shell = document.createElement("div");

  shell.className = "matrix-group-cell";

  const toggle = document.createElement("button");

  toggle.type = "button";
  toggle.className = "matrix-group-toggle";
  toggle.setAttribute("aria-label", `Espandi o collassa gruppo ${groupKey}`);
  toggle.setAttribute("aria-expanded", "true");
  toggle.textContent = "▼";

  const content = document.createElement("span");

  content.className = "matrix-group-content";
  content.innerHTML = cell.innerHTML;

  shell.appendChild(toggle);
  shell.appendChild(content);
  cell.replaceChildren(shell);
  cell.classList.add("matrix-group-issue-col");
}

/**
 * @param {HTMLTableSectionElement} tbody
 * @param {boolean} collapsed
 */
function setMatrixGroupCollapsed(tbody, collapsed) {
  tbody.classList.toggle("is-collapsed", collapsed);

  const toggle = tbody.querySelector(".matrix-group-head .matrix-group-toggle");

  if (toggle instanceof HTMLButtonElement) {
    toggle.textContent = collapsed ? "▶" : "▼";
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }
}

/**
 * @param {HTMLTableElement} table
 */
function initMatrixIssueGroups(table) {
  if (table.dataset.groupReady === "1" || !table.classList.contains("matrix-grouped")) {
    return;
  }

  const groups = [...table.querySelectorAll("tbody.matrix-issue-group.has-children")];

  if (groups.length === 0) {
    return;
  }

  const collapsed  = new Set();
  const storageKey = `${GROUP_COLLAPSE_STORAGE_PREFIX}${window.location.pathname}`;

  try {
    const saved = localStorage.getItem(storageKey);

    if (saved) {
      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        for (const key of parsed) {
          if (typeof key === "string") {
            collapsed.add(key);
          }
        }
      }
    }
  } catch {
    /* ignore */
  }

  /**
   * @param {Set<string>} nextCollapsed
   */
  function persistCollapsed(nextCollapsed) {
    try {
      if (nextCollapsed.size === 0) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify([...nextCollapsed]));
      }
    } catch {
      /* ignore */
    }
  }

  for (const tbody of groups) {
    const groupKey = tbody.getAttribute("data-group-key") ?? "";
    const headRow  = tbody.querySelector("tr.matrix-group-head");

    if (!(headRow instanceof HTMLTableRowElement)) {
      continue;
    }

    const cell = headRow.cells[0];

    if (!(cell instanceof HTMLTableCellElement)) {
      continue;
    }

    ensureMatrixGroupToggleCell(cell, groupKey);

    const toggle = cell.querySelector(".matrix-group-toggle");

    setMatrixGroupCollapsed(tbody, collapsed.has(groupKey));

    if (!(toggle instanceof HTMLButtonElement)) {
      continue;
    }

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (collapsed.has(groupKey)) {
        collapsed.delete(groupKey);
      } else {
        collapsed.add(groupKey);
      }

      setMatrixGroupCollapsed(tbody, collapsed.has(groupKey));
      persistCollapsed(collapsed);
    });
  }

  const wrap = table.closest(".matrix-table-wrap") ?? table;
  const toolbarId = `matrix-group-toolbar-${Math.random().toString(36).slice(2, 8)}`;
  const expandId  = `${toolbarId}-expand`;
  const collapseId = `${toolbarId}-collapse`;

  if (!wrap.previousElementSibling?.classList.contains("matrix-group-toolbar")) {
    const toolbar = document.createElement("div");

    toolbar.className = "matrix-group-toolbar";
    toolbar.innerHTML = [
      `<span class="matrix-group-toolbar-label">Raggruppamento issue</span>`
    , matrixGroupToolbarButtons(expandId, collapseId)
    ].join("");

    wrap.parentNode?.insertBefore(toolbar, wrap);

    toolbar.querySelector(`#${expandId}`)?.addEventListener("click", () => {
      collapsed.clear();

      for (const tbody of groups) {
        setMatrixGroupCollapsed(tbody, false);
      }

      persistCollapsed(collapsed);
    });

    toolbar.querySelector(`#${collapseId}`)?.addEventListener("click", () => {
      collapsed.clear();

      for (const tbody of groups) {
        const groupKey = tbody.getAttribute("data-group-key") ?? "";

        if (groupKey) {
          collapsed.add(groupKey);
        }

        setMatrixGroupCollapsed(tbody, true);
      }

      persistCollapsed(collapsed);
    });
  }

  table.dataset.groupReady = "1";
}

function initPillarMatrixGroupTables() {
  document.querySelectorAll("main table.matrix-grouped").forEach((table) => {
    if (table instanceof HTMLTableElement) {
      initMatrixIssueGroups(table);
    }
  });
}

const TREE_COLLAPSE_STORAGE_PREFIX = "pillar-matrix-tree-collapsed-v1:";

/**
 * @param {HTMLTableRowElement} row
 * @param {Set<string>} collapsed
 * @param {Map<string, HTMLTableRowElement>} rowByKey
 */
function isMatrixTreeRowHidden(row, collapsed, rowByKey) {
  let parentKey = row.dataset.parentKey || null;

  while (parentKey) {
    if (collapsed.has(parentKey)) {
      return true;
    }

    parentKey = rowByKey.get(parentKey)?.dataset.parentKey || null;
  }

  return false;
}

/**
 * @param {HTMLTableElement} table
 * @param {Set<string>} collapsed
 * @param {Map<string, HTMLTableRowElement>} rowByKey
 */
function applyMatrixTreeVisibility(table, collapsed, rowByKey) {
  for (const row of table.querySelectorAll("tr.matrix-tree-row")) {
    if (!(row instanceof HTMLTableRowElement)) {
      continue;
    }

    const hidden = isMatrixTreeRowHidden(row, collapsed, rowByKey);
    row.classList.toggle("is-tree-hidden", hidden);

    const toggle = row.querySelector(".matrix-tree-toggle");

    if (!(toggle instanceof HTMLButtonElement)) {
      continue;
    }

    const key = row.dataset.issueKey ?? "";

    if (!key || row.dataset.hasChildren !== "true") {
      continue;
    }

    toggle.textContent = collapsed.has(key) ? "▶" : "▼";
    toggle.setAttribute("aria-expanded", collapsed.has(key) ? "false" : "true");
  }
}

/**
 * @param {HTMLTableElement} table
 */
function initMatrixTreeTable(table) {
  if (table.dataset.treeReady === "1" || !table.classList.contains("matrix-tree")) {
    return;
  }

  const rows = [...table.querySelectorAll("tr.matrix-tree-row")].filter(
    (row) => row instanceof HTMLTableRowElement
  );

  if (rows.length === 0) {
    return;
  }

  /** @type {Map<string, HTMLTableRowElement>} */
  const rowByKey = new Map();

  for (const row of rows) {
    const key = row.dataset.issueKey;

    if (key) {
      rowByKey.set(key, row);
    }
  }

  const collapsed  = new Set();
  const storageKey = `${TREE_COLLAPSE_STORAGE_PREFIX}${window.location.pathname}`;

  try {
    const saved = localStorage.getItem(storageKey);

    if (saved) {
      const parsed = JSON.parse(saved);

      if (Array.isArray(parsed)) {
        for (const key of parsed) {
          if (typeof key === "string") {
            collapsed.add(key);
          }
        }
      }
    }
  } catch {
    /* ignore */
  }

  /**
   * @param {Set<string>} nextCollapsed
   */
  function persistCollapsed(nextCollapsed) {
    try {
      if (nextCollapsed.size === 0) {
        localStorage.removeItem(storageKey);
      } else {
        localStorage.setItem(storageKey, JSON.stringify([...nextCollapsed]));
      }
    } catch {
      /* ignore */
    }
  }

  for (const row of rows) {
    const key = row.dataset.issueKey ?? "";
    const toggle = row.querySelector(".matrix-tree-toggle");

    if (!(toggle instanceof HTMLButtonElement) || row.dataset.hasChildren !== "true" || !key) {
      continue;
    }

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (collapsed.has(key)) {
        collapsed.delete(key);
      } else {
        collapsed.add(key);
      }

      applyMatrixTreeVisibility(table, collapsed, rowByKey);
      persistCollapsed(collapsed);
    });
  }

  applyMatrixTreeVisibility(table, collapsed, rowByKey);

  const wrap = table.closest(".matrix-table-wrap") ?? table;
  const toolbarId = `matrix-tree-toolbar-${Math.random().toString(36).slice(2, 8)}`;
  const expandId    = `${toolbarId}-expand`;
  const collapseId  = `${toolbarId}-collapse`;

  if (!wrap.previousElementSibling?.classList.contains("matrix-tree-toolbar")) {
    const toolbar = document.createElement("div");

    toolbar.className = "matrix-tree-toolbar";
    toolbar.innerHTML = [
      `<span class="matrix-tree-toolbar-label">Albero issue</span>`
    , matrixGroupToolbarButtons(expandId, collapseId)
    ].join("");

    wrap.parentNode?.insertBefore(toolbar, wrap);

    toolbar.querySelector(`#${expandId}`)?.addEventListener("click", () => {
      collapsed.clear();
      applyMatrixTreeVisibility(table, collapsed, rowByKey);
      persistCollapsed(collapsed);
    });

    toolbar.querySelector(`#${collapseId}`)?.addEventListener("click", () => {
      collapsed.clear();

      for (const row of rows) {
        const key = row.dataset.issueKey ?? "";

        if (key && row.dataset.hasChildren === "true") {
          collapsed.add(key);
        }
      }

      applyMatrixTreeVisibility(table, collapsed, rowByKey);
      persistCollapsed(collapsed);
    });
  }

  table.dataset.treeReady = "1";
}

function initPillarMatrixTreeTables() {
  document.querySelectorAll("main table.matrix-tree").forEach((table) => {
    if (table instanceof HTMLTableElement) {
      initMatrixTreeTable(table);
    }
  });
}

function initPillarMatrixUi() {
  initPillarRegenerateUi();
  initPillarMatrixTreeTables();
  initPillarMatrixGroupTables();
  initPillarMatrixColumnResizers();
}

/**
 * Nasconde/disabilita rigenera da cruscotto; normalizza riga versione su HTML legacy.
 */
function initPillarRegenerateUi() {
  const toolbar = document.querySelector(".pillar-toolbar");
  const btn     = document.getElementById("btn-pillar-regenerate");
  const status  = document.getElementById("pillar-regen-status");

  if (toolbar instanceof HTMLElement) {
    toolbar.hidden = true;
  }

  if (btn instanceof HTMLButtonElement) {
    btn.disabled = true;
    btn.hidden   = true;
    btn.setAttribute("aria-hidden", "true");
  }

  if (status instanceof HTMLElement) {
    status.hidden = true;
  }

  if (!PILLAR_REGENERATE_ENABLED) {
    document.querySelectorAll(".page-footer").forEach((footer) => {
      if (!(footer instanceof HTMLElement)) {
        return;
      }

      footer.innerHTML = footer.innerHTML.replace(/\s*·\s*API\s*<code>[^<]*pillar-matrix\/regenerate[^<]*<\/code>/gi, "");
    });
  }

  document.querySelectorAll("header p.meta").forEach((meta) => {
    if (!(meta instanceof HTMLElement) || meta.classList.contains("pillar-version")) {
      return;
    }

    const time = meta.querySelector("time");

    if (!(time instanceof HTMLTimeElement) || !time.dateTime) {
      return;
    }

    const dateLabel = time.textContent?.trim() || time.dateTime.slice(0, 10);
    const docLink   = meta.querySelector('a[href*="9076737"]');

    meta.classList.add("pillar-version");
    meta.textContent = "";

    meta.append("Versione ");

    const versionTime = document.createElement("time");

    versionTime.dateTime = time.dateTime.slice(0, 10);
    versionTime.textContent = dateLabel;
    meta.append(versionTime);

    if (docLink instanceof HTMLAnchorElement) {
      meta.append(" · ");
      meta.append(docLink.cloneNode(true));
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPillarMatrixUi);
} else {
  initPillarMatrixUi();
}
