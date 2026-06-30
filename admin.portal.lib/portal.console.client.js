/**
 * Componente log condiviso — polling /api/logs, filtri livello/sorgente (ADMIN-163/164).
 * Espone `window.PortalLogConsole`.
 */
(function initPortalLogConsole(global) {
  "use strict";

  const LEVELS = ["all", "debug", "info", "warn", "error"];
  const LEVEL_RANK = { debug: 0, info: 1, warn: 2, error: 3 };

  /**
   * @param {string} text
   */
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * @param {Record<string, unknown>} row
   */
  function rowLevel(row) {
    const level = String(row.level ?? "info").toLowerCase();
    return level in LEVEL_RANK ? level : "info";
  }

  /**
   * @param {Record<string, unknown>} row
   * @param {{ level?: string, source?: string }} filters
   */
  function rowMatchesFilters(row, filters) {
    const source = filters.source ?? "all";

    if (source !== "all" && String(row.source ?? "") !== source) {
      return false;
    }

    const minLevel = filters.level ?? "all";

    if (minLevel !== "all" && LEVEL_RANK[rowLevel(row)] < LEVEL_RANK[minLevel]) {
      return false;
    }

    return true;
  }

  /**
   * @param {HTMLElement} pane
   * @param {Record<string, unknown>} row
   */
  function appendLineToPane(pane, row) {
    const stream = String(row.stream ?? "stdout");
    const lineEl = document.createElement("div");
    lineEl.className = `process-console-line process-console-${stream} process-console-level-${rowLevel(row)}`;
    lineEl.textContent = String(row.text ?? "");
    pane.appendChild(lineEl);
  }

  /**
   * @param {{
   *   root: HTMLElement
   *   apiPath?: string
   *   pollMs?: number
   *   sources?: Array<{ id: string, label: string }>
   *   defaultSource?: string
   *   defaultLevel?: string
   *   onClear?: () => Promise<void>
   *   clearServerPath?: string
   * }} options
   */
  function mount(options) {
    const root           = options.root;
    const apiPath        = options.apiPath ?? "/api/logs";
    const pollMs         = options.pollMs ?? 700;
    const sources        = options.sources ?? [{ id: "all", label: "Tutti" }];
    const outputEl       = root.querySelector("[data-portal-log-output]");
    const followEl       = root.querySelector("[data-portal-log-follow]");
    const clearBtn       = root.querySelector("[data-portal-log-clear]");
    const levelSelect    = root.querySelector("[data-portal-log-level]");
    const sourceSelect   = root.querySelector("[data-portal-log-source]");

    if (!(outputEl instanceof HTMLElement)) {
      throw new Error("PortalLogConsole: elemento [data-portal-log-output] mancante");
    }

    let cursor = 0;
    /** @type {ReturnType<typeof setInterval> | null} */
    let pollTimer = null;

    /** @type {{ level: string, source: string }} */
    const filters = {
      level  : options.defaultLevel ?? "all"
    , source : options.defaultSource ?? "all"
    };

    if (levelSelect instanceof HTMLSelectElement) {
      levelSelect.value = filters.level;
      levelSelect.addEventListener("change", () => {
        filters.level = levelSelect.value;
        outputEl.textContent = "";
        cursor = 0;
        void poll(true);
      });
    }

    if (sourceSelect instanceof HTMLSelectElement) {
      sourceSelect.innerHTML = sources.map((src) => {
        return `<option value="${escapeHtml(src.id)}">${escapeHtml(src.label)}</option>`;
      }).join("");
      sourceSelect.value = filters.source;
      sourceSelect.addEventListener("change", () => {
        filters.source = sourceSelect.value;
        outputEl.textContent = "";
        cursor = 0;
        void poll(true);
      });
    }

    /**
     * @param {boolean} [reload]
     */
    async function poll(reload = false) {
      if (reload) {
        cursor = 0;
      }

      const params = new URLSearchParams({ cursor: String(cursor), extended: "1" });

      if (filters.source !== "all") {
        params.set("source", filters.source);
      }

      if (filters.level !== "all") {
        params.set("level", filters.level);
      }

      try {
        const res  = await fetch(`${apiPath}?${params.toString()}`);
        const data = await res.json();
        const lines = Array.isArray(data.lines) ? data.lines : [];

        for (const row of lines) {
          if (rowMatchesFilters(row, filters)) {
            appendLineToPane(outputEl, row);
          }
        }

        if (typeof data.cursor === "number") {
          cursor = data.cursor;
        }

        const follow = !(followEl instanceof HTMLInputElement) || followEl.checked;

        if (follow) {
          outputEl.scrollTop = outputEl.scrollHeight;
        }
      } catch {
        // poll silenzioso
      }
    }

    function startPolling() {
      stopPolling();
      void poll();
      pollTimer = global.setInterval(() => {
        void poll();
      }, pollMs);
    }

    function stopPolling() {
      if (pollTimer != null) {
        global.clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    if (clearBtn instanceof HTMLButtonElement) {
      clearBtn.addEventListener("click", async () => {
        if (options.onClear) {
          await options.onClear();
        } else if (options.clearServerPath) {
          const params = filters.source !== "all" ? `?source=${encodeURIComponent(filters.source)}` : "";
          await fetch(`${options.clearServerPath}${params}`, { method: "DELETE" });
        }

        outputEl.textContent = "";
        cursor = 0;
        void poll(true);
      });
    }

    startPolling();

    return {
      poll
    , startPolling
    , stopPolling
    , reset() {
        outputEl.textContent = "";
        cursor = 0;
      }
    , logClient(source, stream, text) {
        appendLineToPane(outputEl, { source, stream, text, level: stream === "stderr" ? "error" : "info" });
        const follow = !(followEl instanceof HTMLInputElement) || followEl.checked;

        if (follow) {
          outputEl.scrollTop = outputEl.scrollHeight;
        }
      }
    };
  }

  global.PortalLogConsole = {
    LEVELS
  , mount
  , rowMatchesFilters
  };
})(typeof window !== "undefined" ? window : globalThis);
