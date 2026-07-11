/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** PAGE SCRIPT ** -- commentato il: 2026-06-19 00:51
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-17   by: IbyEll
 * modificato il: 2026-06-19 00:51   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *        Cruscotto Dev — companion cruscotto.home.html (SPA sidebar, hash routing, overlay PROJECT_*).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Interfaccia unica per sviluppo locale PortalAdmin + product repo (JustLastOne, AdminDashBoard, …).
 *   - Evita shell manuali per test, servizi, backlog Jira, stack dev e agent Cursor.
 *
 *   A cosa serve:
 *   - Tab Overview, Requisiti, Servizi, testScript (custom/tecnici/funzionali), Summary, Process, Cursor.
 *   - Tab Process: discovery stack, avvio/kill servizi, console log, DB dev, export report.
 *   - Iframe Jira (working, project tree, backlog, my-project, pillar matrix).
 *   - Run test singolo/suite/all e export report via API cruscotto.server.
 *
 * Generalizzazione:
 *   Si — label, prefisso Jira, path DB, porte e catalogo test da window.CRUSCOTTO_PROJECT (overlay PROJECT_*).
 *
 * Input:
 *   - window.CRUSCOTTO_PROJECT / __CRUSCOTTO_PROJECT__ — config progetto da bootstrap/server
 *   - location.hash — tab attiva (#overview … #process, #cursor)
 *   - risposte API same-origin — payload /api/* usati dal render tab e iframe
 *
 * Pagina HTML:
 *   - cruscotto.frontend/cruscotto.home.html — route / e /app.html
 *
 * Servito da:
 *   - cruscotto.frontend/cruscotto.server.mjs — alias statico /cruscotto.js
 *
 * Asset correlati:
 *   - cruscotto.project.bootstrap.js — window.CRUSCOTTO_PROJECT
 *   - expand-collapse-ui.js — window.JloExpandCollapseUi per toolbar alberi
 *
 * API (fetch same-origin):
 *   - GET  /api/dev/requirements, /api/dev/services — tab Requisiti e Servizi
 *   - GET  /api/scripts, /api/report, /api/status — catalogo e ultimo run test
 *   - POST /api/run*, /api/report/tecnici-analysis — esecuzione testScript
 *   - GET|POST /api/repo/services/*, /api/repo/database/* — tab Process
 *   - GET  /api/jira/*, /api/my-project/analyze, /api/cursor/* — backlog Jira e Cursor agent
 *
 * Dipendenze runtime:
 *   - window.CRUSCOTTO_PROJECT — repoName, jiraPrefix, dashboardPort, dbFilename, friendbotLabel
 *   - elementi #section-* e .sidebar-nav [data-tab] — shell tab da cruscotto.home.html
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

/** @returns {Record<string, unknown>} */
function getCruscottoProject() {
  const w = /** @type {Window & { CRUSCOTTO_PROJECT?: Record<string, unknown>, __CRUSCOTTO_PROJECT__?: Record<string, unknown> }} */ (window);

  return w.CRUSCOTTO_PROJECT ?? w.__CRUSCOTTO_PROJECT__ ?? {};
}

/**
 * Footer Avvia product / stack completo / Kill All — solo stack Nest (web, api, auth).
 *
 * @returns {boolean}
 */
function processShowBulkStackFooter() {
  const ids = new Set(cruscottoStackStartServiceIds());

  return ids.has("web") || ids.has("api") || ids.has("auth");
}

/**
 * @param {Record<string, unknown>} [project]
 */
function applySidebarProjectBrand(project) {
  const payload = project ?? getCruscottoProject();
  const w       = /** @type {Window & { CRUSCOTTO_PROJECT?: Record<string, unknown> }} */ (window);

  if (project) {
    w.CRUSCOTTO_PROJECT = payload;
  }

  const title = String(
    /** @type {Record<string, string> | undefined} */ (payload.titles)?.cruscotto
    ?? (() => {
      const name = String(payload.projectDisplayName ?? payload.repoName ?? payload.overlayName ?? "").trim();
      return name ? `Cruscotto ${name}` : "Cruscotto";
    })()
  );
  const local = String(
    /** @type {Record<string, string> | undefined} */ (payload.titles)?.sidebarLocal
    ?? (() => {
      const name = String(payload.projectDisplayName ?? payload.repoName ?? "").trim();
      return name ? `${name} local` : "local";
    })()
  );
  const brand   = document.querySelector(".sidebar-brand strong");
  const localEl = document.querySelector(".sidebar-brand > span.muted");

  if (brand) {
    brand.textContent = title;
  }

  if (localEl) {
    localEl.textContent = local;
  }

  if (/^Cruscotto(\s|$)/i.test(document.title) || document.title === "Cruscotto Dev") {
    document.title = title;
  }
}

function initSidebarBrand() {
  applySidebarProjectBrand();

  document.addEventListener("cruscotto:project-ready", (event) => {
    const detail = /** @type {CustomEvent<Record<string, unknown>>} */ (event).detail;

    if (detail && typeof detail === "object") {
      applySidebarProjectBrand(detail);
    }
  });

  const project = getCruscottoProject();

  if (!project.projectDisplayName && !project.repoName) {
    fetch("/api/cruscotto/project")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((payload) => applySidebarProjectBrand(/** @type {Record<string, unknown>} */ (payload)))
      .catch(() => {
        // bootstrap/API assenti — resta placeholder HTML
      });
  }
}

/** @returns {string} */
function cruscottoJiraPrefix() {
  return String(getCruscottoProject().jiraPrefix ?? "").trim();
}

/** @returns {string} */
function cruscottoRepoName() {
  const project = getCruscottoProject();

  return String(project.repoName ?? project.repoFolder ?? "Product");
}

/** @returns {boolean} */
function cruscottoHasProductDatabase() {
  return getCruscottoProject().hasProductDatabase === true;
}

/** @returns {string[]} */
function cruscottoStackStartServiceIds() {
  const ids = getCruscottoProject().stackStartServiceIds;

  if (Array.isArray(ids) && ids.length > 0) {
    return ids.map((id) => String(id));
  }

  return ["web", "api", "auth"];
}

/** @returns {string} */
function cruscottoDbFilename() {
  if (!cruscottoHasProductDatabase()) {
    return "";
  }

  return String(getCruscottoProject().dbFilename ?? "dev.db");
}

/** @returns {string} */
function cruscottoDefaultProductSibling() {
  const project = getCruscottoProject();

  return String(project.defaultProductRepoSibling ?? `../${project.repoFolder ?? "Product"}`);
}

/** @returns {string} */
function cruscottoFriendbotLabel() {
  return String(getCruscottoProject().friendbotLabel ?? `friendBOT ${cruscottoJiraPrefix()}`);
}

/** @returns {number} */
function cruscottoDashboardPort() {
  const port = Number(getCruscottoProject().dashboardPort);

  return Number.isFinite(port) && port > 0 ? port : 3999;
}

/** @returns {string} */
function cruscottoStackStartScriptRel() {
  return String(
    getCruscottoProject().stackStartScriptRel
    ?? "cruscotto.frontend/cruscotto.process.start.all.services.mjs"
  );
}

/**
 * @param {Array<Record<string, unknown>>} services
 * @param {string} id
 * @returns {string}
 */
function processServiceLabel(services, id) {
  const row = services.find((svc) => String(svc.id ?? "") === id);

  return row ? String(row.label ?? id) : id;
}

/**
 * @param {Array<Record<string, unknown>>} services
 * @param {string[]} ids
 * @returns {string}
 */
function formatProcessServiceList(services, ids) {
  return ids.map((id) => processServiceLabel(services, id)).join(", ");
}

/**
 * @param {Array<Record<string, unknown>>} services
 */
function buildProcessStackFooterModel(services) {
  const coreIds        = cruscottoStackStartServiceIds();
  const dashboardPort  = cruscottoDashboardPort();
  const friendbotLabel = cruscottoFriendbotLabel();
  const coreSet        = new Set(coreIds);

  const extraIds = services
    .map((svc) => String(svc.id ?? ""))
    .filter((id) => id && id !== "dashboard" && !coreSet.has(id));

  const fullPollIds = [...new Set([...coreIds, ...extraIds])];

  const killPorts = services
    .filter((svc) => {
      const id = String(svc.id ?? "");

      return id !== "dashboard" && typeof svc.port === "number" && svc.port > 0;
    })
    .map((svc) => Number(svc.port))
    .sort((a, b) => a - b);

  const coreList  = formatProcessServiceList(services, coreIds);
  const extraList = formatProcessServiceList(services, extraIds);

  const coreButton = `Avvia product (${coreList})`;
  const fullButton = extraIds.length
    ? `Avvia stack completo (+ ${extraList})`
    : `Avvia stack completo (${coreList})`;

  /** @type {string[]} */
  const killParts = [];

  if (killPorts.length) {
    killParts.push(`libera porte ${killPorts.join(", ")}`);
  }

  if (extraIds.includes("friendbot")) {
    killParts.push(`termina ${friendbotLabel}`);
  }

  const killHint = killParts.length
    ? `Kill All: ${killParts.join(" · ")} — output nella console. Il cruscotto :${dashboardPort} resta attivo.`
    : `Kill All — output nella console. Il cruscotto :${dashboardPort} resta attivo.`;

  const killConfirmMessage = [
    `Terminare i servizi dev (${formatProcessServiceList(services, fullPollIds)})?`
  , ""
  , `Il cruscotto su :${dashboardPort} resta attivo. L'output sarà mostrato nella console.`
  ].join("\n");

  const stackScript = cruscottoStackStartScriptRel();

  return {
    coreIds
  , extraIds
  , fullPollIds
  , coreButton
  , fullButton
  , killHint
  , killConfirmMessage
  , stopBtnTitle : `Termina ${fullPollIds.join(", ")} — non il cruscotto :${dashboardPort}`
  , cliCommand   : `node ${stackScript}`
  };
}

// --- router — tab, hash e meta pagina ---
const TABS = ["requisiti", "servizi", "test", "testtecnici", "testfunzionali", "jiraproject", "backlog", "mybacklog", "workingplan", "issue", "projectoverview", "matrix", "matrixcoverage", "pillarmatrix", "process", "cursor"];
const DEFAULT_TAB = "requisiti";

/** Hash legacy — tab rimosse, reindirizza alla default. */
const LEGACY_TAB_ALIASES = {
  overview  : "requisiti"
, summary   : "requisiti"
, myproject : "projectoverview"
};

/**
 * @returns {{ tab: string, payload: string | null }}
 */
function parseLocationHash() {
  let raw = location.hash.replace("#", "");

  if (raw === "utility") {
    raw = "process";
  }

  const colon = raw.indexOf(":");

  if (colon > 0) {
    const tabRaw = raw.slice(0, colon);
    const tab    = LEGACY_TAB_ALIASES[tabRaw] ?? tabRaw;

    return {
      tab
    , payload: raw.slice(colon + 1).trim() || null
    };
  }

  return {
    tab    : LEGACY_TAB_ALIASES[raw] ?? raw
  , payload: null
  };
}

/**
 * Apre issue nell'iframe Issue — numero o key completa.
 *
 * @param {string} issueRef
 */
function navigateIssueTab(issueRef) {
  const iframe = document.querySelector("#section-issue iframe");

  if (!iframe || !issueRef) {
    return;
  }

  const prefix = cruscottoJiraPrefix() || "ADMIN";
  const key    = /^\d+$/.test(issueRef)
    ? `${prefix}-${issueRef}`
    : String(issueRef).trim().toUpperCase();

  iframe.src = `/issue.html?key=${encodeURIComponent(key)}&source=db`;
}

// --- tab Process — console log stack dev e dialogo conferma ---
/** Polling console Process — log stack dev. */
/** @type {number | null} */
let processConsolePollTimer = null;

/** @type {number | null} */
let cursorAgentPollTimer = null;

/** @type {number} */
let cursorAgentLogCursor = 0;

/** Seq già renderizzate — evita duplicati se poll concorrenti. */
/** @type {Set<number>} */
let cursorAgentLogSeenSeq = new Set();

/** Guard poll log agent — una richiesta in flight alla volta. */
let cursorAgentLogPollInFlight = false;

/** Filtro livello log Cursor Agent (ADMIN-164). */
let cursorAgentLogLevelFilter = "all";

/** @type {number} */
let processLogCursor = 0;

/** Filtro livello log Process (ADMIN-164). */
let processLogLevelFilter = "all";

/** Filtro sorgente log unificato (ADMIN-164). */
let processLogSourceFilter = "process";

/** @type {number} */
let runLogCursor = 0;

/** Tab console process attiva. */
let processConsoleActiveTab = "all";

/** @type {Array<{ id: string, label: string }>} */
let processConsoleTabs = [{ id: "all", label: "Tutti" }];

/** @type {Set<string>} */
let processConsoleKnownServiceIds = new Set();

/** @type {Map<string, number>} */
let processConsoleServicePorts = new Map();

function initProcessConsoleTabsFallback() {
  /** @type {Array<{ id: string, label: string }>} */
  const tabs = [{ id: "all", label: "Tutti" }];

  if (cruscottoHasProductDatabase()) {
    tabs.push({ id: "database", label: "Database" });
  }

  processConsoleTabs            = tabs;
  processConsoleKnownServiceIds = new Set(tabs.map((tab) => tab.id).filter((id) => id !== "all"));
  processConsoleServicePorts    = new Map();
  processConsoleActiveTab       = "all";
}

/**
 * @param {Array<Record<string, unknown>>} services
 */
function applyProcessConsoleTabsFromServices(services) {
  /** @type {Array<{ id: string, label: string }>} */
  const tabs = [{ id: "all", label: "Tutti" }];
  /** @type {Set<string>} */
  const knownIds = new Set();
  /** @type {Map<string, number>} */
  const ports = new Map();

  if (cruscottoHasProductDatabase()) {
    tabs.push({ id: "database", label: "Database" });
    knownIds.add("database");
  }

  for (const svc of services) {
    const id = String(svc.id ?? "").trim();

    if (!id || id === "database") {
      continue;
    }

    const label = String(svc.label ?? id);

    if (!tabs.some((tab) => tab.id === id)) {
      tabs.push({ id, label });
    }

    knownIds.add(id);

    const port = Number(svc.port);

    if (Number.isFinite(port) && port > 0) {
      ports.set(id, port);
    }
  }

  processConsoleTabs            = tabs;
  processConsoleKnownServiceIds = knownIds;
  processConsoleServicePorts    = ports;
  refreshProcessConsoleTabsDom();
}

/**
 * @param {string} tabId
 * @returns {boolean}
 */
function processConsoleTabExists(tabId) {
  return processConsoleTabs.some((tab) => tab.id === tabId);
}

/**
 * Aggiorna tab/pannelli console dopo discovery — preserva righe già renderizzate.
 */
function refreshProcessConsoleTabsDom() {
  const panel = document.querySelector(".process-console-panel");
  const tablist = panel?.querySelector("#process-console-tabs");
  const panesHost = panel?.querySelector(".process-console-panes");

  if (!(tablist instanceof HTMLElement) || !(panesHost instanceof HTMLElement)) {
    return;
  }

  tablist.innerHTML = processConsoleTabs.map((tab) => {
    const active = tab.id === processConsoleActiveTab;

    return `<button type="button" role="tab" class="process-console-tab${active ? " is-active" : ""}" data-console-tab="${escapeHtml(tab.id)}" aria-selected="${active ? "true" : "false"}">${escapeHtml(tab.label)}</button>`;
  }).join("");

  for (const tab of processConsoleTabs) {
    let pane = getProcessConsolePane(tab.id);

    if (!(pane instanceof HTMLElement)) {
      pane = document.createElement("div");
      pane.id = `process-console-pane-${tab.id}`;
      pane.className = `process-console-output process-console-pane${tab.id === processConsoleActiveTab ? " is-active" : ""}`;
      pane.setAttribute("role", "tabpanel");
      pane.setAttribute("data-console-pane", tab.id);
      pane.setAttribute("aria-live", "polite");
      pane.setAttribute("aria-relevant", "additions");
      pane.hidden = tab.id !== processConsoleActiveTab;
      panesHost.appendChild(pane);
    }
  }

  for (const pane of [...panesHost.querySelectorAll("[data-console-pane]")]) {
    const id = pane.getAttribute("data-console-pane");

    if (id && !processConsoleTabs.some((tab) => tab.id === id)) {
      pane.remove();
    }
  }

  delete tablist.dataset.bound;

  if (panel instanceof HTMLElement) {
    bindProcessConsoleTabs(panel);
  }

  const activeStill = processConsoleTabExists(processConsoleActiveTab)
    ? processConsoleActiveTab
    : "all";

  setProcessConsoleTab(activeStill);
}

/**
 * @param {string} tabId
 */
function getProcessConsolePane(tabId) {
  return document.getElementById(`process-console-pane-${tabId}`);
}

function clearProcessConsolePanes() {
  for (const tab of processConsoleTabs) {
    const pane = getProcessConsolePane(tab.id);

    if (pane) {
      pane.replaceChildren();
    }
  }
}

/** Svuota solo il pannello del tab console attualmente visibile (i log server restano). */
function clearActiveProcessConsolePane() {
  const pane = getProcessConsolePane(processConsoleActiveTab);

  if (pane instanceof HTMLElement) {
    pane.replaceChildren();
  }
}

/**
 * @param {string} pkg
 * @param {Set<string>} tabs
 */
function mapJloPackageToConsoleTabs(pkg, tabs) {
  const alias = { authentication: "auth" };
  const id    = alias[pkg] ?? pkg;

  if (processConsoleKnownServiceIds.has(id)) {
    tabs.add(id);
  }
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function classifyProcessLogLine(text) {
  const tabs    = new Set(["all"]);
  const trimmed = text.trimStart();
  const knownIds = [...processConsoleKnownServiceIds];

  if (knownIds.length > 0) {
    const escaped = knownIds.map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const prefixMatch = trimmed.match(new RegExp(`^\\[(${escaped})\\]`));

    if (prefixMatch) {
      tabs.add(prefixMatch[1]);

      return [...tabs];
    }
  }

  if (/cruscotto\.process\.start\.all\.services/i.test(text)) {
    if (processConsoleKnownServiceIds.has("dashboard")) {
      tabs.add("dashboard");
    }

    return [...tabs];
  }

  if (/cruscotto\.process\.start\.api\.documentation|serve-api-documentation/i.test(text)) {
    if (processConsoleKnownServiceIds.has("api-documentation")) {
      tabs.add("api-documentation");
    }

    return [...tabs];
  }

  const prefixMatch = trimmed.match(/^\[(turbo-dev)\]/);

  if (prefixMatch) {
    for (const id of cruscottoStackStartServiceIds()) {
      tabs.add(id);
    }

    return [...tabs];
  }

  for (const match of text.matchAll(/@justlastone\/([a-z0-9-]+)/gi)) {
    mapJloPackageToConsoleTabs(match[1].toLowerCase(), tabs);
  }

  for (const [id, port] of processConsoleServicePorts) {
    if (new RegExp(`\\bPorta ${port}\\b|:${port}\\b`).test(text)) {
      tabs.add(id);
    }
  }

  const dashboardPort = cruscottoDashboardPort();

  if (
    processConsoleKnownServiceIds.has("dashboard")
    && new RegExp(`\\bPorta ${dashboardPort}\\b|:${dashboardPort}\\b`).test(text)
  ) {
    tabs.add("dashboard");
  }

  if (/database|db:push|db:seed|db:generate|dev\.db|prisma|delete & create|inizializza|refresh|init_Database_DEV/i.test(text)) {
    tabs.add("database");
  }

  if (processConsoleKnownServiceIds.has("friendbot") && /friendBOT|friend-bot|friendbot/i.test(text)) {
    tabs.add("friendbot");
  }

  if (processConsoleKnownServiceIds.has("api-documentation") && /api-documentation|serve-api-documentation/i.test(text)) {
    tabs.add("api-documentation");
  }

  if (processConsoleKnownServiceIds.has("dashboard") && /\bcruscotto\b|admin:dashboard/i.test(text)) {
    tabs.add("dashboard");
  }

  if (/Kill stack|Kill nest|Kill product|Porte da liberare|turbo run dev/i.test(text)) {
    for (const id of cruscottoStackStartServiceIds()) {
      tabs.add(id);
    }
  }

  if (/Kill All/i.test(text) || text.includes(cruscottoFriendbotLabel())) {
    for (const id of cruscottoStackStartServiceIds()) {
      tabs.add(id);
    }

    if (processConsoleKnownServiceIds.has("api-documentation")) {
      tabs.add("api-documentation");
    }

    if (processConsoleKnownServiceIds.has("friendbot")) {
      tabs.add("friendbot");
    }
  }

  if (/Processi \(.*authentication|@justlastone\/auth|start_API_Auth/i.test(text)) {
    tabs.add("auth");
  }

  if (/Processi \(.*apps\\api|@justlastone\/api[^a-z-]|start_API_Project/i.test(text)) {
    tabs.add("api");
  }

  if (/Processi \(.*apps\\web|@justlastone\/web|start_WEB/i.test(text)) {
    tabs.add("web");
  }

  const startMatch = text.match(/Avvio ([a-z0-9-]+)/i);

  if (startMatch && processConsoleKnownServiceIds.has(startMatch[1].toLowerCase())) {
    tabs.add(startMatch[1].toLowerCase());
  }

  const killMatch = text.match(/Kill (?:servizio )?([a-z0-9-]+)/i);

  if (killMatch && processConsoleKnownServiceIds.has(killMatch[1].toLowerCase())) {
    tabs.add(killMatch[1].toLowerCase());
  }

  return [...tabs];
}

/**
 * @param {string} tabId
 */
function setProcessConsoleTab(tabId) {
  processConsoleActiveTab = tabId;

  for (const tab of processConsoleTabs) {
    const pane = getProcessConsolePane(tab.id);
    const btn  = document.querySelector(`[data-console-tab="${tab.id}"]`);
    const active = tab.id === tabId;

    if (pane instanceof HTMLElement) {
      pane.classList.toggle("is-active", active);
      pane.hidden = !active;
    }

    if (btn instanceof HTMLButtonElement) {
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    }
  }
}

/**
 * @param {HTMLElement} root
 */
function bindProcessConsoleTabs(root) {
  const tablist = root.querySelector("#process-console-tabs");

  if (!(tablist instanceof HTMLElement) || tablist.dataset.bound === "1") {
    return;
  }

  tablist.dataset.bound = "1";

  tablist.addEventListener("click", (ev) => {
    const target = ev.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const btn = target.closest("[data-console-tab]");

    if (!(btn instanceof HTMLButtonElement)) {
      return;
    }

    const tabId = btn.getAttribute("data-console-tab");

    if (tabId) {
      setProcessConsoleTab(tabId);
    }
  });
}

/**
 * @returns {string}
 */
function renderProcessConsoleTabsMarkup() {
  const tabButtons = processConsoleTabs.map((tab) => {
    const active = tab.id === processConsoleActiveTab;

    return `<button type="button" role="tab" class="process-console-tab${active ? " is-active" : ""}" data-console-tab="${escapeHtml(tab.id)}" aria-selected="${active ? "true" : "false"}">${escapeHtml(tab.label)}</button>`;
  }).join("");

  const panes = processConsoleTabs.map((tab) => {
    const active = tab.id === processConsoleActiveTab;

    return `<div id="process-console-pane-${escapeHtml(tab.id)}" class="process-console-output process-console-pane${active ? " is-active" : ""}" role="tabpanel" data-console-pane="${escapeHtml(tab.id)}" aria-live="polite" aria-relevant="additions"${active ? "" : " hidden"}></div>`;
  }).join("");

  return `<div class="process-console-tabs" id="process-console-tabs" role="tablist">${tabButtons}</div><div class="process-console-panes">${panes}</div>`;
}

/**
 * @param {HTMLElement} pane
 * @param {string} stream
 * @param {string} text
 * @param {string} [level]
 * @param {string} [at]
 */
function appendProcessConsoleLineToPane(pane, stream, text, level, at) {
  if (stream === "assistant") {
    appendLogLineToContainer(pane, "assistant", at, text);
    return;
  }

  const lineEl = document.createElement("div");
  const lvl    = level ? ` process-console-level-${level}` : "";
  lineEl.className = `process-console-line process-console-${stream}${lvl}`;

  if (stream === "stdout" && text.includes("<span class=\"process-console-pkg")) {
    lineEl.innerHTML = formatProcessConsoleLineHtml(text);
  } else {
    setProcessConsoleLineContent(lineEl, at, text);
  }

  pane.appendChild(lineEl);
}

/**
 * @param {HTMLElement} [scrollPane]
 */
function scrollProcessConsoleIfFollow(scrollPane) {
  const followEl = document.getElementById("process-console-follow");
  const follow   = followEl instanceof HTMLInputElement ? followEl.checked : true;
  const pane     = scrollPane ?? getProcessConsolePane(processConsoleActiveTab);

  if (follow && pane instanceof HTMLElement) {
    pane.scrollTop = pane.scrollHeight;
  }
}

/**
 * @param {Record<string, unknown>} listener
 */
function formatProcessStarterShort(listener) {
  const starter = String(listener.starter ?? listener.label ?? "");
  const user    = typeof listener.user === "string" && listener.user ? listener.user : "";

  if (starter === "cursor") {
    return user ? `Cursor (${user})` : "Cursor";
  }

  if (starter === "dashboard") {
    return user ? `Cruscotto (${user})` : "Cruscotto";
  }

  if (starter === "user") {
    return user ? `Utente (${user})` : "Utente";
  }

  return user || "—";
}

/**
 * @param {Record<string, unknown>} processesPayload
 * @returns {Array<{ stream: string, text: string }>}
 */
function buildActiveInstancesConsoleLines(processesPayload) {
  const rows      = Array.isArray(processesPayload.rows) ? processesPayload.rows : [];
  const checkedAt = typeof processesPayload.checkedAt === "string"
    ? formatRunAt(processesPayload.checkedAt)
    : "—";
  /** @type {Array<{ stream: string, text: string }>} */
  const lines = [{
    stream : "system"
  , text   : `=== Istanze servizi attive — ${checkedAt} ===`
  }];

  let activeServices = 0;
  let listenerCount  = 0;

  for (const row of rows) {
    const id        = String(row.label ?? row.id ?? "—");
    const port      = row.port != null ? `:${row.port}` : "daemon";
    const listeners = Array.isArray(row.listeners) ? row.listeners : [];
    const listening = row.listening === true;

    if (listening) {
      activeServices += 1;
    }

    if (!listeners.length) {
      lines.push({
        stream : "system"
      , text   : `  ${id.padEnd(16)} ${String(port).padEnd(10)} — libera`
      });
      continue;
    }

    listeners.forEach((listener, index) => {
      listenerCount += 1;
      const procRow  = /** @type {Record<string, unknown>} */ (listener);
      const pid      = procRow.pid != null ? String(procRow.pid) : "?";
      const dash     = procRow.isDashboard ? " (dashboard)" : "";
      const starter  = formatProcessStarterShort(procRow);
      const nameCol  = index === 0 ? id.padEnd(16) : "".padEnd(16);
      const portCol  = index === 0 ? String(port).padEnd(10) : "".padEnd(10);
      const stateCol = index === 0 ? (listening ? "in ascolto" : "—").padEnd(12) : "".padEnd(12);

      lines.push({
        stream : "system"
      , text   : `  ${nameCol} ${portCol} ${stateCol} pid ${pid}${dash}  user ${starter}`
      });
    });
  }

  const nodeRows = Array.isArray(processesPayload.nodeRows) ? processesPayload.nodeRows : [];

  if (nodeRows.length > 0) {
    lines.push({
      stream : "system"
    , text   : "—— Processi Node progetto (non mappati a porta) ——"
    });

    for (const row of nodeRows) {
      const listeners = Array.isArray(row.listeners) ? row.listeners : [];
      const desc      = String(row.description ?? row.command ?? "—").slice(0, 48);

      for (const [index, listener] of listeners.entries()) {
        listenerCount += 1;
        const procRow = /** @type {Record<string, unknown>} */ (listener);
        const pid     = procRow.pid != null ? String(procRow.pid) : "?";
        const starter = formatProcessStarterShort(procRow);
        const nameCol = index === 0 ? "Node".padEnd(16) : "".padEnd(16);

        lines.push({
          stream : "system"
        , text   : `  ${nameCol} ${desc.padEnd(42)} pid ${pid}  user ${starter}`
        });
      }
    }
  }

  lines.push({
    stream : "system"
  , text   : `=== ${activeServices} servizi attivi · ${listenerCount} processi · ${rows.length} righe discovery · ${nodeRows.length} node extra ===`
  });

  return lines;
}

/**
 * @param {HTMLButtonElement} [button]
 */
async function dumpActiveInstancesToConsole(button = null) {
  const label = button?.textContent ?? null;

  if (button) {
    button.setAttribute("disabled", "true");
    button.textContent = "…";
  }

  try {
    const data  = await apiGet("/api/repo/services/processes");
    const lines = buildActiveInstancesConsoleLines(data);

    setProcessConsoleTab("all");
    appendProcessConsoleLines(lines);
    scrollProcessConsoleIfFollow(getProcessConsolePane("all") ?? undefined);
    startProcessConsolePolling();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lettura istanze fallita";

    setProcessConsoleTab("all");
    appendProcessConsoleLines([{
      stream : "stderr"
    , text   : message
    }]);
    scrollProcessConsoleIfFollow(getProcessConsolePane("all") ?? undefined);
  } finally {
    if (button) {
      button.removeAttribute("disabled");
      button.textContent = label ?? "Istanze attive";
    }
  }
}

/** @type {Record<string, { title: string, subtitle: string }>} — titolo e sottotitolo per tab sidebar. */
const PAGE_META = {
  requisiti: {
    title    : "Requisiti"
  , subtitle : "Stack, env e comandi di setup"
  }
, servizi  : {
    title    : "Servizi"
  , subtitle : "Health check ambiente locale"
  }
, test     : {
    title    : "Test"
  , subtitle : "testScript/ — raggruppati per cartella"
  }
, testtecnici: {
    title    : "TestTecnici"
  , subtitle : "Esecuzione script e test case per file"
  }
, testfunzionali: {
    title    : "TestFunzionali"
  , subtitle : "Multi-utente — amici, match, flusso E2E"
  }
, jiraproject: {
    title    : "Project Tree"
  , subtitle : "Backlog ad albero — check Fatto per ogni step"
  }
, backlog: {
    title    : "Backlog"
  , subtitle : "Elenco completo issue Jira — tipo, key, titolo"
  }
, mybacklog: {
    title    : "MyBacklog"
  , subtitle : "Backlog da cache cruscotto DB — Epic · Sprint · Pilastri"
  }
, workingplan: {
    title    : "Working Plan"
  , subtitle : "Report piano lavoro e verifica ticket obsoleti — output script CLI"
  }
, issue: {
    title    : "Issue"
  , subtitle : "Vista dettaglio issue Jira per key — description, link, WIP"
  }
, projectoverview: {
    title    : "Project Overview"
  , subtitle : "Avanzamento, backlog, sintesi, test e gap"
  }
, matrix: {
    title    : "Matrix Gap"
  , subtitle : "Matrice avanzamento, gap e audit — dati da tabelle matrix_* (portal_gap)"
  }
, matrixcoverage: {
    title    : "Matrix Test"
  , subtitle : "Matrice copertura test — feature, test automatici e gap (test_coverage)"
  }
, pillarmatrix: {
    title    : "Matrice pilastri"
  , subtitle : "Concetti prodotto × backlog × segnali repo"
  }
, process: {
    title    : "Process"
  , subtitle : "Strumenti di supporto e manutenzione Admin"
  }
, cursor: {
    title    : "Cursor Agent"
  , subtitle : "Chat agent Cursor in background — runtime local (product repo) o cloud (GitHub)"
  }
};

/**
 * Meta pagina con label Jira/progetto dal bootstrap server.
 *
 * @param {string} tab
 * @returns {{ title: string, subtitle: string }}
 */
function getPageMeta(tab) {
  const base = PAGE_META[tab] ?? PAGE_META.requisiti;
  const jp   = cruscottoJiraPrefix();

  if (tab === "jiraproject") {
    return { ...base, subtitle: `Backlog ${jp} ad albero — check Fatto per ogni step` };
  }

  if (tab === "pillarmatrix") {
    return { ...base, subtitle: `Concetti prodotto × backlog ${jp} × segnali repo` };
  }

  return base;
}

/** @type {Record<string, string>} */
const SUITE_LABELS = {
  auth          : "Auth"
, chat          : "Chat"
, match         : "Match"
, web           : "Web UI"
, dashboard     : "Dashboard"
, profile       : "Profile"
, social        : "Social"
, tournament    : "Tournament"
, notifications : "Notifications"
, funzionali    : "Funzionali"
, root          : "Root"
};

/** @type {string | null} */
let servicesRefreshTimer = null;

/** @type {Set<string>} */
const collapsedSuites = new Set();

/** @type {Set<string>} */
const collapsedTtecniciSuites = new Set();

/** @type {Set<string>} */
const expandedTtecniciFiles = new Set();

/** @type {Set<string>} */
const expandedTtecniciDeps = new Set();

/** @type {Set<string>} */
const expandedTfuncDeps = new Set();

/** @type {Set<string>} */
const collapsedTfuncSuites = new Set();

/** @type {Set<string>} */
const collapsedTfuncScenarioScripts = new Set();

let tfuncScenarioCollapseSeeded = false;

/** @type {Set<string>} */
const collapsedTtecniciScenarioScripts = new Set();

let ttecniciScenarioCollapseSeeded = false;

let tfuncScenariosSectionCollapsed = true;

let ttecniciScenariosSectionCollapsed = true;

/** @type {Set<string>} */
const collapsedTfuncScenarioTopics = new Set();

/** @type {Set<string>} */
const collapsedTtecniciScenarioTopics = new Set();

let tfuncScenarioTopicsSeeded = false;

let ttecniciScenarioTopicsSeeded = false;

/** @type {Set<string>} */
const expandedTfuncFiles = new Set();

/** Al primo render, ogni sezione test parte con tutte le suite collassate. */
/** @type {{ test: boolean, testtecnici: boolean, testfunzionali: boolean }} */
const suiteCollapseSeeded = {
  test            : false
, testtecnici     : false
, testfunzionali  : false
};

/**
 * @param {Array<{ suite: string }>} groups
 * @param {Set<string>} collapsedSet
 * @param {"test" | "testtecnici" | "testfunzionali"} section
 */
function seedAllSuitesCollapsed(groups, collapsedSet, section) {
  if (suiteCollapseSeeded[section] || groups.length === 0) {
    return;
  }

  suiteCollapseSeeded[section] = true;

  for (const group of groups) {
    collapsedSet.add(group.suite);
  }
}

/**
 * @param {Array<Record<string, unknown>>} scenarios
 * @param {Set<string>} collapsedSet
 * @param {() => boolean} isSeeded
 * @param {(value: boolean) => void} setSeeded
 */
function seedScenariosCollapsed(scenarios, collapsedSet, isSeeded, setSeeded) {
  if (isSeeded() || scenarios.length === 0) {
    return;
  }

  setSeeded(true);

  for (const block of scenarios) {
    const script = String(block.script ?? "");

    if (script) {
      collapsedSet.add(script);
    }
  }
}

/**
 * @param {Array<Record<string, unknown>>} scenarios
 */
function seedTfuncScenariosCollapsed(scenarios) {
  seedScenariosCollapsed(
    scenarios
  , collapsedTfuncScenarioScripts
  , () => tfuncScenarioCollapseSeeded
  , (value) => { tfuncScenarioCollapseSeeded = value; }
  );
}

/**
 * @param {Array<Record<string, unknown>>} scenarios
 */
function seedTtecniciScenariosCollapsed(scenarios) {
  seedScenariosCollapsed(
    scenarios
  , collapsedTtecniciScenarioScripts
  , () => ttecniciScenarioCollapseSeeded
  , (value) => { ttecniciScenarioCollapseSeeded = value; }
  );
}

/**
 * @param {Record<string, unknown>} block
 */
function scenarioTopicKey(block) {
  if (typeof block.topic === "string" && block.topic.trim()) {
    return block.topic.trim();
  }

  const script = String(block.script ?? "");
  const parts  = script.split("/");

  return parts.length > 1 ? parts[0] : "root";
}

/**
 * @param {string} topicKey
 * @param {Record<string, unknown>} block
 */
function scenarioTopicLabel(topicKey, block) {
  if (typeof block.topicLabel === "string" && block.topicLabel.trim()) {
    return block.topicLabel.trim();
  }

  return suiteLabel(topicKey);
}

/**
 * @param {string} topicKey
 * @param {Array<Record<string, unknown>>} [items]
 */
function scenarioTopicFolderPath(topicKey, items = []) {
  if (items.length > 0) {
    const script = String(items[0].script ?? "");
    const parts  = script.split("/");

    if (parts.length > 1) {
      return `testScript/${parts[0]}/`;
    }
  }

  return topicKey === "root" ? "testScript/" : `testScript/${topicKey}/`;
}

/**
 * @param {Array<Record<string, unknown>>} scenarios
 */
function groupScenariosByTopic(scenarios) {
  /** @type {Map<string, Record<string, unknown>[]>} */
  const groups = new Map();

  for (const block of scenarios) {
    const topic = scenarioTopicKey(block);
    const list  = groups.get(topic) ?? [];

    list.push(block);
    groups.set(topic, list);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([topic, items]) => ({
      topic
    , label : scenarioTopicLabel(topic, items[0])
    , path  : scenarioTopicFolderPath(topic, items)
    , items : items.sort((x, y) => String(x.script).localeCompare(String(y.script)))
    }));
}

/**
 * @param {Array<{ topic: string }>} topicGroups
 * @param {Set<string>} collapsedSet
 * @param {() => boolean} isSeeded
 * @param {(value: boolean) => void} setSeeded
 */
function seedScenarioTopicsCollapsed(topicGroups, collapsedSet, isSeeded, setSeeded) {
  if (isSeeded() || topicGroups.length === 0) {
    return;
  }

  setSeeded(true);

  for (const group of topicGroups) {
    collapsedSet.add(group.topic);
  }
}

/**
 * @param {Array<{ topic: string }>} topicGroups
 */
function seedTfuncScenarioTopicsCollapsed(topicGroups) {
  seedScenarioTopicsCollapsed(
    topicGroups
  , collapsedTfuncScenarioTopics
  , () => tfuncScenarioTopicsSeeded
  , (value) => { tfuncScenarioTopicsSeeded = value; }
  );
}

/**
 * @param {Array<{ topic: string }>} topicGroups
 */
function seedTtecniciScenarioTopicsCollapsed(topicGroups) {
  seedScenarioTopicsCollapsed(
    topicGroups
  , collapsedTtecniciScenarioTopics
  , () => ttecniciScenarioTopicsSeeded
  , (value) => { ttecniciScenarioTopicsSeeded = value; }
  );
}

/**
 * @param {"testtecnici" | "testfunzionali"} section
 */
function getWorkbenchSets(section) {
  if (section === "testfunzionali") {
    return {
      sectionId         : "section-testfunzionali"
    , domPrefix         : "tf"
    , collapsedSuites   : collapsedTfuncSuites
    , expandedFiles     : expandedTfuncFiles
    , expandedDeps      : expandedTfuncDeps
    , suiteCollapseKey  : "testfunzionali"
    , scriptFilter      : (entry) => String(entry.suite ?? "") === "funzionali"
    , runAllButtonId    : "btn-tf-run-all"
    , runAllFetch       : () => fetch("/api/run/funzionali", { method: "POST" })
    , showTecniciTools  : false
    };
  }

  return {
    sectionId         : "section-testtecnici"
  , domPrefix         : "tt"
  , collapsedSuites   : collapsedTtecniciSuites
  , expandedFiles     : expandedTtecniciFiles
  , expandedDeps      : expandedTtecniciDeps
  , suiteCollapseKey  : "testtecnici"
  , scriptFilter      : (entry) => String(entry.suite ?? "") !== "funzionali"
  , runAllButtonId    : "btn-tt-run-all"
  , runAllFetch       : () => fetch("/api/run", { method: "POST" })
  , showTecniciTools  : true
  };
}

/**
 * Riga/gruppo evidenziato dopo click su Esegui.
 * @type {{ section: "test" | "testtecnici" | "testfunzionali", script: string | null, testCase: string | null, suite: string | null, dependencies: string[], runAll: boolean } | null}
 */
let selectedRunTarget = null;

const DEP_STAR_SVG = `<svg class="dep-star-icon" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>`;

/** @type {{ report: Record<string, unknown> | null, status: Record<string, unknown> | null, catalog: { scripts?: Array<Record<string, unknown>> } | null } | null} */
let lastTestView = null;

const TEST_TABLE_COLGROUP = `
  <colgroup>
    <col class="col-script" />
    <col class="col-status" />
    <col class="col-detail" />
    <col class="col-duration" />
    <col class="col-runat" />
    <col class="col-actions" />
  </colgroup>`;

const RUN_ICON_SVG = `<svg class="run-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66L11 3h1l-1 7h3.5c.49 0 .56.33.47.51l-4 10.5z"/></svg>`;

// --- testScript — workbench, run, export e analisi ---
/**
 * @param {string} expandId
 * @param {string} collapseId
 * @param {{ expandLabel?: string, collapseLabel?: string, groupLabel?: string }} [labels]
 */
function treeBulkToggleHtml(expandId, collapseId, labels = {}) {
  const ui = globalThis.JloExpandCollapseUi;

  if (ui) {
    return ui.pair(expandId, collapseId, labels);
  }

  const expandLabel   = labels.expandLabel ?? "Espandi tutto";
  const collapseLabel = labels.collapseLabel ?? "Collassa tutto";

  return `<button type="button" class="action" id="${expandId}">${expandLabel}</button><button type="button" class="action" id="${collapseId}">${collapseLabel}</button>`;
}

/**
 * @param {{ disabled?: boolean, runningActive?: boolean, title?: string, dataRunScript?: string, dataRunCase?: string }} opts
 */
function renderRunIconButton(opts = {}) {
  const runningActive = opts.runningActive === true;
  const title = runningActive ? "Running" : (opts.title ?? "Esegui script");
  const classes = ["action", "btn-run-one", "btn-run-icon"];

  if (runningActive) {
    classes.push("is-running");
  }

  const attrs = [
    `class="${classes.join(" ")}"`
  , 'type="button"'
  , `title="${escapeHtml(title)}"`
  , `aria-label="${escapeHtml(title)}"`
  ];

  if (opts.disabled || runningActive) {
    attrs.push("disabled");
  } else if (opts.dataRunScript) {
    attrs.push(`data-run-script="${escapeHtml(opts.dataRunScript)}"`);
  }

  if (!opts.disabled && !runningActive && opts.dataRunCase) {
    attrs.push(`data-run-case="${escapeHtml(opts.dataRunCase)}"`);
  }

  const content = runningActive ? "Running" : RUN_ICON_SVG;

  return `<button ${attrs.join(" ")}>${content}</button>`;
}

/**
 * @param {"test" | "testtecnici"} section
 */
function isSelectedRunAll(section) {
  return selectedRunTarget?.section === section && selectedRunTarget.runAll === true;
}

/**
 * @param {"test" | "testtecnici"} section
 * @param {string} suite
 * @param {Record<string, unknown> | null | undefined} status
 * @param {boolean} running
 */
function isSuiteRunActive(section, suite, status, running) {
  if (!running || !status?.running) {
    return false;
  }

  const mode = status.mode;
  const targetScript = typeof status.targetScript === "string" ? status.targetScript : null;
  const currentScript = typeof status.currentScript === "string" ? status.currentScript : null;

  if (mode === "suite" && targetScript === suite) {
    return true;
  }

  if (mode === "all" && currentScript) {
    return currentScript === suite || currentScript.startsWith(`${suite}/`);
  }

  if (mode === "funzionali" && section === "testfunzionali" && currentScript) {
    return currentScript === suite || currentScript.startsWith(`${suite}/`);
  }

  return false;
}

/**
 * @param {"test" | "testtecnici"} section
 * @param {Record<string, unknown> | null | undefined} status
 * @param {boolean} running
 */
function isRunAllActive(section, status, running) {
  if (!running || !status?.running) {
    return false;
  }

  if (section === "testfunzionali") {
    return status.mode === "funzionali";
  }

  return status.mode === "all";
}

/**
 * @param {"test" | "testtecnici"} section
 * @param {string} suite
 * @param {Record<string, unknown> | null | undefined} status
 * @param {boolean} running
 */
function renderRunSuiteButton(section, suite, status, running) {
  const selected = isSelectedRunSuite(section, suite) || isSelectedRunAll(section);
  const active = isSuiteRunActive(section, suite, status, running);
  const classes = ["action", "btn-run-suite"];

  if (selected) {
    classes.push("is-run-selected");
  }

  if (active) {
    classes.push("is-running");
  }

  const label = active ? "Running" : "Esegui gruppo";
  const attrs = [
    `class="${classes.join(" ")}"`
  , 'type="button"'
  , `data-run-suite="${escapeHtml(suite)}"`
  , `aria-label="${escapeHtml(active ? `Running gruppo ${suite}` : `Esegui gruppo ${suite}`)}"`
  ];

  if (running) {
    attrs.push("disabled");
  }

  return `<button ${attrs.join(" ")}>${label}</button>`;
}

/**
 * @param {string} id
 * @param {"test" | "testtecnici"} section
 * @param {Record<string, unknown> | null | undefined} status
 * @param {boolean} running
 * @param {string} [idleLabel]
 */
function renderRunAllButton(id, section, status, running, idleLabel = "Esegui tutti i test") {
  const selected = isSelectedRunAll(section);
  const active = isRunAllActive(section, status, running);
  const classes = ["action", "primary"];

  if (selected) {
    classes.push("is-run-selected");
  }

  if (active) {
    classes.push("is-running");
  }

  const label = active ? "Running" : idleLabel;
  const attrs = [
    `class="${classes.join(" ")}"`
  , 'type="button"'
  , `id="${escapeHtml(id)}"`
  , `aria-label="${escapeHtml(active ? "Running tutti i test" : idleLabel)}"`
  ];

  if (running) {
    attrs.push("disabled");
  }

  return `<button ${attrs.join(" ")}>${escapeHtml(label)}</button>`;
}

// --- HTTP — fetch JSON verso cruscotto.server ---
/**
 * @param {number} timeoutMs
 * @returns {AbortSignal | undefined}
 */
function apiFetchSignal(timeoutMs) {
  if (timeoutMs <= 0) {
    return undefined;
  }

  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();

  window.setTimeout(() => controller.abort(), timeoutMs);

  return controller.signal;
}

/**
 * GET JSON; errore se status non ok (messaggio da body.error o HTTP).
 *
 * @param {string} path — path assoluto es. `/api/report`
 * @param {number} [timeoutMs]
 * @returns {Promise<Record<string, unknown>>}
 */
async function apiGet(path, timeoutMs = 0) {
  const signal = apiFetchSignal(timeoutMs);
  const init   = signal ? { signal } : undefined;
  const res    = await fetch(path, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * @param {string} text
 */
function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

/**
 * @param {string} cmd
 */
async function copyCmd(cmd) {
  await navigator.clipboard.writeText(cmd);
}

/**
 * Classi colore per workspace @justlastone/* nella console process.
 * @type {Record<string, string>}
 */
const PROCESS_JLO_PKG_CLASS = {
  web           : "process-console-pkg-web"
, api           : "process-console-pkg-api"
, "api-documentation"  : "process-console-pkg-api-documentation"
, auth          : "process-console-pkg-auth"
, authentication: "process-console-pkg-auth"
, friendbot     : "process-console-pkg-friendbot"
, database      : "process-console-pkg-database"
, shared        : "process-console-pkg-shared"
, i18n          : "process-console-pkg-i18n"
, "auth-kit"    : "process-console-pkg-auth-kit"
};

/**
 * @param {string} slug
 */
function processConsolePkgClass(slug) {
  const key = slug.toLowerCase();
  return PROCESS_JLO_PKG_CLASS[key] ?? "process-console-pkg-default";
}

/**
 * Evidenzia @justlastone/xxx e prefissi [web] [api] … con span colorati.
 * @param {string} text
 */
function formatProcessConsoleLineHtml(text) {
  let html = escapeHtml(text);

  html = html.replace(
    /^(\[(web|api|auth|api-documentation|friendbot|dashboard|turbo-dev)\])/
  , (_match, bracket, serviceId) => {
      const cls = processConsolePkgClass(serviceId);
      return `<span class="process-console-pkg ${cls}">${bracket}</span>`;
    }
  );

  html = html.replace(
    /@justlastone\/([a-z0-9-]+)/gi
  , (match, pkg) => {
      const cls = processConsolePkgClass(pkg);
      return `<span class="process-console-pkg ${cls}">${match}</span>`;
    }
  );

  return html;
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} levelFilter
 */
function logRowPassesLevelFilter(row, levelFilter) {
  if (levelFilter === "all") {
    return true;
  }

  /** @type {Record<string, number>} */
  const rank = { debug: 0, info: 1, warn: 2, error: 3 };
  const level = String(row.level ?? "info").toLowerCase();
  const min   = rank[levelFilter] ?? 1;
  const rowRank = rank[level] ?? 1;

  return rowRank >= min;
}

/**
 * @param {Array<Record<string, unknown>>} lines
 */
function appendProcessConsoleLines(lines) {
  for (const row of lines) {
    if (!logRowPassesLevelFilter(row, processLogLevelFilter)) {
      continue;
    }

    const stream = String(row.stream ?? "stdout");
    const text   = String(row.text ?? "");
    const tabIds = classifyProcessLogLine(text);

    for (const tabId of tabIds) {
      const pane = getProcessConsolePane(tabId);

      if (pane instanceof HTMLElement) {
        appendProcessConsoleLineToPane(
          pane
        , stream
        , text
        , String(row.level ?? "info")
        , typeof row.at === "string" ? row.at : undefined
        );
      }
    }
  }

  scrollProcessConsoleIfFollow();
}

async function pollRunLogs() {
  try {
    const data  = await apiGet(`/api/run/logs?cursor=${runLogCursor}`);
    const lines = Array.isArray(data.lines) ? data.lines : [];

    if (lines.length > 0) {
      appendProcessConsoleLines(lines);
      runLogCursor = typeof data.cursor === "number" ? data.cursor : runLogCursor;
    }
  } catch {
    // poll silenzioso
  }
}

function scrollProcessConsoleIntoView() {
  document.querySelector(".process-console-panel")?.scrollIntoView({
    behavior : "smooth"
  , block    : "nearest"
  });
}

/** @type {((value: boolean) => void) | null} */
let processConfirmResolve = null;

let processConfirmModalBound = false;

function closeProcessConfirm(result) {
  const modal = document.getElementById("process-confirm-modal");

  if (!modal || !processConfirmResolve) {
    return;
  }

  const resolve           = processConfirmResolve;
  processConfirmResolve   = null;

  modal.classList.add("hidden");
  modal.setAttribute("hidden", "");
  document.body.classList.remove("process-confirm-open");
  resolve(result);
}

function bindProcessConfirmModal() {
  if (processConfirmModalBound) {
    return;
  }

  processConfirmModalBound = true;

  const modal = document.getElementById("process-confirm-modal");

  if (!modal) {
    return;
  }

  modal.querySelector("#process-confirm-ok")?.addEventListener("click", () => {
    closeProcessConfirm(true);
  });

  modal.querySelector("#process-confirm-cancel")?.addEventListener("click", () => {
    closeProcessConfirm(false);
  });

  modal.addEventListener("click", (ev) => {
    if (ev.target === modal) {
      closeProcessConfirm(false);
    }
  });

  document.addEventListener("keydown", (ev) => {
    if (!processConfirmResolve) {
      return;
    }

    if (ev.key === "Escape") {
      closeProcessConfirm(false);
    }
  });
}

/**
 * Dialogo conferma Process (non usa window.confirm).
 *
 * @param {{
 *   title?: string
 *   message: string
 *   confirmLabel?: string
 *   cancelLabel?: string
 *   danger?: boolean
 * }} options
 * @returns {Promise<boolean>}
 */
function processConfirm(options) {
  return new Promise((resolve) => {
    const modal     = document.getElementById("process-confirm-modal");
    const titleEl   = modal?.querySelector("#process-confirm-title");
    const bodyEl    = modal?.querySelector("#process-confirm-body");
    const okBtn     = modal?.querySelector("#process-confirm-ok");
    const cancelBtn = modal?.querySelector("#process-confirm-cancel");

    if (!(modal instanceof HTMLElement)
        || !(titleEl instanceof HTMLElement)
        || !(bodyEl instanceof HTMLElement)
        || !(okBtn instanceof HTMLButtonElement)
        || !(cancelBtn instanceof HTMLButtonElement)) {
      resolve(false);
      return;
    }

    if (processConfirmResolve) {
      resolve(false);
      return;
    }

    processConfirmResolve = resolve;
    titleEl.textContent   = options.title ?? "Conferma";
    bodyEl.innerHTML      = escapeHtml(options.message)
      .replace(/\n\n/g, "<br><br>")
      .replace(/\n/g, "<br>");
    okBtn.textContent     = options.confirmLabel ?? "Conferma";
    cancelBtn.textContent = options.cancelLabel ?? "Annulla";
    okBtn.className       = options.danger
      ? "action process-confirm-danger"
      : "action primary";

    modal.classList.remove("hidden");
    modal.removeAttribute("hidden");
    document.body.classList.add("process-confirm-open");
    cancelBtn.focus();
  });
}

/**
 * @param {string} tabId
 * @param {string} hint
 */
function beginProcessKillConsole(tabId, hint) {
  processLogCursor = 0;
  clearProcessConsolePanes();
  setProcessConsoleTab(tabId);
  appendProcessConsoleLines([{
    stream : "system"
  , text   : hint
  }]);
  scrollProcessConsoleIntoView();
  startProcessConsolePolling();
}

/**
 * @param {Record<string, unknown>} body
 */
async function applyProcessKillLogResponse(body) {
  clearProcessConsolePanes();

  if (Array.isArray(body.lines) && body.lines.length > 0) {
    appendProcessConsoleLines(body.lines);
    processLogCursor = typeof body.logCursor === "number" ? body.logCursor : processLogCursor;
  } else {
    await reloadProcessConsole(true);
  }

  await pollProcessConsoleLogs();
  startProcessConsolePolling();
}

function stopProcessConsolePolling() {
  if (processConsolePollTimer != null) {
    window.clearInterval(processConsolePollTimer);
    processConsolePollTimer = null;
  }
}

function startProcessConsolePolling() {
  if (!getProcessConsolePane("all")) {
    return;
  }

  stopProcessConsolePolling();
  void pollProcessConsoleLogs();

  processConsolePollTimer = window.setInterval(() => {
    void pollProcessConsoleLogs();
  }, 700);
}

async function pollProcessConsoleLogs() {
  try {
    const source = processLogSourceFilter !== "all" ? processLogSourceFilter : "process";
    const [data, statusData] = await Promise.all([
      apiGet(`/api/logs?cursor=${processLogCursor}&source=${encodeURIComponent(source)}&extended=1`)
    , source === "process" || processLogSourceFilter === "all"
        ? apiGet(`/api/repo/services/logs?cursor=${processLogCursor}`)
        : Promise.resolve(null)
    ]);
    const lines = Array.isArray(data.lines) ? data.lines : [];

    if (lines.length > 0) {
      appendProcessConsoleLines(lines);
      processLogCursor = typeof data.cursor === "number" ? data.cursor : processLogCursor;
    }

    const statusPayload = statusData && typeof statusData === "object" ? statusData : data;

    const badge = document.getElementById("process-console-running");

    if (badge) {
      badge.textContent = statusPayload.running ? "in esecuzione" : "fermo";
      badge.classList.toggle("is-running", Boolean(statusPayload.running));
    }

    const statusEl = document.getElementById("process-start-status");

    if (statusEl && statusPayload.status && typeof statusPayload.status === "object") {
      const launchStatus = /** @type {Record<string, unknown>} */ (statusPayload.status);

      if (launchStatus.running) {
        const pid = launchStatus.pid != null ? String(launchStatus.pid) : "—";
        statusEl.textContent = `Avvio in corso (pid ${pid}). Output in tempo reale sotto.`;
      } else if (typeof launchStatus.error === "string" && launchStatus.error) {
        statusEl.textContent = `Ultimo avvio: ${launchStatus.error}`;
      }
    }
  } catch {
    // poll silenzioso — la console resta visibile
  }
}

/**
 * Notifica iframe Project Overview di rilanciare GET /api/project-overview/analyze.
 *
 * @param {HTMLIFrameElement} iframe
 * @param {{ force?: boolean }} [opts]
 */
function postProjectOverviewRefresh(iframe, opts = {}) {
  try {
    iframe.contentWindow?.postMessage({
      type  : "cruscotto:project-overview-refresh"
    , force : opts.force === true
    }, location.origin);
  } catch {
    /* iframe non pronto */
  }
}

/**
 * Notifica iframe MyBacklog di ricaricare GET /api/jira/my-backlog (cache DB).
 *
 * @param {HTMLIFrameElement} iframe
 * @param {{ reason?: string, sprintId?: number | null }} [opts]
 */
function postMyBacklogRefresh(iframe, opts = {}) {
  try {
    iframe.contentWindow?.postMessage({
      type    : "cruscotto:my-backlog-refresh"
    , reason  : opts.reason ?? "sprint-update"
    , sprintId: opts.sprintId ?? null
    }, location.origin);
  } catch {
    /* iframe non pronto */
  }
}

/** @type {HTMLIFrameElement | null} */
let myBacklogIframe = null;

/**
 * Richiede refresh tabella MyBacklog quando la tab è in iframe (es. dopo chiusura sprint WP).
 *
 * @param {{ reason?: string, sprintId?: number | null }} [opts]
 */
function refreshMyBacklogTab(opts = {}) {
  if (!(myBacklogIframe instanceof HTMLIFrameElement)) {
    myBacklogIframe = document.querySelector("#section-mybacklog iframe");
  }

  const iframe = myBacklogIframe;

  if (!(iframe instanceof HTMLIFrameElement)) {
    return;
  }

  postMyBacklogRefresh(iframe, opts);
}

/** @type {HTMLIFrameElement | null} */
let projectOverviewIframe = null;

/** Richiede refresh analisi overview quando la tab è attiva. */
function refreshProjectOverviewTab() {
  if (!(projectOverviewIframe instanceof HTMLIFrameElement)) {
    projectOverviewIframe = document.querySelector("#section-projectoverview iframe");
  }

  const iframe = projectOverviewIframe;

  if (!(iframe instanceof HTMLIFrameElement)) {
    return;
  }

  if (iframe.dataset.loaded === "1") {
    postProjectOverviewRefresh(iframe);
    return;
  }

  iframe.addEventListener("load", () => {
    iframe.dataset.loaded = "1";
    postProjectOverviewRefresh(iframe);
  }, { once: true });
}

/**
 * Mostra/nasconde sezioni, aggiorna titolo pagina e avvia/ferma polling console Process.
 *
 * @param {string} tab — id in {@link TABS} (sincronizzato con `location.hash`)
 * @param {string | null} [hashPayload] — es. numero issue per `#issue:154`
 */
function setActiveTab(tab, hashPayload = null) {
  for (const id of TABS) {
    const section = document.getElementById(`section-${id}`);
    const button  = document.querySelector(`[data-tab="${id}"]`);
    if (section) {
      section.classList.toggle("hidden", id !== tab);
    }
    if (button) {
      button.classList.toggle("active", id === tab);
    }
  }

  const meta = getPageMeta(tab);
  const titleEl = document.getElementById("page-title");
  const subEl   = document.getElementById("page-subtitle");

  if (titleEl) {
    titleEl.textContent = meta.title;
  }
  if (subEl) {
    subEl.textContent = meta.subtitle;
  }

  syncWorkingPlanTopbar(tab);

  if (tab === "workingplan") {
    renderWorkingPlanTab();
    void loadSavedWorkingPlanIfEmpty();
  }

  if (tab === "projectoverview") {
    refreshProjectOverviewTab();
  }

  if (tab === "issue") {
    if (hashPayload) {
      location.hash = `issue:${hashPayload}`;
      navigateIssueTab(hashPayload);
    } else {
      location.hash = "issue";
    }
  } else {
    location.hash = tab;
  }

  if (tab === "process") {
    startProcessConsolePolling();
    stopCursorAgentPolling();
  } else if (tab === "cursor") {
    stopProcessConsolePolling();
    startCursorAgentPolling();
  } else {
    stopProcessConsolePolling();
    stopCursorAgentPolling();
  }
}

/**
 * @param {string} suite
 */
function suiteLabel(suite) {
  return SUITE_LABELS[suite] ?? suite;
}

/**
 * @param {Array<Record<string, unknown>>} scripts
 */
function groupScriptsBySuite(scripts) {
  /** @type {Map<string, Record<string, unknown>[]>} */
  const groups = new Map();

  for (const entry of scripts) {
    const suite = String(entry.suite ?? "root");
    const list  = groups.get(suite) ?? [];
    list.push(entry);
    groups.set(suite, list);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([suite, items]) => ({
      suite
    , label : suiteLabel(suite)
    , items : items.sort((x, y) => String(x.rel).localeCompare(String(y.rel)))
    }));
}

/**
 * @param {Array<Record<string, unknown>>} items
 * @param {Map<string, Record<string, unknown>>} reportByScript
 */
function countSuiteResults(items, reportByScript) {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let pending = 0;

  for (const entry of items) {
    const last = reportByScript.get(String(entry.rel ?? ""));
    const status = last ? String(last.status ?? "") : "";

    if (status === "passed") {
      passed += 1;
    } else if (status === "failed") {
      failed += 1;
    } else if (status === "skipped") {
      skipped += 1;
    } else {
      pending += 1;
    }
  }

  return { passed, failed, skipped, pending, total: items.length };
}

/**
 * @param {{ passed: number, failed: number, skipped: number, pending: number, total: number }} counts
 */
function renderSuiteOutcomeBadge(counts) {
  const { passed, failed, skipped, pending, total } = counts;

  if (pending === total) {
    return `<span class="suite-outcome-badge pending">${total} script · non eseguiti</span>`;
  }

  let tone = "pass";

  if (failed > 0) {
    tone = "fail";
  } else if (pending > 0) {
    tone = "partial";
  } else if (skipped > 0 && passed === 0) {
    tone = "skip";
  }

  const parts = [`${passed}/${total} ok`];

  if (failed > 0) {
    parts.push(`${failed} fail`);
  }
  if (skipped > 0) {
    parts.push(`${skipped} skip`);
  }
  if (pending > 0) {
    parts.push(`${pending} —`);
  }

  return `<span class="suite-outcome-badge ${tone}">${escapeHtml(parts.join(" · "))}</span>`;
}

/**
 * @param {number} ms
 */
function formatDurationMs(ms) {
  if (ms < 1000) {
    return `${ms} ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)} s`;
  }

  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1000);

  return `${min}m ${sec}s`;
}

/**
 * @param {Array<{ suite: string, label: string, items: Array<Record<string, unknown>> }>} groups
 * @param {Array<Record<string, unknown>>} catalogScripts
 * @param {Map<string, Record<string, unknown>>} reportByScript
 * @param {Record<string, unknown> | null} report
 */
function buildTestAnalysis(groups, catalogScripts, reportByScript, report) {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let pending = 0;
  let blocked = 0;
  let totalDurationMs = 0;

  /** @type {Array<{ rel: string, durationMs: number }>} */
  const durations = [];

  /** @type {Array<{ rel: string, suite: string }>} */
  const failedScripts = [];

  /** @type {Array<{ rel: string, reason: string }>} */
  const blockedScripts = [];

  for (const entry of catalogScripts) {
    const rel = String(entry.rel ?? "");
    const suite = String(entry.suite ?? "root");

    if (entry.blocked === true) {
      blocked += 1;
      blockedScripts.push({
        rel
      , reason: String(entry.blockedReason ?? "blocked")
      });
    }

    const last = reportByScript.get(rel);
    const status = last ? String(last.status ?? "") : "";

    if (status === "passed") {
      passed += 1;
    } else if (status === "failed") {
      failed += 1;
      failedScripts.push({ rel, suite });
    } else if (status === "skipped") {
      skipped += 1;
    } else {
      pending += 1;
    }

    if (last?.durationMs != null) {
      const durationMs = Number(last.durationMs);
      totalDurationMs += durationMs;
      durations.push({ rel, durationMs });
    }
  }

  const total = catalogScripts.length;
  const executed = passed + failed + skipped;
  const passRate = executed > 0 ? Math.round((passed / executed) * 100) : null;
  const coverageRate = total > 0 ? Math.round((executed / total) * 100) : null;

  durations.sort((a, b) => b.durationMs - a.durationMs);

  const suiteRows = groups.map((group) => ({
    suite : group.suite
  , label : group.label
  , counts: countSuiteResults(group.items, reportByScript)
  }));

  return {
    total
  , passed
  , failed
  , skipped
  , pending
  , blocked
  , executed
  , passRate
  , coverageRate
  , totalDurationMs
  , failedScripts
  , blockedScripts
  , slowest: durations.slice(0, 5)
  , suiteRows
  , generatedAt: report?.generatedAt ?? null
  , hasReport  : report != null && (report.passed != null || report.failed != null)
  };
}

/**
 * @param {ReturnType<typeof buildTestAnalysis>} analysis
 * @param {boolean} running
 * @param {number} pct
 */
function renderTestAnalysisPanel(analysis, running, pct) {
  const {
    total, passed, failed, skipped, pending, blocked, executed,
    passRate, coverageRate, totalDurationMs, failedScripts, blockedScripts,
    slowest, suiteRows, generatedAt, hasReport
  } = analysis;

  const passBar = passRate != null
    ? `<div class="analysis-bar"><span class="analysis-bar-fill pass" style="width:${passRate}%"></span></div>
       <p class="analysis-bar-label muted">${passRate}% pass · ${coverageRate ?? 0}% copertura catalogo</p>`
    : `<p class="muted">Esegui i test per popolare l'analisi.</p>`;

  const suiteBreakdown = suiteRows.map((row) => {
    const { counts } = row;
    let tone = "pending";

    if (counts.failed > 0) {
      tone = "fail";
    } else if (counts.pending === counts.total) {
      tone = "pending";
    } else if (counts.pending > 0) {
      tone = "partial";
    } else if (counts.passed === counts.total) {
      tone = "pass";
    }

    return `<button type="button" class="analysis-suite-row ${tone}" data-jump-suite="${escapeHtml(row.suite)}">
      <span class="analysis-suite-name">${escapeHtml(row.label)}</span>
      <span class="analysis-suite-stats">
        ${counts.passed > 0 ? `<span class="status-pass">${counts.passed}</span>` : ""}
        ${counts.failed > 0 ? `<span class="status-fail">${counts.failed}</span>` : ""}
        ${counts.skipped > 0 ? `<span class="status-skip">${counts.skipped}</span>` : ""}
        ${counts.pending > 0 ? `<span class="muted">${counts.pending}</span>` : ""}
      </span>
    </button>`;
  }).join("");

  const failedList = failedScripts.length > 0
    ? `<ul class="analysis-list">
        ${failedScripts.map(({ rel, suite }) => `
          <li>
            <button type="button" class="analysis-link" data-jump-suite="${escapeHtml(suite)}">
              <code>${escapeHtml(rel)}</code>
            </button>
          </li>`).join("")}
       </ul>`
    : `<p class="muted">Nessun fallimento.</p>`;

  const blockedList = blockedScripts.length > 0
    ? `<ul class="analysis-list">
        ${blockedScripts.map(({ rel, reason }) => `
          <li>
            <code>${escapeHtml(rel)}</code>
            <span class="muted">${escapeHtml(reason)}</span>
          </li>`).join("")}
       </ul>`
    : `<p class="muted">Nessuno script bloccato.</p>`;

  const slowestList = slowest.length > 0
    ? `<ul class="analysis-list">
        ${slowest.map(({ rel, durationMs }) => `
          <li>
            <code>${escapeHtml(rel)}</code>
            <span class="muted">${escapeHtml(formatDurationMs(durationMs))}</span>
          </li>`).join("")}
       </ul>`
    : `<p class="muted">—</p>`;

  return `
    <aside class="test-analysis-panel" aria-label="Analisi test">
      <div class="analysis-block">
        <h2>Analisi</h2>
        ${running ? `<div class="analysis-running">
          <p class="muted">Run in corso…</p>
          <div class="progress-bar"><span style="width:${pct}%"></span></div>
        </div>` : ""}
        <div class="analysis-stats">
          <div class="analysis-stat pass"><strong>${passed}</strong><span class="muted">ok</span></div>
          <div class="analysis-stat fail"><strong>${failed}</strong><span class="muted">fail</span></div>
          <div class="analysis-stat"><strong>${skipped}</strong><span class="muted">skip</span></div>
          <div class="analysis-stat"><strong>${pending}</strong><span class="muted">—</span></div>
        </div>
        ${passBar}
        <dl class="analysis-meta">
          <div><dt>Script catalogo</dt><dd>${total}</dd></div>
          <div><dt>Eseguiti</dt><dd>${executed}</dd></div>
          <div><dt>Bloccati</dt><dd>${blocked}</dd></div>
          <div><dt>Durata totale</dt><dd>${hasReport ? escapeHtml(formatDurationMs(totalDurationMs)) : "—"}</dd></div>
          <div><dt>Ultimo report</dt><dd>${generatedAt ? escapeHtml(String(generatedAt)) : "—"}</dd></div>
        </dl>
      </div>
      <div class="analysis-block">
        <h3>Per argomento</h3>
        <div class="analysis-suite-list">${suiteBreakdown}</div>
      </div>
      <div class="analysis-block">
        <h3>Falliti (${failedScripts.length})</h3>
        ${failedList}
      </div>
      <div class="analysis-block">
        <h3>Più lenti</h3>
        ${slowestList}
      </div>
      <div class="analysis-block">
        <h3>Bloccati (${blockedScripts.length})</h3>
        ${blockedList}
      </div>
    </aside>`;
}

/**
 * @param {Record<string, unknown> | undefined} row
 * @returns {string | null}
 */
function scriptRunStartedAt(row) {
  if (!row) {
    return null;
  }

  if (typeof row.startedAt === "string") {
    return row.startedAt;
  }

  const nested = row.report;

  if (typeof nested === "object" && nested !== null && typeof /** @type {Record<string, unknown>} */ (nested).startedAt === "string") {
    return /** @type {Record<string, unknown>} */ (nested).startedAt;
  }

  return null;
}

/**
 * @param {Record<string, unknown>} test
 */
function testCaseDurationLabel(test) {
  if (typeof test.durationMs === "number" && test.durationMs >= 0) {
    return `${test.durationMs} ms`;
  }

  return "—";
}

/**
 * @param {Record<string, unknown>} test
 * @returns {string | null}
 */
function testCaseStartedAt(test) {
  return typeof test.startedAt === "string" ? test.startedAt : null;
}

/**
 * @param {string | null} iso
 */
function formatRunAt(iso) {
  if (!iso) {
    return "—";
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("it-IT", {
    day    : "2-digit"
  , month  : "2-digit"
  , year   : "2-digit"
  , hour   : "2-digit"
  , minute : "2-digit"
  , second : "2-digit"
  });
}

/**
 * @param {Record<string, unknown> | undefined} row
 * @param {Record<string, unknown>} entry
 */
function scriptStatusDetail(row, entry) {
  if (entry.blocked === true) {
    return String(entry.blockedReason ?? "blocked");
  }

  if (!row) {
    return "—";
  }

  const status = String(row.status ?? "");

  if (status === "skipped") {
    return typeof row.reason === "string" && row.reason.trim()
      ? row.reason.trim()
      : "—";
  }

  if (status === "failed") {
    /** @type {string[]} */
    const failures = [];

    for (const test of extractScriptTests(row)) {
      if (!test.ok && !test.skipped) {
        const name = String(test.name ?? "").trim();
        const detail = String(test.detail ?? "").trim();
        const line = name && detail ? `${name}: ${detail}` : (detail || name);

        if (line) {
          failures.push(line);
        }
      }
    }

    if (failures.length > 0) {
      return failures.join(" · ");
    }

    if (typeof row.stderr === "string" && row.stderr.trim()) {
      return row.stderr.trim();
    }

    if (typeof row.exitCode === "number" && row.exitCode !== 0) {
      return `exit code ${row.exitCode}`;
    }

    return "—";
  }

  return "—";
}

/**
 * Descrizione narrativa di cosa significa l'errore (non una soluzione).
 *
 * @param {string} error
 * @param {Record<string, unknown>} entry
 * @param {string} testStatus
 * @returns {string}
 */
function buildErrorDescription(error, entry, testStatus) {
  const text = error.toLowerCase();

  if (entry.blocked === true) {
    return "Lo script non è eseguibile perché un prerequisito di ambiente non risulta soddisfatto.";
  }

  if (testStatus === "skipped") {
    if (text.includes("raggiungibile") || text.includes("econnrefused") || text.includes("fetch failed")) {
      return "Il test è stato saltato: il servizio remoto non era raggiungibile al momento dell'esecuzione.";
    }

    return "Il test è stato saltato perché una condizione preliminare richiesta non era disponibile.";
  }

  if (text.includes("404") || text.includes("not found")) {
    return "Il server indica che l'endpoint o la risorsa richiesta non esiste (risposta 404).";
  }

  if (text.includes("401") || text.includes("unauthorized")) {
    return "La richiesta è stata rifiutata: manca un'autenticazione valida o la sessione non è attiva.";
  }

  if (text.includes("403") || text.includes("forbidden")) {
    return "La richiesta è autenticata ma non ha i permessi necessari per l'operazione.";
  }

  if (text.includes("econnrefused") || text.includes("fetch failed") || text.includes("raggiungibile")) {
    return "Il client non riesce a contattare il servizio: host spento, porta errata o rete non disponibile.";
  }

  if (text.includes("expected") && text.includes("got")) {
    return "La risposta o lo stato osservato non corrisponde a quello atteso dal test.";
  }

  if (text.includes("json") || text.includes("parse") || text.includes("syntax")) {
    return "Il payload ricevuto o prodotto non è un JSON valido o non è interpretabile come previsto.";
  }

  if (text.includes("timeout") || text.includes("timed out")) {
    return "L'operazione ha superato il tempo massimo di attesa senza completarsi.";
  }

  if (text.includes("assert") || text.includes("mismatch")) {
    return "Un'asserzione del test non è stata soddisfatta rispetto al comportamento atteso.";
  }

  const narrative = buildTestNarrative(error);

  if (narrative && !narrative.startsWith("Verifica che ")) {
    return narrative;
  }

  return `Il test ha segnalato: ${error}.`;
}

/**
 * @param {Record<string, unknown>} entry
 */
function renderScriptFileNarrative(entry) {
  const narrative = getScriptNarrative(entry);
  const rel       = String(entry.rel ?? "");
  const hasDoc    = typeof entry.docHeader === "string" && entry.docHeader.trim().length > 0;

  if (hasDoc) {
    return `<div class="ttecnici-script-narrative-line summary-test-narrative">
      <span class="ttecnici-script-narrative-text ttecnici-script-narrative-text--clickable" data-tt-script-doc="${escapeHtml(rel)}" title="Apri documentazione test" aria-label="Apri documentazione test">${escapeHtml(narrative)}</span>
    </div>`;
  }

  return `<div class="ttecnici-script-narrative-line summary-test-narrative">
    <span class="ttecnici-script-narrative-text">${escapeHtml(narrative)}</span>
  </div>`;
}

/**
 * @param {string} rel
 * @returns {string}
 */
function getScriptDocHeader(rel) {
  const scripts = Array.isArray(scriptCatalog?.scripts) ? scriptCatalog.scripts : [];
  const entry   = scripts.find((item) => String(item.rel) === rel);

  return typeof entry?.docHeader === "string" ? entry.docHeader.trim() : "";
}

/**
 * @param {string} rel
 */
function openScriptDocModal(rel) {
  const docHeader = getScriptDocHeader(rel);

  if (!docHeader) {
    return;
  }

  const modal = document.getElementById("ttecnici-doc-modal");

  if (!modal) {
    return;
  }

  const title = modal.querySelector("#ttecnici-doc-modal-title");
  const body  = modal.querySelector(".ttecnici-doc-modal-body");

  if (!(title instanceof HTMLElement) || !(body instanceof HTMLElement)) {
    return;
  }

  title.textContent = rel;
  body.textContent  = docHeader;
  modal.classList.remove("hidden");
  modal.removeAttribute("hidden");
  document.body.classList.add("ttecnici-modal-open");
  modal.querySelector(".ttecnici-modal-close")?.focus();
}

function closeScriptDocModal() {
  const modal = document.getElementById("ttecnici-doc-modal");

  if (!modal) {
    return;
  }

  modal.classList.add("hidden");
  modal.setAttribute("hidden", "");
  document.body.classList.remove("ttecnici-modal-open");
}

/** Collega overlay, chiusura e Escape del popup documentazione script (una sola volta). */
let scriptDocModalBound = false;

function bindScriptDocModalGlobal() {
  if (scriptDocModalBound) {
    return;
  }

  scriptDocModalBound = true;

  const modal = document.getElementById("ttecnici-doc-modal");

  if (!modal) {
    return;
  }

  modal.querySelector(".ttecnici-modal-close")?.addEventListener("click", () => {
    closeScriptDocModal();
  });

  modal.addEventListener("click", (ev) => {
    if (ev.target === modal) {
      closeScriptDocModal();
    }
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !modal.classList.contains("hidden")) {
      closeScriptDocModal();
    }
  });
}

/**
 * @param {Record<string, unknown>} test
 * @param {string} testStatus
 * @returns {string | null}
 */
function getTestCasePrimaryError(test, testStatus) {
  if (testStatus !== "failed" && testStatus !== "skipped") {
    return null;
  }

  const detail = String(test.detail ?? "").trim();

  if (detail && detail !== "—") {
    return detail;
  }

  return null;
}

/**
 * Cosa stava verificando il test quando è emerso l'errore (il check, non il comando).
 *
 * @param {string} name
 */
function buildTestCheckExplanation(name) {
  const raw = String(name ?? "").trim();

  if (!raw) {
    return "";
  }

  if (raw === "skipped") {
    return "Il check non è stato eseguito.";
  }

  const arrowMatch = raw.match(/^(.+?)\s*(?:→|->)\s*(.+)$/u);

  if (arrowMatch) {
    return `Check in corso: verifica che ${arrowMatch[1].trim()} corrisponda a «${arrowMatch[2].trim()}».`;
  }

  if (raw.includes(" — ")) {
    const [lead, rest] = raw.split(" — ").map((part) => part.trim());
    const subject = rest || lead;

    if (/^(GET|POST|PUT|PATCH|DELETE)\s+\S+/iu.test(lead)) {
      return `Check in corso: ${subject}.`;
    }

    return `Check in corso: ${lead} — ${subject}.`;
  }

  if (/^(GET|POST|PUT|PATCH|DELETE)\s+\S+/iu.test(raw)) {
    return "Check in corso: validazione della risposta attesa dall'endpoint.";
  }

  if (/health|raggiungibile/i.test(raw)) {
    return "Check in corso: servizio raggiungibile e operativo.";
  }

  if (/^setup\b/iu.test(raw) || /^cleanup\b/iu.test(raw)) {
    return `Check in corso: preparazione o ripulitura del contesto — ${raw}.`;
  }

  if (/login|logout|sessione|token|register|registrazione/i.test(raw)) {
    return `Check in corso: flusso di autenticazione — ${raw}.`;
  }

  if (/contract|envelope|i18n|UI|Web\b/i.test(raw)) {
    return `Check in corso: comportamento funzionale — ${raw}.`;
  }

  return `Check in corso: ${raw}.`;
}

/**
 * @param {Record<string, unknown>} test
 * @param {Record<string, unknown>} entry
 * @param {string} testStatus
 * @param {string} testName
 * @param {string | null} [stepComment]
 */
function renderTestCaseDetailContext(test, entry, testStatus, testName, stepComment) {
  const primaryError = getTestCasePrimaryError(test, testStatus);

  if (!primaryError) {
    if (testStatus === "—") {
      const stepText = typeof stepComment === "string" ? stepComment.trim() : "";

      if (stepText) {
        return `<div class="ttecnici-test-step-line">${escapeHtml(stepText)}</div>`;
      }
    }

    return "—";
  }

  const errorView = truncateDetail(primaryError, 280);
  const errorDescription = buildErrorDescription(primaryError, entry, testStatus);
  const stepText = typeof stepComment === "string" ? stepComment.trim() : "";
  const contextLine = stepText
    ? `<div class="ttecnici-test-step-line">${escapeHtml(stepText)}</div>`
    : `<div class="ttecnici-test-check-line">${escapeHtml(buildTestCheckExplanation(testName))}</div>`;

  const errorLine = `<div class="ttecnici-script-error-line" title="${escapeHtml(errorView.title)}">${escapeHtml(errorView.label)}</div>`;

  const descriptionLine = `<div class="ttecnici-script-error-desc-line">${escapeHtml(errorDescription)}</div>`;

  return `<div class="ttecnici-script-detail-context">${contextLine}${errorLine}${descriptionLine}</div>`;
}

/**
 * @param {string} text
 * @param {number} [max]
 */
function truncateDetail(text, max = 160) {
  if (text.length <= max) {
    return { label: text, title: text };
  }

  return {
    label : `${text.slice(0, max)}…`
  , title : text
  };
}

/**
 * @param {Record<string, unknown>} entry
 * @param {Map<string, Record<string, unknown>>} reportByScript
 * @param {boolean} running
 * @param {Record<string, unknown> | null | undefined} status
 */
function renderScriptRow(entry, reportByScript, running, status) {
  const e = entry;
  const rel = String(e.rel ?? "");
  const last = reportByScript.get(rel);
  const lastStatus = last ? String(last.status ?? "—") : "—";
  const duration = last?.durationMs != null ? `${last.durationMs} ms` : "—";
  const runStartedAt = scriptRunStartedAt(last);
  const runAtLabel = formatRunAt(runStartedAt);
  const statusDetail = scriptStatusDetail(last, e);
  const detailView = truncateDetail(statusDetail);
  const detailClass = lastStatus === "failed"
    ? "status-detail-cell status-fail"
    : lastStatus === "skipped"
      ? "status-detail-cell status-skip"
      : "status-detail-cell";
  const blocked = e.blocked === true;
  const blockedReason = e.blockedReason ? String(e.blockedReason) : "blocked";
  const runBtn = blocked
    ? `<button class="action btn-run-one btn-run-icon" type="button" disabled title="${escapeHtml(blockedReason)}" aria-label="${escapeHtml(blockedReason)}">—</button>`
    : renderRunIconButton({
        dataRunScript : rel
      , disabled      : running
      , runningActive : isScriptRunActive("test", rel, status, running)
      , title         : `Esegui ${rel}`
      });

  return `<tr${renderRunRowAttrs("test", rel, null, status, running)}>
    <td><code>${escapeHtml(rel)}</code></td>
    <td class="${statusClass(lastStatus)}">${escapeHtml(lastStatus)}</td>
    <td class="${detailClass}" title="${escapeHtml(detailView.title)}">${escapeHtml(detailView.label)}</td>
    <td>${escapeHtml(duration)}</td>
    <td class="run-at-cell"${runStartedAt ? ` title="${escapeHtml(runStartedAt)}"` : ""}>${escapeHtml(runAtLabel)}</td>
    <td>${runBtn}</td>
  </tr>`;
}

/**
 * @param {HTMLElement} root
 * @param {boolean} collapsed
 */
function setAllSuitesCollapsed(root, collapsed) {
  root.querySelectorAll(".test-suite-group").forEach((group) => {
    const toggle = group.querySelector("[data-toggle-suite]");
    const suite  = toggle?.getAttribute("data-toggle-suite");

    if (!suite) {
      return;
    }

    group.classList.toggle("is-collapsed", collapsed);

    if (collapsed) {
      collapsedSuites.add(suite);
    } else {
      collapsedSuites.delete(suite);
    }

    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  });
}

/**
 * @param {"xlsx" | "json"} format
 * @param {HTMLButtonElement} button
 * @param {string | null} [suite]
 */
async function triggerReportExport(format, button, suite = null) {
  if (button.hasAttribute("disabled")) {
    return;
  }

  const label = button.textContent ?? "Export";
  button.setAttribute("disabled", "true");
  button.textContent = "Export…";
  button.classList.add("is-loading");

  try {
    const query = new URLSearchParams({ format });

    if (suite) {
      query.set("suite", suite);
    }

    const res = await fetch(`/api/export?${query.toString()}`);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        typeof err.error === "string" ? err.error : `HTTP ${res.status}`
      );
    }

    const blob     = await res.blob();
    const cd       = res.headers.get("Content-Disposition") ?? "";
    const match    = cd.match(/filename="([^"]+)"/);
    const fallback = format === "json" ? "report.json" : "report.xlsx";
    const filename = match?.[1] ?? fallback;
    const url      = URL.createObjectURL(blob);
    const link     = document.createElement("a");

    link.href     = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(err instanceof Error ? err.message : "Export fallito");
  } finally {
    button.removeAttribute("disabled");
    button.textContent = label;
    button.classList.remove("is-loading");
  }
}

/**
 * @param {HTMLElement} root
 * @param {{ xlsxId: string, jsonId: string, suite?: string | null }} ids
 */
function bindExportActions(root, ids) {
  const xlsxBtn = root.querySelector(`#${ids.xlsxId}`);
  const jsonBtn = root.querySelector(`#${ids.jsonId}`);
  const suite   = ids.suite ?? null;

  xlsxBtn?.addEventListener("click", () => {
    triggerReportExport("xlsx", /** @type {HTMLButtonElement} */ (xlsxBtn), suite);
  });

  jsonBtn?.addEventListener("click", () => {
    triggerReportExport("json", /** @type {HTMLButtonElement} */ (jsonBtn), suite);
  });
}

/**
 * @param {HTMLButtonElement} button
 */
async function triggerTecniciAnalysis(button) {
  if (button.hasAttribute("disabled")) {
    return;
  }

  const label = button.textContent ?? "Genera analisi";
  button.setAttribute("disabled", "true");
  button.textContent = "Analisi…";
  button.classList.add("is-loading");

  try {
    const res = await fetch("/api/report/tecnici-analysis", { method: "POST" });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        typeof err.error === "string" ? err.error : `HTTP ${res.status}`
      );
    }

    const data = await res.json();
    const htmlUrl = typeof data?.urls?.html === "string"
      ? data.urls.html
      : "/api/report/tecnici-analysis/html";

    window.open(htmlUrl, "_blank", "noopener");

    const openLink = document.getElementById("btn-tt-open-analysis");

    if (openLink instanceof HTMLAnchorElement) {
      openLink.href = htmlUrl;
      openLink.removeAttribute("aria-disabled");
      openLink.classList.remove("is-disabled");
    }
  } catch (err) {
    alert(err instanceof Error ? err.message : "Generazione analisi fallita");
  } finally {
    button.removeAttribute("disabled");
    button.textContent = label;
    button.classList.remove("is-loading");
  }
}

/**
 * @param {HTMLElement} root
 */
function bindTecniciAnalysisAction(root) {
  const btn = root.querySelector("#btn-tt-generate-analysis");

  btn?.addEventListener("click", () => {
    triggerTecniciAnalysis(/** @type {HTMLButtonElement} */ (btn));
  });
}

/**
 * @param {HTMLElement} root
 */
function bindTestActions(root) {
  root.querySelector("#btn-run-all")?.addEventListener("click", async () => {
    selectRunTarget({ section: "test", runAll: true });
    const res = await fetch("/api/run", { method: "POST" });
    if (!res.ok && res.status !== 202) {
      alert("Impossibile avviare run-all");
      return;
    }
    pollRunStatus();
  });

  root.querySelectorAll("[data-run-suite]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const suite = btn.getAttribute("data-run-suite");

      if (!suite || btn.hasAttribute("disabled")) {
        return;
      }

      selectRunTarget({ section: "test", suite }, btn);

      const res = await fetch("/api/run/suite", {
        method  : "POST"
      , headers : { "Content-Type": "application/json" }
      , body    : JSON.stringify({ suite })
      });

      if (!res.ok && res.status !== 202) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Impossibile avviare il gruppo");
        return;
      }

      pollRunStatus();
    });
  });

  root.querySelectorAll("[data-run-script]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const script = btn.getAttribute("data-run-script");

      if (!script || btn.hasAttribute("disabled")) {
        return;
      }

      selectRunTarget({ section: "test", script }, btn);

      const res = await fetch("/api/run/one", {
        method  : "POST"
      , headers : { "Content-Type": "application/json" }
      , body    : JSON.stringify({ script })
      });

      if (!res.ok && res.status !== 202) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Impossibile avviare lo script");
        return;
      }

      pollRunStatus();
    });
  });

  root.querySelectorAll("[data-toggle-suite]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const suite = btn.getAttribute("data-toggle-suite");

      if (!suite) {
        return;
      }

      const group = root.querySelector(`#suite-${suite}`);

      if (!group) {
        return;
      }

      const collapsed = group.classList.toggle("is-collapsed");

      if (collapsed) {
        collapsedSuites.add(suite);
      } else {
        collapsedSuites.delete(suite);
      }

      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });
  });

  root.querySelector("#btn-expand-all")?.addEventListener("click", () => {
    setAllSuitesCollapsed(root, false);
  });

  root.querySelector("#btn-collapse-all")?.addEventListener("click", () => {
    setAllSuitesCollapsed(root, true);
  });

  root.querySelectorAll("[data-jump-suite]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const suite = btn.getAttribute("data-jump-suite");

      if (!suite) {
        return;
      }

      const group = root.querySelector(`#suite-${suite}`);

      if (group) {
        group.classList.remove("is-collapsed");
        collapsedSuites.delete(suite);
        const toggle = group.querySelector("[data-toggle-suite]");
        toggle?.setAttribute("aria-expanded", "true");
        group.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      root.querySelectorAll("[data-jump-suite]").forEach((el) => {
        el.classList.toggle("active", el.getAttribute("data-jump-suite") === suite);
      });
    });
  });
}

