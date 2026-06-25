/**
 * Companion toolbar doc.cursor.rule — elenco pagine, AGGIORNA da .mdc, navigazione.
 */

const selectEl   = document.getElementById("cursor-rules-chrome-select");
const refreshBtn = document.getElementById("cursor-rules-chrome-refresh");
const statusEl   = document.getElementById("cursor-rules-chrome-status");
const PREFIX     = "/doc.cursor.rule";

/**
 * @returns {string}
 */
function currentDocRel() {
  const path = window.location.pathname.replace(/^\/doc\.cursor\.rule\//, "");

  return decodeURIComponent(path || "index.html");
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
async function loadRuleList() {
  if (!selectEl) {
    return;
  }

  const res = await fetch("/api/doc.cursor.rule/list");

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
  setStatus("Rigenerazione da .mdc…");

  const cur  = currentDocRel();
  const body = cur === "index.html" ? {} : { file: cur };

  try {
    const res = await fetch("/api/doc.cursor.rule/refresh", {
      method  : "POST"
    , headers : { "Content-Type": "application/json" }
    , body    : JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error ?? `refresh ${res.status}`);
    }

    const n = Array.isArray(data.updated) ? data.updated.length : 0;
    const skipped = Array.isArray(data.skipped) ? data.skipped.length : 0;
    const stamp   = typeof data.refreshedAt === "string" ? data.refreshedAt : "";

    setStatus(
      skipped > 0
        ? `Aggiornati ${n} file · ${skipped} saltati${stamp ? ` · ${stamp}` : ""}`
        : `Aggiornati ${n} file${stamp ? ` · ${stamp}` : ""}`
    , "ok"
    );

    window.setTimeout(() => window.location.reload(), 500);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setStatus(message, "err");
  } finally {
    refreshBtn.disabled = false;
  }
}

if (selectEl) {
  selectEl.addEventListener("change", () => {
    const name = selectEl.value;

    if (name && name !== currentDocRel()) {
      window.location.href = `${PREFIX}/${encodeURIComponent(name).replace(/%20/g, " ")}`;
    }
  });
}

if (refreshBtn) {
  refreshBtn.addEventListener("click", () => {
    void runRefresh();
  });
}

void loadRuleList().catch((err) => {
  setStatus(err instanceof Error ? err.message : String(err), "err");
});
