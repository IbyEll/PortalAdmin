/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** PAGE SCRIPT ** -- commentato il: 2026-06-23 21:30
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:30   by: IbyEll
 * modificato il: 2026-06-23 21:30   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Companion portal.home.html — grid overlay, prepare e console diagnostica.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - HOME è shell statica; fetch istanza, prepare e kill processi node vivono in questo script.
 *
 *   A cosa serve:
 *   - Render griglia PROJECT_*, polling prepare, apertura cruscotto e console log HOME.
 *
 * Generalizzazione:
 *   Si — overlay da API; homePort e serverMode da bootstrap server.
 *
 * Input:
 *   - GET /api/portal/projects, POST /api/portal/instance — lista e attivazione overlay
 *   - GET /api/portal/prepare/status — polling stato prepare
 *
 * Pagina HTML:
 *   - admin.portal/portal.home.html — servita su / da portal.home.server.mjs
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

const grid           = document.getElementById("project-grid");
const instanceStatus = document.getElementById("instance-status");
const prepareMessage = document.getElementById("prepare-message");
const prepareLog     = document.getElementById("prepare-log");
const btnOpen        = document.getElementById("btn-open-cruscotto");
const btnReloadHint  = document.getElementById("btn-reload-hint");
const reloadNote     = document.getElementById("reload-note");
const linkCruscotto  = document.getElementById("link-cruscotto");
const btnListNode    = document.getElementById("btn-list-node-procs");
const btnClearConsole = document.getElementById("btn-clear-console");
const btnKillNodePid = document.getElementById("btn-kill-node-pid");
const btnKillNodeAll = document.getElementById("btn-kill-node-all");
const inputKillPid   = document.getElementById("node-kill-pid");
const consolePanel   = document.getElementById("console-panel");
const pageTitle      = document.getElementById("portal-page-title");
const viewProgetti   = document.getElementById("view-progetti");
const viewDocumenti  = document.getElementById("view-documenti");

const PORTAL_VIEWS = ["progetti", "documenti"];
const DEFAULT_PORTAL_VIEW = "progetti";

const CONSOLE_IDLE = "In attesa — scegli un progetto e premi Istanzia.";

/** @type {"home-only" | "dashboard" | null} */
let serverMode = null;

/** @type {number} */
let homePort = 3990;

/** @type {string | null} */
let focusedOverlay = null;

/** @type {ReturnType<typeof setInterval> | null} */
let pollTimer = null;

/** Ultime righe azioni UI (Avvia/Kill/Apri) — visibili in #prepare-log */
/** @type {string[]} */
let uiConsoleLines = [];

/** Tail log prepare (Istanzia) — aggiornato da updatePreparePanel */
let lastPrepareLogTail = "";

/** Tail log avvio cruscotto — aggiornato da poll durante Apri/Avvia */
let lastCruscottoLogTail = "";

/** Tail elenco processi Node — aggiornato da listNodeProcesses */
let lastNodeProcsLogTail = "";

/** Ultimi pid restituiti da /api/portal/node-processes */
/** @type {number[]} */
let lastNodeProcPids = [];

/** Classe tema card per overlay (gradiente bordo come layout legacy). */
const OVERLAY_THEME_CLASS = {
  JustLastOne    : "theme-jlo"
, AdminDashBoard : "theme-admin"
};

function refreshConsoleDisplay() {
  /** @type {string[]} */
  const parts = [];

  if (uiConsoleLines.length > 0) {
    parts.push("--- azioni HOME (click bottoni) ---", uiConsoleLines.join("\n"));
  }

  if (lastPrepareLogTail) {
    parts.push("--- prepare (Istanzia) ---", lastPrepareLogTail);
  }

  if (lastCruscottoLogTail) {
    parts.push("--- cruscotto (avvio) ---", lastCruscottoLogTail);
  }

  if (lastNodeProcsLogTail) {
    parts.push("--- processi Node (product + PortalAdmin) ---", lastNodeProcsLogTail);
  }

  prepareLog.textContent = parts.join("\n\n");

  if (prepareLog.textContent) {
    prepareLog.scrollTop = prepareLog.scrollHeight;
  }
}

function clearConsole() {
  uiConsoleLines         = [];
  lastPrepareLogTail     = "";
  lastCruscottoLogTail   = "";
  lastNodeProcsLogTail   = "";
  prepareLog.textContent = "";
}

/**
 * @param {boolean} hasProcesses
 */