// --- tab Requisiti e Servizi (dev-api) ---
/**
 * @param {Record<string, unknown>} req
 */
function renderRequisiti(req) {
  const root = document.getElementById("section-requisiti");
  if (!root) {
    return;
  }

  const stack = Array.isArray(req.stack) ? req.stack : [];
  const envFiles = Array.isArray(req.envFiles) ? req.envFiles : [];
  const commands = Array.isArray(req.commands) ? req.commands : [];
  const prereqs = Array.isArray(req.prerequisites) ? req.prerequisites : [];

  const stackRows = stack.map((row) => {
    const r = /** @type {Record<string, string>} */ (row);
    return `<tr><td>${escapeHtml(r.label ?? r.app ?? "")}</td><td>${escapeHtml(r.tech ?? "")}</td></tr>`;
  }).join("");

  const envRows = envFiles.map((row) => {
    const r = /** @type {Record<string, string>} */ (row);
    return `<tr><td>${escapeHtml(r.label ?? "")}</td><td><code>${escapeHtml(r.path ?? "")}</code></td></tr>`;
  }).join("");

  const cmdBlocks = commands.map((row) => {
    const r = /** @type {Record<string, string>} */ (row);
    const cmd = r.cmd ?? "";
    return `
      <div class="cmd-block">
        <span class="muted">${escapeHtml(r.label ?? "")}</span>
        <code>${escapeHtml(cmd)}</code>
        <button class="action" type="button" data-copy="${escapeHtml(cmd)}">Copia</button>
      </div>`;
  }).join("");

  root.innerHTML = `
    <div class="panel">
      <h2>Prerequisiti</h2>
      <ul>${prereqs.map((p) => `<li>${escapeHtml(String(p))}</li>`).join("")}</ul>
      <p class="muted">Node minimo: ${escapeHtml(String(req.nodeMin ?? "20"))}</p>
    </div>
    <div class="panel">
      <h2>Stack</h2>
      <table class="data"><thead><tr><th>App</th><th>Tecnologia</th></tr></thead><tbody>${stackRows}</tbody></table>
    </div>
    <div class="panel">
      <h2>File env</h2>
      <table class="data"><thead><tr><th>Servizio</th><th>Path</th></tr></thead><tbody>${envRows}</tbody></table>
    </div>
    <div class="panel">
      <h2>Comandi setup</h2>
      ${cmdBlocks}
      <p class="muted" style="margin-top:0.75rem"><a href="/${escapeHtml(String(req.readmeUrl ?? "README.md"))}" target="_blank" rel="noopener">README root</a></p>
    </div>`;

  root.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => copyCmd(btn.getAttribute("data-copy") ?? ""));
  });
}

