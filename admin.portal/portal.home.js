const grid           = document.getElementById("project-grid");
const instanceStatus = document.getElementById("instance-status");
const prepareMessage = document.getElementById("prepare-message");
const prepareLog     = document.getElementById("prepare-log");
const btnOpen        = document.getElementById("btn-open-cruscotto");
const btnReloadHint  = document.getElementById("btn-reload-hint");
const reloadNote     = document.getElementById("reload-note");
const linkCruscotto  = document.getElementById("link-cruscotto");

const CONSOLE_IDLE = "In attesa — istanzia un progetto dalla colonna destra.";

/** @type {"home-only" | "dashboard" | null} */
let serverMode = null;

/** @type {number} */
let homePort = 3990;

/** @type {string | null} */
let focusedOverlay = null;

/** @type {ReturnType<typeof setInterval> | null} */
let pollTimer = null;

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function api(path, init) {
  const res = await fetch(path, init);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * @param {Record<string, unknown>} instance
 * @returns {Record<string, unknown> | undefined}
 */
function findInstance(instanceMap, overlay) {
  return instanceMap[overlay];
}

/**
 * @param {Array<Record<string, unknown>>} projects
 * @param {Record<string, Record<string, unknown>>} instanceMap
 */
function renderProjects(projects, instanceMap) {
  grid.innerHTML = "";

  for (const project of projects) {
    const overlay  = String(project.overlay);
    const instance = findInstance(instanceMap, overlay);
    const card     = document.createElement("article");
    const prepared = instance?.prepare?.status === "done";
    const running  = Boolean(project.cruscottoRunning);
    const port     = Number(project.dashboardPort ?? instance?.dashboardPort ?? 3999);

    card.className = `project-card${focusedOverlay === overlay ? " active" : ""}${running ? " running" : ""}`;

    const ready = Boolean(project.ready);

    card.innerHTML = `
      <div>
        <span class="badge">${project.prjJiraPrefix}</span>
        <span class="badge port" style="margin-left:0.35rem">:${port}</span>
        ${instance ? '<span class="badge" style="margin-left:0.35rem">istanziato</span>' : ""}
        ${running ? '<span class="badge ok" style="margin-left:0.35rem">cruscotto attivo</span>' : ""}
        ${!ready ? '<span class="badge warn" style="margin-left:0.35rem">incompleto</span>' : ""}
      </div>
      <h3>${project.prjName}</h3>
      <p class="muted">Overlay <code>PROJECT_${project.overlay}</code> · repo <code>../${project.prjRepo}</code></p>
      ${project.missing?.length
        ? `<p class="muted">Manca: ${project.missing.join(", ")}</p>`
        : ""}
      <div class="project-card-actions">
        <button type="button" class="btn-secondary" data-action="instantiate" data-overlay="${overlay}" ${ready ? "" : "disabled"}>
          Istanzia
        </button>
        <button type="button" class="btn-primary" data-action="open" data-overlay="${overlay}" data-port="${port}" ${prepared ? "" : "disabled"}>
          Apri cruscotto
        </button>
      </div>
    `;

    card.querySelector('[data-action="instantiate"]')?.addEventListener("click", () => {
      instantiate(overlay);
    });

    card.querySelector('[data-action="open"]')?.addEventListener("click", () => {
      openCruscotto(overlay, port);
    });

    grid.appendChild(card);
  }
}

/**
 * @param {Record<string, Record<string, unknown>>} instanceMap
 */
function updateInstanceStatus(instanceMap) {
  const keys = Object.keys(instanceMap);

  if (keys.length === 0) {
    instanceStatus.textContent = "Nessuna istanza — scegli un progetto e premi Istanzia.";
    linkCruscotto.hidden = true;
    return;
  }

  const lines = keys.map((overlay) => {
    const row  = instanceMap[overlay];
    const port = row.dashboardPort ?? "?";
    const st   = row.prepare?.status ?? "idle";

    return `${row.prjName} (:${port}, ${st})`;
  });

  instanceStatus.textContent = `Istanze: ${lines.join(" · ")}`;
  linkCruscotto.hidden = false;
}

/**
 * @param {Record<string, unknown> | null} prepare
 * @param {boolean} reloadRequired
 * @param {number} [port]
 */
function updatePreparePanel(prepare, reloadRequired, port) {
  const labels = {
    running : "Prepare in corso…"
  , done    : "Prepare completato — puoi aprire il cruscotto sulla porta dedicata."
  , error   : "Prepare fallito — vedi log."
  };

  if (!prepare || prepare.status === "idle") {
    prepareMessage.textContent = CONSOLE_IDLE;
    prepareLog.textContent     = "";
    btnOpen.disabled           = true;
    btnReloadHint.hidden       = true;
    reloadNote.hidden          = true;
    return;
  }

  prepareMessage.textContent = labels[prepare.status] || String(prepare.status);
  prepareLog.textContent     = String(prepare.logTail || "");

  if (prepareLog.textContent) {
    prepareLog.scrollTop = prepareLog.scrollHeight;
  }

  btnOpen.disabled     = prepare.status !== "done";
  btnReloadHint.hidden = !reloadRequired;
  reloadNote.hidden    = !reloadRequired;

  if (prepare.status === "running" && !pollTimer) {
    pollTimer = setInterval(refreshPrepare, 1500);
  }

  if (prepare.status !== "running" && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  if (port && prepare.status === "done") {
    reloadNote.hidden      = false;
    reloadNote.textContent = `Cruscotto su http://localhost:${port}/app.html — la HOME resta su :${homePort}.`;
  }
}

async function refreshPrepare() {
  if (!focusedOverlay) {
    return;
  }

  const data = await api(`/api/portal/instance?overlay=${encodeURIComponent(focusedOverlay)}`);
  const inst = data.instance;

  updatePreparePanel(inst?.prepare ?? null, Boolean(inst?.reloadRequired), Number(inst?.dashboardPort));
  await load();
}

/**
 * @param {string} overlay
 */
async function instantiate(overlay) {
  focusedOverlay             = overlay;
  prepareMessage.textContent = `Avvio istanziazione ${overlay}…`;
  prepareLog.textContent     = "";
  btnOpen.disabled           = true;

  try {
    const state = await api("/api/portal/instance", {
      method  : "POST"
    , headers : { "Content-Type": "application/json" }
    , body    : JSON.stringify({ overlay })
    });

    updatePreparePanel(state.prepare, Boolean(state.reloadRequired), Number(state.dashboardPort));
    await load();
  } catch (err) {
    prepareMessage.textContent = err instanceof Error ? err.message : String(err);
  }
}

/**
 * @param {Array<Record<string, unknown>>} instances
 * @returns {Record<string, Record<string, unknown>>}
 */
function indexInstances(instances) {
  /** @type {Record<string, Record<string, unknown>>} */
  const map = {};

  for (const row of instances) {
    if (row?.overlay) {
      map[String(row.overlay)] = row;
    }
  }

  return map;
}

async function load() {
  const [projects, instanceCtx] = await Promise.all([
    api("/api/portal/projects")
  , api("/api/portal/instance")
  ]);

  const instanceMap = indexInstances(instanceCtx.instances ?? []);

  if (!focusedOverlay && instanceCtx.instance?.overlay) {
    focusedOverlay = String(instanceCtx.instance.overlay);
  }

  renderProjects(projects.projects, instanceMap);
  updateInstanceStatus(instanceMap);

  if (focusedOverlay && instanceMap[focusedOverlay]?.prepare) {
    const inst = instanceMap[focusedOverlay];
    updatePreparePanel(
      inst.prepare
    , Boolean(inst.reloadRequired)
    , Number(inst.dashboardPort)
    );
  }
}

/**
 * @param {number} port
 * @param {number} maxMs
 */
async function waitForFullDashboard(port, maxMs = 120000) {
  const deadline = Date.now() + maxMs;
  const base     = `http://localhost:${port}`;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/scripts`, { signal: AbortSignal.timeout(3000) });

      if (res.ok) {
        return true;
      }
    } catch {
      // dashboard non ancora pronto
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
  }

  return false;
}

/**
 * @param {string} overlay
 * @param {number} port
 */
async function openCruscotto(overlay, port) {
  focusedOverlay             = overlay;
  const targetUrl            = `http://localhost:${port}/app.html#overview`;

  if (serverMode !== "home-only") {
    window.location.href = targetUrl;
    return;
  }

  btnOpen.disabled           = true;
  prepareMessage.textContent = `Avvio cruscotto ${overlay} su :${port}…`;

  try {
    const result = await api("/api/portal/open-cruscotto", {
      method  : "POST"
    , headers : { "Content-Type": "application/json" }
    , body    : JSON.stringify({ overlay })
    });

    if (result.alreadyRunning) {
      window.open(result.url || targetUrl, "_blank", "noopener");
      prepareMessage.textContent = `Cruscotto ${overlay} già attivo su :${port}.`;
      btnOpen.disabled         = false;
      await load();
      return;
    }

    prepareMessage.textContent = `Attendo cruscotto ${overlay} su :${port}…`;

    const up = await waitForFullDashboard(port);

    if (up) {
      window.open(result.url || targetUrl, "_blank", "noopener");
      prepareMessage.textContent = `Cruscotto ${overlay} pronto su :${port}.`;
      await load();
      return;
    }

    prepareMessage.textContent = `Timeout — avvia manualmente: DASHBOARD_PORT=${port} PRJ_NAME=${overlay} npm run admin:dashboard`;
    reloadNote.hidden        = false;
    reloadNote.textContent   = `Porta dedicata :${port} per ${overlay}.`;
    btnOpen.disabled         = false;
  } catch (err) {
    prepareMessage.textContent = err instanceof Error ? err.message : String(err);
    btnOpen.disabled           = false;
  }
}

btnOpen.addEventListener("click", () => {
  if (!focusedOverlay) {
    prepareMessage.textContent = "Seleziona un progetto (Istanzia) prima di aprire il cruscotto.";
    return;
  }

  const card = grid.querySelector(`[data-action="open"][data-overlay="${focusedOverlay}"]`);
  const port = Number(card?.getAttribute("data-port") ?? 3999);

  openCruscotto(focusedOverlay, port).catch((err) => {
    prepareMessage.textContent = err instanceof Error ? err.message : String(err);
  });
});

async function detectServerMode() {
  try {
    const health = await api("/api/health");
    serverMode   = health.mode === "home-only" ? "home-only" : "dashboard";

    if (typeof health.port === "number") {
      homePort = health.port;
    }
  } catch {
    serverMode = null;
  }

  linkCruscotto.textContent = serverMode === "home-only"
    ? "HOME progetto"
    : "Apri cruscotto attivo →";
  linkCruscotto.href        = serverMode === "home-only" ? "/" : "/app.html#overview";
  linkCruscotto.hidden      = serverMode !== "home-only";
}

btnReloadHint.addEventListener("click", () => {
  reloadNote.hidden = false;
  reloadNote.scrollIntoView({ behavior: "smooth" });
});

load().catch((err) => {
  instanceStatus.textContent = err instanceof Error ? err.message : String(err);
});

detectServerMode().catch(() => {});