function updateNodeKillButtons(hasProcesses) {
  if (btnKillNodeAll) {
    btnKillNodeAll.disabled = !hasProcesses;
  }

  if (btnKillNodePid && inputKillPid) {
    const pid = Number(inputKillPid.value);
    btnKillNodePid.disabled = !Number.isInteger(pid) || pid <= 0;
  }
}

/**
 * @param {string} message
 */
function appendUiConsole(message) {
  const ts = new Date().toLocaleTimeString("it-IT", {
    hour   : "2-digit"
  , minute : "2-digit"
  , second : "2-digit"
  });

  uiConsoleLines.push(`[${ts}] ${message}`);

  if (uiConsoleLines.length > 100) {
    uiConsoleLines = uiConsoleLines.slice(-100);
  }

  refreshConsoleDisplay();
}

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
 * @param {Record<string, Record<string, unknown>>} instanceMap
 */
function updateConsoleToolbar(instanceMap) {
  const inst           = focusedOverlay ? instanceMap[focusedOverlay] : null;
  const isInstantiated = Boolean(inst);
  const prepared       = inst?.prepare?.status === "done";
  const themeClass     = focusedOverlay
    ? (OVERLAY_THEME_CLASS[focusedOverlay] ?? "theme-default")
    : null;

  if (btnOpen) {
    btnOpen.disabled = !isInstantiated || !prepared;
  }

  if (consolePanel) {
    consolePanel.classList.toggle("illuminated", isInstantiated);
    consolePanel.classList.remove("theme-jlo", "theme-admin", "theme-default");

    if (isInstantiated && themeClass) {
      consolePanel.classList.add(themeClass);
    }
  }
}

/**
 * @param {Array<Record<string, unknown>>} projects
 * @param {Record<string, Record<string, unknown>>} instanceMap
 */