/**
 * @param {{ services: Array<Record<string, unknown>>, checkedAt?: string }} payload
 */
function renderServizi(payload) {
  const root = document.getElementById("section-servizi");
  if (!root) {
    return;
  }

  const services = payload.services ?? [];
  const cards = services.map((svc) => {
    const up = svc.status === "up";
    const latency = svc.latencyMs != null ? `${svc.latencyMs} ms` : "—";
    const isDaemon = svc.port == null && (svc.processScript || svc.id === "friendbot");
    const portLabel = svc.port != null
      ? `:${escapeHtml(String(svc.port))}`
      : isDaemon
        ? "daemon"
        : "—";
    const hint = up
      ? ""
      : `<p class="muted">Avvia <code>npm run dev</code> o lo script dedicato.</p>`;
    const healthLine = isDaemon
      ? `<p class="muted"><code>${escapeHtml(String(svc.processScript ?? "friend-bot.mjs"))}</code></p>`
      : `<p class="muted"><code>${escapeHtml(String(svc.healthUrl ?? ""))}</code></p>`;
    const docs = svc.docs
      ? `<a href="${escapeHtml(String(svc.openUrl ?? ""))}" target="_blank" rel="noopener">Docs</a>`
      : svc.openUrl
        ? `<a href="${escapeHtml(String(svc.openUrl))}" target="_blank" rel="noopener">Apri</a>`
        : isDaemon
          ? `<span class="muted">Processo background</span>`
          : "";

    return `
      <article class="service-card">
        <h3>${escapeHtml(String(svc.label ?? svc.id ?? ""))}</h3>
        <span class="badge ${up ? "up" : "down"}">${up ? "UP" : "DOWN"}</span>
        <span class="muted"> · ${portLabel} · ${latency}</span>
        ${healthLine}
        ${hint}
        <div class="btn-row">${docs}</div>
      </article>`;
  }).join("");

  root.innerHTML = `
    <div class="panel">
      <div class="btn-row" style="margin-top:0">
        <button class="action primary" type="button" id="btn-refresh-services">Aggiorna</button>
        <label class="muted"><input type="checkbox" id="toggle-auto-refresh" /> Auto-refresh 30s</label>
        <span class="muted">Ultimo check: ${escapeHtml(payload.checkedAt ?? "—")}</span>
      </div>
    </div>
    <div class="service-grid">${cards}</div>`;

  document.getElementById("btn-refresh-services")?.addEventListener("click", () => loadServizi());
  document.getElementById("toggle-auto-refresh")?.addEventListener("change", (ev) => {
    const checked = /** @type {HTMLInputElement} */ (ev.target).checked;
    if (servicesRefreshTimer) {
      clearInterval(servicesRefreshTimer);
      servicesRefreshTimer = null;
    }
    if (checked) {
      servicesRefreshTimer = window.setInterval(() => loadServizi(), 30_000);
    }
  });
}

async function loadServizi() {
  const payload = await apiGet("/api/dev/services");
  renderServizi(payload);
  return payload;
}

/**
 * @param {string} status
 */
function statusClass(status) {
  if (status === "passed") {
    return "status-pass";
  }
  if (status === "failed") {
    return "status-fail";
  }
  if (status === "skipped") {
    return "status-skip";
  }
  return "";
}

/**
 * @param {{ section: "test" | "testtecnici" | "testfunzionali", script?: string | null, testCase?: string | null, suite?: string | null, dependencies?: string[], runAll?: boolean }} target
 * @param {HTMLElement} [btn]
 */
function selectRunTarget(target, btn) {
  selectedRunTarget = {
    section      : target.section
  , script       : target.script ?? null
  , testCase     : target.testCase ?? null
  , suite        : target.suite ?? null
  , dependencies : Array.isArray(target.dependencies) ? target.dependencies.map((dep) => String(dep)) : []
  , runAll       : target.runAll === true
  };

  if (target.section === "testtecnici" && target.script) {
    expandedTtecniciFiles.add(target.script);
  }

  if (target.section === "testfunzionali" && target.script) {
    expandedTfuncFiles.add(target.script);
  }

  refreshTestViews();
  focusSelectedRunTarget();
}

