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
  const path = window.location.pathname.replace(/^\/docs(?:\.portal)?\//, "");

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
    const total = data.analysis?.summary?.total ?? 0;
    const passed = data.analysis?.summary?.passed ?? 0;
    setStatus(
      total > 0 ? `Verificati ${total} controlli (${passed} OK) · ${n} file aggiornati` : (n > 0 ? `Aggiornati ${n} file` : "Verifica completata")
    , "ok"
    );
    sessionStorage.setItem("docs-scroll-fresh", "1");
    window.setTimeout(() => window.location.reload(), 600);
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

void restorePersistedFindingIssues().catch(() => {
  // store assente o pagina non Avanzamento
});

// 3. Dopo Aggiorna — scroll alla prima stellina
if (sessionStorage.getItem("docs-scroll-fresh")) {
  sessionStorage.removeItem("docs-scroll-fresh");

  window.requestAnimationFrame(() => {
    document.querySelector(".adv-card .docs-fresh-mark, .docs-fresh-mark")
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

const JIRA_BROWSE_BASE = "https://myfuturejobsearch.atlassian.net/browse";

/**
 * @param {string | undefined} issueType
 * @returns {{ slug: string, label: string }}
 */
function createdIssueTypeBadge(issueType) {
  const raw = String(issueType ?? "Bug").toLowerCase();

  if (raw.includes("bug")) {
    return { slug: "bug", label: "bug" };
  }

  if (raw.includes("story")) {
    return { slug: "story", label: "story" };
  }

  if (raw.includes("epic")) {
    return { slug: "epic", label: "epic" };
  }

  if (raw.includes("task")) {
    return { slug: "task", label: "task" };
  }

  if (raw.includes("todo")) {
    return { slug: "todo", label: "todo" };
  }

  return { slug: "other", label: "issue" };
}

/**
 * @param {HTMLElement} wrap
 */
function closeIssueCreateMenus(wrap) {
  for (const menu of document.querySelectorAll(".issue-ref-create-menu")) {
    if (menu instanceof HTMLElement) {
      menu.hidden = true;
    }
  }
}

/**
 * @param {HTMLButtonElement} btn
 * @param {{ key: string, issueType?: string }} data
 */
function paintCreatedIssueCell(btn, data) {
  const cell = btn?.closest?.("td.issue-refinement") ?? btn;

  if (!(cell instanceof HTMLElement)) {
    return;
  }

  const { slug, label } = createdIssueTypeBadge(data.issueType);
  const badge           = `<span class="issue-type issue-type-${slug}">${label}</span>`;
  const url             = `${JIRA_BROWSE_BASE}/${encodeURIComponent(data.key)}`;

  cell.dataset.issueKey = data.key;
  cell.innerHTML = `${badge}<a class="issue-ref" href="${url}" target="_blank" rel="noopener noreferrer">${data.key}</a>`;

  if (data.issueType) {
    cell.dataset.issueType = String(data.issueType);
  }
}

/**
 * Ripristina link issue persistiti dopo reload pagina Avanzamento.
 * @returns {Promise<void>}
 */
async function restorePersistedFindingIssues() {
  const rows = document.querySelectorAll("tr[data-finding-id]");

  if (rows.length === 0) {
    return;
  }

  const res = await fetch("/api/docs/advancement/finding-issues");

  if (!res.ok) {
    return;
  }

  const data  = await res.json().catch(() => ({}));
  const links = data.links && typeof data.links === "object" ? data.links : {};

  for (const row of rows) {
    if (!(row instanceof HTMLElement)) {
      continue;
    }

    const findingId = row.dataset.findingId ?? "";
    const link      = links[findingId];

    if (!link?.key) {
      continue;
    }

    const cell = row.querySelector("td.issue-refinement");

    if (!(cell instanceof HTMLElement)) {
      continue;
    }

    if (cell.querySelector("a.issue-ref")) {
      continue;
    }

    const btn = cell.querySelector(".issue-ref-create");

    if (btn instanceof HTMLButtonElement) {
      paintCreatedIssueCell(btn, { key: link.key, issueType: link.issueType });
    }
  }
}

// 4. Crea issue Jira da finding Avanzamento (colonna Issue refinement)
document.addEventListener("click", (ev) => {
  const target = ev.target;

  if (!(target instanceof Element)) {
    return;
  }

  const confirmBtn = target.closest(".issue-ref-create-confirm");

  if (confirmBtn instanceof HTMLButtonElement) {
    const wrap = confirmBtn.closest(".issue-ref-create-wrap");
    const btn  = wrap?.querySelector(".issue-ref-create");
    const sel  = wrap?.querySelector(".issue-ref-create-type");

    if (!(btn instanceof HTMLButtonElement) || !(sel instanceof HTMLSelectElement)) {
      return;
    }

    ev.preventDefault();
    ev.stopPropagation();

    void (async () => {
      btn.disabled = true;
      confirmBtn.disabled = true;
      setStatus("Creazione issue Jira…");

      let paths = [];

      try {
        paths = JSON.parse(btn.dataset.paths ?? "[]");
      } catch {
        paths = [];
      }

      try {
        const res = await fetch("/api/docs/advancement/create-issue", {
          method  : "POST"
        , headers : { "Content-Type": "application/json" }
        , body    : JSON.stringify({
            findingId   : btn.dataset.findingId
          , project     : btn.dataset.project
          , issueType   : sel.value || "BUG"
          , sectionLabel: btn.dataset.sectionLabel
          , category    : btn.dataset.category || undefined
          , summary     : btn.dataset.summary
          , detail      : btn.dataset.detail
          , paths
          })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error ?? `create-issue ${res.status}`);
        }

        closeIssueCreateMenus(wrap ?? undefined);
        paintCreatedIssueCell(btn, data);
        setStatus(`Creato ${data.key} — veve applicato`, "ok");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStatus(message, "err");
        btn.disabled = false;
        confirmBtn.disabled = false;
      }
    })();

    return;
  }

  const btn = target.closest(".issue-ref-create");

  if (btn instanceof HTMLButtonElement) {
    ev.preventDefault();
    ev.stopPropagation();

    const wrap = btn.closest(".issue-ref-create-wrap");
    const menu = wrap?.querySelector(".issue-ref-create-menu");

    if (!(menu instanceof HTMLElement)) {
      return;
    }

    const willOpen = menu.hidden;
    closeIssueCreateMenus();

    if (willOpen) {
      menu.hidden = false;
    }

    return;
  }

  if (!target.closest(".issue-ref-create-wrap")) {
    closeIssueCreateMenus();
  }
});
