/**
 * Ridimensionamento colonne tabella — drag handle su thead, persistenza localStorage.
 * Espone window.CruscottoTableColumnResize per pagine cruscotto e working plan.
 */
(function initCruscottoTableColumnResize(global) {
  const MIN_COL_WIDTH_PCT = 4;
  const STORAGE_PREFIX = "cruscotto-col-widths-v1:";

  /**
   * @param {unknown} node
   * @param {string} tagName
   * @returns {boolean}
   */
  function isElementTag(node, tagName) {
    return node != null
      && typeof node === "object"
      && "nodeType" in node
      && node.nodeType === 1
      && "tagName" in node
      && String(node.tagName).toUpperCase() === tagName;
  }

  /** @type {Record<number, number[]>} */
  const DEFAULT_WIDTHS_BY_COLS = {
    7: [2, 3, 11, 38, 20, 4, 10]
  , 5: [8, 12, 8, 8, 64]
  , 4: [12, 14, 14, 60]
  , 3: [14, 16, 70]
  };

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
   * @returns {number[] | null}
   */
  function parseDefaultWidths(table) {
    const raw = table.dataset.colResizeDefaults;

    if (!raw) {
      return null;
    }

    const parsed = raw.split(",").map((part) => Number(part.trim())).filter(Number.isFinite);

    return parsed.length >= 2 ? normalizeColWidths(parsed) : null;
  }

  /**
   * @param {HTMLTableElement} table
   * @param {number} colCount
   * @returns {number[]}
   */
  function tableDefaultWidths(table, colCount) {
    return parseDefaultWidths(table) ?? defaultColWidths(colCount);
  }

  /**
   * @param {HTMLTableElement} table
   * @returns {string}
   */
  function tableStorageKey(table) {
    const page = `${global.location.pathname}${global.location.hash.split(":")[0]}`;
    const id = table.dataset.colResizeId
      || [...table.classList].filter(Boolean).join(".")
      || "table";
    const headers = [...table.querySelectorAll("thead th")].map(
      (th) => th.textContent?.trim().replace(/\s+/g, " ") ?? ""
    );

    return `${STORAGE_PREFIX}${page}:${id}:${headers.join("|")}`;
  }

  /**
   * @param {string} storageKey
   * @param {HTMLTableElement} table
   * @param {number} colCount
   * @returns {number[]}
   */
  function loadColWidths(storageKey, table, colCount) {
    const defaults = tableDefaultWidths(table, colCount);

    try {
      const raw = global.localStorage.getItem(storageKey);

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
      global.localStorage.setItem(storageKey, JSON.stringify(normalizeColWidths(widths)));
    } catch {
      /* quota / private mode */
    }
  }

  /**
   * @param {HTMLTableElement} table
   * @param {number[]} widths
   */
  function applyColWidths(table, widths) {
    const cols = [...table.querySelectorAll("colgroup col")];

    cols.forEach((colEl, index) => {
      if (!isElementTag(colEl, "COL") || index >= widths.length) {
        return;
      }

      colEl.style.width = `${widths[index].toFixed(2)}%`;
    });
  }

  /**
   * @param {HTMLTableElement} table
   */
  function ensureResizableTable(table) {
    const headers = [...table.querySelectorAll("thead th")];

    if (headers.length < 2) {
      return false;
    }

    table.classList.add("table-col-resizable");

    let colgroup = table.querySelector("colgroup");

    if (!isElementTag(colgroup, "COLGROUP")) {
      colgroup = document.createElement("colgroup");
      table.insertBefore(colgroup, table.firstChild);
    }

    if (colgroup.children.length !== headers.length) {
      const previousClasses = [...colgroup.children].map((node) => node.className);

      colgroup.replaceChildren();

      for (let index = 0; index < headers.length; index += 1) {
        const col = document.createElement("col");
        const headerClass = headers[index] instanceof HTMLElement
          ? [...headers[index].classList].find((name) => name.startsWith("wp-col-"))
          : "";
        col.className = headerClass || previousClasses[index] || `col-resize-${index}`;
        colgroup.appendChild(col);
      }
    }

    headers.forEach((th) => {
      if (th instanceof HTMLElement) {
        th.classList.add("col-resize-head");
      }
    });

    return true;
  }

  /**
   * @param {HTMLTableElement} table
   * @param {{ storageKey?: string, defaults?: number[] }} [options]
   */
  function initTable(table, options = {}) {
    if (!isElementTag(table, "TABLE")) {
      return;
    }

    if (options.force) {
      delete table.dataset.colResizeReady;
      table.querySelectorAll(".col-resize-handle").forEach((node) => node.remove());
    }

    if (table.dataset.colResizeReady === "1") {
      return;
    }

    if (!ensureResizableTable(table)) {
      return;
    }

    const headers = [...table.querySelectorAll("thead th.col-resize-head")];
    const colCount = headers.length;
    const storageKey = options.storageKey ?? tableStorageKey(table);
    const defaults = options.defaults ?? tableDefaultWidths(table, colCount);
    let widths = loadColWidths(storageKey, table, colCount);

    applyColWidths(table, widths);
    table.dataset.colResizeReady = "1";

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
        const startX = event.clientX;
        const startLeft = widths[index];
        const startRight = widths[index + 1];

        handle.classList.add("is-dragging");
        document.body.classList.add("is-col-resizing");

        /** @param {MouseEvent} ev */
        const onMove = (ev) => {
          const deltaPct = ((ev.clientX - startX) / tableWidth) * 100;
          let newLeft = startLeft + deltaPct;
          let newRight = startRight - deltaPct;

          if (newLeft < MIN_COL_WIDTH_PCT) {
            const shift = MIN_COL_WIDTH_PCT - newLeft;
            newLeft = MIN_COL_WIDTH_PCT;
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
          widths[index] = newLeft;
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
        widths = normalizeColWidths([...defaults]);
        applyColWidths(table, widths);
        saveColWidths(storageKey, widths);
      });

      th.appendChild(handle);
    });
  }

  /**
   * @param {ParentNode} [root]
   * @param {string} [selector]
   */
  function initAll(root = document, selector) {
    const sel = selector
      || "table.wp-table, .wp-table-wrap > table, .table-wrap > table, table.table-col-resizable, table.data";

    root.querySelectorAll(sel).forEach((node) => {
      if (isElementTag(node, "TABLE")) {
        initTable(node);
      }
    });
  }

  global.CruscottoTableColumnResize = {
    initTable
  , initAll
  , MIN_COL_WIDTH_PCT
  };
})(window);
