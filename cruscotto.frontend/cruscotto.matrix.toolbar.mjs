/**
 * Toolbar matrice cruscotto — rigenera DB, ricarica pagina, crea issue Jira da finding.
 * Companion di /matrix.html servita da cruscotto.server.mjs.
 */

const reloadBtn     = document.getElementById("matrix-chrome-reload");
const regenerateBtn = document.getElementById("matrix-chrome-regenerate");
const statusEl      = document.getElementById("matrix-chrome-status");

const JIRA_BROWSE_BASE = "https://myfuturejobsearch.atlassian.net/browse";

/**
 * @returns {string}
 */
function currentMatrixKind() {
  const fromBody = document.body.dataset.matrixKind;

  if (fromBody) {
    return fromBody;
  }

  return new URLSearchParams(window.location.search).get("kind") ?? "portal_gap";
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

  if (raw.includes("sub-task") || raw.includes("subtask")) {
    return { slug: "sub", label: "sub" };
  }

  if (raw.includes("todo") || raw.includes("to do")) {
    return { slug: "todo", label: "todo" };
  }

  if (raw.includes("task")) {
    return { slug: "other", label: "task" };
  }

  return { slug: "other", label: "issue" };
}

/**
 * @param {HTMLElement} menu
 */
function resetIssueCreateMenuPosition(menu) {
  menu.classList.remove("is-fixed");
  menu.style.left = "";
  menu.style.top = "";
  menu.style.minWidth = "";
}

/**
 * @param {HTMLElement} menu
 * @param {HTMLButtonElement} btn
 */
function positionIssueCreateMenu(menu, btn) {
  const rect = btn.getBoundingClientRect();

  menu.classList.add("is-fixed");
  menu.style.left = `${Math.max(8, rect.left)}px`;
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.minWidth = `${Math.max(rect.width, 176)}px`;
}

/**
 * @param {HTMLElement | undefined} wrap
 */
function closeIssueCreateMenus(wrap) {
  for (const menu of document.querySelectorAll(".issue-ref-create-menu")) {
    if (menu instanceof HTMLElement) {
      menu.hidden = true;
      resetIssueCreateMenuPosition(menu);
    }
  }
}

/**
 * @param {HTMLButtonElement | HTMLElement} btn
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

  cell.classList.add("issue-refinement--linked");
  cell.dataset.issueKey = data.key;
  cell.innerHTML = `${badge}<a class="issue-ref" href="${url}" target="_blank" rel="noopener noreferrer">${data.key}</a>`;

  if (data.issueType) {
    cell.dataset.issueType = String(data.issueType);
  }
}

/**
 * @returns {Promise<void>}
 */
async function restorePersistedFindingIssues() {
  const rows = document.querySelectorAll("tr[data-finding-id]");

  if (rows.length === 0) {
    return;
  }

  const res = await fetch(`/api/matrix/finding-issues?kind=${encodeURIComponent(currentMatrixKind())}`);

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
      continue;
    }

    paintCreatedIssueCell(cell, { key: link.key, issueType: link.issueType });
  }
}

/**
 * @returns {Promise<void>}
 */
async function runRegenerate() {
  if (!regenerateBtn) {
    return;
  }

  const matrixKind = regenerateBtn.dataset.matrixKind || currentMatrixKind();

  regenerateBtn.disabled = true;

  if (reloadBtn) {
    reloadBtn.disabled = true;
  }

  setStatus(`Rigenerazione ${matrixKind}…`);

  try {
    const res = await fetch("/api/matrix/regenerate", {
      method  : "POST"
    , headers : { "Content-Type": "application/json" }
    , body    : JSON.stringify({ matrixKind, saveHtml: true, fullRender: false })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error ?? `regenerate ${res.status}`);
    }

    setStatus(`Rigenerato — ${data.rowCount ?? "?"} righe`, "ok");
    window.setTimeout(() => window.location.reload(), 600);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setStatus(message, "err");
  } finally {
    regenerateBtn.disabled = false;

    if (reloadBtn) {
      reloadBtn.disabled = false;
    }
  }
}

if (reloadBtn) {
  reloadBtn.addEventListener("click", () => {
    window.location.reload();
  });
}

if (regenerateBtn) {
  regenerateBtn.addEventListener("click", () => {
    void runRegenerate();
  });
}

void restorePersistedFindingIssues().catch(() => {
  // store assente
});

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
        const res = await fetch("/api/matrix/create-issue", {
          method  : "POST"
        , headers : { "Content-Type": "application/json" }
        , body    : JSON.stringify({
            findingId    : btn.dataset.findingId
          , project      : btn.dataset.project
          , issueType    : sel.value || "BUG"
          , sectionLabel : btn.dataset.sectionLabel
          , category     : btn.dataset.category || undefined
          , summary      : btn.dataset.summary
          , detail       : btn.dataset.detail
          , matrixKind   : currentMatrixKind()
          , paths
          })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error ?? `create-issue ${res.status}`);
        }

        closeIssueCreateMenus(wrap ?? undefined);
        paintCreatedIssueCell(btn, data);
        const veveNote = data.veve?.ok
          ? ` · veve DB${Array.isArray(data.veve.createdSubtasks) && data.veve.createdSubtasks.length
            ? ` (+${data.veve.createdSubtasks.filter((row) => row.created).length} subtask)`
            : ""}`
          : data.veve?.error
            ? ` · veve DB fallito: ${data.veve.error}`
            : "";
        setStatus(`Creato ${data.key}${veveNote}`, data.veve?.ok === false ? "err" : "ok");
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
      positionIssueCreateMenu(menu, btn);
    }

    return;
  }

  if (!target.closest(".issue-ref-create-wrap")) {
    closeIssueCreateMenus();
  }
});