function focusSelectedRunTarget() {
  if (!selectedRunTarget) {
    return;
  }

  const sectionRoot = document.getElementById(
    selectedRunTarget.section === "testtecnici"
      ? "section-testtecnici"
      : selectedRunTarget.section === "testfunzionali"
        ? "section-testfunzionali"
        : "section-test"
  );

  if (!sectionRoot) {
    return;
  }

  if (selectedRunTarget.suite && !selectedRunTarget.script) {
    const prefix = selectedRunTarget.section === "testtecnici"
      ? "tt-suite-"
      : selectedRunTarget.section === "testfunzionali"
        ? "tf-suite-"
        : "suite-";
    document.getElementById(`${prefix}${selectedRunTarget.suite}`)?.scrollIntoView({
      behavior: "smooth"
    , block   : "nearest"
    });
    return;
  }

  /** @type {HTMLElement | null} */
  let matchBtn = null;

  if (selectedRunTarget.testCase && selectedRunTarget.script) {
    const caseRow = sectionRoot.querySelector(
      `tr[data-tt-script="${cssEscapeAttr(selectedRunTarget.script)}"][data-tt-case="${cssEscapeAttr(selectedRunTarget.testCase)}"]`
    );

    if (caseRow) {
      caseRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }

    sectionRoot.querySelectorAll("[data-run-case]").forEach((btn) => {
      if (matchBtn) {
        return;
      }

      if (btn.getAttribute("data-run-script") === selectedRunTarget.script
        && btn.getAttribute("data-run-case") === selectedRunTarget.testCase) {
        matchBtn = /** @type {HTMLElement} */ (btn);
      }
    });
  } else if (selectedRunTarget.script) {
    sectionRoot.querySelectorAll("[data-run-script]:not([data-run-case])").forEach((btn) => {
      if (matchBtn) {
        return;
      }

      if (btn.getAttribute("data-run-script") === selectedRunTarget.script) {
        matchBtn = /** @type {HTMLElement} */ (btn);
      }
    });
  }

  matchBtn?.closest("tr")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function refreshTestViews() {
  if (!lastTestView) {
    return;
  }

  renderTest(lastTestView.report, lastTestView.status, lastTestView.catalog);
  renderTestTecnici(lastTestView.report, lastTestView.status, lastTestView.catalog, tecniciMeta);
  renderTestFunzionali(lastTestView.report, lastTestView.status, lastTestView.catalog, funzionaliMeta);
}

/**
 * @param {"test" | "testtecnici"} section
 * @param {string | null | undefined} scriptRel
 * @param {string | null | undefined} testCase
 * @param {Record<string, unknown> | null | undefined} status
 * @param {boolean} running
 */
function isRunningTarget(section, scriptRel, testCase, status, running) {
  if (!running || !status?.running) {
    return false;
  }

  const mode = status.mode;
  const targetScript = typeof status.targetScript === "string" ? status.targetScript : null;
  const targetTestCase = typeof status.targetTestCase === "string" ? status.targetTestCase : null;
  const currentScript = typeof status.currentScript === "string" ? status.currentScript : null;

  if (mode === "case") {
    return targetScript === scriptRel && targetTestCase === testCase;
  }

  if (mode === "funzionali") {
    return (testCase == null || testCase === "") && currentScript === scriptRel;
  }

  if (mode === "single") {
    return targetScript === scriptRel && (testCase == null || testCase === "");
  }

  if ((mode === "suite" || mode === "all") && (testCase == null || testCase === "")) {
    return currentScript === scriptRel;
  }

  return false;
}

/**
 * @param {"test" | "testtecnici"} section
 * @param {string} scriptRel
 * @param {Record<string, unknown> | null | undefined} status
 * @param {boolean} running
 */
function isScriptRunActive(section, scriptRel, status, running) {
  if (!running || !status?.running) {
    return false;
  }

  const mode = status.mode;
  const targetScript = typeof status.targetScript === "string" ? status.targetScript : null;
  const currentScript = typeof status.currentScript === "string" ? status.currentScript : null;

  if (mode === "single" || mode === "case") {
    return targetScript === scriptRel;
  }

  if (mode === "suite" || mode === "all") {
    return currentScript === scriptRel;
  }

  if (mode === "funzionali") {
    return currentScript === scriptRel;
  }

  return false;
}

/**
 * @param {"test" | "testtecnici" | "testfunzionali"} section
 * @param {string | null | undefined} scriptRel
 * @param {string | null | undefined} testCase
 */
function isSelectedRunRow(section, scriptRel, testCase) {
  if (!selectedRunTarget || selectedRunTarget.section !== section) {
    return false;
  }

  if (testCase) {
    return selectedRunTarget.script === scriptRel && selectedRunTarget.testCase === testCase;
  }

  return selectedRunTarget.script === scriptRel
    && !selectedRunTarget.testCase
    && !selectedRunTarget.suite;
}

/**
 * @param {"test" | "testtecnici"} section
 * @param {string} suite
 */
function isSelectedRunSuite(section, suite) {
  return selectedRunTarget?.section === section
    && selectedRunTarget.suite === suite
    && !selectedRunTarget.script
    && !selectedRunTarget.testCase
    && !selectedRunTarget.runAll;
}

/**
 * @param {"test" | "testtecnici"} section
 * @param {string | null | undefined} scriptRel
 * @param {string | null | undefined} testCase
 * @param {Record<string, unknown> | null | undefined} status
 * @param {boolean} running
 */
function buildRunRowClasses(section, scriptRel, testCase, status, running) {
  /** @type {string[]} */
  const classes = [];

  if (isSelectedRunRow(section, scriptRel, testCase) || isRunningTarget(section, scriptRel, testCase, status, running)) {
    classes.push("is-run-selected");
  }

  if (isRunningTarget(section, scriptRel, testCase, status, running)) {
    classes.push("is-run-active");
  }

  return classes;
}

/**
 * @param {"test" | "testtecnici"} section
 * @param {string | null | undefined} scriptRel
 * @param {string | null | undefined} testCase
 * @param {Record<string, unknown> | null | undefined} status
 * @param {boolean} running
 */
function renderRunRowAttrs(section, scriptRel, testCase, status, running) {
  const classes = buildRunRowClasses(section, scriptRel, testCase, status, running);

  return classes.length > 0 ? ` class="${classes.join(" ")}"` : "";
}

/**
 * @param {"test" | "testtecnici"} section
 * @param {string} suite
 * @param {Record<string, unknown> | null | undefined} status
 * @param {boolean} running
 */
function renderSuiteGroupClass(section, suite, status, running) {
  const classes = [];

  if (isSelectedRunSuite(section, suite) || isSelectedRunAll(section)) {
    classes.push("is-run-selected");
  }

  if (isSuiteRunActive(section, suite, status, running)) {
    classes.push("is-run-active");
  }

  return classes.length > 0 ? ` ${classes.join(" ")}` : "";
}

// --- tab Test custom — catalogo testScript e run ---
/**
 * @param {Record<string, unknown> | null} report
 * @param {Record<string, unknown> | null} status
 * @param {{ scripts?: Array<Record<string, unknown>> } | null} catalog
 */
function renderTest(report, status, catalog) {
  const root = document.getElementById("section-test");
  if (!root) {
    return;
  }

  const running = status?.running === true;
  const progress = /** @type {{ current?: number, total?: number } | undefined} */ (status?.progress);
  const pct = progress?.total ? Math.round(((progress.current ?? 0) / progress.total) * 100) : 0;
  const runMode = status?.mode === "single"
    ? "singolo"
    : status?.mode === "suite"
      ? "gruppo"
      : "completo";
  const runLabel = running
    ? (status?.targetScript
      ? `Run ${runMode}: ${String(status.targetScript)}`
      : `Run ${runMode} in corso…`)
    : "";

  /** @type {Map<string, Record<string, unknown>>} */
  const reportByScript = new Map();

  if (report && Array.isArray(report.scripts)) {
    for (const row of report.scripts) {
      const r = /** @type {Record<string, unknown>} */ (row);
      if (typeof r.script === "string") {
        reportByScript.set(r.script, r);
      }
    }
  }

  const catalogScripts = Array.isArray(catalog?.scripts)
    ? catalog.scripts
    : (report && Array.isArray(report.scripts)
      ? report.scripts.map((row) => {
      const r = /** @type {Record<string, unknown>} */ (row);
          const rel = String(r.script ?? "");
          const parts = rel.split("/");
          return {
            rel
          , suite : parts.length > 1 ? parts[0] : "root"
          , blocked: false
          };
        })
      : []);

  const scripts = catalogScripts.map((e) => /** @type {Record<string, unknown>} */ (e));

  const groups = groupScriptsBySuite(scripts);

  seedAllSuitesCollapsed(groups, collapsedSuites, "test");

  const analysis = buildTestAnalysis(groups, scripts, reportByScript, report);

  const scope = report && (report.passed != null || report.failed != null)
    ? (status?.mode === "single" || report.totalScripts === 1 ? "ultimo run singolo" : "ultimo run completo")
    : null;

  const suiteNav = groups.map((group) => `
    <button type="button" data-jump-suite="${escapeHtml(group.suite)}">
      ${escapeHtml(group.label)} <span class="muted">(${group.items.length})</span>
    </button>`
  ).join("");

  const suitePanels = groups.map((group) => {
    const counts = countSuiteResults(group.items, reportByScript);
    const collapsed = collapsedSuites.has(group.suite);
    const bodyRows = group.items
      .map((entry) => renderScriptRow(entry, reportByScript, running, status))
      .join("");

    const folderPath = group.suite === "root" ? "testScript/" : `testScript/${group.suite}/`;

    return `
      <section class="test-suite-group${collapsed ? " is-collapsed" : ""}${renderSuiteGroupClass("test", group.suite, status, running)}" id="suite-${escapeHtml(group.suite)}">
        <div class="test-suite-header-row">
          <button
            type="button"
            class="test-suite-toggle"
            data-toggle-suite="${escapeHtml(group.suite)}"
            aria-expanded="${collapsed ? "false" : "true"}"
          >
            <span class="suite-chevron" aria-hidden="true"></span>
            <span class="suite-title">
              <span class="suite-name">${escapeHtml(group.label)}</span>
              <span class="suite-path">${escapeHtml(folderPath)}</span>
              <span class="suite-count muted">${group.items.length} script</span>
            </span>
          </button>
          <div class="test-suite-actions">
            ${renderRunSuiteButton("test", group.suite, status, running)}
            <span class="suite-outcome">${renderSuiteOutcomeBadge(counts)}</span>
          </div>
        </div>
        <div class="test-suite-body">
          <table class="data test-suite-table">
            ${TEST_TABLE_COLGROUP}
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
      </section>`;
    }).join("");

  root.innerHTML = `
    <div class="test-page-layout">
      ${renderTestAnalysisPanel(analysis, running, pct)}
      <div class="test-page-main">
    <div class="panel">
          <h2>Esecuzione</h2>
          <div class="btn-row" style="margin-top:0">
        ${renderRunAllButton("btn-run-all", "test", status, running)}
            <a class="action" href="/api/report/html${report?.generatedAt ? `?t=${encodeURIComponent(String(report.generatedAt))}` : ""}" target="_blank" rel="noopener">Apri report HTML</a>
            <button class="action" type="button" id="btn-export-xlsx" ${report ? "" : "disabled"}>Export Excel</button>
            <button class="action" type="button" id="btn-export-json" ${report ? "" : "disabled"}>Export JSON</button>
      </div>
          ${running ? `<p class="muted">${escapeHtml(runLabel)}</p>` : ""}
          ${scope ? `<p class="muted">${escapeHtml(scope)}</p>` : `<p class="muted">Nessun report — esegui i test per generare <code>latest.json</code>.</p>`}
    </div>
    <div class="panel">
          <h2>Script per argomento</h2>
          <p class="muted">Struttura allineata alle cartelle <code>testScript/</code></p>
          ${groups.length > 0
            ? `<div class="test-suite-toolbar">
                 <nav class="test-suite-nav" aria-label="Salta a cartella">${suiteNav}</nav>
                 <div class="test-suite-bulk">
                   ${treeBulkToggleHtml("btn-expand-all", "btn-collapse-all", {
                     expandLabel  : "Espandi tutti i gruppi"
                   , collapseLabel: "Collassa tutti i gruppi"
                   , groupLabel   : "Espandi o collassa tutti i gruppi test"
                   })}
                 </div>
               </div>
               <div class="test-suites-wrap">
                 <table class="data test-suite-table test-suite-head">
                   ${TEST_TABLE_COLGROUP}
                   <thead>
                     <tr><th>Script</th><th>Ultimo status</th><th>Dettaglio</th><th>Durata</th><th>Data/ora</th><th>Azioni</th></tr>
                   </thead>
                 </table>
                 ${suitePanels}
               </div>`
            : `<p class="muted">Catalogo non disponibile.</p>`}
        </div>
      </div>
    </div>`;

  lastTestView = { report, status, catalog };
  bindTestActions(root);
  bindExportActions(root, { xlsxId: "btn-export-xlsx", jsonId: "btn-export-json" });
}

/**
 * @param {Record<string, unknown> | undefined} row
 */
function renderScriptTestCasesTable(row) {
  const tests = extractScriptTests(row);

  if (tests.length === 0) {
    return `<p class="muted ttecnici-no-cases">Nessun test case — esegui lo script per popolare il dettaglio.</p>`;
  }

  const rows = tests.map((test) => {
    const testName = String(test.name ?? "");
    const status = testCaseStatus(/** @type {{ ok: boolean, skipped: boolean }} */ (test));
    const detail = test.detail ? String(test.detail) : "—";
    const narrative = buildTestNarrative(testName);

    return `<tr>
      <td class="summary-test-cell">
        <div class="summary-test-definition">${escapeHtml(testName)}</div>
        <div class="summary-test-narrative">${escapeHtml(narrative)}</div>
      </td>
      <td class="${statusClass(status)}">${escapeHtml(status)}</td>
      <td class="summary-test-detail">${escapeHtml(detail)}</td>
    </tr>`;
  }).join("");

  return `
    <table class="data summary-test-table ttecnici-cases-table">
      <thead>
        <tr><th>Test case</th><th>Status</th><th>Dettaglio</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/**
 * @param {Record<string, unknown>} entry
 * @param {Map<string, Record<string, unknown>>} reportByScript
 * @param {boolean} running
 * @param {boolean} expanded
 * @param {Record<string, unknown> | null | undefined} status
 */
/**
 * @param {Record<string, unknown>} entry
 * @param {Map<string, Record<string, unknown>>} reportByScript
 * @param {boolean} running
 * @param {boolean} expanded
 * @param {Record<string, unknown> | null | undefined} status
 * @param {"testtecnici" | "testfunzionali"} [section]
 * @param {ReturnType<typeof getWorkbenchSets>} [wb]
 */
function renderTtecniciScriptRow(entry, reportByScript, running, expanded, status, section = "testtecnici", wb = getWorkbenchSets(section)) {
  const e = entry;
  const rel = String(e.rel ?? "");
  const domPrefix = wb.domPrefix;
  const last = reportByScript.get(rel);
  const lastStatus = last ? String(last.status ?? "—") : "—";
  const duration = last?.durationMs != null ? `${last.durationMs} ms` : "—";
  const runStartedAt = scriptRunStartedAt(last);
  const runAtLabel = formatRunAt(runStartedAt);
  const blocked = e.blocked === true;
  const blockedReason = e.blockedReason ? String(e.blockedReason) : "blocked";
  const detailClass = "status-detail-cell ttecnici-script-detail-cell";
  const runBtn = blocked
    ? `<button class="action btn-run-one btn-run-icon" type="button" disabled title="${escapeHtml(blockedReason)}" aria-label="${escapeHtml(blockedReason)}">—</button>`
    : renderRunIconButton({
        dataRunScript : rel
      , disabled      : running
      , runningActive : isScriptRunActive(section, rel, status, running)
      , title         : `Esegui ${rel}`
      });
  const caseCount = resolveScriptTestsForDisplay(e, last).length;

  const rowClasses = ["ttecnici-script-row", ...buildRunRowClasses(section, rel, null, status, running)].join(" ");

  return `<tr class="${rowClasses} ttecnici-selectable-row" data-tt-script="${escapeHtml(rel)}">
    <td class="ttecnici-script-name-cell">
      <button
        type="button"
        class="ttecnici-file-toggle"
        data-toggle-${domPrefix}-file="${escapeHtml(rel)}"
        aria-expanded="${expanded ? "true" : "false"}"
        aria-label="Espandi test case ${escapeHtml(rel)}"
      >
        <span class="suite-chevron" aria-hidden="true"></span>
      </button>
      <div class="summary-test-cell ttecnici-script-summary">
        <code class="ttecnici-script-path">${escapeHtml(rel)}</code>
        <span class="ttecnici-case-count muted">${caseCount} test case</span>
      </div>
    </td>
    <td class="${statusClass(lastStatus)}">${escapeHtml(lastStatus)}</td>
    <td class="${detailClass}">
      <div class="ttecnici-script-detail-context">${renderScriptFileNarrative(e)}</div>
    </td>
    <td>${escapeHtml(duration)}</td>
    <td class="run-at-cell"${runStartedAt ? ` title="${escapeHtml(runStartedAt)}"` : ""}>${escapeHtml(runAtLabel)}</td>
    <td>${runBtn}</td>
  </tr>`;
}

/**
 * @param {Array<Record<string, unknown>>} catalogScripts
 * @param {string} scriptRel
 * @param {string} testName
 */
function getTestCaseMeta(catalogScripts, scriptRel, testName) {
  const entry = catalogScripts.find((item) => String(item.rel) === scriptRel);
  const cases = Array.isArray(entry?.testCases) ? entry.testCases : [];

  return cases.find((item) => String(item.name) === testName) ?? null;
}

/**
 * @param {string} scriptRel
 * @param {string} testName
 */
function resolveCaseDependencies(scriptRel, testName) {
  const catalogScripts = Array.isArray(scriptCatalog?.scripts)
    ? scriptCatalog.scripts
    : [];
  const meta = getTestCaseMeta(catalogScripts, scriptRel, testName);

  return Array.isArray(meta?.dependencies)
    ? meta.dependencies.map((dep) => String(dep))
    : [];
}

/**
 * @param {string} scriptRel
 * @param {string} testName
 * @param {HTMLElement | null | undefined} [btn]
 */
function selectTestCaseTarget(scriptRel, testName, btn) {
  selectRunTarget({
    section      : "testtecnici"
  , script       : scriptRel
  , testCase     : testName
  , dependencies : resolveCaseDependencies(scriptRel, testName)
  }, btn ?? null);
}

/**
 * @param {string} scriptRel
 * @param {string} testName
 */
function isChainDependency(scriptRel, testName) {
  if (!selectedRunTarget
    || selectedRunTarget.section !== "testtecnici"
    || selectedRunTarget.script !== scriptRel
    || !selectedRunTarget.testCase) {
    return false;
  }

  return selectedRunTarget.dependencies.includes(testName);
}

/**
 * @param {string} scriptRel
 * @param {string} testName
 * @returns {Set<string>}
 */
function getActiveDepsForTestCase(scriptRel, testName) {
  if (!selectedRunTarget
    || selectedRunTarget.section !== "testtecnici"
    || selectedRunTarget.script !== scriptRel
    || selectedRunTarget.testCase !== testName
    || selectedRunTarget.dependencies.length === 0) {
    return new Set();
  }

  return new Set(selectedRunTarget.dependencies);
}

/**
 * @param {string} scriptRel
 * @param {string} testName
 */
function depsToggleKey(scriptRel, testName) {
  return `${scriptRel}\x1e${testName}`;
}

/**
 * @param {string[]} dependencies
 * @param {string} scriptRel
 * @param {string} testName
 */
function renderTestCaseDepsBlock(dependencies, scriptRel, testName) {
  if (dependencies.length === 0) {
    return "";
  }

  const depKey = depsToggleKey(scriptRel, testName);
  const expanded = expandedTtecniciDeps.has(depKey);
  const activeDeps = getActiveDepsForTestCase(scriptRel, testName);

  const listItems = dependencies.map((dep) => {
    const starred = activeDeps.has(dep);
    const star = starred
      ? `<span class="ttecnici-dep-star" title="Inclusa nel run">${DEP_STAR_SVG}</span>`
      : "";

    return `<li class="ttecnici-dep-item${starred ? " is-chain-dep" : ""}">${star}<span class="ttecnici-dep-name">${escapeHtml(dep)}</span></li>`;
  }).join("");

  return `<div class="ttecnici-deps-block${expanded ? " is-expanded" : ""}">
    <button
      type="button"
      class="ttecnici-deps-toggle"
      data-toggle-tt-deps="1"
      data-tt-deps-script="${escapeHtml(scriptRel)}"
      data-tt-deps-case="${escapeHtml(testName)}"
      aria-expanded="${expanded ? "true" : "false"}"
    >
      <span class="suite-chevron ttecnici-deps-chevron" aria-hidden="true"></span>
      <span class="ttecnici-deps-label">Dipendenze</span>
      <span class="ttecnici-deps-count muted">(${dependencies.length})</span>
    </button>
    <ul class="ttecnici-deps-list">${listItems}</ul>
  </div>`;
}

/**
 * @param {string} scriptRel
 * @param {string} testName
 */
function renderChainDepStar(scriptRel, testName) {
  if (!isChainDependency(scriptRel, testName)) {
    return "";
  }

  return `<span class="ttecnici-case-dep-star" title="Dipendenza del run selezionato">${DEP_STAR_SVG}</span>`;
}

/**
 * @param {Record<string, unknown> | undefined} row
 * @param {string} scriptRel
 * @param {boolean} running
 * @param {Array<Record<string, unknown>>} catalogScripts
 * @param {Record<string, unknown> | null | undefined} status
 */
function renderTtecniciCaseRows(
  row
, scriptRel
, running
, catalogScripts
, status
, entry
, section = "testtecnici"
) {
  const catalogEntry = entry ?? { blocked: false };
  const tests        = resolveScriptTestsForDisplay(catalogEntry, row);

  if (tests.length === 0) {
    return `<tr class="ttecnici-case-row ttecnici-case-empty">
      <td class="ttecnici-case-name-cell">
        <span class="ttecnici-tree-branch" aria-hidden="true"></span>
        <span class="muted">Nessun test case — esegui lo script.</span>
      </td>
      <td class="muted">—</td>
      <td class="muted">—</td>
      <td class="muted">—</td>
      <td class="muted">—</td>
      <td></td>
    </tr>`;
  }

  return tests.map((test) => {
    const testName = String(test.name ?? "");
    const testStatus = testCaseStatus(/** @type {{ ok: boolean, skipped: boolean }} */ (test));
    const narrative = buildTestNarrative(testName);
    const meta = getTestCaseMeta(catalogScripts, scriptRel, testName);
    const stepComment = typeof test.stepComment === "string"
      ? test.stepComment
      : (typeof meta?.stepComment === "string" ? meta.stepComment : null);
    const detailContent = renderTestCaseDetailContext(
      test
    , catalogEntry
    , testStatus
    , testName
    , stepComment
    );
    const detailClass = testStatus === "failed"
      ? "status-detail-cell status-fail"
      : testStatus === "skipped"
        ? "status-detail-cell status-skip"
        : "status-detail-cell";
    const dependencies = Array.isArray(meta?.dependencies)
      ? meta.dependencies.map((dep) => String(dep))
      : [];
    const runTitle = dependencies.length > 0
      ? `Esegui test case (+${dependencies.length} dip.): ${testName}`
      : `Esegui test case: ${testName}`;
    const caseRunning = isRunningTarget(section, scriptRel, testName, status, running);
    const caseStartedAt = testCaseStartedAt(test);
    const caseRunAtLabel = formatRunAt(caseStartedAt);
    const caseDuration = testCaseDurationLabel(test);

    const runBtn = renderRunIconButton({
      dataRunScript : scriptRel
    , dataRunCase     : testName
    , disabled        : running
    , runningActive   : caseRunning
    , title           : caseRunning ? "Running" : runTitle
    });

    const caseClasses = ["ttecnici-case-row", ...buildRunRowClasses(section, scriptRel, testName, status, running)].join(" ");

    return `<tr class="${caseClasses} ttecnici-selectable-row" data-tt-script="${escapeHtml(scriptRel)}" data-tt-case="${escapeHtml(testName)}">
      <td class="ttecnici-case-name-cell">
        <span class="ttecnici-tree-branch" aria-hidden="true"></span>
        <div class="summary-test-cell">
          <div class="summary-test-definition">${renderChainDepStar(scriptRel, testName)}${escapeHtml(testName)}</div>
          <div class="summary-test-narrative">${escapeHtml(narrative)}</div>
          ${renderTestCaseDepsBlock(dependencies, scriptRel, testName)}
        </div>
      </td>
      <td class="${statusClass(testStatus)}">${escapeHtml(testStatus)}</td>
      <td class="${detailClass} ttecnici-case-detail-cell">${detailContent}</td>
      <td>${escapeHtml(caseDuration)}</td>
      <td class="run-at-cell"${caseStartedAt ? ` title="${escapeHtml(caseStartedAt)}"` : ""}>${escapeHtml(caseRunAtLabel)}</td>
      <td>${runBtn}</td>
    </tr>`;
  }).join("");
}

/**
 * @param {Record<string, unknown>} entry
 * @param {Map<string, Record<string, unknown>>} reportByScript
 * @param {boolean} running
 */
function renderTtecniciScriptBlock(
  entry
, reportByScript
, running
, catalogScripts
, status
, section = "testtecnici"
, wb = getWorkbenchSets(section)
) {
  const rel      = String(entry.rel ?? "");
  const last     = reportByScript.get(rel);
  const expanded = wb.expandedFiles.has(rel);
  const domPrefix = wb.domPrefix;

  return `
    <tbody class="ttecnici-script-block${expanded ? " is-expanded" : ""}" id="${domPrefix}-file-${cssEscapeId(rel)}">
      ${renderTtecniciScriptRow(entry, reportByScript, running, expanded, status, section, wb)}
      ${renderTtecniciCaseRows(last, rel, running, catalogScripts, status, entry, section)}
    </tbody>`;
}

/**
 * @param {HTMLElement} root
 * @param {boolean} collapsed
 */
function setAllTtecniciFilesExpanded(root, expanded) {
  root.querySelectorAll(".ttecnici-script-block").forEach((block) => {
    const toggle = block.querySelector("[data-toggle-tt-file]");
    const rel    = toggle?.getAttribute("data-toggle-tt-file");

    block.classList.toggle("is-expanded", expanded);

    if (rel) {
      if (expanded) {
        expandedTtecniciFiles.add(rel);
      } else {
        expandedTtecniciFiles.delete(rel);
      }
    }

    toggle?.setAttribute("aria-expanded", expanded ? "true" : "false");
  });
}

function setAllTtecniciSuitesCollapsed(root, collapsed) {
  root.querySelectorAll(".ttecnici-suite-group").forEach((group) => {
    const toggle = group.querySelector("[data-toggle-tt-suite]");
    const suite  = toggle?.getAttribute("data-toggle-tt-suite");

    if (!suite) {
      return;
    }

    group.classList.toggle("is-collapsed", collapsed);

    if (collapsed) {
      collapsedTtecniciSuites.add(suite);
    } else {
      collapsedTtecniciSuites.delete(suite);
    }

    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  });
}

/**
 * @param {HTMLElement} root
 * @param {{ prefix: string, collapsedSet: Set<string>, collapsedTopicSet: Set<string>, getScenariosSectionCollapsed: () => boolean, setScenariosSectionCollapsed: (value: boolean) => void }} config
 */
function bindIntroScenarioActions(root, config) {
  const {
    prefix
  , collapsedSet
  , collapsedTopicSet
  , getScenariosSectionCollapsed
  , setScenariosSectionCollapsed
  } = config;
  const toggleAttr        = `data-toggle-${prefix}-scenario`;
  const topicToggleAttr   = `data-toggle-${prefix}-scenario-topic`;
  const sectionToggleAttr = `data-toggle-${prefix}-scenarios-section`;

  root.querySelector(`[${sectionToggleAttr}]`)?.addEventListener("click", () => {
    const group = root.querySelector(`#${prefix}-scenarios-root`);

    if (!group) {
      return;
    }

    const isCollapsed = group.classList.toggle("is-collapsed");
    setScenariosSectionCollapsed(isCollapsed);

    const btn = root.querySelector(`[${sectionToggleAttr}]`);

    btn?.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
  });

  root.querySelectorAll(`[${topicToggleAttr}]`).forEach((btn) => {
    btn.addEventListener("click", () => {
      const topic = btn.getAttribute(topicToggleAttr);

      if (!topic) {
        return;
      }

      const group = root.querySelector(`#${prefix}-scenario-topic-${cssEscapeId(topic)}`);

      if (!group) {
        return;
      }

      const isCollapsed = group.classList.toggle("is-collapsed");

      if (isCollapsed) {
        collapsedTopicSet.add(topic);
      } else {
        collapsedTopicSet.delete(topic);
      }

      btn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    });
  });

  root.querySelectorAll(`[${toggleAttr}]`).forEach((btn) => {
    btn.addEventListener("click", () => {
      const script = btn.getAttribute(toggleAttr);

      if (!script) {
        return;
      }

      const group = root.querySelector(`#${prefix}-scenario-${cssEscapeId(script)}`);

      if (!group) {
        return;
      }

      const isCollapsed = group.classList.toggle("is-collapsed");

      if (isCollapsed) {
        collapsedSet.add(script);
      } else {
        collapsedSet.delete(script);
      }

      btn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    });
  });

  root.querySelector(`#btn-${prefix}-scenarios-expand-all`)?.addEventListener("click", () => {
    root.querySelectorAll(`.${prefix}-scenario-topic-group`).forEach((group) => {
      group.classList.remove("is-collapsed");
      const topicToggle = group.querySelector(`[${topicToggleAttr}]`);
      const topic       = topicToggle?.getAttribute(topicToggleAttr);

      if (topic) {
        collapsedTopicSet.delete(topic);
      }

      topicToggle?.setAttribute("aria-expanded", "true");
    });

    root.querySelectorAll(`.${prefix}-scenario-group`).forEach((group) => {
      group.classList.remove("is-collapsed");
      const toggle = group.querySelector(`[${toggleAttr}]`);
      const script = toggle?.getAttribute(toggleAttr);

      if (script) {
        collapsedSet.delete(script);
      }

      toggle?.setAttribute("aria-expanded", "true");
    });
  });

  root.querySelector(`#btn-${prefix}-scenarios-collapse-all`)?.addEventListener("click", () => {
    root.querySelectorAll(`.${prefix}-scenario-topic-group`).forEach((group) => {
      group.classList.add("is-collapsed");
      const topicToggle = group.querySelector(`[${topicToggleAttr}]`);
      const topic       = topicToggle?.getAttribute(topicToggleAttr);

      if (topic) {
        collapsedTopicSet.add(topic);
      }

      topicToggle?.setAttribute("aria-expanded", "false");
    });

    root.querySelectorAll(`.${prefix}-scenario-group`).forEach((group) => {
      group.classList.add("is-collapsed");
      const toggle = group.querySelector(`[${toggleAttr}]`);
      const script = toggle?.getAttribute(toggleAttr);

      if (script) {
        collapsedSet.add(script);
      }

      toggle?.setAttribute("aria-expanded", "false");
    });
  });
}

/**
 * @param {HTMLElement} root
 */
function bindTestTecniciActions(root) {
  root.querySelector("#btn-tt-run-all")?.addEventListener("click", async () => {
    selectRunTarget({ section: "testtecnici", runAll: true });
    const res = await fetch("/api/run", { method: "POST" });

    if (!res.ok && res.status !== 202) {
      alert("Impossibile avviare run-all");
      return;
    }

    pollRunStatus();
  });

  root.querySelectorAll("[data-run-suite]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const suite = btn.getAttribute("data-run-suite");

      if (!suite || btn.hasAttribute("disabled")) {
        return;
      }

      selectRunTarget({ section: "testtecnici", suite }, btn);

      const res = await fetch("/api/run/suite", {
        method  : "POST"
      , headers : { "Content-Type": "application/json" }
      , body    : JSON.stringify({ suite })
      });

      if (!res.ok && res.status !== 202) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Impossibile avviare il gruppo");
        return;
      }

      pollRunStatus();
    });
  });

  root.querySelectorAll("[data-run-script]:not([data-run-case])").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const script = btn.getAttribute("data-run-script");

      if (!script || btn.hasAttribute("disabled")) {
        return;
      }

      selectRunTarget({ section: "testtecnici", script }, btn);

      const res = await fetch("/api/run/one", {
        method  : "POST"
      , headers : { "Content-Type": "application/json" }
      , body    : JSON.stringify({ script })
      });

      if (!res.ok && res.status !== 202) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Impossibile avviare lo script");
        return;
      }

      pollRunStatus();
    });
  });

  root.querySelectorAll("[data-run-case]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const script = btn.getAttribute("data-run-script");
      const test   = btn.getAttribute("data-run-case");

      if (!script || !test || btn.hasAttribute("disabled")) {
        return;
      }

      selectTestCaseTarget(script, test, btn);

      const res = await fetch("/api/run/case", {
        method  : "POST"
      , headers : { "Content-Type": "application/json" }
      , body    : JSON.stringify({ script, test })
      });

      if (!res.ok && res.status !== 202) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Impossibile avviare il test case");
        return;
      }

      pollRunStatus();
    });
  });

  root.querySelectorAll(".ttecnici-case-row[data-tt-case]").forEach((row) => {
    row.addEventListener("click", (ev) => {
      if (!(ev.target instanceof HTMLElement)) {
        return;
      }

      if (ev.target.closest("button, a")) {
        return;
      }

      const script = row.getAttribute("data-tt-script");
      const test   = row.getAttribute("data-tt-case");

      if (!script || !test) {
        return;
      }

      selectTestCaseTarget(script, test);
    });
  });

  root.querySelectorAll("[data-tt-script-doc]").forEach((el) => {
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();

      const rel = el.getAttribute("data-tt-script-doc");

      if (rel) {
        openScriptDocModal(rel);
      }
    });
  });

  root.querySelectorAll(".ttecnici-script-row[data-tt-script]").forEach((row) => {
    row.addEventListener("click", (ev) => {
      if (!(ev.target instanceof HTMLElement)) {
        return;
      }

      if (ev.target.closest("button, a, [data-tt-script-doc]")) {
        return;
      }

      const script = row.getAttribute("data-tt-script");

      if (!script) {
        return;
      }

      selectRunTarget({ section: "testtecnici", script, dependencies: [] });
    });
  });

  root.querySelectorAll("[data-toggle-tt-suite]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const suite = btn.getAttribute("data-toggle-tt-suite");

      if (!suite) {
        return;
      }

      const group = root.querySelector(`#tt-suite-${suite}`);

      if (!group) {
        return;
      }

      const isCollapsed = group.classList.toggle("is-collapsed");

      if (isCollapsed) {
        collapsedTtecniciSuites.add(suite);
      } else {
        collapsedTtecniciSuites.delete(suite);
      }

      btn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    });
  });

  root.querySelectorAll("[data-toggle-tt-deps]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();

      const script = btn.getAttribute("data-tt-deps-script");
      const test   = btn.getAttribute("data-tt-deps-case");

      if (!script || !test) {
        return;
      }

      const key = depsToggleKey(script, test);
      const block = btn.closest(".ttecnici-deps-block");
      const willExpand = !expandedTtecniciDeps.has(key);

      if (willExpand) {
        expandedTtecniciDeps.add(key);
      } else {
        expandedTtecniciDeps.delete(key);
      }

      block?.classList.toggle("is-expanded", willExpand);
      btn.setAttribute("aria-expanded", willExpand ? "true" : "false");
    });
  });

  root.querySelectorAll("[data-toggle-tt-file]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();

      const rel = btn.getAttribute("data-toggle-tt-file");

      if (!rel) {
        return;
      }

      const block = root.querySelector(`#tt-file-${cssEscapeId(rel)}`);

      if (!block) {
        return;
      }

      const isExpanded = block.classList.toggle("is-expanded");

      if (isExpanded) {
        expandedTtecniciFiles.add(rel);
      } else {
        expandedTtecniciFiles.delete(rel);
      }

      btn.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    });
  });

  root.querySelector("#btn-tt-expand-all")?.addEventListener("click", () => {
    setAllTtecniciSuitesCollapsed(root, false);
    setAllTtecniciFilesExpanded(root, true);
  });

  root.querySelector("#btn-tt-collapse-all")?.addEventListener("click", () => {
    setAllTtecniciSuitesCollapsed(root, true);
    setAllTtecniciFilesExpanded(root, false);
  });

  root.querySelectorAll("[data-jump-tt-suite]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const suite = btn.getAttribute("data-jump-tt-suite");

      if (!suite) {
        return;
      }

      const group = root.querySelector(`#tt-suite-${suite}`);

      if (group) {
        group.classList.remove("is-collapsed");
        collapsedTtecniciSuites.delete(suite);
        const toggle = group.querySelector("[data-toggle-tt-suite]");
        toggle?.setAttribute("aria-expanded", "true");
        group.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      root.querySelectorAll("[data-jump-tt-suite]").forEach((el) => {
        el.classList.toggle("active", el.getAttribute("data-jump-tt-suite") === suite);
      });
    });
  });

  bindIntroScenarioActions(root, {
    prefix                        : "ttecnici"
  , collapsedSet                  : collapsedTtecniciScenarioScripts
  , collapsedTopicSet             : collapsedTtecniciScenarioTopics
  , getScenariosSectionCollapsed  : () => ttecniciScenariosSectionCollapsed
  , setScenariosSectionCollapsed  : (value) => { ttecniciScenariosSectionCollapsed = value; }
  });
}

/**
 * @param {"testtecnici" | "testfunzionali"} sectionKey
 * @param {Record<string, unknown> | null} report
 * @param {Record<string, unknown> | null} status
 * @param {{ scripts?: Array<Record<string, unknown>> } | null} catalog
 * @param {{ introHtml?: string }} [options]
 */