function renderProjects(projects, instanceMap) {
  grid.innerHTML = "";

  for (const project of projects) {
    const overlay        = String(project.overlay);
    const instance       = findInstance(instanceMap, overlay);
    const isInstantiated = Boolean(instance);
    const card           = document.createElement("article");
    const prepared       = instance?.prepare?.status === "done";
    const running        = Boolean(project.cruscottoRunning);
    const port           = Number(project.dashboardPort ?? instance?.dashboardPort ?? 3999);
    const themeClass     = OVERLAY_THEME_CLASS[overlay] ?? "theme-default";

    card.className = [
      "project-card"
    , themeClass
    , isInstantiated ? "instantiated" : ""
    , focusedOverlay === overlay ? "active" : ""
    , running ? "running" : ""
    ].filter(Boolean).join(" ");

    const ready = Boolean(project.ready);

    card.innerHTML = `
      <div class="project-card-badges">
        <span class="badge">${project.prjJiraPrefix}</span>
        <span class="badge port">:${port}</span>
        ${isInstantiated ? '<span class="badge ok">istanziato</span>' : ""}
        ${running ? '<span class="badge ok">attivo</span>' : ""}
        ${!ready ? '<span class="badge warn">incompleto</span>' : ""}
      </div>
      <h3>${project.prjName}</h3>
      <p class="muted project-card-meta"><code>PROJECT_${project.overlay}</code> · <code>../${project.prjRepo}</code></p>
      ${project.missing?.length
        ? `<p class="project-card-missing">Manca: ${project.missing.join(", ")}</p>`
        : ""}
      <div class="project-card-actions">
        <button type="button" class="btn-secondary" data-action="instantiate" data-overlay="${overlay}" ${ready && !isInstantiated ? "" : "disabled"}>
          Istanzia
        </button>
        <button type="button" class="btn-danger" data-action="kill" data-overlay="${overlay}" data-port="${port}" ${isInstantiated ? "" : "disabled"}>
          Kill
        </button>
        <button type="button" class="btn-primary" data-action="open" data-overlay="${overlay}" data-port="${port}" ${isInstantiated && prepared ? "" : "disabled"}>
          Apri cruscotto
        </button>
      </div>
    `;

    card.querySelector('[data-action="instantiate"]')?.addEventListener("click", () => {
      instantiate(overlay);
    });

    card.querySelector('[data-action="kill"]')?.addEventListener("click", () => {
      killCruscotto(overlay, port);
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
    lastPrepareLogTail         = "";
    refreshConsoleDisplay();
    btnOpen.disabled           = true;
    btnReloadHint.hidden       = true;
    reloadNote.hidden          = true;
    return;
  }

  prepareMessage.textContent = labels[prepare.status] || String(prepare.status);
  lastPrepareLogTail         = String(prepare.logTail || "");
  refreshConsoleDisplay();

  btnOpen.disabled     = prepare.status !== "done" || !focusedOverlay;
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
  lastPrepareLogTail         = "";
  appendUiConsole(`click Istanzia — overlay=${overlay}`);
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
    const msg = err instanceof Error ? err.message : String(err);
    appendUiConsole(`errore Istanzia: ${msg}`);
    prepareMessage.textContent = msg;
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
  updateConsoleToolbar(instanceMap);

  if (focusedOverlay && instanceMap[focusedOverlay]?.prepare) {
    const inst = instanceMap[focusedOverlay];
    updatePreparePanel(
      inst.prepare
    , Boolean(inst.reloadRequired)
    , Number(inst.dashboardPort)
    );
    applyDashboardLogTail(inst.dashboard);
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} dashboard
 */
function applyDashboardLogTail(dashboard) {
  if (!dashboard || typeof dashboard !== "object") {
    return;
  }

  const tail = String(dashboard.logTail ?? "").trim();

  if (tail) {
    lastCruscottoLogTail = tail;
    refreshConsoleDisplay();
  }
}

/**
 * @param {string} overlay
 */
async function refreshDashboardLog(overlay) {
  try {
    const data = await api(`/api/portal/instance?overlay=${encodeURIComponent(overlay)}`);
    applyDashboardLogTail(data.instance?.dashboard);
  } catch {
    // poll silenzioso
  }
}

/**
 * @param {number} port
 * @param {string} [overlay]
 * @param {number} [maxMs]
 */
async function waitForFullDashboard(port, overlay, maxMs = 120000) {
  const deadline = Date.now() + maxMs;
  const base     = `http://localhost:${port}`;

  while (Date.now() < deadline) {
    if (overlay) {
      await refreshDashboardLog(overlay);
    }

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
async function startCruscotto(overlay, port) {
  focusedOverlay             = overlay;
  prepareMessage.textContent = `Avvio cruscotto ${overlay} su :${port}…`;
  appendUiConsole(`click Avvia — ${overlay} :${port} → POST /api/portal/start-cruscotto`);

  try {
    const result = await api("/api/portal/start-cruscotto", {
      method  : "POST"
    , headers : { "Content-Type": "application/json" }
    , body    : JSON.stringify({ overlay })
    });

    if (result.alreadyRunning) {
      appendUiConsole(`risposta: cruscotto già attivo su :${port}`);
      prepareMessage.textContent = `Cruscotto ${overlay} già attivo su :${port}.`;
      await load();
      return;
    }

    appendUiConsole(`risposta: starting — log cruscotto nella console sotto (pid ${result.pid ?? "—"})`);
    prepareMessage.textContent = `Attendo cruscotto ${overlay} su :${port}…`;

    const up = await waitForFullDashboard(port, overlay);

    if (up) {
      appendUiConsole(`health OK — http://localhost:${port}/api/scripts`);
      prepareMessage.textContent = `Cruscotto ${overlay} avviato su :${port}.`;
      await load();
      return;
    }

    appendUiConsole(`timeout — cruscotto non risponde su :${port}`);
    prepareMessage.textContent = `Timeout — avvia manualmente: DASHBOARD_PORT=${port} PRJ_NAME=${overlay} npm run admin:dashboard`;
    reloadNote.hidden        = false;
    await load();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    appendUiConsole(`errore Avvia: ${msg}`);
    prepareMessage.textContent = msg;
  }
}

/**
 * @param {string} overlay
 * @param {number} port
 */
async function killCruscotto(overlay, port) {
  focusedOverlay             = overlay;
  prepareMessage.textContent = `Kill istanza ${overlay} (:${port})…`;
  appendUiConsole(`click Kill — ${overlay} :${port} → POST /api/portal/kill-cruscotto`);

  try {
    const result = await api("/api/portal/kill-cruscotto", {
      method  : "POST"
    , headers : { "Content-Type": "application/json" }
    , body    : JSON.stringify({ overlay })
    });

    const killed       = Array.isArray(result.killed) ? result.killed.length : 0;
    const failed       = Array.isArray(result.failed) ? result.failed.length : 0;
    const deactivated  = result.deactivated === true;
    appendUiConsole(
      `risposta: deactivated=${deactivated} killed=${killed} failed=${failed} running=${Boolean(result.running)}`
    );

    if (focusedOverlay === overlay) {
      focusedOverlay       = null;
      lastCruscottoLogTail = "";
      updatePreparePanel(null, false);
    }

    prepareMessage.textContent = deactivated
      ? killed > 0
        ? `Istanza ${overlay} rimossa — terminati ${killed} processo/i su :${port}.`
        : `Istanza ${overlay} rimossa.`
      : `Kill :${port} — operazione incompleta.`;

    await load();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    appendUiConsole(`errore Kill: ${msg}`);
    prepareMessage.textContent = msg;
  }
}

/**
 * @param {string} overlay
 * @param {number} port
 */
async function openCruscotto(overlay, port) {
  focusedOverlay             = overlay;
  const targetUrl            = `http://localhost:${port}/app.html#process`;
  appendUiConsole(`click Apri cruscotto — ${overlay} :${port}`);

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
      appendUiConsole(`già attivo — apertura browser ${targetUrl}`);
      window.open(result.url || targetUrl, "_blank", "noopener");
      prepareMessage.textContent = `Cruscotto ${overlay} già attivo su :${port}.`;
      btnOpen.disabled         = false;
      await load();
      return;
    }

    prepareMessage.textContent = `Attendo cruscotto ${overlay} su :${port}…`;

    const up = await waitForFullDashboard(port, overlay);

    if (up) {
      appendUiConsole(`browser → ${result.url || targetUrl}`);
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
    const msg = err instanceof Error ? err.message : String(err);
    appendUiConsole(`errore Apri: ${msg}`);
    prepareMessage.textContent = msg;
    btnOpen.disabled           = false;
  }
}

btnOpen?.addEventListener("click", () => {
  if (!focusedOverlay) {
    prepareMessage.textContent = "Seleziona un progetto e premi Istanzia prima di aprire il cruscotto.";
    return;
  }

  const card = grid.querySelector(`[data-action="open"][data-overlay="${focusedOverlay}"]`);

  if (card?.disabled) {
    prepareMessage.textContent = "Apri cruscotto disponibile solo dopo l'istanziazione e il prepare completato.";
    return;
  }

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
  linkCruscotto.href        = serverMode === "home-only" ? "/" : "/app.html#process";
  linkCruscotto.hidden      = serverMode !== "home-only";
}

btnReloadHint?.addEventListener("click", () => {
  reloadNote.hidden = false;
  reloadNote.scrollIntoView({ behavior: "smooth" });
});

async function listNodeProcesses() {
  prepareMessage.textContent = "Scansione processi node.exe…";
  appendUiConsole("click Processi Node → GET /api/portal/node-processes");

  if (btnListNode) {
    btnListNode.disabled = true;
  }

  try {
    const result = await api("/api/portal/node-processes");
    const text   = typeof result.text === "string" ? result.text : "";
    const count  = Number(result.count ?? 0);

    lastNodeProcsLogTail = text;
    lastNodeProcPids     = Array.isArray(result.processes)
      ? result.processes
        .map((row) => Number(row.pid))
        .filter((pid) => Number.isInteger(pid) && pid > 0)
      : [];

    refreshConsoleDisplay();
    updateNodeKillButtons(lastNodeProcPids.length > 0);

    const markers = Array.isArray(result.markers) ? result.markers.length : 0;
    appendUiConsole(`risposta: ${count} processo/i — marker=${markers}`);
    prepareMessage.textContent = count > 0
      ? `Trovati ${count} processi node — vedi console.`
      : "Nessun processo node trovato per PortalAdmin/product.";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    appendUiConsole(`errore Processi Node: ${msg}`);
    prepareMessage.textContent = msg;
    lastNodeProcsLogTail       = "";
    lastNodeProcPids           = [];
    updateNodeKillButtons(false);
    refreshConsoleDisplay();
  } finally {
    if (btnListNode) {
      btnListNode.disabled = false;
    }
  }
}

/**
 * @param {number} pid
 */
async function killNodeProcess(pid) {
  prepareMessage.textContent = `Kill PID ${pid}…`;
  appendUiConsole(`click Kill PID — ${pid} → POST /api/portal/kill-node-process`);

  if (btnKillNodePid) {
    btnKillNodePid.disabled = true;
  }

  try {
    const result = await api("/api/portal/kill-node-process", {
      method  : "POST"
    , headers : { "Content-Type": "application/json" }
    , body    : JSON.stringify({ pid })
    });

    const killed = Array.isArray(result.killed) ? result.killed.length : 0;
    const failed = Array.isArray(result.failed) ? result.failed.length : 0;
    appendUiConsole(`risposta kill pid: killed=${killed} failed=${failed}`);
    prepareMessage.textContent = killed > 0
      ? `PID ${pid} terminato.`
      : `Kill PID ${pid} — nessun processo terminato.`;

    await listNodeProcesses();
    await load();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    appendUiConsole(`errore Kill PID: ${msg}`);
    prepareMessage.textContent = msg;
  } finally {
    updateNodeKillButtons(lastNodeProcPids.length > 0);
  }
}

async function killAllNodeProcesses() {
  if (lastNodeProcPids.length === 0) {
    prepareMessage.textContent = "Esegui prima Processi Node.";
    return;
  }

  const ok = window.confirm(
    `Terminare tutti i ${lastNodeProcPids.length} processi node elencati (escluso server HOME)?`
  );

  if (!ok) {
    appendUiConsole("Kill tutti — annullato dall'utente");
    return;
  }

  prepareMessage.textContent = "Kill tutti i processi node elencati…";
  appendUiConsole("click Kill tutti → POST /api/portal/kill-node-process { all: true }");

  if (btnKillNodeAll) {
    btnKillNodeAll.disabled = true;
  }

  try {
    const result = await api("/api/portal/kill-node-process", {
      method  : "POST"
    , headers : { "Content-Type": "application/json" }
    , body    : JSON.stringify({ all: true })
    });

    const killed = Array.isArray(result.killed) ? result.killed.length : 0;
    const failed = Array.isArray(result.failed) ? result.failed.length : 0;
    appendUiConsole(`risposta kill all: killed=${killed} failed=${failed}`);
    prepareMessage.textContent = killed > 0
      ? `Kill tutti — terminati ${killed} processo/i.`
      : "Kill tutti — nessun processo terminato.";

    await listNodeProcesses();
    await load();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    appendUiConsole(`errore Kill tutti: ${msg}`);
    prepareMessage.textContent = msg;
  } finally {
    updateNodeKillButtons(lastNodeProcPids.length > 0);
  }
}

btnListNode?.addEventListener("click", () => {
  listNodeProcesses().catch((err) => {
    prepareMessage.textContent = err instanceof Error ? err.message : String(err);
  });
});

btnClearConsole?.addEventListener("click", () => {
  clearConsole();
});

inputKillPid?.addEventListener("input", () => {
  updateNodeKillButtons(lastNodeProcPids.length > 0);
});

btnKillNodePid?.addEventListener("click", () => {
  const pid = Number(inputKillPid?.value);

  if (!Number.isInteger(pid) || pid <= 0) {
    prepareMessage.textContent = "Inserisci un PID valido.";
    return;
  }

  killNodeProcess(pid).catch((err) => {
    prepareMessage.textContent = err instanceof Error ? err.message : String(err);
  });
});

btnKillNodeAll?.addEventListener("click", () => {
  killAllNodeProcesses().catch((err) => {
    prepareMessage.textContent = err instanceof Error ? err.message : String(err);
  });
});

load().catch((err) => {
  instanceStatus.textContent = err instanceof Error ? err.message : String(err);
});

detectServerMode().catch(() => {});

/**
 * @param {"progetti" | "documenti"} view
 */
function setPortalView(view) {
  const id = PORTAL_VIEWS.includes(view) ? view : DEFAULT_PORTAL_VIEW;

  for (const btn of document.querySelectorAll("[data-portal-view]")) {
    const v = btn.getAttribute("data-portal-view");
    btn.classList.toggle("active", v === id);
  }

  viewProgetti?.classList.toggle("hidden", id !== "progetti");
  viewDocumenti?.classList.toggle("hidden", id !== "documenti");

  if (pageTitle) {
    pageTitle.textContent = id === "documenti"
      ? "Documenti"
      : "Selettore progetto";
  }

  if (location.hash.replace("#", "") !== id) {
    history.replaceState(null, "", id === DEFAULT_PORTAL_VIEW ? "/" : `#${id}`);
  }
}

for (const btn of document.querySelectorAll("[data-portal-view]")) {
  btn.addEventListener("click", () => {
    const view = btn.getAttribute("data-portal-view") ?? DEFAULT_PORTAL_VIEW;
    setPortalView(/** @type {"progetti" | "documenti"} */ (view));
  });
}

window.addEventListener("hashchange", () => {
  const hash = location.hash.replace("#", "");
  setPortalView(PORTAL_VIEWS.includes(hash) ? /** @type {"progetti" | "documenti"} */ (hash) : DEFAULT_PORTAL_VIEW);
});

{
  const hash = location.hash.replace("#", "");
  setPortalView(PORTAL_VIEWS.includes(hash) ? /** @type {"progetti" | "documenti"} */ (hash) : DEFAULT_PORTAL_VIEW);
}
