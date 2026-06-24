/**
 * Companion toolbar docs — elenco pagine e pulsante Aggiorna (barrato + commento).
 */

// 1. Elementi DOM toolbar
const selectEl   = document.getElementById("docs-chrome-select");
const refreshBtn = document.getElementById("docs-chrome-refresh");
const statusEl   = document.getElementById("docs-chrome-status");

/**
 * @returns {string}
 */
function currentDocRel() {
  const path = window.location.pathname.replace(/^\/docs\//, "");

  return path || "index.html";
}

/**
 * @param {string} message
 * @param {"ok" | "err" | ""} kind
 */
function setStatus(message, kind = "") {
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message;
  statusEl.classList.remove("is-ok", "is-err");

  if (kind === "ok") {
    statusEl.classList.add("is-ok");
  }

  if (kind === "err") {
    statusEl.classList.add("is-err");
  }
}

/**
 * @returns {Promise<void>}
 */
async function loadDocList() {
  if (!selectEl) {
    return;
  }

  const res = await fetch("/api/docs/list");

  if (!res.ok) {
    throw new Error(`list ${res.status}`);
  }

  const data  = await res.json();
  const pages = Array.isArray(data.pages) ? data.pages : [];
  const cur   = currentDocRel();

  selectEl.replaceChildren();

  for (const page of pages) {
    const opt = document.createElement("option");
    opt.value = page.name;
    opt.textContent = page.title;
    selectEl.appendChild(opt);
  }

  if (pages.some((p) => p.name === cur)) {
    selectEl.value = cur;
  }
}

/**
 * @returns {Promise<void>}
 */
async function runRefresh() {
  if (!refreshBtn) {
    return;
  }

  refreshBtn.disabled = true;
  setStatus("Analisi…");

  const cur  = currentDocRel();
  const body = cur === "index.html" ? {} : { file: cur };

  try {
    const res = await fetch("/api/docs/refresh", {
      method  : "POST"
    , headers : { "Content-Type": "application/json" }
    , body    : JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error ?? `refresh ${res.status}`);
    }

    const n = Array.isArray(data.updated) ? data.updated.length : 0;
    setStatus(n > 0 ? `Aggiornati ${n} file` : "Già allineato", "ok");

    if (n > 0) {
      window.setTimeout(() => window.location.reload(), 600);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setStatus(message, "err");
  } finally {
    refreshBtn.disabled = false;
  }
}

// 2. Eventi — navigazione select e Aggiorna
if (selectEl) {
  selectEl.addEventListener("change", () => {
    const name = selectEl.value;

    if (name && name !== currentDocRel()) {
      window.location.href = `/docs/${name}`;
    }
  });
}

if (refreshBtn) {
  refreshBtn.addEventListener("click", () => {
    void runRefresh();
  });
}

void loadDocList().catch((err) => {
  setStatus(err instanceof Error ? err.message : String(err), "err");
});