function renderTestWorkbench(sectionKey, report, status, catalog, options = {}) {
  const wb   = getWorkbenchSets(sectionKey);
  const root = document.getElementById(wb.sectionId);

  if (!root) {
    return;
  }

  const running  = status?.running === true;
  const progress = /** @type {{ current?: number, total?: number } | undefined} */ (status?.progress);
  const pct      = progress?.total
    ? Math.round(((progress.current ?? 0) / progress.total) * 100)
    : 0;
  const runMode  = status?.mode === "case"
    ? "test case"
    : status?.mode === "funzionali"
      ? "funzionali"
      : status?.mode === "single"
        ? "singolo"
        : status?.mode === "suite"
          ? "gruppo"
          : "completo";
  const runLabel = running
    ? (status?.mode === "case" && status?.targetTestCase
      ? `Run ${runMode}: ${String(status.targetScript)} → ${String(status.targetTestCase)}`
      : status?.targetScript
        ? `Run ${runMode}: ${String(status.targetScript)}`
        : `Run ${runMode} in corso…`)
    : "";

  /** @type {Map<string, Record<string, unknown>>} */
  const reportByScript = new Map();

  if (report && Array.isArray(report.scripts)) {
    for (const row of report.scripts) {
      const r = /** @type {Record<string, unknown>} */ (row);

      if (typeof r.script === "string") {
        reportByScript.set(r.script, r);
      }
    }
  }

  const catalogScripts = Array.isArray(catalog?.scripts)
    ? catalog.scripts
    : (report && Array.isArray(report.scripts)
      ? report.scripts.map((row) => {
          const r   = /** @type {Record<string, unknown>} */ (row);
          const rel = String(r.script ?? "");
          const parts = rel.split("/");

          return {
            rel
          , suite   : parts.length > 1 ? parts[0] : "root"
          , blocked : false
          };
        })
      : []);

  const scripts = catalogScripts
    .filter(wb.scriptFilter)
    .map((e) => /** @type {Record<string, unknown>} */ (e));
  const groups = groupScriptsBySuite(scripts);

  seedAllSuitesCollapsed(groups, wb.collapsedSuites, wb.suiteCollapseKey);

  const analysis = buildTestAnalysis(groups, scripts, reportByScript, report);

  const scope = report && (report.passed != null || report.failed != null)
    ? (status?.mode === "case"
      ? "ultimo run test case"
      : status?.mode === "funzionali"
        ? "ultimo run funzionali"
        : status?.mode === "single" || report.totalScripts === 1
          ? "ultimo run singolo"
          : "ultimo run completo")
    : null;

  const jumpAttr = `data-jump-${wb.domPrefix}-suite`;
  const suiteNav = groups.map((group) => `
    <button type="button" ${jumpAttr}="${escapeHtml(group.suite)}">
      ${escapeHtml(group.label)} <span class="muted">(${group.items.length})</span>
    </button>`
  ).join("");

  const suitePanels = groups.map((group) => {
    const counts    = countSuiteResults(group.items, reportByScript);
    const collapsed = wb.collapsedSuites.has(group.suite);
    const bodyBlocks = group.items
      .map((entry) => renderTtecniciScriptBlock(
        entry
      , reportByScript
      , running
      , scripts
      , status
      , sectionKey
      , wb
      ))
      .join("");

    const folderPath = group.suite === "root" ? "testScript/" : `testScript/${group.suite}/`;

    return `
      <section class="test-suite-group ttecnici-suite-group${collapsed ? " is-collapsed" : ""}${renderSuiteGroupClass(sectionKey, group.suite, status, running)}" id="${wb.domPrefix}-suite-${escapeHtml(group.suite)}">
        <div class="test-suite-header-row">
          <button
            type="button"
            class="test-suite-toggle"
            data-toggle-${wb.domPrefix}-suite="${escapeHtml(group.suite)}"
            aria-expanded="${collapsed ? "false" : "true"}"
          >
            <span class="suite-chevron" aria-hidden="true"></span>
            <span class="suite-title">
              <span class="suite-name">${escapeHtml(group.label)}</span>
              <span class="suite-path">${escapeHtml(folderPath)}</span>
              <span class="suite-count muted">${group.items.length} script</span>
            </span>
          </button>
          <div class="test-suite-actions">
            ${renderRunSuiteButton(sectionKey, group.suite, status, running)}
            <span class="suite-outcome">${renderSuiteOutcomeBadge(counts)}</span>
          </div>
        </div>
        <div class="test-suite-body ttecnici-suite-body">
          <table class="data test-suite-table ttecnici-suite-table">
            ${TEST_TABLE_COLGROUP}
            ${bodyBlocks}
          </table>
        </div>
      </section>`;
  }).join("");

  const introBlock = options.introHtml
    ? `<div class="panel test-intro-panel">${options.introHtml}</div>`
    : "";

  const tecniciTools = wb.showTecniciTools
    ? `<button class="action" type="button" id="btn-tt-generate-analysis" ${report ? "" : "disabled"}>Genera analisi</button>
       <a class="action is-disabled" href="/api/report/tecnici-analysis/html" target="_blank" rel="noopener" id="btn-tt-open-analysis" aria-disabled="true" title="Genera prima l'analisi">Apri analisi</a>`
    : "";

  const runAllLabel = sectionKey === "testfunzionali"
    ? "Esegui suite funzionali"
    : "Esegui tutti i test";

  const exportSuite = sectionKey === "testfunzionali" ? "funzionali" : null;
  const exportReady = sectionKey === "testfunzionali"
    ? analysis.executed > 0
    : report != null;
  const reportHtmlParams = new URLSearchParams();

  if (exportSuite) {
    reportHtmlParams.set("suite", exportSuite);
  }

  if (report?.generatedAt) {
    reportHtmlParams.set("t", String(report.generatedAt));
  }

  const reportHtmlQuery = reportHtmlParams.toString();
  const reportHtmlHref    = `/api/report/html${reportHtmlQuery ? `?${reportHtmlQuery}` : ""}`;

  const executionPanel = `
        <div class="panel">
          <h2>Esecuzione</h2>
          <div class="btn-row" style="margin-top:0">
            ${renderRunAllButton(wb.runAllButtonId, sectionKey, status, running, runAllLabel)}
            <a class="action" href="${reportHtmlHref}" target="_blank" rel="noopener">Apri report HTML</a>
            ${tecniciTools}
            <button class="action" type="button" id="btn-${wb.domPrefix}-export-xlsx" ${exportReady ? "" : "disabled"}>Export Excel</button>
            <button class="action" type="button" id="btn-${wb.domPrefix}-export-json" ${exportReady ? "" : "disabled"}>Export JSON</button>
          </div>
          ${running ? `<p class="muted">${escapeHtml(runLabel)}</p>` : ""}
          ${scope ? `<p class="muted">${escapeHtml(scope)}</p>` : `<p class="muted">Nessun report — esegui i test per generare <code>latest.json</code>.</p>`}
        </div>`;

  const scriptsPanel = `
        <div class="panel">
          <h2>Script e test case</h2>
          <p class="muted">${sectionKey === "testfunzionali"
            ? "Pool multi-utente <code>testScript/funzionali/</code> — espandi uno script per le casistiche"
            : "Merge operativo (Test) e descrittivo (Summary) per ogni file <code>testScript/</code>"}</p>
          ${groups.length > 0
            ? `<div class="test-suite-toolbar">
                 <nav class="test-suite-nav" aria-label="Salta a cartella">${suiteNav}</nav>
                 <div class="test-suite-bulk">
                   ${treeBulkToggleHtml(`btn-${wb.domPrefix}-expand-all`, `btn-${wb.domPrefix}-collapse-all`, {
                     expandLabel  : "Espandi tutti i gruppi"
                   , collapseLabel: "Collassa tutti i gruppi"
                   , groupLabel   : "Espandi o collassa tutti i gruppi test"
                   })}
                 </div>
               </div>
               <div class="test-suites-wrap ttecnici-suites-wrap">
                 <table class="data test-suite-table test-suite-head ttecnici-suite-head">
                   ${TEST_TABLE_COLGROUP}
                   <thead>
                     <tr><th>Script</th><th>Ultimo status</th><th>Dettaglio</th><th>Durata</th><th>Data/ora</th><th>Azioni</th></tr>
                   </thead>
                 </table>
                 ${suitePanels}
               </div>`
            : `<p class="muted">Catalogo non disponibile.</p>`}
        </div>`;

  const priorityPanels = `${executionPanel}${scriptsPanel}`;

  const mainPanels = options.introHtml
    ? `${introBlock}${priorityPanels}`
    : priorityPanels;

  root.innerHTML = `
    <div class="test-page-layout${options.introHtml ? " test-page-layout--with-intro" : ""}">
      ${renderTestAnalysisPanel(analysis, running, pct)}
      <div class="test-page-main">
        ${mainPanels}
      </div>
    </div>`;

  lastTestView = { report, status, catalog };

  if (sectionKey === "testtecnici") {
    bindTestTecniciActions(root);
    bindTecniciAnalysisAction(root);
    fetch("/api/report/tecnici-analysis")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.generatedAt) {
          return;
        }

        const openLink = root.querySelector("#btn-tt-open-analysis");

        if (openLink instanceof HTMLAnchorElement) {
          openLink.removeAttribute("aria-disabled");
          openLink.classList.remove("is-disabled");
        }
      })
      .catch(() => {});
  } else {
    bindTestFunzionaliActions(root, wb);
  }

  bindExportActions(root, {
    xlsxId : `btn-${wb.domPrefix}-export-xlsx`
  , jsonId : `btn-${wb.domPrefix}-export-json`
  , suite  : exportSuite
  });
}

/**
 * @param {Record<string, unknown> | null} report
 * @param {Record<string, unknown> | null} status
 * @param {{ scripts?: Array<Record<string, unknown>> } | null} catalog
 */
function renderTestTecnici(report, status, catalog, meta = null) {
  renderTestWorkbench("testtecnici", report, status, catalog, {
    introHtml: renderTecniciIntroHtml(meta)
  });
}

/**
 * @param {Record<string, unknown> | null} meta
 * @param {{ prefix: string, fallbackTitle: string, runOrderHeading: string, seedCollapsed: (scenarios: Array<Record<string, unknown>>) => void, seedTopicsCollapsed: (topicGroups: Array<{ topic: string }>) => void, collapsedSet: Set<string>, collapsedTopicSet: Set<string>, getScenariosSectionCollapsed: () => boolean }} config
 */
function renderTestIntroHtml(meta, config) {
  const {
    prefix
  , fallbackTitle
  , runOrderHeading
  , seedCollapsed
  , seedTopicsCollapsed
  , collapsedSet
  , collapsedTopicSet
  , getScenariosSectionCollapsed
  } = config;

  if (!meta || typeof meta !== "object") {
    return `<h2>Implementazione</h2><p class="muted">Metadati non disponibili — avvia il cruscotto con API attiva.</p>`;
  }

  const impl = /** @type {Record<string, unknown>} */ (meta.implementation ?? {});
  const scenarios = Array.isArray(meta.scenarios) ? meta.scenarios : [];
  const prereq = Array.isArray(impl.prerequisites) ? impl.prerequisites : [];
  const arch   = Array.isArray(impl.architecture) ? impl.architecture : [];
  const order  = Array.isArray(impl.runOrder) ? impl.runOrder : [];

  const prereqList = prereq.map((line) => `<li>${escapeHtml(String(line))}</li>`).join("");
  const archList   = arch.map((line) => `<li><code>${escapeHtml(String(line))}</code></li>`).join("");
  const orderList  = order.map((line) => `<li><code>${escapeHtml(String(line))}</code></li>`).join("");

  seedCollapsed(scenarios);

  const topicGroups = groupScenariosByTopic(
    scenarios.map((block) => /** @type {Record<string, unknown>} */ (block))
  );

  seedTopicsCollapsed(topicGroups);

  /**
   * @param {Record<string, unknown>} block
   */
  function renderScenarioScriptGroup(block) {
    const script = String(block.script ?? "");
    const title  = String(block.title ?? script);
    const cases  = Array.isArray(block.cases) ? block.cases : [];
    const collapsed = collapsedSet.has(script);
    const caseCountLabel = cases.length === 1 ? "1 test case" : `${cases.length} test cases`;
    const toggleAttr = `data-toggle-${prefix}-scenario`;

    const caseRows = cases.map((item) => {
      const c = /** @type {Record<string, unknown>} */ (item);

      return `<tr>
        <td>${escapeHtml(String(c.name ?? ""))}</td>
        <td class="muted">${escapeHtml(String(c.description ?? ""))}</td>
      </tr>`;
    }).join("");

    return `
      <section class="test-suite-group ${prefix}-scenario-group${collapsed ? " is-collapsed" : ""}" id="${prefix}-scenario-${cssEscapeId(script)}">
        <div class="test-suite-header-row">
          <button
            type="button"
            class="test-suite-toggle"
            ${toggleAttr}="${escapeHtml(script)}"
            aria-expanded="${collapsed ? "false" : "true"}"
          >
            <span class="suite-chevron" aria-hidden="true"></span>
            <span class="suite-title">
              <span class="suite-name">${escapeHtml(title)}</span>
              <span class="suite-path"><code>${escapeHtml(script)}</code></span>
              <span class="suite-count muted">${caseCountLabel}</span>
            </span>
          </button>
        </div>
        <div class="test-suite-body">
          <div class="table-scroll">
            <table class="data ${prefix}-scenarios-table">
              <thead>
                <tr><th>Test case</th><th>Descrizione</th></tr>
              </thead>
              <tbody>${caseRows || `<tr><td colspan="2" class="muted">—</td></tr>`}</tbody>
            </table>
          </div>
        </div>
      </section>`;
  }

  const scenarioGroups = topicGroups.map((group) => {
    const topicCollapsed = collapsedTopicSet.has(group.topic);
    const scriptCount    = group.items.length;
    const caseCountTopic = group.items.reduce(
      (sum, row) => sum + (Array.isArray(row.cases) ? row.cases.length : 0)
    , 0
    );
    const scriptCountLabel = scriptCount === 1 ? "1 script" : `${scriptCount} script`;
    const caseCountTopicLabel = caseCountTopic === 1 ? "1 test case" : `${caseCountTopic} test cases`;
    const topicToggleAttr = `data-toggle-${prefix}-scenario-topic`;
    const scriptGroups = group.items
      .map((block) => renderScenarioScriptGroup(/** @type {Record<string, unknown>} */ (block)))
      .join("");

    return `
      <section class="test-suite-group ${prefix}-scenario-topic-group${topicCollapsed ? " is-collapsed" : ""}" id="${prefix}-scenario-topic-${cssEscapeId(group.topic)}">
        <div class="test-suite-header-row">
          <button
            type="button"
            class="test-suite-toggle"
            ${topicToggleAttr}="${escapeHtml(group.topic)}"
            aria-expanded="${topicCollapsed ? "false" : "true"}"
          >
            <span class="suite-chevron" aria-hidden="true"></span>
            <span class="suite-title">
              <span class="suite-name">${escapeHtml(group.label)}</span>
              <span class="suite-path">${escapeHtml(group.path)}</span>
              <span class="suite-count muted">${scriptCountLabel} · ${caseCountTopicLabel}</span>
            </span>
          </button>
        </div>
        <div class="test-suite-body">
          <div class="${prefix}-scenarios-topic-wrap">
            ${scriptGroups}
          </div>
        </div>
      </section>`;
  }).join("");

  const caseCount      = Number(meta.caseCount ?? 0);
  const sectionCollapsed = getScenariosSectionCollapsed();
  const caseCountLabel = caseCount === 1 ? "1 test case" : `${caseCount} test cases`;

  return `
    <h2>${escapeHtml(String(impl.title ?? fallbackTitle))}</h2>
    <p>${escapeHtml(String(impl.summary ?? ""))}</p>
    <h3>Prerequisiti</h3>
    <ul class="test-meta-list">${prereqList}</ul>
    <h3>Architettura repo</h3>
    <ul class="test-meta-list">${archList}</ul>
    <h3>${escapeHtml(runOrderHeading)}</h3>
    <ol class="test-meta-list">${orderList}</ol>
    <section class="test-suite-group ${prefix}-scenarios-root${sectionCollapsed ? " is-collapsed" : ""}" id="${prefix}-scenarios-root">
      <div class="test-suite-header-row ${prefix}-scenarios-head">
        <button
          type="button"
          class="test-suite-toggle"
          data-toggle-${prefix}-scenarios-section=""
          aria-expanded="${sectionCollapsed ? "false" : "true"}"
        >
          <span class="suite-chevron" aria-hidden="true"></span>
          <span class="suite-title">
            <span class="suite-name">Elenco casistiche</span>
            <span class="suite-count muted">${caseCountLabel}</span>
          </span>
        </button>
        <div class="${prefix}-scenarios-bulk">
          ${treeBulkToggleHtml(`btn-${prefix}-scenarios-expand-all`, `btn-${prefix}-scenarios-collapse-all`, {
            expandLabel  : "Espandi tutti"
          , collapseLabel: "Collassa tutti"
          , groupLabel   : "Espandi o collassa argomenti e script nelle casistiche"
          })}
        </div>
      </div>
      <div class="test-suite-body">
        <div class="${prefix}-scenarios-wrap">
          ${scenarioGroups || `<p class="muted">Nessuna casistica definita.</p>`}
        </div>
      </div>
    </section>`;
}

/**
 * @param {Record<string, unknown> | null} meta
 */
function renderFunzionaliIntroHtml(meta) {
  return renderTestIntroHtml(meta, {
    prefix                       : "tfunc"
  , fallbackTitle                : "Test funzionali"
  , runOrderHeading              : "Ordine orchestratore"
  , seedCollapsed                : seedTfuncScenariosCollapsed
  , seedTopicsCollapsed          : seedTfuncScenarioTopicsCollapsed
  , collapsedSet                 : collapsedTfuncScenarioScripts
  , collapsedTopicSet            : collapsedTfuncScenarioTopics
  , getScenariosSectionCollapsed : () => tfuncScenariosSectionCollapsed
  });
}

/**
 * @param {Record<string, unknown> | null} meta
 */
function renderTecniciIntroHtml(meta) {
  return renderTestIntroHtml(meta, {
    prefix                       : "ttecnici"
  , fallbackTitle                : "Test tecnici backend"
  , runOrderHeading              : "Ordine esecuzione"
  , seedCollapsed                : seedTtecniciScenariosCollapsed
  , seedTopicsCollapsed          : seedTtecniciScenarioTopicsCollapsed
  , collapsedSet                 : collapsedTtecniciScenarioScripts
  , collapsedTopicSet            : collapsedTtecniciScenarioTopics
  , getScenariosSectionCollapsed : () => ttecniciScenariosSectionCollapsed
  });
}

/**
 * @param {Record<string, unknown> | null} report
 * @param {Record<string, unknown> | null} status
 * @param {{ scripts?: Array<Record<string, unknown>> } | null} catalog
 * @param {Record<string, unknown> | null} [meta]
 */
function renderTestFunzionali(report, status, catalog, meta = null) {
  renderTestWorkbench("testfunzionali", report, status, catalog, {
    introHtml: renderFunzionaliIntroHtml(meta)
  });
}

/**
 * @param {HTMLElement} root
 * @param {ReturnType<typeof getWorkbenchSets>} wb
 */
function bindTestFunzionaliActions(root, wb) {
  root.querySelector(`#${wb.runAllButtonId}`)?.addEventListener("click", async () => {
    selectRunTarget({ section: "testfunzionali", runAll: true });
    const res = await wb.runAllFetch();

    if (!res.ok && res.status !== 202) {
      alert("Impossibile avviare la suite funzionali");
      return;
    }

    pollRunStatus();
  });

  root.querySelectorAll("[data-run-suite]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const suite = btn.getAttribute("data-run-suite");

      if (!suite || btn.hasAttribute("disabled")) {
        return;
      }

      selectRunTarget({ section: "testfunzionali", suite }, btn);

      const res = await fetch("/api/run/suite", {
        method  : "POST"
      , headers : { "Content-Type": "application/json" }
      , body    : JSON.stringify({ suite })
      });

      if (!res.ok && res.status !== 202) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Impossibile avviare il gruppo");
        return;
      }

      pollRunStatus();
    });
  });

  root.querySelectorAll("[data-run-script]:not([data-run-case])").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const script = btn.getAttribute("data-run-script");

      if (!script || btn.hasAttribute("disabled")) {
        return;
      }

      selectRunTarget({ section: "testfunzionali", script }, btn);

      const res = await fetch("/api/run/one", {
        method  : "POST"
      , headers : { "Content-Type": "application/json" }
      , body    : JSON.stringify({ script })
      });

      if (!res.ok && res.status !== 202) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Impossibile avviare lo script");
        return;
      }

      pollRunStatus();
    });
  });

  root.querySelectorAll("[data-run-case]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const script = btn.getAttribute("data-run-script");
      const test   = btn.getAttribute("data-run-case");

      if (!script || !test || btn.hasAttribute("disabled")) {
        return;
      }

      selectRunTarget({
        section      : "testfunzionali"
      , script       : script
      , testCase     : test
      , dependencies : resolveCaseDependencies(script, test)
      }, btn);

      const res = await fetch("/api/run/case", {
        method  : "POST"
      , headers : { "Content-Type": "application/json" }
      , body    : JSON.stringify({ script, test })
      });

      if (!res.ok && res.status !== 202) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Impossibile avviare il test case");
        return;
      }

      pollRunStatus();
    });
  });

  const domPrefix = wb.domPrefix;

  root.querySelectorAll(`[data-toggle-${domPrefix}-suite]`).forEach((btn) => {
    btn.addEventListener("click", () => {
      const suite = btn.getAttribute(`data-toggle-${domPrefix}-suite`);

      if (!suite) {
        return;
      }

      const group = root.querySelector(`#${domPrefix}-suite-${suite}`);

      if (!group) {
        return;
      }

      const isCollapsed = group.classList.toggle("is-collapsed");

      if (isCollapsed) {
        wb.collapsedSuites.add(suite);
      } else {
        wb.collapsedSuites.delete(suite);
      }

      btn.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    });
  });

  root.querySelectorAll(`[data-toggle-${domPrefix}-file]`).forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();

      const rel = btn.getAttribute(`data-toggle-${domPrefix}-file`);

      if (!rel) {
        return;
      }

      const block = root.querySelector(`#${domPrefix}-file-${cssEscapeId(rel)}`);

      if (!block) {
        return;
      }

      const isExpanded = block.classList.toggle("is-expanded");

      if (isExpanded) {
        wb.expandedFiles.add(rel);
      } else {
        wb.expandedFiles.delete(rel);
      }

      btn.setAttribute("aria-expanded", isExpanded ? "true" : "false");
    });
  });

  root.querySelector(`#btn-${domPrefix}-expand-all`)?.addEventListener("click", () => {
    root.querySelectorAll(".ttecnici-suite-group").forEach((group) => {
      group.classList.remove("is-collapsed");
      const toggle = group.querySelector(`[data-toggle-${domPrefix}-suite]`);
      const suite  = toggle?.getAttribute(`data-toggle-${domPrefix}-suite`);

      if (suite) {
        wb.collapsedSuites.delete(suite);
      }

      toggle?.setAttribute("aria-expanded", "true");
    });

    root.querySelectorAll(".ttecnici-script-block").forEach((block) => {
      block.classList.add("is-expanded");
      const toggle = block.querySelector(`[data-toggle-${domPrefix}-file]`);
      const rel    = toggle?.getAttribute(`data-toggle-${domPrefix}-file`);

      if (rel) {
        wb.expandedFiles.add(rel);
      }

      toggle?.setAttribute("aria-expanded", "true");
    });
  });

  root.querySelector(`#btn-${domPrefix}-collapse-all`)?.addEventListener("click", () => {
    root.querySelectorAll(".ttecnici-suite-group").forEach((group) => {
      group.classList.add("is-collapsed");
      const toggle = group.querySelector(`[data-toggle-${domPrefix}-suite]`);
      const suite  = toggle?.getAttribute(`data-toggle-${domPrefix}-suite`);

      if (suite) {
        wb.collapsedSuites.add(suite);
      }

      toggle?.setAttribute("aria-expanded", "false");
    });

    root.querySelectorAll(".ttecnici-script-block").forEach((block) => {
      block.classList.remove("is-expanded");
      const toggle = block.querySelector(`[data-toggle-${domPrefix}-file]`);
      const rel    = toggle?.getAttribute(`data-toggle-${domPrefix}-file`);

      if (rel) {
        wb.expandedFiles.delete(rel);
      }

      toggle?.setAttribute("aria-expanded", "false");
    });
  });

  bindIntroScenarioActions(root, {
    prefix                        : "tfunc"
  , collapsedSet                  : collapsedTfuncScenarioScripts
  , collapsedTopicSet             : collapsedTfuncScenarioTopics
  , getScenariosSectionCollapsed  : () => tfuncScenariosSectionCollapsed
  , setScenariosSectionCollapsed  : (value) => { tfuncScenariosSectionCollapsed = value; }
  });
}

/**
 * @param {Record<string, unknown> | undefined} row
 */
function extractScriptTests(row) {
  if (!row) {
    return [];
  }

  const nested = row.report;

  if (typeof nested === "object" && nested !== null && Array.isArray(/** @type {Record<string, unknown>} */ (nested).tests)) {
    return /** @type {Record<string, unknown>[]} */ (/** @type {Record<string, unknown>} */ (nested).tests).map((test) => ({
      name       : String(test.name ?? "")
    , ok         : test.ok === true
    , skipped    : test.skipped === true
    , detail     : typeof test.detail === "string" ? test.detail : ""
    , durationMs : typeof test.durationMs === "number" ? test.durationMs : null
    , startedAt  : typeof test.startedAt === "string" ? test.startedAt : null
    }));
  }

  if (row.status === "skipped") {
    return [{
      name    : "skipped"
    , ok      : true
    , skipped : true
    , detail  : typeof row.reason === "string" ? row.reason : ""
    }];
  }

  return [];
}

/**
 * Catalog-first test list for TestTecnici: merges static discovery with last report.
 *
 * @param {Record<string, unknown> | undefined} entry
 * @param {Record<string, unknown> | undefined} reportRow
 */
function resolveScriptTestsForDisplay(entry, reportRow) {
  const catalogCases = Array.isArray(entry?.testCases) ? entry.testCases : [];
  const reportTests  = extractScriptTests(reportRow);

  if (catalogCases.length === 0) {
    return reportTests;
  }

  /** @type {Map<string, Record<string, unknown>>} */
  const reportByName = new Map(
    reportTests.map((test) => [String(test.name ?? ""), test])
  );

  return catalogCases.map((catalogCase) => {
    const name    = String(catalogCase.name ?? "");
    const matched = reportByName.get(name);
    const stepComment = typeof catalogCase.stepComment === "string"
      ? catalogCase.stepComment
      : null;

    if (matched) {
      return {
        name
      , ok          : matched.ok === true
      , skipped     : matched.skipped === true
      , detail      : typeof matched.detail === "string" ? matched.detail : ""
      , durationMs  : typeof matched.durationMs === "number" ? matched.durationMs : null
      , startedAt   : typeof matched.startedAt === "string" ? matched.startedAt : null
      , pending     : false
      , stepComment
      };
    }

    return {
      name
    , ok          : undefined
    , skipped     : false
    , detail      : ""
    , durationMs  : null
    , startedAt   : null
    , pending     : true
    , stepComment
    };
  });
}

/**
 * @param {{ ok?: boolean, skipped?: boolean, pending?: boolean }} test
 */
function testCaseStatus(test) {
  if (test.pending === true || (test.ok === undefined && test.skipped !== true)) {
    return "—";
  }
  if (test.skipped) {
    return "skipped";
  }
  if (test.ok) {
    return "passed";
  }
  return "failed";
}

/**
 * @param {Record<string, unknown>} entry
 */
function getScriptNarrative(entry) {
  const description = typeof entry.description === "string" ? entry.description.trim() : "";

  if (description) {
    return description;
  }

  return buildScriptNarrativeFallback(String(entry.rel ?? ""));
}

/**
 * @param {string} rel
 */
function buildScriptNarrativeFallback(rel) {
  const parts = rel.split("/");
  const file = (parts.pop() ?? rel).replace(/\.mjs$/iu, "").replace(/^test-/iu, "");
  const suite = parts.length > 0 ? parts[parts.length - 1] : "root";
  const suiteLabel = SUITE_LABELS[suite] ?? suite;
  const topic = file.split("-").join(" ");

  return `Script ${suiteLabel} — copertura: ${topic}.`;
}

/**
 * Trasforma il titolo del test case in una riga descrittiva più leggibile.
 *
 * @param {string} name
 */
function buildTestNarrative(name) {
  const raw = String(name ?? "").trim();

  if (!raw) {
    return "";
  }

  if (raw === "skipped") {
    return "Lo script non è stato eseguito o è stato saltato.";
  }

  const arrowMatch = raw.match(/^(.+?)\s*(?:→|->)\s*(.+)$/u);

  if (arrowMatch) {
    const action   = arrowMatch[1].trim();
    const expected = arrowMatch[2].trim();

    return `Verifica che ${action} produca l'esito atteso: ${expected}.`;
  }

  if (/^(GET|POST|PUT|PATCH|DELETE)\s+\S+/iu.test(raw)) {
    return `Scenario API — ${raw}.`;
  }

  if (raw.includes(" — ")) {
    const [lead, rest] = raw.split(" — ").map((part) => part.trim());

    return `${lead}: ${rest}.`;
  }

  if (/^(login|register|setup|cleanup|host|player|seed)\b/iu.test(raw)) {
    return `Preparazione o verifica del contesto — ${raw}.`;
  }

  if (/contract|envelope|i18n|UI|Web\b/iu.test(raw)) {
    return `Controllo funzionale — ${raw}.`;
  }

  return `Verifica che ${raw}.`;
}

/**
 * @param {string} value
 */
function cssEscapeId(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * @param {string} value
 */
function cssEscapeAttr(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** @type {number | null} */
let pollTimer = null;

/** @type {{ scripts?: Array<Record<string, unknown>> } | null} */
let scriptCatalog = null;

/** @type {Record<string, unknown> | null} */
let funzionaliMeta = null;

/** @type {Record<string, unknown> | null} */
let tecniciMeta = null;

async function refreshRunViewsFromApi() {
  const status = await apiGet("/api/status");
  let report = null;

  try {
    report = await apiGet("/api/report");
  } catch {
    report = null;
  }

  renderTest(report, status, scriptCatalog);
  renderTestTecnici(report, status, scriptCatalog, tecniciMeta);
  renderTestFunzionali(report, status, scriptCatalog, funzionaliMeta);

  return { status, report };
}

function pollRunStatus() {
  runLogCursor = 0;

  if (pollTimer) {
    clearInterval(pollTimer);
  }

  const tick = async () => {
    let status;
    let report;

    try {
      ({ status, report } = await refreshRunViewsFromApi());
    } catch {
      return;
    }

    if (!status.running) {
      clearInterval(/** @type {number} */ (pollTimer));
      pollTimer = null;
    }

    await pollRunLogs();
  };

  void tick();
  pollTimer = window.setInterval(tick, 1500);
}

// --- tab Process — orchestrazione stack dev ---
/**
 * Tab Process — tabella servizi, avvio/kill stack, console log e DB dev.
 *
 * @param {Record<string, unknown> | null} report — ultimo report test (export Excel/JSON)
 */
async function renderProcess(report) {
  const root = document.getElementById("section-process");
  if (!root) {
    return;
  }

  initProcessConsoleTabsFallback();

  const hasReport            = Boolean(report);
  const repoName               = cruscottoRepoName();
  const jiraPrefix             = cruscottoJiraPrefix();
  const hasProductDatabase   = cruscottoHasProductDatabase();
  const dbFilename             = cruscottoDbFilename();
  const defaultProductSibling  = cruscottoDefaultProductSibling();
  const friendbotLabel         = cruscottoFriendbotLabel();
  const dashboardPort          = cruscottoDashboardPort();
  const showBulkStackFooter      = processShowBulkStackFooter();
  const dbDefaultPath          = hasProductDatabase
    ? `${String(getCruscottoProject().dbPrismaRelPath ?? "packages/database/prisma")}/${dbFilename}`
    : "";

  root.innerHTML = `
    <section class="panel process-intro-panel test-suite-group" id="process-intro-panel">
      <div class="test-suite-header-row process-intro-header">
        <button
          type="button"
          class="test-suite-toggle"
          id="btn-process-intro-toggle"
          aria-expanded="true"
        >
          <span class="suite-chevron" aria-hidden="true"></span>
          <span class="suite-title">
            <span class="suite-name">Guida — cos'è Process e cosa fare</span>
            <span class="suite-path muted">tabella servizi · bottoni → script · console</span>
          </span>
        </button>
      </div>
      <div class="test-suite-body process-intro-body">
        <h3>Cos'è questa pagina</h3>
        <p>
          Process è il pannello operativo per lo sviluppo locale: tabella dei servizi del product repo
          (${repoName}) e del cruscotto, avvio e kill per riga, console dell'output in tempo reale,
          export dell'ultimo report test.
        </p>
        <h3>Tabella «Avvio stack dev»</h3>
        <p>
          Ogni riga mostra <strong>Path</strong> (cartella o script nel repo), <strong>PID</strong>,
          <strong>User</strong> (Cursor / Utente / Cruscotto), <strong>Stato</strong>
          (data/ora sulla prima riga, stato sulla seconda) e i bottoni in <strong>Avvio / Kill</strong>.
          Le righe <em>Database - Prisma — REFRESH</em>, <em>web</em>, <em>api</em> e <em>auth</em> condividono una
          sola cella unificata.
          <em>API Documentation</em> e <em>Admin Dashboard</em> sono servizi <strong>PortalAdmin</strong>
          (righe separate, config progetto da <code>PRODUCT_REPO_PATH</code>).
        </p>
        <h3>Bottoni nella tabella — script agganciati</h3>
        <table class="data process-intro-table">
          <thead>
            <tr><th>Bottone</th><th>Riga / ambito</th><th>Script o API</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Avvia</strong> (stack)</td>
              <td>schema + web + api + auth</td>
              <td>
                <code>node cruscotto.frontend/cruscotto.process.start.all.services.mjs</code>
                (Auth + API + Web — include db:push prima dell'avvio).
              </td>
            </tr>
            <tr>
              <td><strong>Kill</strong> (stack)</td>
              <td>web, api, auth</td>
              <td>API <code>POST /api/repo/services/stop</code> — libera porte 3000, 4000, 4001</td>
            </tr>
            <tr>
              <td><strong>Avvia</strong> / <strong>Kill</strong></td>
              <td>API Documentation (PortalAdmin)</td>
              <td>
                API <code>start-one</code> / <code>stop-one</code> —
                <code>node cruscotto.frontend/cruscotto.process.start.api.documentation.mjs</code>
                (UI in <code>PortalAdmin/api-documentation/</code>, config da manifest product)
              </td>
            </tr>
            ${hasProductDatabase ? `
            <tr>
              <td><strong>Delete &amp; create</strong></td>
              <td>Database — Prisma (file)</td>
              <td><code>node cruscotto.database/product.database.init.mjs</code> (elimina <code>${dbFilename}</code>, ricrea schema)</td>
            </tr>
            <tr>
              <td><strong>Inizializza</strong></td>
              <td>Database — Script inizializzazione</td>
              <td><code>node cruscotto.database/product.database.seed.run.call.mjs</code> (<code>npm run db:seed</code>)</td>
            </tr>
            ` : ""}
            <tr>
              <td><strong>Avvia</strong> / <strong>Kill</strong></td>
              <td>singola riga (es. friendBOT)</td>
              <td>
                API <code>start-one</code> / <code>stop-one</code> — comando dalla colonna Path:
                <code>npm run dev -w …</code> per le app Turbo, oppure
                <code>node testScript/funzionali/friend-bot.mjs</code> per friendBOT
              </td>
            </tr>
            <tr>
              <td class="muted">—</td>
              <td>Admin Dashboard (:3999)</td>
              <td class="muted">Cruscotto già attivo — nessun Avvia/Kill</td>
            </tr>
          </tbody>
        </table>
        <h3>Bottoni sotto la tabella</h3>
        <table class="data process-intro-table">
          <thead>
            <tr><th>Bottone</th><th>Script equivalente</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Avvia product</strong> (web, api, auth)</td>
              <td><code>node cruscotto.frontend/cruscotto.process.start.all.services.mjs</code></td>
            </tr>
            <tr>
              <td><strong>Avvia stack completo</strong></td>
              <td><code>node cruscotto.frontend/cruscotto.process.start.all.services.mjs</code> + friendBOT + API Documentation</td>
            </tr>
            <tr>
              <td><strong>Kill All</strong></td>
              <td><code>node cruscotto.frontend/cruscotto.process.stop.all.services.mjs</code> o <code>npm run stop:all</code>
                — non termina il cruscotto :3999</td>
            </tr>
            <tr>
              <td><strong>Aggiorna processi</strong></td>
              <td><code>GET /api/repo/services/processes</code> (solo PID, User, Stato)</td>
            </tr>
            <tr>
              <td><strong>Riprova discovery</strong></td>
              <td>Ricarica piano avvio da manifest + stato health</td>
            </tr>
          </tbody>
        </table>
        <h3>Cosa fare (prima volta)</h3>
        <ol class="process-intro-steps">
          <li>
            In <code>PortalAdmin/.env</code> imposta
            <code>PRODUCT_REPO_PATH</code> sul checkout ${repoName} (default
            <code>${defaultProductSibling}</code> se affiancato).
          </li>
          <li>
            <strong>Riavvia il dashboard</strong> dopo aggiornamenti Admin:
            <code>Ctrl+C</code>, poi <code>npm run admin:dashboard</code>.
          </li>
          <li>
            Verifica la tabella: servizi con colonne <strong>Stato</strong> (data/ora + in ascolto/libera)
            e <strong>User</strong>.
          </li>
          <li>
            ${hasProductDatabase
              ? "Database file: <strong>Delete &amp; create</strong>; seed: <strong>Inizializza</strong>. Stack product: <strong>Avvia</strong> / <strong>Kill</strong> (include db:push all'avvio)."
              : "Stack product (se presente nel manifest): <strong>Avvia</strong> / <strong>Kill</strong> dalla cella unificata o dai bottoni sotto la tabella."}
          </li>
          <li>
            Avvia lo stack dalla cella unificata <strong>Avvia</strong> (product) o dai bottoni
            <strong>Avvia product</strong> / <strong>Avvia stack completo</strong> sotto la tabella.
          </li>
          <li>
            Segui l'output in <strong>Console avvio stack</strong>; per liberare le porte usa
            <strong>Kill</strong> sulla riga stack, <strong>Kill All</strong> o
            <code>npm run stop:repo</code>.
          </li>
        </ol>
        <p class="muted process-intro-note">
          Setup alternativo da terminale (product repo):
          <code>node admin.script.standalone/start-dev.mjs</code> — cleanup, build, db opzionale e avvio stack.
          Se vedi <em>Discovery non disponibile</em> o <code>Not found</code>, riavvia
          <code>npm run admin:dashboard</code> e ricarica con Ctrl+F5.
        </p>
      </div>
    </section>
    <div class="panel">
      <h2>Avvio stack dev</h2>
      <table class="data">
        <thead>
          <tr><th class="process-block-col">#</th><th>Product</th><th>Servizio</th><th>Descrizione</th><th>Path</th><th>Porta</th><th>PID</th><th>User</th><th>Stato</th><th>Link</th><th>Avvio / Kill</th></tr>
        </thead>
        <tbody id="process-services-body">
          <tr><td colspan="11" class="muted">Caricamento piano avvio…</td></tr>
        </tbody>
      </table>
      <p id="process-processes-checked" class="muted" style="margin-top:0.35rem;font-size:0.8rem">—</p>
      <div class="btn-row" style="margin-top:0.75rem">
        ${showBulkStackFooter ? `
        <button class="action primary" type="button" id="btn-process-start-core">Avvia product…</button>
        <button class="action" type="button" id="btn-process-start-full">Avvia stack completo…</button>
        <button class="action" type="button" id="btn-process-stop-stack" title="Kill servizi dev — non il cruscotto">Kill All</button>
        ` : ""}
        <button class="action" type="button" id="btn-process-refresh-processes">Aggiorna processi</button>
        <button class="action" type="button" id="btn-process-retry-discovery">Riprova discovery</button>
      </div>
      ${showBulkStackFooter ? `
      <p class="muted process-stop-hint" id="process-stop-hint">—</p>
      <p id="process-start-status" class="muted" style="margin-top:0.75rem">—</p>
      <div class="cmd-block" style="margin-top:0.75rem">
        <span class="muted">CLI</span>
        <code id="process-cli-cmd">node cruscotto.frontend/cruscotto.process.start.all.services.mjs</code>
        <button class="action" type="button" id="btn-process-copy-cmd">Copia</button>
      </div>
      ` : ""}
    </div>
    <div class="panel process-console-panel">
      <div class="process-console-head">
        <div>
          <h2>Console avvio stack</h2>
          <p class="muted">Output in tempo reale — tab <strong>Tutti</strong> o per singolo servizio.</p>
        </div>
        <div class="process-console-tools">
          <label class="portal-log-filter">
            <span class="muted">Livello</span>
            <select id="process-log-level" aria-label="Filtro livello log">
              <option value="all">tutti</option>
              <option value="debug">debug+</option>
              <option value="info" selected>info+</option>
              <option value="warn">warn+</option>
              <option value="error">error</option>
            </select>
          </label>
          <label class="portal-log-filter">
            <span class="muted">Sorgente</span>
            <select id="process-log-source" aria-label="Filtro sorgente log">
              <option value="process" selected>process</option>
              <option value="test">test</option>
              <option value="agent">agent</option>
              <option value="all">all</option>
            </select>
          </label>
          <span id="process-console-running" class="process-console-badge">—</span>
          <label class="process-console-follow-label">
            <input type="checkbox" id="process-console-follow" checked />
            Auto-scroll
          </label>
          <button class="action" type="button" id="btn-process-console-instances" title="Elenco PID e user dei servizi in ascolto">Istanze attive</button>
          <button class="action" type="button" id="btn-process-clear-console" title="Svuota solo il tab console attivo — i log sul server restano, arrivano solo righe nuove">Clear console</button>
          <button class="action" type="button" id="btn-process-console-clear" title="Cancella i log sul server e ricarica tutte le tab">Pulisci</button>
        </div>
      </div>
      ${renderProcessConsoleTabsMarkup()}
    </div>
    <div class="panel">
      <h2>Export report</h2>
      <p class="muted">Scarica l'ultimo report test (<code>latest.json</code>) in Excel o JSON.</p>
      <div class="btn-row">
        <button class="action" type="button" id="btn-process-export-xlsx" ${hasReport ? "" : "disabled"}>Export Excel</button>
        <button class="action" type="button" id="btn-process-export-json" ${hasReport ? "" : "disabled"}>Export JSON</button>
      </div>
    </div>
    <div class="panel">
      <h2>Report HTML</h2>
      <p class="muted">Apri l'ultimo report HTML generato da <code>run-all</code>.</p>
      <div class="btn-row">
        <a
          href="/api/report/html"
          target="_blank"
          rel="noopener"
          class="action${hasReport ? "" : " is-disabled"}"
          ${hasReport ? "" : 'aria-disabled="true" tabindex="-1"'}
        >Apri report HTML</a>
      </div>
    </div>
    <div
      id="process-confirm-modal"
      class="process-confirm-overlay hidden"
      hidden
      role="dialog"
      aria-modal="true"
      aria-labelledby="process-confirm-title"
    >
      <div class="process-confirm-panel">
        <h3 id="process-confirm-title" class="process-confirm-title">Conferma</h3>
        <div id="process-confirm-body" class="process-confirm-body"></div>
        <div class="process-confirm-actions">
          <button type="button" class="action" id="process-confirm-cancel">Annulla</button>
          <button type="button" class="action primary" id="process-confirm-ok">Conferma</button>
        </div>
      </div>
    </div>`;

  bindExportActions(root, {
    xlsxId : "btn-process-export-xlsx"
  , jsonId : "btn-process-export-json"
  });

  bindProcessIntroPanel(root);
  bindProcessConsoleTabs(root);
  bindProcessConfirmModal();
  await hydrateProcessStack(root);

  if (location.hash.replace("#", "") === "process") {
    startProcessConsolePolling();
  }
}

/**
 * @param {HTMLElement} root
 */
function bindProcessIntroPanel(root) {
  const panel  = root.querySelector("#process-intro-panel");
  const toggle = root.querySelector("#btn-process-intro-toggle");

  if (!(panel instanceof HTMLElement) || !(toggle instanceof HTMLButtonElement)) {
    return;
  }

  if (localStorage.getItem("process-intro-collapsed") === "1") {
    panel.classList.add("is-collapsed");
    toggle.setAttribute("aria-expanded", "false");
  }

  toggle.addEventListener("click", () => {
    const collapsed = panel.classList.toggle("is-collapsed");
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    localStorage.setItem("process-intro-collapsed", collapsed ? "1" : "0");
  });
}

/**
 * @param {unknown} err
 */
function formatProcessDiscoveryError(err) {
  const msg = err instanceof Error ? err.message : "Errore discovery";

  if (msg === "Not found" || msg.includes("HTTP 404")) {
    return [
      "API /api/repo/services non trovata sul server in ascolto su :3999."
    , "1) Riavvia: npm run admin:dashboard"
    , "2) Ricarica la pagina con Ctrl+F5"
    , "3) Clicca Riprova discovery"
    ].join(" ");
  }

  if (msg.includes("Product repo non trovato")) {
    return [
      msg
    , "— imposta PRODUCT_REPO_PATH in PortalAdmin/.env"
    ].join(" ");
  }

  return msg;
}

/**
 * @param {HTMLElement} root
 */
async function hydrateProcessStack(root) {
  const showBulkFooter = processShowBulkStackFooter();
  const tableEl  = root.querySelector("#process-services-body");
  const statusEl = root.querySelector("#process-start-status");
  const cliEl    = root.querySelector("#process-cli-cmd");
  const coreBtn  = root.querySelector("#btn-process-start-core");
  const fullBtn  = root.querySelector("#btn-process-start-full");
  const copyBtn  = root.querySelector("#btn-process-copy-cmd");
  const clearBtn  = root.querySelector("#btn-process-console-clear");
  const clearViewBtn = root.querySelector("#btn-process-clear-console");
  const instancesBtn = root.querySelector("#btn-process-console-instances");
  const levelFilterEl = root.querySelector("#process-log-level");
  const sourceFilterEl = root.querySelector("#process-log-source");
  const retryBtn  = root.querySelector("#btn-process-retry-discovery");
  const stopBtn   = root.querySelector("#btn-process-stop-stack");
  const refreshProcBtn = root.querySelector("#btn-process-refresh-processes");
  const processesCheckedEl = root.querySelector("#process-processes-checked");

  if (!tableEl || !refreshProcBtn || !retryBtn) {
    return;
  }

  if (levelFilterEl instanceof HTMLSelectElement) {
    levelFilterEl.addEventListener("change", () => {
      processLogLevelFilter = levelFilterEl.value;
    });
  }

  if (sourceFilterEl instanceof HTMLSelectElement) {
    sourceFilterEl.addEventListener("change", async () => {
      processLogSourceFilter = sourceFilterEl.value;
      processLogCursor         = 0;
      clearProcessConsolePanes();
      await reloadProcessConsole(true);
    });
  }

  if (showBulkFooter && (!statusEl || !cliEl || !coreBtn || !fullBtn)) {
    return;
  }

  const PROCESS_TABLE_COLS   = 11;
  const PRODUCT_REPO_NAME    = cruscottoRepoName();
  const friendbotLabel       = cruscottoFriendbotLabel();
  const dashboardPort        = cruscottoDashboardPort();
  const HAS_PRODUCT_DATABASE = cruscottoHasProductDatabase();
  const dbDefaultPath        = HAS_PRODUCT_DATABASE
    ? `${String(getCruscottoProject().dbPrismaRelPath ?? "packages/database/prisma")}/${cruscottoDbFilename()}`
    : "";
  const PROCESS_BLOCK_DB_FILE = 1;
  const PROCESS_BLOCK_DB_SEED = 2;
  const PROCESS_BLOCK_STACK   = 3;

  /** @type {Array<Record<string, unknown>>} */
  let lastDiscoveredServices = [];
  /** @type {Array<Record<string, unknown>>} */
  let lastProcessRows        = [];
  /** @type {ReturnType<typeof buildProcessStackFooterModel>} */
  let processStackFooterModel = buildProcessStackFooterModel([]);

  const stopHintEl = root.querySelector("#process-stop-hint");

  /** @param {string} message */
  function setProcessStatus(message) {
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  /**
   * @param {Array<Record<string, unknown>>} services
   */
  function refreshProcessStackFooter(services) {
    processStackFooterModel = buildProcessStackFooterModel(services);

    if (coreBtn) {
      coreBtn.textContent = processStackFooterModel.coreButton;
    }

    if (fullBtn) {
      fullBtn.textContent = processStackFooterModel.fullButton;
    }

    if (stopBtn) {
      stopBtn.title = processStackFooterModel.stopBtnTitle;
    }

    if (stopHintEl) {
      stopHintEl.textContent = processStackFooterModel.killHint;
    }

    if (cliEl) {
      cliEl.textContent = processStackFooterModel.cliCommand;
    }
  }

  refreshProcessStackFooter([]);

  /**
   * @param {number} blockNum
   * @param {number} [rowSpan]
   */
  function renderProcessBlockCell(blockNum, rowSpan = 1) {
    return `<td rowspan="${rowSpan}" class="process-block-cell" valign="middle">${blockNum}</td>`;
  }

  /**
   * @param {number} blockNum
   */
  function processBlockParityClass(blockNum) {
    return blockNum % 2 === 1 ? "process-block-odd" : "process-block-even";
  }

  /**
   * @param {number} blockNum
   * @param {...string} extraClasses
   */
  function processTrClassAttr(blockNum, ...extraClasses) {
    const classes = [
      processBlockParityClass(blockNum)
    , ...extraClasses.filter(Boolean)
    ].join(" ");

    return classes ? ` class="${classes}"` : "";
  }

  /** Servizi PortalAdmin con Avvia/Kill per riga (oltre stack product). */
  const PORTAL_MANAGED_SERVICE_IDS = new Set([
    "home"
  , "api-documentation"
  , "friendbot"
  ]);

  function isPortalAdminService(svc) {
    return String(svc.product ?? "") === "PortalAdmin";
  }

  /**
   * @param {Record<string, unknown>} svc
   */
  function isStackCompleteService(svc) {
    const id = String(svc.id ?? "");

    if (PORTAL_MANAGED_SERVICE_IDS.has(id)) {
      return false;
    }

    return String(svc.product ?? "") === PRODUCT_REPO_NAME
      && id !== "friendbot"
      && id !== "database";
  }

  /**
   * @param {Record<string, unknown>} svc
   * @param {Record<string, unknown> | null | undefined} prevSvc
   */
  function processProductBoundaryClass(svc, prevSvc) {
    const product     = String(svc.product ?? "");
    const prevProduct = prevSvc
      ? String(prevSvc.product ?? "")
      : PRODUCT_REPO_NAME;

    if (product === "PortalAdmin" && prevProduct === PRODUCT_REPO_NAME) {
      return "process-product-boundary-row";
    }

    return "";
  }

  /**
   * @param {Map<string, Record<string, unknown>>} processById
   * @param {string} serviceId
   */
  function isProcessServiceListening(processById, serviceId) {
    return processById.get(serviceId)?.listening === true;
  }

  /**
   * @param {Map<string, Record<string, unknown>>} processById
   */
  function isProductStackListening(processById) {
    return cruscottoStackStartServiceIds().every(
      (id) => isProcessServiceListening(processById, id)
    );
  }

  /**
   * @param {Map<string, Record<string, unknown>>} processById
   */
  function isAnyProductStackListening(processById) {
    return cruscottoStackStartServiceIds().some(
      (id) => isProcessServiceListening(processById, id)
    );
  }

  /**
   * Cella unificata stack product (schema db + web, api, auth).
   * @param {number} rowSpan
   * @param {{ stackAllUp?: boolean, stackAnyUp?: boolean }} [options]
   */
  function renderStackActionsCell(rowSpan, options = {}) {
    const { stackAllUp = false, stackAnyUp = false } = options;
    const startDisabled = stackAllUp ? " disabled" : "";
    const killDisabled  = stackAnyUp ? "" : " disabled";

    return `<td rowspan="${rowSpan}" class="process-actions-cell process-stack-complete-cell" valign="middle">
      <div class="process-actions-stack">
        <button type="button" class="action primary process-action-btn" data-process-action="stack-start" title="cruscotto.process.start.all.services.mjs — stack product da discovery"${startDisabled}>Avvia</button>
        <button type="button" class="action process-action-btn" data-process-action="stack-kill" title="Termina servizi stack product (es. web/api/auth o HOME/api-documentation)"${killDisabled}>Kill</button>
      </div>
    </td>`;
  }

  /**
   * Prima riga gruppo stack senza DB product — equivalente schema REFRESH per overlay PortalAdmin-only.
   * @param {number} rowSpan
   * @param {{ stackAllUp?: boolean, stackAnyUp?: boolean }} stackState
   */
  function renderStackHeaderRowNoDb(rowSpan, stackState) {
    const stackIds = cruscottoStackStartServiceIds().join(", ");

    return `
      <tr${processTrClassAttr(PROCESS_BLOCK_STACK, "process-stack-header-row")}>
        ${renderProcessBlockCell(PROCESS_BLOCK_STACK, rowSpan)}
        <td>${escapeHtml(PRODUCT_REPO_NAME)}</td>
        <td>Stack product<span class="process-svc-suffix"> — AVVIA / KILL</span></td>
        <td class="process-service-desc muted">Servizi: ${escapeHtml(stackIds)} — avvio singolo per servizio PortalAdmin</td>
        <td><code class="process-service-path">${escapeHtml(stackIds)}</code></td>
        <td>—</td>
        <td><code>—</code></td>
        <td class="muted">—</td>
        <td>—</td>
        <td>—</td>
        ${renderStackActionsCell(rowSpan, stackState)}
      </tr>`;
  }

  /**
   * @param {number} bytes
   */
  function formatDbSize(bytes) {
    if (!bytes || bytes <= 0) {
      return "—";
    }

    if (bytes < 1024) {
      return `${bytes} B`;
    }

    return `${Math.round(bytes / 1024)} KB`;
  }

  /**
   * Bottoni Avvia/Kill per singolo servizio (es. friendBOT, API Documentation).
   * @param {string} serviceId
   * @param {boolean} [listening]
   */
  function renderServiceActionsCell(serviceId, listening = false) {
    const safeId        = escapeHtml(serviceId);
    const startDisabled = listening ? " disabled" : "";
    const killDisabled  = listening ? "" : " disabled";

    return `<td class="process-actions-cell">
      <div class="process-actions-stack">
        <button type="button" class="action primary process-action-btn" data-process-action="service-start" data-service-id="${safeId}"${startDisabled}>Avvia</button>
        <button type="button" class="action process-action-btn" data-process-action="service-kill" data-service-id="${safeId}"${killDisabled}>Kill</button>
      </div>
    </td>`;
  }

  /**
   * @param {Record<string, unknown>} svc
   * @param {number} index
   * @param {number} firstStackIndex
   * @param {number} stackRowCount
   * @param {Map<string, Record<string, unknown>>} processById
   * @param {{ stackAllUp?: boolean, stackAnyUp?: boolean }} stackState
   */
  function renderRowActionsCell(svc, index, firstStackIndex, stackRowCount, processById, stackState = {}) {
    const id        = String(svc.id ?? "");
    const svcPort   = Number(svc.port);
    const listening = isProcessServiceListening(processById, id);

    if (id === "dashboard") {
      if (Number.isFinite(svcPort) && svcPort === dashboardPort && listening) {
        return `<td class="process-actions-cell muted" title="Sessione cruscotto corrente (:${dashboardPort})">—</td>`;
      }

      return renderServiceActionsCell(id, listening);
    }

    if (isStackCompleteService(svc)) {
      return "";
    }

    if (PORTAL_MANAGED_SERVICE_IDS.has(id)) {
      return renderServiceActionsCell(id, listening);
    }

    return `<td class="process-actions-cell muted">—</td>`;
  }

  /**
   * Prima riga del gruppo stack (schema + web, api, auth) — cella Avvia/Kill unificata.
   * @param {Record<string, unknown>} dbStatus
   * @param {number} rowSpan
   * @param {{ stackAllUp?: boolean, stackAnyUp?: boolean }} stackState
   */
  function renderDatabaseSchemaStackRow(dbStatus, rowSpan, stackState) {
    if (!HAS_PRODUCT_DATABASE) {
      return "";
    }

    const exists     = dbStatus.exists === true;
    const scriptPath = "cruscotto.database/product.database.init.mjs --push";
    const sizeLabel  = formatDbSize(Number(dbStatus.sizeBytes ?? 0));
    const createdIso = typeof dbStatus.createdAt === "string" ? dbStatus.createdAt : null;
    const checkedAt  = typeof dbStatus.checkedAt === "string" ? dbStatus.checkedAt : null;
    const dbStato    = exists
      ? renderProcessStatoCell({
          atIso  : createdIso ?? checkedAt
        , up     : true
        , label  : "presente"
        , suffix : sizeLabel
        })
      : renderProcessStatoCell({
          atIso  : checkedAt
        , absent : true
        , label  : ""
        });

    return `
      <tr${processTrClassAttr(PROCESS_BLOCK_STACK, "process-db-row", "process-db-schema-stack-row")}>
        ${renderProcessBlockCell(PROCESS_BLOCK_STACK, rowSpan)}
        <td>${escapeHtml(PRODUCT_REPO_NAME)}</td>
        <td>Database - Prisma<span class="process-svc-suffix"> — REFRESH —</span></td>
        <td class="process-service-desc muted">Allinea schema Prisma (db:push) — stack web, api, auth</td>
        <td><code class="process-service-path">${escapeHtml(scriptPath)}</code></td>
        <td>—</td>
        <td><code>—</code></td>
        <td class="muted">—</td>
        <td>${dbStato}</td>
        <td>—</td>
        ${renderStackActionsCell(rowSpan, stackState)}
      </tr>`;
  }

  /**
   * @param {Array<Record<string, unknown>>} listeners
   */
  function formatProcessUserCell(listeners) {
    if (!listeners.length) {
      return `<td class="process-proc-user-cell muted">—</td>`;
    }

    const lines = listeners.map((row) => {
      const starter = String(row.starter ?? row.label ?? "unknown");
      const user    = typeof row.user === "string" && row.user ? row.user : "";
      const userHtml = user ? ` <span class="muted process-proc-user-name">${escapeHtml(user)}</span>` : "";

      if (starter === "cursor") {
        return `<span class="process-proc-user process-proc-user-cursor">Cursor</span>${userHtml}`;
      }

      if (starter === "dashboard") {
        return `<span class="process-proc-user process-proc-user-dashboard">Cruscotto</span>${userHtml}`;
      }

      if (starter === "user") {
        return `<span class="process-proc-user process-proc-user-terminal">Utente</span>${userHtml}`;
      }

      const fallbackLabel = typeof row.label === "string" && row.label && row.label !== "—"
        ? row.label
        : (user ? escapeHtml(user) : "—");

      return escapeHtml(fallbackLabel);
    });

    return `<td class="process-proc-user-cell">${lines.join("<br>")}</td>`;
  }

  /**
   * @param {{
   *   atIso?: string | null
   *   up?: boolean
   *   label: string
   *   suffix?: string
   *   absent?: boolean
   * }} opts
   */
  function renderProcessStatoCell(opts) {
    const { atIso, up, label, suffix, absent } = opts;
    const atHtml = escapeHtml(formatRunAt(atIso ?? null));

    if (absent) {
      return `<div class="process-db-stato">
        <div class="process-db-created">${atHtml}</div>
        <div><span class="process-db-absent">! DB Assente !</span></div>
      </div>`;
    }

    const klass      = up ? "process-proc-up" : "process-proc-down";
    const suffixHtml = suffix ? ` <span class="muted">(${escapeHtml(suffix)})</span>` : "";

    return `<div class="process-db-stato">
      <div class="process-db-created">${atHtml}</div>
      <div><span class="${klass}">${escapeHtml(label)}</span>${suffixHtml}</div>
    </div>`;
  }

  /**
   * @param {Array<Record<string, unknown>>} listeners
   * @returns {string | null}
   */
  function earliestListenerStartedAt(listeners) {
    /** @type {string | null} */
    let best = null;

    for (const row of listeners) {
      const startedAt = typeof row.startedAt === "string" ? row.startedAt : null;

      if (!startedAt) {
        continue;
      }

      if (!best || startedAt < best) {
        best = startedAt;
      }
    }

    return best;
  }

  /**
   * @param {Record<string, unknown>} dbStatus
   */
  function renderDatabaseRows(dbStatus) {
    if (!HAS_PRODUCT_DATABASE) {
      return "";
    }

    const exists     = dbStatus.exists === true;
    const dbPath     = escapeHtml(String(dbStatus.path ?? dbDefaultPath));
    const sizeLabel  = formatDbSize(Number(dbStatus.sizeBytes ?? 0));
    const createdIso = typeof dbStatus.createdAt === "string" ? dbStatus.createdAt : null;
    const checkedAt  = typeof dbStatus.checkedAt === "string" ? dbStatus.checkedAt : null;
    const dbStato    = exists
      ? renderProcessStatoCell({
          atIso  : createdIso ?? checkedAt
        , up     : true
        , label  : "presente"
        , suffix : sizeLabel
        })
      : renderProcessStatoCell({
          atIso  : checkedAt
        , absent : true
        , label  : ""
        });
    const scriptPath     = "cruscotto.database/product.database.seed.run.call.mjs";
    const seedAt         = typeof dbStatus.seedCompletedAt === "string" ? dbStatus.seedCompletedAt : null;
    const seedCompleted  = dbStatus.seedCompleted === true || seedAt != null;
    const seedStato      = seedCompleted
      ? renderProcessStatoCell({
          atIso : seedAt ?? checkedAt
        , up    : true
        , label : "completed"
        })
      : renderProcessStatoCell({
          atIso : checkedAt
        , up    : false
        , label : "da inizializzare"
        });
    const seedBtnDisabled = seedCompleted ? " disabled" : "";
    const seedBtnClass    = seedCompleted
      ? "action process-action-btn"
      : "action primary process-action-btn";

    return `
      <tr${processTrClassAttr(PROCESS_BLOCK_DB_FILE, "process-db-row", "process-db-file-row")}>
        ${renderProcessBlockCell(PROCESS_BLOCK_DB_FILE)}
        <td>${escapeHtml(PRODUCT_REPO_NAME)}</td>
        <td>Database - Prisma</td>
        <td class="process-service-desc muted">File SQLite Prisma — schema persistente</td>
        <td><code class="process-service-path">${dbPath}</code></td>
        <td>—</td>
        <td><code>—</code></td>
        <td class="muted">—</td>
        <td>${dbStato}</td>
        <td>—</td>
        <td class="process-actions-cell">
          <div class="process-actions-stack">
            <button type="button" class="action process-action-btn" data-process-action="db-reset" title="Elimina ${escapeHtml(dbFilename)} e ricrea schema">Delete &amp; create</button>
          </div>
        </td>
      </tr>
      <tr${processTrClassAttr(PROCESS_BLOCK_DB_SEED, "process-db-row", "process-db-script-row")}>
        ${renderProcessBlockCell(PROCESS_BLOCK_DB_SEED)}
        <td>${escapeHtml(PRODUCT_REPO_NAME)}</td>
        <td>Database - Script inizializzazione</td>
        <td class="process-service-desc muted">npm run db:seed — righe host@ e player@</td>
        <td><code class="process-service-path">${escapeHtml(scriptPath)}</code></td>
        <td>—</td>
        <td><code>—</code></td>
        <td class="muted">—</td>
        <td>${seedStato}</td>
        <td>—</td>
        <td class="process-actions-cell">
          <div class="process-actions-stack">
            <button type="button" class="${seedBtnClass}" data-process-action="db-seed"${seedBtnDisabled} title="npm run db:seed — host/player">Inizializza</button>
          </div>
        </td>
      </tr>`;
  }

  /**
   * @param {Array<Record<string, unknown>>} nodeRows
   * @param {string | null} checkedAt
   * @param {number} blockNum
   */
  function renderProcessNodeProcessRows(nodeRows, checkedAt, blockNum) {
    if (!nodeRows.length) {
      return "";
    }

    return nodeRows.map((row, index) => {
      const listeners   = Array.isArray(row.listeners) ? row.listeners : [];
      const pidText     = listeners.length > 0
        ? listeners.map((listener) => {
            const pid = listener.pid != null ? String(listener.pid) : "?";
            return listener.isDashboard ? `${pid} (dashboard)` : pid;
          }).join(", ")
        : "—";
      const userCell    = formatProcessUserCell(listeners);
      const atIso       = earliestListenerStartedAt(listeners) ?? checkedAt;
      const description = escapeHtml(String(row.description ?? row.command ?? "—"));
      const path        = escapeHtml(String(row.path ?? description));
      const product     = escapeHtml(String(row.product ?? "—"));
      const stato       = renderProcessStatoCell({
        atIso : atIso
      , up    : true
      , label : "attivo"
      });
      const blockCell   = index === 0
        ? renderProcessBlockCell(blockNum, nodeRows.length)
        : "";

      return `
        <tr${processTrClassAttr(blockNum, "process-node-proc-row")}>
          ${blockCell}
          <td>${product}</td>
          <td>Node <span class="muted">#${escapeHtml(pidText)}</span></td>
          <td class="process-service-desc muted" title="${path}">${description}</td>
          <td><code class="process-service-path process-node-cmd" title="${path}">${path}</code></td>
          <td>—</td>
          <td><code>${escapeHtml(pidText)}</code></td>
          ${userCell}
          <td>${stato}</td>
          <td>—</td>
          <td class="process-actions-cell muted" title="Processo rilevato — usa Kill sul servizio correlato">—</td>
        </tr>`;
    }).join("");
  }

  /**
   * @param {Array<Record<string, unknown>>} services
   * @param {Array<Record<string, unknown>>} [processRows]
   * @param {Record<string, unknown>} [dbStatus]
   * @param {Array<Record<string, unknown>>} [nodeRows]
   */
  function renderServiceRows(services, processRows = [], dbStatus = {}, nodeRows = []) {
    const checkedAt = typeof dbStatus.checkedAt === "string" ? dbStatus.checkedAt : null;
    const dbRow     = HAS_PRODUCT_DATABASE ? renderDatabaseRows(dbStatus) : "";

    if (!services.length) {
      const nodeHtml = renderProcessNodeProcessRows(nodeRows, checkedAt, PROCESS_BLOCK_STACK);

      return `${dbRow}${nodeHtml || `<tr><td colspan="${PROCESS_TABLE_COLS}" class="muted">Nessun servizio rilevato</td></tr>`}`;
    }

    const processById = new Map(
      processRows.map((row) => [String(row.id ?? ""), row])
    );

    const stackIndices = services
      .map((svc, index) => (isStackCompleteService(svc) ? index : -1))
      .filter((index) => index >= 0);
    const firstStackIndex = stackIndices[0] ?? -1;
    const stackRowCount     = stackIndices.length;

    const stackAllUp = isProductStackListening(processById);
    const stackAnyUp = isAnyProductStackListening(processById);
    const stackState = { stackAllUp, stackAnyUp };
    const stackGroupRowSpan = stackRowCount > 0 ? stackRowCount + 1 : stackRowCount;
    const productStackHeaderRow = HAS_PRODUCT_DATABASE
      ? renderDatabaseSchemaStackRow(
          dbStatus
        , stackRowCount > 0 ? stackGroupRowSpan : 1
        , stackState
        )
      : stackRowCount > 0
        ? renderStackHeaderRowNoDb(stackGroupRowSpan, stackState)
        : "";
    let nextBlockNum        = stackGroupRowSpan > 0 || productStackHeaderRow
      ? PROCESS_BLOCK_STACK + 1
      : PROCESS_BLOCK_STACK;

    const serviceRows = services.map((svc, index) => {
      const id          = String(svc.id ?? "");
      const label       = escapeHtml(String(svc.label ?? svc.id ?? "—"));
      const description = escapeHtml(String(svc.description ?? "—"));
      const product     = escapeHtml(String(svc.product ?? "—"));
      const path        = escapeHtml(String(svc.path ?? "—"));
      const port        = svc.port != null ? escapeHtml(String(svc.port)) : "—";
      const openUrl     = typeof svc.openUrl === "string" ? svc.openUrl : null;
      const proc        = processById.get(id);
      const listeners   = Array.isArray(proc?.listeners) ? proc.listeners : [];
      const pidText     = listeners.length > 0
        ? listeners.map((row) => {
            const pid = row.pid != null ? String(row.pid) : "?";
            return row.isDashboard ? `${pid} (dashboard)` : pid;
          }).join(", ")
        : "—";
      const userCell    = formatProcessUserCell(listeners);
      const listening = proc?.listening === true;
      const isDaemon  = svc.port == null && (svc.processScript || id === "friendbot");
      const atIso     = listening
        ? earliestListenerStartedAt(listeners) ?? checkedAt
        : checkedAt;
      const statoLabel = listening
        ? (isDaemon ? "attivo" : "in ascolto")
        : (isDaemon ? "fermo" : "libera");
      const stato     = renderProcessStatoCell({
        atIso : atIso
      , up    : listening
      , label : statoLabel
      });
      const actionsCell = renderRowActionsCell(
        svc
      , index
      , firstStackIndex
      , stackRowCount
      , processById
      , stackState
      );
      const isStackSvc  = isStackCompleteService(svc);
      const rowBlockNum = isStackSvc ? PROCESS_BLOCK_STACK : nextBlockNum;
      const blockCell   = isStackSvc
        ? ""
        : renderProcessBlockCell(nextBlockNum++);
      const boundaryClass = processProductBoundaryClass(
        svc
      , index > 0 ? services[index - 1] : null
      );
      const rowClassAttr  = processTrClassAttr(rowBlockNum, boundaryClass);

      return `
        <tr${rowClassAttr}>
          ${blockCell}
          <td>${product}</td>
          <td>${label}</td>
          <td class="process-service-desc muted">${description}</td>
          <td><code class="process-service-path">${path}</code></td>
          <td>${port}</td>
          <td><code>${escapeHtml(pidText)}</code></td>
          ${userCell}
          <td>${stato}</td>
          <td>${openUrl ? `<a href="${escapeHtml(openUrl)}" target="_blank" rel="noopener">Apri</a>` : "—"}</td>
          ${actionsCell}
        </tr>`;
    }).join("");

    const nodeHtml = renderProcessNodeProcessRows(nodeRows, checkedAt, nextBlockNum);

    return `${dbRow}${productStackHeaderRow}${serviceRows}${nodeHtml}`;
  }

  /**
   * @param {Array<Record<string, unknown>>} processRows
   */
  function syncProcessFooterStartButtons(processRows) {
    if (!coreBtn && !fullBtn) {
      return;
    }

    const processById = new Map(
      processRows.map((row) => [String(row.id ?? ""), row])
    );
    const stackAllUp = isProductStackListening(processById);
    const fullIds    = processStackFooterModel.fullPollIds.length
      ? processStackFooterModel.fullPollIds
      : cruscottoStackStartServiceIds();
    const fullAllUp  = fullIds.length > 0
      && fullIds.every((id) => isProcessServiceListening(processById, id));

    if (stackAllUp) {
      coreBtn?.setAttribute("disabled", "true");
    } else {
      coreBtn?.removeAttribute("disabled");
    }

    if (fullAllUp) {
      fullBtn?.setAttribute("disabled", "true");
    } else {
      fullBtn?.removeAttribute("disabled");
    }
  }

  /**
   * @param {HTMLButtonElement | null} [triggerBtn]
   * @param {{ processesOnly?: boolean }} [options]
   */
  async function loadProcessDiscovery(triggerBtn = null, options = {}) {
    const { processesOnly = false } = options;
    const label = triggerBtn?.textContent ?? null;

    if (triggerBtn) {
      triggerBtn.setAttribute("disabled", "true");
      triggerBtn.textContent = "Caricamento…";
    }

    if (!processesOnly) {
      tableEl.innerHTML = `<tr><td colspan="${PROCESS_TABLE_COLS}" class="muted">Caricamento piano avvio…</td></tr>`;
    }

    try {
      /** @type {Array<Record<string, unknown>>} */
      let services = lastDiscoveredServices;

      if (!processesOnly || services.length === 0) {
        const core = await apiGet("/api/repo/services/discover?allExtras=1", 45_000);

        services                 = Array.isArray(core.services) ? core.services : [];
        lastDiscoveredServices   = services;
        applyProcessConsoleTabsFromServices(services);
        refreshProcessStackFooter(services);

        if (!processesOnly) {
          if (cliEl) {
            cliEl.textContent = processStackFooterModel.cliCommand;
          }

          coreBtn?.removeAttribute("disabled");
          fullBtn?.removeAttribute("disabled");

          const dbStatusEarly = HAS_PRODUCT_DATABASE
            ? await apiGet("/api/repo/database/status", 10_000).catch(() => ({}))
            : { enabled: false };

          tableEl.innerHTML = renderServiceRows(services, [], dbStatusEarly, []);

          const launchStatus = await apiGet("/api/repo/services/status", 10_000).catch(() => null);

          if (launchStatus) {
            setProcessStatus(renderLaunchStatus(launchStatus));
          }
        }
      }

      /** @type {Array<Record<string, unknown>>} */
      let processRows = [];
      /** @type {Array<Record<string, unknown>>} */
      let nodeRows    = [];
      let checkedAt   = null;

      const dbStatus = HAS_PRODUCT_DATABASE
        ? await apiGet("/api/repo/database/status", 10_000).catch(() => ({}))
        : { enabled: false };
      checkedAt      = typeof dbStatus.checkedAt === "string" ? dbStatus.checkedAt : null;

      try {
        const processes = await apiGet("/api/repo/services/processes", 90_000);
        processRows     = Array.isArray(processes.rows) ? processes.rows : [];
        nodeRows        = Array.isArray(processes.nodeRows) ? processes.nodeRows : [];
        checkedAt       = typeof processes.checkedAt === "string"
          ? processes.checkedAt
          : checkedAt;
      } catch (procErr) {
        const procMsg = procErr instanceof Error ? procErr.message : "processes non disponibile";

        if (processesCheckedEl) {
          processesCheckedEl.textContent = `Processi: ${procMsg} — elenco servizi comunque visibile`;
        }
      }

      tableEl.innerHTML = renderServiceRows(services, processRows, {
        ...dbStatus
      , checkedAt
      }, nodeRows);
      lastProcessRows = processRows;
      refreshProcessStackFooter(services);
      syncProcessFooterStartButtons(processRows);

      if (processesCheckedEl && processRows.length > 0) {
        const at = checkedAt ?? "—";
        processesCheckedEl.textContent = `Processi aggiornati: ${at} — API GET /api/repo/services/processes`;
      }
    } catch (err) {
      const hint = formatProcessDiscoveryError(err);
      tableEl.innerHTML = `<tr><td colspan="${PROCESS_TABLE_COLS}" class="muted">${escapeHtml(hint)}</td></tr>`;

      if (!processesOnly) {
        setProcessStatus("Discovery non disponibile — riavvia il dashboard e usa Riprova discovery.");
      }
    } finally {
      if (triggerBtn) {
        triggerBtn.removeAttribute("disabled");
        triggerBtn.textContent = label ?? (processesOnly ? "Aggiorna processi" : "Riprova discovery");
      }
    }
  }

  let processProcPollTimer = null;
  let processProcPollTicks = 0;
  /** @type {"up" | "down"} */
  let processProcPollMode  = "up";
  /** @type {string[] | null} */
  let processProcPollIds   = null;

  const PROCESS_PROC_POLL_MS  = 2500;
  const PROCESS_PROC_POLL_MAX = 48;

  function stopProcessServicesPolling() {
    if (processProcPollTimer != null) {
      window.clearInterval(processProcPollTimer);
      processProcPollTimer = null;
    }

    processProcPollTicks = 0;
    processProcPollIds   = null;
  }

  /**
   * @param {Record<string, unknown>} options
   * @returns {string[] | null}
   */
  function serviceIdsForStartOptions(options) {
    if (options.productStackComplete === true) {
      return [...cruscottoStackStartServiceIds()];
    }

    if (options.allExtras === true) {
      return processStackFooterModel.fullPollIds.length
        ? [...processStackFooterModel.fullPollIds]
        : null;
    }

    if (options.productOnly === true) {
      const ids = [...cruscottoStackStartServiceIds()];

      if (processStackFooterModel.extraIds.includes("friendbot")) {
        ids.push("friendbot");
      }

      return ids;
    }

    return [...cruscottoStackStartServiceIds()];
  }

  /**
   * @param {Array<Record<string, unknown>>} rows
   * @param {string[] | null} serviceIds
   */
  function processPollTargetRows(rows, serviceIds) {
    return rows.filter((row) => {
      const id = String(row.id ?? "");

      if (id === "dashboard") {
        return false;
      }

      if (serviceIds?.length) {
        return serviceIds.includes(id);
      }

      return row.port != null || id === "friendbot";
    });
  }

  /**
   * @param {{ mode?: "up" | "down", serviceIds?: string[] | null }} [options]
   */
  function startProcessServicesPolling(options = {}) {
    const { mode = "up", serviceIds = null } = options;

    stopProcessServicesPolling();
    processProcPollMode = mode;
    processProcPollIds  = serviceIds;

    const tick = async () => {
      processProcPollTicks += 1;

      try {
        await loadProcessDiscovery(null, { processesOnly: true });

        const rows    = lastProcessRows;
        const targets = processPollTargetRows(rows, processProcPollIds);
        let done      = false;

        if (processProcPollMode === "up") {
          done = targets.length > 0 && targets.every((row) => row.listening === true);
        } else {
          done = targets.length === 0 || targets.every((row) => row.listening !== true);
        }

        if (done || processProcPollTicks >= PROCESS_PROC_POLL_MAX) {
          stopProcessServicesPolling();
        }
      } catch {
        if (processProcPollTicks >= PROCESS_PROC_POLL_MAX) {
          stopProcessServicesPolling();
        }
      }
    };

    void tick();
    processProcPollTimer = window.setInterval(() => {
      void tick();
    }, PROCESS_PROC_POLL_MS);
  }

  /**
   * @param {boolean} [fromBeginning]
   */
  async function reloadProcessConsole(fromBeginning = false) {
    if (!getProcessConsolePane("all")) {
      return;
    }

    const cursor = fromBeginning ? 0 : processLogCursor;

    if (fromBeginning) {
      processLogCursor = 0;
      clearProcessConsolePanes();
    }

    try {
      const source = processLogSourceFilter !== "all" ? processLogSourceFilter : "process";
      const data  = await apiGet(`/api/logs?cursor=${cursor}&source=${encodeURIComponent(source)}&extended=1`);
      const lines = Array.isArray(data.lines) ? data.lines : [];

      appendProcessConsoleLines(lines);
      processLogCursor = typeof data.cursor === "number" ? data.cursor : processLogCursor;
    } catch {
      // ignore
    }
  }

  /**
   * @param {Record<string, unknown>} launchStatus
   */
  function renderLaunchStatus(launchStatus) {
    if (launchStatus.running) {
      const startedAt = typeof launchStatus.startedAt === "string" ? launchStatus.startedAt : "—";
      const pid       = launchStatus.pid != null ? String(launchStatus.pid) : "—";
      return `Avvio in corso dal cruscotto (pid ${pid}, ${startedAt}). Controlla la tab Servizi.`;
    }

    if (typeof launchStatus.error === "string" && launchStatus.error) {
      return `Ultimo avvio: ${launchStatus.error}`;
    }

    return "Pronto — usa i pulsanti sopra o la CLI.";
  }

  /**
   * @param {Record<string, unknown>} options
   * @param {HTMLButtonElement} button
   */
  async function triggerProcessStart(options, button) {
    const label = button.textContent ?? "Avvia";
    button.setAttribute("disabled", "true");
    button.textContent = "Avvio…";
    setProcessStatus("Richiesta avvio stack…");

    try {
      const res = await fetch("/api/repo/services/start", {
        method  : "POST"
      , headers : { "Content-Type": "application/json" }
      , body    : JSON.stringify(options)
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
      }

      const pid = body.pid != null ? String(body.pid) : "—";
      setProcessStatus(`Stack avviato (pid ${pid}). Output in tempo reale nella console sotto.`);
      processLogCursor = typeof body.logCursor === "number" ? body.logCursor : processLogCursor;
      startProcessConsolePolling();
      startProcessServicesPolling({
        mode       : "up"
      , serviceIds : serviceIdsForStartOptions(options)
      });
      await loadProcessDiscovery(null, { processesOnly: true });
    } catch (err) {
      setProcessStatus(err instanceof Error ? err.message : "Avvio fallito");
    } finally {
      button.removeAttribute("disabled");
      button.textContent = label;
    }
  }

  /**
   * @param {HTMLButtonElement} button
   * @param {string} serviceId
   */
  async function triggerServiceStart(button, serviceId) {
    const label = button.textContent ?? "Avvia";
    button.setAttribute("disabled", "true");
    button.textContent = "Avvio…";
    setProcessStatus(`Avvio ${serviceId}…`);

    if (processConsoleTabExists(serviceId)) {
      setProcessConsoleTab(serviceId);
    }

    try {
      const res = await fetch("/api/repo/services/start-one", {
        method  : "POST"
      , headers : { "Content-Type": "application/json" }
      , body    : JSON.stringify({ serviceId })
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
      }

      const pid = body.pid != null ? String(body.pid) : "—";
      setProcessStatus(`${serviceId} avviato (pid ${pid}). Output nella console.`);
      if (typeof body.logCursor === "number") {
        processLogCursor = body.logCursor;
      }
      startProcessConsolePolling();
      startProcessServicesPolling({
        mode       : "up"
      , serviceIds : [serviceId]
      });
      await loadProcessDiscovery(null, { processesOnly: true });
    } catch (err) {
      setProcessStatus(err instanceof Error ? err.message : "Avvio fallito");
    } finally {
      button.removeAttribute("disabled");
      button.textContent = label;
    }
  }

  /**
   * @param {HTMLButtonElement} button
   * @param {string} serviceId
   */
  async function triggerServiceKill(button, serviceId) {
    const confirmed = await processConfirm({
      title        : `Kill ${serviceId}`
    , message      : "Terminare solo questo servizio?\n\nOutput nella console."
    , confirmLabel : "Kill"
    , danger       : true
    });

    if (!confirmed) {
      return;
    }

    const label = button.textContent ?? "Kill";
    button.setAttribute("disabled", "true");
    button.textContent = "Kill…";
    setProcessStatus(`Kill ${serviceId} in corso…`);

    const consoleTab = processConsoleTabExists(serviceId)
      ? serviceId
      : "all";
    beginProcessKillConsole(consoleTab, `Kill ${serviceId} — richiesta al server…`);

    try {
      const res = await fetch("/api/repo/services/stop-one", {
        method  : "POST"
      , headers : { "Content-Type": "application/json" }
      , body    : JSON.stringify({ serviceId })
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
      }

      setProcessStatus(typeof body.summary === "string"
        ? body.summary
        : `Kill ${serviceId} completato.`);

      await applyProcessKillLogResponse(body);

      await loadProcessDiscovery(null, { processesOnly: true });
      startProcessServicesPolling({
        mode       : "down"
      , serviceIds : [serviceId]
      });
    } catch (err) {
      setProcessStatus(err instanceof Error ? err.message : "Kill fallito");
      appendProcessConsoleLines([{
        stream : "stderr"
      , text   : err instanceof Error ? err.message : "Kill fallito"
      }]);
    } finally {
      button.removeAttribute("disabled");
      button.textContent = label;
    }
  }

  /**
   * @param {HTMLButtonElement} button
   * @param {"reset" | "seed" | "push"} mode
   */
  async function triggerDatabaseJob(button, mode) {
    if (!HAS_PRODUCT_DATABASE) {
      return;
    }

    const isReset  = mode === "reset";
    const isSeed   = mode === "seed";
    const isPush   = mode === "push";
    const endpoint = isReset
      ? "/api/repo/database/reset"
      : isSeed
        ? "/api/repo/database/seed"
        : "/api/repo/database/push";

    if (isReset || isSeed) {
      const confirmed = await processConfirm({
        title        : isReset ? "Delete & create" : "Inizializza"
      , message      : isReset
          ? `Eliminare fisicamente ${dbFilename} (e journal/wal) e ricreare lo schema Prisma?\n\nConsigliato: fermare api/auth prima.`
          : "Eseguire npm run db:seed?"
      , confirmLabel : isReset ? "Delete & create" : "Inizializza"
      , danger       : isReset
      });

      if (!confirmed) {
        return;
      }
    }

    const label = button.textContent ?? (isReset ? "Delete & create" : isSeed ? "Inizializza" : "Refresh");
    button.setAttribute("disabled", "true");
    button.textContent = isReset ? "Reset…" : isSeed ? "Seed…" : "Push…";
    setProcessStatus(isReset
      ? "Reset database in corso…"
      : isSeed
        ? "Seed database in corso…"
        : "db:push in corso…");
    processLogCursor = 0;
    startProcessConsolePolling();
    clearProcessConsolePanes();
    appendProcessConsoleLines([{
      stream : "system"
    , text   : isReset
        ? "Database delete & create — richiesta inviata…"
        : isSeed
          ? "Database inizializza — richiesta inviata…"
          : "Database refresh (db:push) — richiesta inviata…"
    }]);
    setProcessConsoleTab("database");

    try {
      const res = await fetch(endpoint, {
        method  : "POST"
      , headers : { "Content-Type": "application/json" }
      , body    : JSON.stringify({})
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok || body.ok === false) {
        throw new Error(typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
      }

      setProcessStatus(isReset
        ? "Database ricreato (delete & create completato)."
        : isSeed
          ? "Database inizializzato (seed completato)."
          : "Schema allineato (db:push completato).");

      if (Array.isArray(body.lines) && body.lines.length > 0) {
        clearProcessConsolePanes();
        appendProcessConsoleLines(body.lines);
        processLogCursor = typeof body.logCursor === "number" ? body.logCursor : processLogCursor;
      }

      await loadProcessDiscovery(null, { processesOnly: true });
    } catch (err) {
      setProcessStatus(err instanceof Error ? err.message : "Operazione database fallita");

      if (!isReset) {
        button.removeAttribute("disabled");
        button.textContent = label;
      }
    } finally {
      if (isReset || isPush) {
        button.removeAttribute("disabled");
        button.textContent = label;
      }
    }
  }

  async function triggerStackCompleteStart(button) {
    await triggerProcessStart({
      productStackComplete : true
    , noDb                 : true
    }, button);
  }

  async function triggerStackCompleteKill(button) {
    const stackIds   = cruscottoStackStartServiceIds();
    const stackLabel = stackIds.join(", ");

    const confirmed = await processConfirm({
      title        : "Kill stack"
    , message      : `Terminare lo stack product (${formatProcessServiceList(lastDiscoveredServices, stackIds)})?\n\nServizi extra e cruscotto non inclusi in questo kill.`
    , confirmLabel : "Kill stack"
    , danger       : true
    });

    if (!confirmed) {
      return;
    }

    const label = button.textContent ?? "Kill";
    button.setAttribute("disabled", "true");
    button.textContent = "Kill…";
    setProcessStatus("Kill stack in corso…");
    beginProcessKillConsole("all", `Kill stack (${stackLabel}) — richiesta al server…`);

    try {
      const res = await fetch("/api/repo/services/stop", {
        method  : "POST"
      , headers : { "Content-Type": "application/json" }
      , body    : JSON.stringify({
          includeDashboard     : false
        , productStackComplete : true
        })
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
      }

      setProcessStatus(typeof body.summary === "string"
        ? body.summary
        : "Kill stack completato.");

      await applyProcessKillLogResponse(body);

      await loadProcessDiscovery(null, { processesOnly: true });
      startProcessServicesPolling({
        mode       : "down"
      , serviceIds : cruscottoStackStartServiceIds()
      });
    } catch (err) {
      setProcessStatus(err instanceof Error ? err.message : "Kill stack fallito");
      appendProcessConsoleLines([{
        stream : "stderr"
      , text   : err instanceof Error ? err.message : "Kill stack fallito"
      }]);
    } finally {
      button.removeAttribute("disabled");
      button.textContent = label;
    }
  }

  const servicesTable = tableEl.closest("table");

  if (servicesTable instanceof HTMLTableElement && !servicesTable.dataset.processActionsBound) {
    servicesTable.dataset.processActionsBound = "1";

    servicesTable.addEventListener("click", (ev) => {
      const target = ev.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const btn = target.closest("[data-process-action]");

      if (!(btn instanceof HTMLButtonElement)) {
        return;
      }

      const action    = btn.getAttribute("data-process-action");
      const serviceId = btn.getAttribute("data-service-id") ?? "";

      if (action === "service-start" && serviceId) {
        triggerServiceStart(btn, serviceId);
      } else if (action === "service-kill" && serviceId) {
        triggerServiceKill(btn, serviceId);
      } else if (action === "stack-start") {
        triggerStackCompleteStart(btn).then(() => loadProcessDiscovery(null, { processesOnly: true }));
      } else if (action === "stack-kill") {
        triggerStackCompleteKill(btn);
      } else if (action === "db-reset") {
        triggerDatabaseJob(btn, "reset");
      } else if (action === "db-push") {
        triggerDatabaseJob(btn, "push");
      } else if (action === "db-seed") {
        triggerDatabaseJob(btn, "seed");
      }
    });
  }

  try {
    await loadProcessDiscovery();
  } catch {
    // gestito in loadProcessDiscovery
  }

  retryBtn?.addEventListener("click", () => {
    loadProcessDiscovery(/** @type {HTMLButtonElement} */ (retryBtn));
  });

  refreshProcBtn?.addEventListener("click", () => {
    loadProcessDiscovery(/** @type {HTMLButtonElement} */ (refreshProcBtn), { processesOnly: true });
  });

  stopBtn?.addEventListener("click", async () => {
    if (!(stopBtn instanceof HTMLButtonElement)) {
      return;
    }

    const confirmed = await processConfirm({
      title        : "Kill All"
    , message      : processStackFooterModel.killConfirmMessage
    , confirmLabel : "Kill All"
    , danger       : true
    });

    if (!confirmed) {
      return;
    }

    const label = stopBtn.textContent ?? "Kill All";
    stopBtn.setAttribute("disabled", "true");
    stopBtn.textContent = "Kill…";
    setProcessStatus("Kill All in corso…");
    beginProcessKillConsole("all", "Kill All — richiesta inviata al server…");

    try {
      const res = await fetch("/api/repo/services/stop", {
        method  : "POST"
      , headers : { "Content-Type": "application/json" }
      , body    : JSON.stringify({ includeDashboard: false })
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(typeof body.error === "string" ? body.error : `HTTP ${res.status}`);
      }

      setProcessStatus(typeof body.summary === "string"
        ? body.summary
        : "Kill All completato.");

      await applyProcessKillLogResponse(body);

      await loadProcessDiscovery();
      startProcessServicesPolling({ mode: "down", serviceIds: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Kill All fallito";
      setProcessStatus(message);

      appendProcessConsoleLines([{
        stream : "stderr"
      , text   : message
      }]);
    } finally {
      stopBtn.removeAttribute("disabled");
      stopBtn.textContent = label;
    }
  });

  if (showBulkFooter && coreBtn) {
    coreBtn.addEventListener("click", () => {
      triggerProcessStart({
        withPortal : false
      , extras     : []
      , noDb       : true
      }, /** @type {HTMLButtonElement} */ (coreBtn));
    });
  }

  if (showBulkFooter && fullBtn) {
    fullBtn.addEventListener("click", () => {
      triggerProcessStart({
        allExtras : true
      , noDb      : true
      }, /** @type {HTMLButtonElement} */ (fullBtn));
    });
  }

  copyBtn?.addEventListener("click", () => {
    copyCmd(cliEl.textContent ?? "");
  });

  clearViewBtn?.addEventListener("click", () => {
    clearActiveProcessConsolePane();
  });

  clearBtn?.addEventListener("click", async () => {
    try {
      await fetch("/api/repo/services/logs", { method: "DELETE" });
      await reloadProcessConsole(true);
    } catch (err) {
      setProcessStatus(err instanceof Error ? err.message : "Pulizia console fallita");
    }
  });

  instancesBtn?.addEventListener("click", () => {
    if (instancesBtn instanceof HTMLButtonElement) {
      void dumpActiveInstancesToConsole(instancesBtn);
    }
  });

  await reloadProcessConsole(true);
}

// --- tab Cursor Agent — SDK local/cloud in background ---

/**
 * @param {string | undefined} iso
 * @returns {string}
 */
function formatLogTimestamp(iso) {
  if (!iso) {
    return "";
  }

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) {
    return "";
  }

  const pad = (n) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * @param {HTMLElement} row
 * @param {string | undefined} at
 * @param {string} text
 */
function setProcessConsoleLineContent(row, at, text) {
  const ts = formatLogTimestamp(at);

  if (ts) {
    const stamp = document.createElement("span");

    stamp.className   = "process-console-ts";
    stamp.textContent = `${ts} `;
    row.appendChild(stamp);
  }

  const body = document.createElement("span");

  body.className   = "process-console-text";
  body.textContent = text;
  row.appendChild(body);
}

/**
 * Assistant SDK — unisci token/delta sulla stessa riga; messaggi distinti su righe separate.
 *
 * @param {HTMLElement} container
 * @param {string} text
 * @returns {boolean}
 */
function tryMergeAssistantLogChunk(container, text) {
  const last = container.lastElementChild;

  if (!(last instanceof HTMLElement) || !last.classList.contains("process-console-assistant")) {
    return false;
  }

  if (/^\n{2,}/.test(text)) {
    return false;
  }

  const body = last.querySelector(".process-console-text");

  if (!(body instanceof HTMLElement)) {
    return false;
  }

  const existing = body.textContent ?? "";
  const incoming = text;

  if (!incoming) {
    return true;
  }

  if (incoming === existing) {
    return true;
  }

  // SDK cumulativo già visto — sostituisci, non concatenare
  if (incoming.startsWith(existing)) {
    body.textContent = incoming;
    return true;
  }

  if (existing.startsWith(incoming)) {
    return true;
  }

  const trimmedExisting = existing.trimEnd();
  const trimmedIncoming = incoming.trimStart();

  // Nuovo messaggio dopo frase completa — riga dedicata
  if (
    trimmedExisting.length > 0
    && /[.!?]["']?\s*$/.test(trimmedExisting)
    && /^[A-ZÀ-ÖØ-Þ]/.test(trimmedIncoming)
    && trimmedIncoming.length > 12
  ) {
    return false;
  }

  body.textContent = existing + incoming;

  return true;
}

/**
 * @param {HTMLElement} container
 * @param {string} stream
 * @param {string | undefined} at
 * @param {string} text
 */
function appendLogLineToContainer(container, stream, at, text) {
  const raw = String(text ?? "");

  if (!raw) {
    return;
  }

  /** @type {string[]} */
  const segments = [];
  let buffer     = "";

  for (const part of raw.split(/(\n{2,})/)) {
    if (/^\n{2,}$/.test(part)) {
      if (buffer) {
        segments.push(buffer);
        buffer = "";
      }

      continue;
    }

    buffer += part;
  }

  if (buffer) {
    segments.push(buffer);
  }

  for (const segment of segments) {
    const chunk = segment.replace(/^\n+/, "").replace(/\n+$/, "");

    if (!chunk) {
      continue;
    }

    if (stream === "assistant" && tryMergeAssistantLogChunk(container, chunk)) {
      continue;
    }

    const row = document.createElement("div");

    row.className = `process-console-line process-console-${stream}`;
    setProcessConsoleLineContent(row, at, chunk);
    container.appendChild(row);
  }
}

/**
 * @param {HTMLElement | null} outputEl
 * @param {{ seq?: number, stream?: string, text?: string, at?: string }} line
 */
function appendCursorAgentLogLine(outputEl, line) {
  if (!outputEl || !line.text) {
    return;
  }

  const seq = Number(line.seq);

  if (Number.isFinite(seq) && seq > 0) {
    if (cursorAgentLogSeenSeq.has(seq)) {
      return;
    }

    cursorAgentLogSeenSeq.add(seq);
  }

  const stream = line.stream === "assistant"
    ? "assistant"
    : line.stream === "workflow"
      ? "workflow"
      : line.stream === "stderr"
        ? "stderr"
        : "system";

  appendLogLineToContainer(outputEl, stream, line.at, line.text);
}

function stopCursorAgentPolling() {
  if (cursorAgentPollTimer != null) {
    clearInterval(cursorAgentPollTimer);
    cursorAgentPollTimer = null;
  }
}

function startCursorAgentPolling() {
  stopCursorAgentPolling();
  cursorAgentPollTimer = window.setInterval(() => {
    void pollCursorAgentLogs();
  }, 1500);
  void pollCursorAgentLogs();
}

/**
 * Aggiorna badge header e barra WF a destra dei bottoni (step + running/fermo/errore).
 *
 * @param {Record<string, unknown>} status
 */
function updateCursorAgentWorkflowUi(status) {
  const badgeEl   = document.getElementById("cursor-agent-badge");
  const stepEl    = document.getElementById("cursor-agent-wf-step");
  const stateEl   = document.getElementById("cursor-agent-wf-state");
  const barEl     = document.getElementById("cursor-agent-wf-bar");
  const statusEl  = document.getElementById("cursor-agent-status-line");

  const uiPhase = String(status.uiPhase ?? status.status ?? "idle");
  const workflowKey = typeof status.workflowKey === "string" ? status.workflowKey.trim().toUpperCase() : "";
  const workflowKind = typeof status.workflowKind === "string" ? status.workflowKind.trim() : "";
  const stepLabel = typeof status.workflowStepLabel === "string" && status.workflowStepLabel.trim()
    ? status.workflowStepLabel.trim()
    : workflowKey
      ? "Workflow in corso…"
      : uiPhase === "running" || uiPhase === "finalizing"
        ? "Agent in esecuzione"
        : "—";

  /** @type {Record<string, { text: string, className: string }>} */
  const phaseUi = {
    running    : { text: "running", className: "is-running" }
  , finalizing : { text: "finalizzazione", className: "is-finalizing" }
  , stopped    : { text: "fermo", className: "is-stopped" }
  , error      : { text: "errore", className: "is-error" }
  , idle       : { text: "idle", className: "is-idle" }
  , finished   : { text: "fermo", className: "is-stopped" }
  };

  const phase = phaseUi[uiPhase] ?? phaseUi.idle;

  if (badgeEl) {
    badgeEl.textContent = phase.text;
    badgeEl.className = `process-console-badge ${phase.className}`;
  }

  if (stateEl) {
    stateEl.textContent = phase.text;
    stateEl.className = `process-console-badge cursor-agent-wf-state ${phase.className}`;
    stateEl.title = typeof status.error === "string" && status.error.trim()
      ? status.error.trim()
      : `Stato agent: ${phase.text}`;
  }

  if (stepEl) {
    const ticketPrefix = workflowKey
      ? `${workflowKind ? `${workflowKind} ` : ""}${workflowKey} · `
      : "";
    stepEl.textContent = `${ticketPrefix}${stepLabel}`;
    stepEl.title = stepLabel;
  }

  if (barEl) {
    barEl.hidden = uiPhase === "idle" && stepLabel === "—";
  }

  if (statusEl) {
    const parts = [
      workflowKey ? `${workflowKind || "wf"} ${workflowKey}` : null
    , stepLabel !== "—" ? stepLabel : null
    , phase.text !== "idle" ? phase.text : null
    , status.runtime ? `runtime ${String(status.runtime)}` : null
    , status.agentId ? `agent ${String(status.agentId)}` : null
    ].filter(Boolean);
    statusEl.textContent = parts.join(" · ") || "Pronto";
  }
}

/**
 * @returns {Promise<void>}
 */
async function pollCursorAgentLogs() {
  const outputEl = document.getElementById("cursor-agent-output");

  if (!outputEl || cursorAgentLogPollInFlight) {
    return;
  }

  cursorAgentLogPollInFlight = true;

  try {
    const data = await apiGet(`/api/logs?cursor=${cursorAgentLogCursor}&source=agent&extended=1`);
    const lines = Array.isArray(data.lines) ? data.lines : [];
    let appended = false;

    for (const line of lines) {
      if (!logRowPassesLevelFilter(line, cursorAgentLogLevelFilter)) {
        continue;
      }

      const before = outputEl.childElementCount;
      appendCursorAgentLogLine(outputEl, /** @type {{ text?: string, stream?: string, seq?: number }} */ (line));

      if (outputEl.childElementCount > before) {
        appended = true;
      }
    }

    const nextCursor = Number(data.cursor);

    if (Number.isFinite(nextCursor) && nextCursor >= cursorAgentLogCursor) {
      cursorAgentLogCursor = nextCursor;
    }

    if (appended) {
      outputEl.scrollTop = outputEl.scrollHeight;
    }

    const status = data.status && typeof data.status === "object"
      ? /** @type {Record<string, unknown>} */ (data.status)
      : {};

    updateCursorAgentWorkflowUi(status);
  } catch {
    // poll silenzioso
  } finally {
    cursorAgentLogPollInFlight = false;
  }
}

/**
 * Tab Working Plan — pannello output report script (HTML).
 */
function renderWorkingPlanTab() {
  const root = document.getElementById("section-workingplan");

  if (!root) {
    return;
  }

  if (root.dataset.rendered === "1" && root.querySelector(".working-plan-report-wrap")) {
    return;
  }

  root.dataset.rendered = "1";
  root.innerHTML = `
    <section class="panel working-plan-panel">
      <p class="muted" id="working-plan-status">Premi <strong>RIGENERA</strong> o <strong>CHECK OBSOLETE</strong> in testata.</p>
      <div id="working-plan-output" class="working-plan-report-wrap" aria-live="polite"></div>
    </section>`;

  document.getElementById("working-plan-output")?.addEventListener("change", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const section = target.closest("[data-wp-backlog-pool]");

    if (!section || !(section instanceof HTMLElement)) {
      return;
    }

    if (!target.matches(".wp-backlog-check, .wp-backlog-check-all, [data-wp-backlog-sprint-select]")) {
      return;
    }

    if (target.matches(".wp-backlog-check-all") && target instanceof HTMLInputElement) {
      const checked = target.checked;

      section.querySelectorAll(".wp-backlog-check[data-wp-backlog-key]").forEach((node) => {
        if (node instanceof HTMLInputElement) {
          node.checked = checked;
        }
      });
    }

    syncBacklogPoolToolbar(section);
  });

  document.getElementById("working-plan-output")?.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const backlogBtn = target.closest(".wp-btn-backlog-add-sprint");

    if (backlogBtn instanceof HTMLButtonElement) {
      void addBacklogSelectionToSprint(backlogBtn);
      return;
    }

    const closeSprintBtn = target.closest(".wp-btn-close-sprint");

    if (closeSprintBtn instanceof HTMLButtonElement) {
      void closeActiveJiraSprint(closeSprintBtn);
      return;
    }

    const btn = target.closest(".wp-btn-create-sprint");

    if (btn instanceof HTMLButtonElement) {
      void createJiraSprintFromCard(btn);
      return;
    }

    const epicBtn = target.closest(".wp-btn-set-epic");

    if (epicBtn instanceof HTMLButtonElement) {
      void saveWorkingPlanEpicRef(epicBtn);
      return;
    }

    if (target.closest("a, button, .col-resize-handle, input, select, textarea, label, .wp-epic-picker")) {
      return;
    }

    const row = target.closest("table.wp-table--dev-queue tbody tr");

    if (!row || row.tagName !== "TR") {
      return;
    }

    const table = row.closest("table.wp-table--dev-queue");

    if (!table) {
      return;
    }

    const wasSelected = row.classList.contains("is-row-selected");

    table.querySelectorAll("tbody tr.is-row-selected").forEach((node) => {
      node.classList.remove("is-row-selected");
    });

    if (!wasSelected) {
      row.classList.add("is-row-selected");
    }
  });
}

/** @type {boolean} */
let workingPlanActionBusy = false;

/** Caricamento saved in flight — incrementato da RIGENERA per evitare race overwrite. */
let workingPlanSavedLoadToken = 0;

/** @type {Record<string, unknown> | null} */
let lastWorkingPlanPayload = null;

/** @type {boolean} */
let workingPlanSprintCreateBusy = false;

/**
 * @param {HTMLElement} root
 * @returns {Map<string, { className: string, innerHTML: string, hidden: boolean }>}
 */
function captureWorkingPlanSprintStatuses(root) {
  /** @type {Map<string, { className: string, innerHTML: string, hidden: boolean }>} */
  const preserved = new Map();

  root.querySelectorAll("[data-wp-sprint-status]").forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }

    const sprint = node.dataset.wpSprintStatus;

    if (!sprint || node.hidden) {
      return;
    }

    if (!node.textContent?.trim() && !node.classList.contains("is-ok") && !node.classList.contains("is-error")) {
      return;
    }

    preserved.set(sprint, {
      className : node.className
    , innerHTML : node.innerHTML
    , hidden    : node.hidden
    });
  });

  return preserved;
}

/**
 * @param {HTMLElement} outputEl
 * @param {string} html
 * @param {Map<string, { className: string, innerHTML: string, hidden: boolean }>} preserved
 */
function initWorkingPlanTableResize(root) {
  const scope = root ?? document;

  scope.querySelectorAll("table.wp-table--dev-queue, table.wp-table--backlog-pool, table.wp-table--active-sprint, .wp-table-wrap > table.wp-table--dev-queue, .wp-table-wrap > table.wp-table--backlog-pool, .wp-table-wrap > table.wp-table--active-sprint").forEach((node) => {
    if (node instanceof HTMLTableElement || (node && node.tagName === "TABLE")) {
      globalThis.CruscottoTableColumnResize?.initTable(node, { force: true });
    }
  });

  globalThis.CruscottoTableColumnResize?.initAll(
    scope
  , "table.wp-table:not(.wp-table--dev-queue), .wp-table-wrap > table:not(.wp-table--dev-queue)"
  );
}

/** @type {Promise<string> | null} */
let issueDisplayCssTextPromise = null;

/**
 * Carica CSS canonico TipoIssue — cache in memoria per fragment Working Plan senza `<style>` inline.
 *
 * @returns {Promise<string>}
 */
function loadIssueDisplayCssText() {
  if (!issueDisplayCssTextPromise) {
    issueDisplayCssTextPromise = fetch("/jira-issue-display.css")
      .then((res) => (res.ok ? res.text() : ""))
      .catch(() => "");
  }

  return issueDisplayCssTextPromise;
}

/**
 * Inietta `<style class="issue-display-tipo-inline">` se manca (HTML salvato pre-fix).
 *
 * @param {ParentNode} scope
 */
async function ensureWorkingPlanIssueDisplayStyles(scope) {
  const host = scope.querySelector(".working-plan-report") ?? scope;

  if (!(host instanceof HTMLElement) || host.querySelector(".issue-display-tipo-inline")) {
    return;
  }

  const css = await loadIssueDisplayCssText();

  if (!css.trim()) {
    return;
  }

  const style = document.createElement("style");

  style.className   = "issue-display-tipo-inline";
  style.textContent = css.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  host.insertBefore(style, host.firstChild);
}

async function applyWorkingPlanHtml(outputEl, html, preserved) {
  outputEl.innerHTML = html;

  await ensureWorkingPlanIssueDisplayStyles(outputEl);

  for (const [sprint, state] of preserved) {
    outputEl.querySelectorAll(`[data-wp-sprint-status="${sprint}"]`).forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      node.className = state.className;
      node.innerHTML = state.innerHTML;
      node.hidden    = state.hidden;
    });
  }

  initWorkingPlanTableResize(outputEl);
  initBacklogPoolControls(outputEl);
}

/**
 * Carica ultimo piano salvato se il pannello è ancora vuoto.
 */
async function loadSavedWorkingPlanIfEmpty() {
  const outputEl = document.getElementById("working-plan-output");
  const statusEl = document.getElementById("working-plan-status");

  if (!outputEl || outputEl.querySelector(".working-plan-report")) {
    return;
  }

  const loadToken = ++workingPlanSavedLoadToken;

  try {
    const res  = await fetch("/api/jira/working-plan/saved");
    const data = await res.json().catch(() => ({}));

    if (loadToken !== workingPlanSavedLoadToken) {
      return;
    }

    if (workingPlanActionBusy || outputEl.querySelector(".working-plan-report")) {
      return;
    }

    if (!res.ok || typeof data.html !== "string" || !data.html.trim()) {
      return;
    }

    outputEl.innerHTML = data.html;
    lastWorkingPlanPayload = data.payload ?? null;
    await ensureWorkingPlanIssueDisplayStyles(outputEl);
    initWorkingPlanTableResize(outputEl);
    initBacklogPoolControls(outputEl);

    if (statusEl) {
      statusEl.textContent = data.savedAt
        ? `Piano salvato · ${data.savedAt}${data.publicUrl ? ` · ${data.publicUrl}` : ""}`
        : "Piano salvato caricato";
    }
  } catch {
    // tab resta vuoto fino a RIGENERA
  }
}

/**
 * Aggiorna bottoni testata per tab Working Plan.
 *
 * @param {string} tab
 */
function syncWorkingPlanTopbar(tab) {
  const actions = document.getElementById("topbar-actions");

  if (!actions) {
    return;
  }

  if (tab !== "workingplan") {
    actions.classList.add("hidden");
    actions.innerHTML = "";
    delete actions.dataset.initialized;
    return;
  }

  actions.classList.remove("hidden");

  if (actions.dataset.initialized === "1") {
    return;
  }

  actions.dataset.initialized = "1";
  actions.innerHTML = `
    <button type="button" class="action primary" id="wp-btn-regenerate">RIGENERA</button>
    <button type="button" class="action" id="wp-btn-obsolete">CHECK OBSOLETE</button>`;

  document.getElementById("wp-btn-regenerate")?.addEventListener("click", () => {
    void runWorkingPlanAction("regenerate");
  });
  document.getElementById("wp-btn-obsolete")?.addEventListener("click", () => {
    void runWorkingPlanAction("obsolete");
  });
}

/**
 * @param {"regenerate" | "obsolete"} kind
 */
async function runWorkingPlanAction(kind) {
  if (workingPlanActionBusy) {
    return;
  }

  const statusEl = document.getElementById("working-plan-status");
  const outputEl = document.getElementById("working-plan-output");
  const regenBtn = document.getElementById("wp-btn-regenerate");
  const obsBtn   = document.getElementById("wp-btn-obsolete");
  const endpoint = kind === "regenerate"
    ? "/api/jira/working-plan/regenerate"
    : "/api/jira/working-plan/check-obsolete";
  const label    = kind === "regenerate" ? "Rigenerazione piano…" : "Verifica obsoleti…";

  workingPlanActionBusy = true;
  workingPlanSavedLoadToken += 1;

  if (regenBtn instanceof HTMLButtonElement) {
    regenBtn.disabled = true;
  }

  if (obsBtn instanceof HTMLButtonElement) {
    obsBtn.disabled = true;
  }

  if (statusEl) {
    statusEl.textContent = label;
  }

  if (outputEl && kind !== "regenerate") {
    outputEl.innerHTML = "";
  }

  const preservedSprintStatus = new Map();

  try {
    const res = await fetch(endpoint, {
      method  : "POST"
    , headers : { "Content-Type": "application/json" }
    , body    : JSON.stringify({ source: "db", saveHtml: kind === "regenerate" })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(String(data.error ?? `HTTP ${res.status}`));
    }

    if (kind === "regenerate") {
      lastWorkingPlanPayload = data.payload ?? null;
    }

    if (outputEl) {
      if (typeof data.html === "string" && data.html.trim()) {
        await applyWorkingPlanHtml(
          outputEl
        , data.html
        , kind === "regenerate" ? preservedSprintStatus : new Map()
        );
      } else if (typeof data.markdown === "string") {
        outputEl.innerHTML = `<pre class="working-plan-fallback">${escapeHtml(data.markdown)}</pre>`;
      } else {
        outputEl.innerHTML = `<pre class="working-plan-fallback">${escapeHtml(JSON.stringify(data.payload ?? data, null, 2))}</pre>`;
      }
    }

    if (statusEl) {
      const fetchedAt = data.payload?.fetchedAt ?? data.payload?.report?.generatedAt ?? data.payload?.report?.scannedAt ?? "";
      const savedUrl  = data.savedHtml?.publicUrl ?? data.payload?.savedHtml?.publicUrl ?? "";

      if (kind === "regenerate") {
        statusEl.textContent = `Report piano generato${fetchedAt ? ` · backlog ${fetchedAt}` : ""}`
          + (savedUrl ? ` · salvato ${savedUrl}` : "");
      } else {
        statusEl.textContent = `Verifica obsoleti completata${fetchedAt ? ` · backlog ${fetchedAt}` : ""}`;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (statusEl) {
      statusEl.textContent = `Errore: ${message}`;
    }

    if (outputEl) {
      outputEl.innerHTML = `<p class="working-plan-error">${escapeHtml(message)}</p>`;
    }
  } finally {
    workingPlanActionBusy = false;

    if (regenBtn instanceof HTMLButtonElement) {
      regenBtn.disabled = false;
    }

    if (obsBtn instanceof HTMLButtonElement) {
      obsBtn.disabled = false;
    }
  }
}

/**
 * Salva epic di riferimento manuale per una story orphan e rigenera il piano.
 *
 * @param {HTMLButtonElement} btn
 */
async function saveWorkingPlanEpicRef(btn) {
  if (workingPlanActionBusy) {
    return;
  }

  const picker   = btn.closest(".wp-epic-picker");
  const issueKey = picker instanceof HTMLElement ? String(picker.dataset.wpEpicIssue ?? "").trim() : "";
  const select   = picker?.querySelector(".wp-epic-select");
  const epicKey  = select instanceof HTMLSelectElement ? select.value.trim() : "";
  const outputEl = document.getElementById("working-plan-output");
  const statusEl = document.getElementById("working-plan-status");

  if (!issueKey) {
    return;
  }

  if (!epicKey) {
    if (statusEl) {
      statusEl.textContent = `Seleziona un'epic prima di salvare (${issueKey})`;
    }

    return;
  }

  workingPlanActionBusy = true;
  btn.disabled = true;

  if (statusEl) {
    statusEl.textContent = `Salvataggio epic su Jira per ${issueKey}…`;
  }

  try {
    const res = await fetch("/api/jira/working-plan/epic-ref", {
      method  : "POST"
    , headers : { "Content-Type": "application/json" }
    , body    : JSON.stringify({
        issueKey
      , epicKey: epicKey || null
      , source : "db"
      , saveHtml: true
      })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(String(data.error ?? `HTTP ${res.status}`));
    }

    lastWorkingPlanPayload = data.payload ?? null;

    if (outputEl && typeof data.html === "string" && data.html.trim()) {
      await applyWorkingPlanHtml(outputEl, data.html, new Map());
    }

    if (statusEl) {
      statusEl.textContent = String(data.message ?? `Epic salvata per ${issueKey}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (statusEl) {
      statusEl.textContent = `Errore epic: ${message}`;
    }
  } finally {
    workingPlanActionBusy = false;
    btn.disabled = false;
  }
}

/**
 * @param {ParentNode} root
 * @returns {HTMLElement | null}
 */
function getBacklogPoolSection(root) {
  const node = root.querySelector("[data-wp-backlog-pool]");

  return node instanceof HTMLElement ? node : null;
}

/**
 * @param {HTMLElement} section
 * @returns {string[]}
 */
function getSelectedBacklogKeys(section) {
  /** @type {string[]} */
  const keys = [];

  section.querySelectorAll(".wp-backlog-check:checked").forEach((node) => {
    if (!(node instanceof HTMLInputElement)) {
      return;
    }

    const key = String(node.dataset.wpBacklogKey ?? "").trim();

    if (key) {
      keys.push(key);
    }
  });

  return keys;
}

/** Valore select backlog — crea nuovo sprint con numerazione piano. */
const BACKLOG_NEW_SPRINT_VALUE = "__new__";

/**
 * @param {HTMLElement | null} section
 */
function syncBacklogPoolToolbar(section) {
  if (!section) {
    return;
  }

  const selected  = getSelectedBacklogKeys(section);
  const sprintSel = section.querySelector("[data-wp-backlog-sprint-select]");
  const addBtn    = section.querySelector("[data-wp-backlog-add-sprint]");
  const countEl   = section.querySelector("[data-wp-backlog-selection]");
  const sprintVal = sprintSel instanceof HTMLSelectElement ? sprintSel.value : "";

  if (countEl instanceof HTMLElement) {
    countEl.textContent = `${selected.length} selezionate`;
  }

  if (addBtn instanceof HTMLButtonElement) {
    addBtn.disabled = selected.length === 0 || !sprintVal;
  }

  const openChecks = [...section.querySelectorAll(".wp-backlog-check[data-wp-backlog-key]")];
  const checkAll   = section.querySelector("[data-wp-backlog-check-all]");

  if (checkAll instanceof HTMLInputElement && openChecks.length > 0) {
    checkAll.checked       = openChecks.every((node) => node instanceof HTMLInputElement && node.checked);
    checkAll.indeterminate = !checkAll.checked && openChecks.some((node) => node instanceof HTMLInputElement && node.checked);
  }
}

/**
 * @param {ParentNode} root
 */
function initBacklogPoolControls(root) {
  syncBacklogPoolToolbar(getBacklogPoolSection(root));
}

/**
 * Sposta issue selezionate dal pool backlog allo sprint proposto scelto (Jira agile).
 *
 * @param {HTMLButtonElement} btn
 */
async function addBacklogSelectionToSprint(btn) {
  if (workingPlanSprintCreateBusy) {
    return;
  }

  const section = btn.closest("[data-wp-backlog-pool]");

  if (!(section instanceof HTMLElement)) {
    return;
  }

  const sprintSel   = section.querySelector("[data-wp-backlog-sprint-select]");
  const actionEl    = section.querySelector("[data-wp-backlog-action]");
  const outputEl    = document.getElementById("working-plan-output");
  const statusEl    = document.getElementById("working-plan-status");
  const sprintVal   = sprintSel instanceof HTMLSelectElement ? sprintSel.value : "";
  const keys        = getSelectedBacklogKeys(section);
  const isNewSprint = sprintVal === BACKLOG_NEW_SPRINT_VALUE;
  const sprintNum   = isNewSprint
    ? Number(section.dataset.wpNextSprint)
    : Number(sprintVal);
  const report      = lastWorkingPlanPayload?.report;
  const block       = !isNewSprint && report && typeof report === "object" && Array.isArray(report.proposedSprints)
    ? report.proposedSprints.find((row) => Number(row.sprint) === sprintNum && !row.backlogPool)
    : null;

  if (!sprintVal || keys.length === 0) {
    return;
  }

  if (!isNewSprint && (!Number.isFinite(sprintNum) || sprintNum < 1)) {
    return;
  }

  if (!isNewSprint && !block) {
    if (actionEl instanceof HTMLElement) {
      actionEl.hidden = false;
      actionEl.textContent = "Rigenera il piano prima di assegnare issue allo sprint.";
      actionEl.className = "wp-backlog-action wp-sprint-action is-error";
    }

    return;
  }

  workingPlanSprintCreateBusy = true;
  btn.disabled = true;

  if (actionEl instanceof HTMLElement) {
    actionEl.hidden = false;
    actionEl.className = "wp-backlog-action wp-sprint-action";
    actionEl.textContent = isNewSprint
      ? `Creazione sprint ${sprintNum} con ${keys.length} issue…`
      : `Assegnazione ${keys.length} issue allo sprint ${sprintNum}…`;
  }

  try {
    /** @type {Record<string, unknown>} */
    const payload = {
      keys
    , refreshPlan: true
    };

    if (isNewSprint) {
      payload.createNew = true;
      payload.sprint    = sprintNum;
    } else {
      payload.sprint      = block.sprint;
      payload.name        = block.name;
      payload.description = block.description ?? "";
    }

    const res = await fetch("/api/jira/working-plan/create-sprint", {
      method  : "POST"
    , headers : { "Content-Type": "application/json" }
    , body    : JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(String(data.error ?? `HTTP ${res.status}`));
    }

    if (typeof data.html === "string" && data.html.trim() && outputEl) {
      lastWorkingPlanPayload = data.payload ?? null;
      await applyWorkingPlanHtml(outputEl, data.html, new Map());
    }

    const planSprint = Number(data.planSprint ?? sprintNum);
    const message    = String(data.message ?? `${keys.length} issue assegnate`);

    if (actionEl instanceof HTMLElement) {
      actionEl.className = "wp-backlog-action wp-sprint-action is-ok";
      actionEl.textContent = message;
    }

    if (statusEl) {
      statusEl.textContent = isNewSprint
        ? `Sprint ${planSprint} creato su Jira · piano rigenerato`
        : `Issue assegnate allo sprint ${planSprint} · piano rigenerato`;
    }

    refreshMyBacklogTab({
      reason  : isNewSprint ? "create-sprint" : "assign-sprint"
    , sprintId: Number(data.sprintId) || null
    });

    if (reportPayloadHasSprintStatus(report)) {
      if (!report.jiraSprintStatusByPlanNum) {
        report.jiraSprintStatusByPlanNum = {};
      }

      report.jiraSprintStatusByPlanNum[String(planSprint)] = {
        sprintId    : data.sprintId ?? null
      , sprintName  : data.sprintName ?? block?.name ?? ""
      , state       : "future"
      , message
      , boardUrl    : data.boardUrl ?? null
      , matchedKeys : Number(data.issueCount ?? keys.length)
      , totalKeys   : keys.length
      };
    }

    const refreshedSection = getBacklogPoolSection(outputEl ?? section);

    if (refreshedSection instanceof HTMLElement) {
      syncBacklogPoolToolbar(refreshedSection);
    } else {
      syncBacklogPoolToolbar(section);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (actionEl instanceof HTMLElement) {
      actionEl.className = "wp-backlog-action wp-sprint-action is-error";
      actionEl.textContent = message;
    }
  } finally {
    workingPlanSprintCreateBusy = false;
    btn.disabled = false;
    const liveSection = getBacklogPoolSection(document.getElementById("working-plan-output") ?? section);

    syncBacklogPoolToolbar(liveSection instanceof HTMLElement ? liveSection : section);
  }
}

/**
 * @param {unknown} report
 * @returns {report is Record<string, unknown> & { jiraSprintStatusByPlanNum?: Record<string, unknown> }}
 */
function reportPayloadHasSprintStatus(report) {
  return Boolean(report) && typeof report === "object";
}

/**
 * Blocco sprint piano per creazione Jira — da proposedSprints o da coda ordine sviluppo.
 *
 * @param {number} sprintNum
 * @param {Record<string, unknown> | null | undefined} report
 * @returns {{ sprint: number, name: string, description?: string, keys: string[] } | null}
 */
function resolveWpSprintBlockForCreate(sprintNum, report) {
  if (!report || typeof report !== "object") {
    return null;
  }

  const fromProposed = Array.isArray(report.proposedSprints)
    ? report.proposedSprints.find((row) => Number(row.sprint) === sprintNum)
    : null;

  if (fromProposed && Array.isArray(fromProposed.keys) && fromProposed.keys.length > 0) {
    return {
      sprint     : Number(fromProposed.sprint)
    , name       : String(fromProposed.name ?? `Sprint ${sprintNum}`)
    , description: typeof fromProposed.description === "string" ? fromProposed.description : ""
    , keys       : fromProposed.keys.map((key) => String(key))
    };
  }

  const queueRows = Array.isArray(report.orderedDevelopmentQueue)
    ? report.orderedDevelopmentQueue.filter((row) => Number(row.sprint) === sprintNum)
    : [];

  if (!queueRows.length) {
    return null;
  }

  const keys = [...new Set(queueRows.map((row) => String(row.key).trim()).filter(Boolean))];
  const first = queueRows[0];

  return {
    sprint     : sprintNum
  , name       : String(first.sprintName ?? `Sprint ${sprintNum}`)
  , description: ""
  , keys
  };
}

/**
 * Crea su Jira lo sprint proposto dalla card Working Plan.
 *
 * @param {HTMLButtonElement} btn
 */
async function createJiraSprintFromCard(btn) {
  if (workingPlanSprintCreateBusy) {
    return;
  }

  const sprintNum = Number(btn.dataset.wpSprint);
  const reportPayload = lastWorkingPlanPayload?.report;
  const block = resolveWpSprintBlockForCreate(sprintNum, reportPayload);
  const outputEl = document.getElementById("working-plan-output");

  const scope = btn.closest(".wp-sprint-actions, [data-wp-sprint-card]");
  const statusEl = scope instanceof HTMLElement
    ? scope.querySelector(`[data-wp-sprint-status="${sprintNum}"]`)
    : document.querySelector(`[data-wp-sprint-status="${sprintNum}"]`);

  if (!block) {
    if (statusEl instanceof HTMLElement) {
      statusEl.hidden = false;
      statusEl.textContent = "Rigenera il piano prima di creare lo sprint su Jira.";
      statusEl.className = "wp-sprint-action is-error";
    }

    return;
  }

  workingPlanSprintCreateBusy = true;
  btn.disabled = true;

  if (statusEl instanceof HTMLElement) {
    statusEl.hidden = false;
    statusEl.className = "wp-sprint-action";
    statusEl.textContent = "Creazione sprint su Jira…";
  }

  try {
    const res = await fetch("/api/jira/working-plan/create-sprint", {
      method  : "POST"
    , headers : { "Content-Type": "application/json" }
    , body    : JSON.stringify({
        sprint     : block.sprint
      , name       : block.name
      , description: block.description ?? ""
      , keys       : block.keys ?? []
      })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(String(data.error ?? `HTTP ${res.status}`));
    }

    if (typeof data.html === "string" && data.html.trim() && outputEl) {
      lastWorkingPlanPayload = data.payload ?? null;
      await applyWorkingPlanHtml(outputEl, data.html, new Map());
    }

    if (statusEl instanceof HTMLElement) {
      const message = escapeHtml(String(data.message ?? "Sprint creato su Jira"));
      const boardUrl = typeof data.boardUrl === "string" ? data.boardUrl : "";

      statusEl.className = "wp-sprint-action is-ok";
      statusEl.innerHTML = boardUrl
        ? `${message} · <a href="${escapeHtml(boardUrl)}" target="_blank" rel="noopener noreferrer">Apri board</a>`
        : message;
    }

    if (reportPayload && typeof reportPayload === "object" && !data.html) {
      if (!reportPayload.jiraSprintStatusByPlanNum || typeof reportPayload.jiraSprintStatusByPlanNum !== "object") {
        reportPayload.jiraSprintStatusByPlanNum = {};
      }

      const totalKeys = Array.isArray(block.keys) ? block.keys.length : 0;

      reportPayload.jiraSprintStatusByPlanNum[String(sprintNum)] = {
        sprintId    : data.sprintId ?? null
      , sprintName  : data.sprintName ?? block.name
      , state       : data.state ?? "future"
      , boardUrl    : typeof data.boardUrl === "string" ? data.boardUrl : ""
      , matchedKeys : Number(data.issueCount ?? totalKeys)
      , totalKeys
      , message     : String(data.message ?? "Sprint creato su Jira")
      };
    }

    refreshMyBacklogTab({
      reason  : "create-sprint"
    , sprintId: Number(data.sprintId) || null
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (statusEl instanceof HTMLElement) {
      statusEl.className = "wp-sprint-action is-error";
      statusEl.textContent = message;
    }
  } finally {
    workingPlanSprintCreateBusy = false;
    btn.disabled = false;
  }
}

/**
 * Chiude sprint Jira attivo (tutte Fatto), sync DB e rigenera Working Plan.
 *
 * @param {HTMLButtonElement} btn
 */
async function closeActiveJiraSprint(btn) {
  if (workingPlanSprintCreateBusy || workingPlanActionBusy) {
    return;
  }

  const jiraSprintId = Number(btn.dataset.wpJiraSprintId);
  const planSprint   = Number(btn.dataset.wpPlanSprint);
  const section      = btn.closest("[data-wp-active-sprint]");
  const actionEl     = section instanceof HTMLElement
    ? section.querySelector("[data-wp-active-sprint-action]")
    : null;
  const outputEl     = document.getElementById("working-plan-output");
  const statusEl     = document.getElementById("working-plan-status");

  if (!Number.isFinite(jiraSprintId) || jiraSprintId < 1) {
    return;
  }

  workingPlanSprintCreateBusy = true;
  btn.disabled = true;

  if (actionEl instanceof HTMLElement) {
    actionEl.hidden = false;
    actionEl.className = "wp-active-sprint-action wp-sprint-action";
    actionEl.textContent = "Chiusura sprint su Jira e aggiornamento cache…";
  }

  if (statusEl) {
    statusEl.textContent = "Chiusura sprint attivo…";
  }

  try {
    const res = await fetch("/api/jira/working-plan/close-sprint", {
      method  : "POST"
    , headers : { "Content-Type": "application/json" }
    , body    : JSON.stringify({
        jiraSprintId
      , planSprint: Number.isFinite(planSprint) ? planSprint : undefined
      , saveHtml  : true
      })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(String(data.error ?? `HTTP ${res.status}`));
    }

    if (typeof data.html === "string" && data.html.trim() && outputEl) {
      lastWorkingPlanPayload = data.payload ?? null;
      await applyWorkingPlanHtml(outputEl, data.html, new Map());
    }

    const message = String(data.message ?? data.close?.message ?? "Sprint chiuso");
    const boardUrl = typeof data.close?.boardUrl === "string" ? data.close.boardUrl : "";

    if (actionEl instanceof HTMLElement) {
      actionEl.className = "wp-active-sprint-action wp-sprint-action is-ok";
      actionEl.innerHTML = boardUrl
        ? `${escapeHtml(message)} — <a href="${escapeHtml(boardUrl)}" target="_blank" rel="noopener noreferrer">Board Jira</a>`
        : escapeHtml(message);
    }

    if (statusEl) {
      const patchedAt = data.dbPatch?.patchedAt ?? data.payload?.fetchedAt ?? "";
      statusEl.textContent = `Sprint chiuso${patchedAt ? ` · cache ${patchedAt}` : ""} · piano rigenerato`;
    }

    refreshMyBacklogTab({ reason: "close-sprint", sprintId: jiraSprintId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (actionEl instanceof HTMLElement) {
      actionEl.className = "wp-active-sprint-action wp-sprint-action is-error";
      actionEl.textContent = message;
    }

    if (statusEl) {
      statusEl.textContent = `Errore: ${message}`;
    }
  } finally {
    workingPlanSprintCreateBusy = false;
    btn.disabled = false;
  }
}

/**
 * Tab Cursor Agent — prompt, runtime local/cloud, console log polling.
 */
async function renderCursorAgent() {
  const root = document.getElementById("section-cursor");

  if (!root) {
    return;
  }

  /** @type {Record<string, unknown>} */
  let config = {};

  try {
    config = await apiGet("/api/cursor/config");
  } catch {
    config = { configured: false };
  }

  const configured     = Boolean(config.configured);
  const defaultRuntime = config.defaultRuntime === "cloud" ? "cloud" : "local";
  const localCwd       = escapeHtml(String(config.localCwd ?? "—"));
  const cloudRepos     = Array.isArray(config.cloudRepos)
    ? config.cloudRepos.map((r) => escapeHtml(String(/** @type {{ url?: string }} */ (r).url ?? ""))).join("<br>")
    : "—";
  const modelId        = escapeHtml(String(/** @type {{ id?: string }} */ (config.model)?.id ?? "composer-2.5"));

  root.innerHTML = `
    <section class="panel process-console-panel" id="cursor-agent-panel">
      <div class="process-console-head">
        <div>
          <h2>Cursor Agent</h2>
          <p class="muted" id="cursor-agent-status-line">Caricamento…</p>
        </div>
        <div class="process-console-tools">
          <label class="portal-log-filter">
            <span class="muted">Livello</span>
            <select id="cursor-agent-log-level" aria-label="Filtro livello log agent">
              <option value="all">tutti</option>
              <option value="info" selected>info+</option>
              <option value="warn">warn+</option>
              <option value="error">error</option>
            </select>
          </label>
          <span class="process-console-badge" id="cursor-agent-badge">idle</span>
        </div>
      </div>
      <p class="muted">
        Agent Cursor via <code>@cursor/sdk</code> — <strong>local</strong> usa <code>${localCwd}</code>;
        <strong>cloud</strong> clona: ${cloudRepos}. Modello: <code>${modelId}</code>.
      </p>
      ${configured
    ? ""
    : `<p class="muted"><strong>CURSOR_API_KEY</strong> assente in <code>.env</code> — configura la chiave da Cursor Dashboard → Integrations.</p>`}
      <div class="btn-row" style="margin: 0.75rem 0">
        <label><input type="radio" name="cursor-runtime" value="local" ${defaultRuntime === "local" ? "checked" : ""} /> Local</label>
        <label style="margin-left:1rem"><input type="radio" name="cursor-runtime" value="cloud" ${defaultRuntime === "cloud" ? "checked" : ""} /> Cloud</label>
        <label style="margin-left:1rem"><input type="checkbox" id="cursor-agent-resume" /> Resume ultimo agent</label>
      </div>
      <textarea id="cursor-agent-prompt" class="cursor-agent-prompt" rows="5" placeholder="Es. procedi Story ADMIN-96 — segui ADMIN-Workflow.mdc" ${configured ? "" : "disabled"}></textarea>
      <div class="btn-row cursor-agent-btn-row" style="margin-top:0.75rem">
        <div class="cursor-agent-btn-group">
          <button type="button" class="action primary" id="cursor-agent-send" ${configured ? "" : "disabled"}>Invia</button>
          <button type="button" class="action" id="cursor-agent-cancel">Cancel</button>
          <button type="button" class="action" id="cursor-agent-clear">Svuota log</button>
          <button type="button" class="action" id="cursor-agent-template-gogo">Template gogo</button>
        </div>
        <div class="cursor-agent-wf-bar" id="cursor-agent-wf-bar" hidden>
          <span class="cursor-agent-wf-step muted" id="cursor-agent-wf-step" title="Step workflow">—</span>
          <span class="process-console-badge cursor-agent-wf-state is-idle" id="cursor-agent-wf-state" title="Stato agent">idle</span>
        </div>
      </div>
      <div id="cursor-agent-output" class="process-console-output" aria-live="polite"></div>
    </section>`;

  const promptEl   = document.getElementById("cursor-agent-prompt");
  const sendBtn    = document.getElementById("cursor-agent-send");
  const cancelBtn  = document.getElementById("cursor-agent-cancel");
  const clearBtn   = document.getElementById("cursor-agent-clear");
  const templateBtn = document.getElementById("cursor-agent-template-gogo");
  const levelFilterEl = document.getElementById("cursor-agent-log-level");

  if (levelFilterEl instanceof HTMLSelectElement) {
    levelFilterEl.addEventListener("change", () => {
      cursorAgentLogLevelFilter = levelFilterEl.value;
    });
  }

  templateBtn?.addEventListener("click", () => {
    if (promptEl instanceof HTMLTextAreaElement) {
      const prefix = cruscottoJiraPrefix();
      promptEl.value = `gogo ${prefix}-xxx — workflow ADMIN, branch STORY---${prefix}-num-slug`;
    }
  });

  sendBtn?.addEventListener("click", async () => {
    if (!(promptEl instanceof HTMLTextAreaElement)) {
      return;
    }

    const runtimeInput = root.querySelector('input[name="cursor-runtime"]:checked');
    const runtime = runtimeInput instanceof HTMLInputElement ? runtimeInput.value : "local";
    const resumeEl = document.getElementById("cursor-agent-resume");
    const resume   = resumeEl instanceof HTMLInputElement && resumeEl.checked;

    try {
      const res = await fetch("/api/cursor/agent", {
        method  : "POST"
      , headers : { "Content-Type": "application/json" }
      , body    : JSON.stringify({
          prompt : promptEl.value.trim()
        , runtime
        , resume
        })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(String(data.error ?? `HTTP ${res.status}`));
      }

      cursorAgentLogCursor = Number(data.logCursor) || cursorAgentLogCursor;
      void pollCursorAgentLogs();
    } catch (err) {
      const statusEl = document.getElementById("cursor-agent-status-line");
      if (statusEl) {
        statusEl.textContent = err instanceof Error ? err.message : String(err);
      }
    }
  });

  cancelBtn?.addEventListener("click", async () => {
    try {
      await fetch("/api/cursor/agent/cancel", { method: "POST" });
      void pollCursorAgentLogs();
    } catch {
      // ignore
    }
  });

  clearBtn?.addEventListener("click", async () => {
    try {
      await fetch("/api/cursor/agent/clear-logs", { method: "POST" });
      const outputEl = document.getElementById("cursor-agent-output");
      if (outputEl) {
        outputEl.innerHTML = "";
      }
      cursorAgentLogCursor = 0;
      cursorAgentLogSeenSeq = new Set();
    } catch {
      // ignore
    }
  });

  void pollCursorAgentLogs();
}

// --- bootstrap SPA — caricamento iniziale e avvio ---
/**
 * Carica requisiti, servizi, catalogo test e report; renderizza tutte le tab statiche.
 */
async function loadAll() {
  // 1. Rimuovi indicatore boot — shell HTML pronta
  document.getElementById("boot-loading")?.remove();

  // 2. Requisiti e servizi dev — tab Requisiti/Servizi e Overview
  const requirements = await apiGet("/api/dev/requirements");
  const services     = await loadServizi();
  renderRequisiti(requirements);

  // 3. Catalogo test e meta suite — opzionale se API non pronte
  let report = null;
  let status = null;
  try {
    scriptCatalog = await apiGet("/api/scripts");
  } catch {
    scriptCatalog = null;
  }
  try {
    funzionaliMeta = await apiGet("/api/funzionali/meta");
  } catch {
    funzionaliMeta = null;
  }
  try {
    tecniciMeta = await apiGet("/api/tecnici/meta");
  } catch {
    tecniciMeta = null;
  }
  try {
    report = await apiGet("/api/report");
  } catch {
    report = null;
  }
  try {
    status = await apiGet("/api/status");
  } catch {
    status = null;
  }

  // 4. Render tab statiche
  renderTest(report, status, scriptCatalog);
  renderTestTecnici(report, status, scriptCatalog, tecniciMeta);
  renderTestFunzionali(report, status, scriptCatalog, funzionaliMeta);
  await renderProcess(report);
  renderWorkingPlanTab();
  await renderCursorAgent();
  if (location.hash.replace("#", "") === "cursor") {
    startCursorAgentPolling();
  }
}

/**
 * Sidebar click e hash URL → {@link setActiveTab}; compat `#utility` → `process`.
 */
function initRouter() {
  document.querySelectorAll(".sidebar-nav [data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.getAttribute("data-tab") ?? DEFAULT_TAB));
  });

  window.addEventListener("hashchange", () => {
    const { tab, payload } = parseLocationHash();

    if (TABS.includes(tab)) {
      setActiveTab(tab, payload);
    }
  });

  const { tab, payload } = parseLocationHash();
  setActiveTab(TABS.includes(tab) ? tab : DEFAULT_TAB, payload);
}

/**
 * Tab Project Overview — refresh analisi al load iframe e al cambio tab.
 */
function bindProjectOverviewIframe() {
  const iframe = document.querySelector("#section-projectoverview iframe");

  if (!(iframe instanceof HTMLIFrameElement) || iframe.dataset.bound === "1") {
    return;
  }

  iframe.dataset.bound = "1";
  projectOverviewIframe = iframe;

  iframe.addEventListener("load", () => {
    iframe.dataset.loaded = "1";

    if (parseLocationHash().tab === "projectoverview") {
      postProjectOverviewRefresh(iframe);
    }
  });
}

// --- init pagina ---
// 1. Titolo sidebar da progetto istanziato
initSidebarBrand();
// 2. Router hash e tab sidebar
initRouter();
bindProjectOverviewIframe();
// 3. Modal documentazione testScript (delegazione globale)
bindScriptDocModalGlobal();
// 4. Caricamento dati iniziale da API cruscotto — errori in .cruscotto-main
loadAll().catch((err) => {
  console.error(err);
  const main = document.querySelector(".cruscotto-main");
  if (main) {
    main.insertAdjacentHTML("afterbegin", `<div class="panel"><p class="muted">Errore caricamento cruscotto: ${escapeHtml(err.message)}</p></div>`);
  }
});
