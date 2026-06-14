/**
 * Cruscotto Dev Admin — SPA vanilla (Overview, Requisiti, Servizi, Test).
 * Sezioni: JLO-916 shell · JLO-917 Requisiti · JLO-918 Servizi · JLO-919 Test · JLO-920 Overview
 */

const TABS = ["overview", "requisiti", "servizi", "test", "summary", "testtecnici", "testfunzionali", "jiraworking", "jiraworkingold", "jiraproject", "backlog", "myproject", "pillarmatrix"];
const DEFAULT_TAB = "overview";

/** @type {Record<string, { title: string, subtitle: string }>} */
const PAGE_META = {
  overview : {
    title    : "Overview"
  , subtitle : "Riepilogo servizi e ultimo run test"
  }
, requisiti: {
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
, summary  : {
    title    : "Summary"
  , subtitle : "Test case per file — da ultimo report"
  }
, testtecnici: {
    title    : "TestTecnici"
  , subtitle : "Esecuzione script e test case per file"
  }
, testfunzionali: {
    title    : "TestFunzionali"
  , subtitle : "Multi-utente — amici, match, flusso E2E"
  }
, jiraworking: {
    title    : "Jira Working"
  , subtitle : "Ordine di sviluppo backlog e sprint JLO"
  }
, jiraworkingold: {
    title    : "Jira Working OLD"
  , subtitle : "Snapshot precedente — sola lettura"
  }
, jiraproject: {
    title    : "Project Tree"
  , subtitle : "Backlog JLO ad albero — check Fatto per ogni step"
  }
, backlog: {
    title    : "Backlog"
  , subtitle : "Elenco completo issue Jira — tipo, key, titolo"
  }
, myproject: {
    title    : "My Project"
  , subtitle : "Analisi indipendente repository vs Jira"
  }
, pillarmatrix: {
    title    : "Matrice pilastri"
  , subtitle : "Concetti doc 9076737 × backlog JLO × segnali repo"
  }
};

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
const collapsedSummarySuites = new Set();

/** @type {Set<string>} */
const expandedSummaryFiles = new Set();

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
/** @type {{ test: boolean, testtecnici: boolean, testfunzionali: boolean, summary: boolean }} */
const suiteCollapseSeeded = {
  test            : false
, testtecnici     : false
, testfunzionali  : false
, summary         : false
};

/**
 * @param {Array<{ suite: string }>} groups
 * @param {Set<string>} collapsedSet
 * @param {"test" | "testtecnici" | "testfunzionali" | "summary"} section
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

/**
 * @param {string} path
 */
async function apiGet(path) {
  const res = await fetch(path);
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
 * @param {string} tab
 */
function setActiveTab(tab) {
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

  const meta = PAGE_META[tab] ?? PAGE_META.overview;
  const titleEl = document.getElementById("page-title");
  const subEl   = document.getElementById("page-subtitle");

  if (titleEl) {
    titleEl.textContent = meta.title;
  }
  if (subEl) {
    subEl.textContent = meta.subtitle;
  }

  location.hash = tab;
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
    const hint = up ? "" : `<p class="muted">Avvia <code>npm run dev</code> o lo script dedicato.</p>`;
    const docs = svc.docs ? `<a href="${escapeHtml(String(svc.openUrl ?? ""))}" target="_blank" rel="noopener">Docs</a>` : `<a href="${escapeHtml(String(svc.openUrl ?? ""))}" target="_blank" rel="noopener">Apri</a>`;

    return `
      <article class="service-card">
        <h3>${escapeHtml(String(svc.label ?? svc.id ?? ""))}</h3>
        <span class="badge ${up ? "up" : "down"}">${up ? "UP" : "DOWN"}</span>
        <span class="muted"> · :${escapeHtml(String(svc.port ?? ""))} · ${latency}</span>
        <p class="muted"><code>${escapeHtml(String(svc.healthUrl ?? ""))}</code></p>
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
 * @param {HTMLElement} root
 */
function bindSummaryActions(root) {
  root.querySelectorAll("[data-toggle-summary-suite]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const suite = btn.getAttribute("data-toggle-summary-suite");

      if (!suite) {
        return;
      }

      const group = root.querySelector(`#summary-suite-${suite}`);

      if (!group) {
        return;
      }

      const collapsed = group.classList.toggle("is-collapsed");

      if (collapsed) {
        collapsedSummarySuites.add(suite);
      } else {
        collapsedSummarySuites.delete(suite);
      }

      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });
  });

  root.querySelectorAll("[data-toggle-summary-file]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rel = btn.getAttribute("data-toggle-summary-file");

      if (!rel) {
        return;
      }

      const block = root.querySelector(`#summary-file-${cssEscapeId(rel)}`);

      if (!block) {
        return;
      }

      const expanded = block.classList.toggle("is-expanded");

      if (expanded) {
        expandedSummaryFiles.add(rel);
      } else {
        expandedSummaryFiles.delete(rel);
      }

      btn.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
  });

  root.querySelector("#btn-summary-expand-all")?.addEventListener("click", () => {
    root.querySelectorAll(".summary-suite-group").forEach((group) => {
      const toggle = group.querySelector("[data-toggle-summary-suite]");
      const suite  = toggle?.getAttribute("data-toggle-summary-suite");

      group.classList.remove("is-collapsed");

      if (suite) {
        collapsedSummarySuites.delete(suite);
      }

      toggle?.setAttribute("aria-expanded", "true");
    });

    root.querySelectorAll(".summary-file-block").forEach((block) => {
      const toggle = block.querySelector("[data-toggle-summary-file]");
      const rel    = toggle?.getAttribute("data-toggle-summary-file");

      block.classList.add("is-expanded");

      if (rel) {
        expandedSummaryFiles.add(rel);
      }

      toggle?.setAttribute("aria-expanded", "true");
    });
  });

  root.querySelector("#btn-summary-collapse-all")?.addEventListener("click", () => {
    root.querySelectorAll(".summary-suite-group").forEach((group) => {
      const toggle = group.querySelector("[data-toggle-summary-suite]");
      const suite  = toggle?.getAttribute("data-toggle-summary-suite");

      group.classList.add("is-collapsed");

      if (suite) {
        collapsedSummarySuites.add(suite);
      }

      toggle?.setAttribute("aria-expanded", "false");
    });

    root.querySelectorAll(".summary-file-block").forEach((block) => {
      const toggle = block.querySelector("[data-toggle-summary-file]");
      const rel    = toggle?.getAttribute("data-toggle-summary-file");

      block.classList.remove("is-expanded");

      if (rel) {
        expandedSummaryFiles.delete(rel);
      }

      toggle?.setAttribute("aria-expanded", "false");
    });
  });

  root.querySelectorAll("[data-jump-summary-suite]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const suite = btn.getAttribute("data-jump-summary-suite");

      if (!suite) {
        return;
      }

      const group = root.querySelector(`#summary-suite-${suite}`);

      if (group) {
        group.classList.remove("is-collapsed");
        collapsedSummarySuites.delete(suite);
        const toggle = group.querySelector("[data-toggle-summary-suite]");
        toggle?.setAttribute("aria-expanded", "true");
        group.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      root.querySelectorAll("[data-jump-summary-suite]").forEach((el) => {
        el.classList.toggle("active", el.getAttribute("data-jump-summary-suite") === suite);
      });
    });
  });
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

/**
 * @param {Record<string, unknown> | null} report
 * @param {{ scripts?: Array<Record<string, unknown>> } | null} catalog
 */
function renderSummary(report, catalog) {
  const root = document.getElementById("section-summary");

  if (!root) {
    return;
  }

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
    ? catalog.scripts.map((e) => /** @type {Record<string, unknown>} */ (e))
    : [];

  const groups = groupScriptsBySuite(catalogScripts);

  seedAllSuitesCollapsed(groups, collapsedSummarySuites, "summary");

  let filesWithTests = 0;
  let totalCases = 0;
  let casesPassed = 0;
  let casesFailed = 0;
  let casesSkipped = 0;

  for (const entry of catalogScripts) {
    const rel = String(entry.rel ?? "");
    const tests = extractScriptTests(reportByScript.get(rel));

    if (tests.length > 0) {
      filesWithTests += 1;
    }

    for (const test of tests) {
      totalCases += 1;
      const status = testCaseStatus(/** @type {{ ok: boolean, skipped: boolean }} */ (test));

      if (status === "passed") {
        casesPassed += 1;
      } else if (status === "failed") {
        casesFailed += 1;
      } else {
        casesSkipped += 1;
      }
    }
  }

  const suiteNav = groups.map((group) => `
    <button type="button" data-jump-summary-suite="${escapeHtml(group.suite)}">
      ${escapeHtml(group.label)} <span class="muted">(${group.items.length})</span>
    </button>`
  ).join("");

  const suitePanels = groups.map((group) => {
    const suiteCollapsed = collapsedSummarySuites.has(group.suite);
    const folderPath = group.suite === "root" ? "testScript/" : `testScript/${group.suite}/`;

    const fileBlocks = group.items.map((entry) => {
      const rel = String(entry.rel ?? "");
      const last = reportByScript.get(rel);
      const scriptStatus = last ? String(last.status ?? "—") : "pending";
      const tests = extractScriptTests(last);
      const fileExpanded = expandedSummaryFiles.has(rel);

      let testsBody = `<p class="muted">Esegui lo script per registrare l'elenco dei test case.</p>`;

      if (tests.length > 0) {
        testsBody = renderScriptTestCasesTable(last);
      }

      return `
        <article class="summary-file-block${fileExpanded ? " is-expanded" : ""}" id="summary-file-${cssEscapeId(rel)}">
          <button
            type="button"
            class="summary-file-toggle"
            data-toggle-summary-file="${escapeHtml(rel)}"
            aria-expanded="${fileExpanded ? "true" : "false"}"
          >
            <span class="suite-chevron" aria-hidden="true"></span>
            <code class="summary-file-path">${escapeHtml(rel)}</code>
            <span class="summary-file-meta muted">${tests.length} test case</span>
            <span class="summary-file-status ${statusClass(scriptStatus === "pending" ? "" : scriptStatus)}">${escapeHtml(scriptStatus === "pending" ? "—" : scriptStatus)}</span>
          </button>
          <div class="summary-file-body">${testsBody}</div>
        </article>`;
    }).join("");

    return `
      <section class="summary-suite-group${suiteCollapsed ? " is-collapsed" : ""}" id="summary-suite-${escapeHtml(group.suite)}">
        <button
          type="button"
          class="summary-suite-toggle"
          data-toggle-summary-suite="${escapeHtml(group.suite)}"
          aria-expanded="${suiteCollapsed ? "false" : "true"}"
        >
          <span class="suite-chevron" aria-hidden="true"></span>
          <span class="suite-title">
            <span class="suite-name">${escapeHtml(group.label)}</span>
            <span class="suite-path">${escapeHtml(folderPath)}</span>
            <span class="suite-count muted">${group.items.length} file</span>
          </span>
        </button>
        <div class="summary-suite-body">${fileBlocks}</div>
      </section>`;
  }).join("");

  root.innerHTML = `
    <div class="panel">
      <h2>Panoramica test case</h2>
      <div class="overview-grid">
        <div class="stat-card"><strong>${catalogScripts.length}</strong><span class="muted">file test</span></div>
        <div class="stat-card"><strong>${filesWithTests}</strong><span class="muted">file con dettaglio</span></div>
        <div class="stat-card pass"><strong>${casesPassed}</strong><span class="muted">case ok</span></div>
        <div class="stat-card fail"><strong>${casesFailed}</strong><span class="muted">case fail</span></div>
        <div class="stat-card"><strong>${casesSkipped}</strong><span class="muted">case skip</span></div>
        <div class="stat-card"><strong>${totalCases}</strong><span class="muted">case totali</span></div>
      </div>
      <p class="muted">Ultimo report: ${report?.generatedAt ? escapeHtml(String(report.generatedAt)) : "—"} · Apri la tab <a href="#test">Test</a> per eseguire gli script.</p>
    </div>
    <div class="panel">
      <h2>Test per file</h2>
      <p class="muted">Espandi un file per leggere i test case registrati nell'ultimo run.</p>
      ${groups.length > 0
        ? `<div class="summary-toolbar">
             <nav class="test-suite-nav" aria-label="Salta a cartella">${suiteNav}</nav>
             <div class="test-suite-bulk">
               ${treeBulkToggleHtml("btn-summary-expand-all", "btn-summary-collapse-all", {
                 expandLabel  : "Espandi tutti i file"
               , collapseLabel: "Collassa tutti i file"
               , groupLabel   : "Espandi o collassa tutti i file test"
               })}
             </div>
           </div>
           <div class="summary-suites-wrap">${suitePanels}</div>`
        : `<p class="muted">Catalogo non disponibile.</p>`}
    </div>`;

  bindSummaryActions(root);
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
  renderSummary(report, scriptCatalog);
  renderTestTecnici(report, status, scriptCatalog, tecniciMeta);
  renderTestFunzionali(report, status, scriptCatalog, funzionaliMeta);

  return { status, report };
}

function pollRunStatus() {
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

      if (report) {
        try {
          const services = await apiGet("/api/dev/services");
          renderOverview(services, report);
        } catch {
          // ignore overview refresh errors
        }
      }
    }
  };

  void tick();
  pollTimer = window.setInterval(tick, 1500);
}

/**
 * @param {{ services: Array<Record<string, unknown>> }} servicesPayload
 * @param {Record<string, unknown> | null} report
 */
function renderOverview(servicesPayload, report) {
  const root = document.getElementById("section-overview");
  if (!root) {
    return;
  }

  const services = servicesPayload.services ?? [];
  const up = services.filter((s) => s.status === "up").length;
  const down = services.filter((s) => s.status !== "up");
  const downList = down.map((s) => escapeHtml(String(s.label ?? s.id))).join(", ") || "nessuno";

  const total = report && typeof report.summary === "object"
    ? /** @type {{ tests?: { total?: number, passed?: number } }} */ (report.summary).tests
    : null;
  const passRate = total?.total
    ? Math.round(((total.passed ?? 0) / total.total) * 100)
    : null;

  root.innerHTML = `
    <div class="overview-grid">
      <div class="stat-card"><strong>${up}/${services.length}</strong><span class="muted">servizi up</span></div>
      <div class="stat-card"><strong>${passRate != null ? `${passRate}%` : "—"}</strong><span class="muted">pass rate ultimo run</span></div>
    </div>
    <div class="panel">
      <h2>Servizi down</h2>
      <p>${downList}</p>
    </div>
    <div class="panel">
      <h2>Quick links</h2>
      <div class="btn-row">
        <a href="http://localhost:4080/" target="_blank" rel="noopener">API Portal :4080</a>
        <a href="http://localhost:4000/api/v1/docs" target="_blank" rel="noopener">Swagger API</a>
        <a href="http://localhost:4001/api/v1/docs" target="_blank" rel="noopener">Swagger Auth</a>
      </div>
      <div class="cmd-block" style="margin-top:0.75rem">
        <code>node server/dashboard-server.mjs</code>
        <button class="action" type="button" data-copy="node server/dashboard-server.mjs">Copia</button>
      </div>
    </div>`;

  root.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => copyCmd(btn.getAttribute("data-copy") ?? ""));
  });
}

async function loadAll() {
  document.getElementById("boot-loading")?.remove();

  const requirements = await apiGet("/api/dev/requirements");
  const services     = await loadServizi();
  renderRequisiti(requirements);

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

  renderTest(report, status, scriptCatalog);
  renderSummary(report, scriptCatalog);
  renderTestTecnici(report, status, scriptCatalog, tecniciMeta);
  renderTestFunzionali(report, status, scriptCatalog, funzionaliMeta);
  renderOverview(services, report);
}

function initRouter() {
  document.querySelectorAll(".sidebar-nav [data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.getAttribute("data-tab") ?? DEFAULT_TAB));
  });

  const hash = location.hash.replace("#", "");
  setActiveTab(TABS.includes(hash) ? hash : DEFAULT_TAB);
}

initRouter();
bindScriptDocModalGlobal();
loadAll().catch((err) => {
  console.error(err);
  const main = document.querySelector(".cruscotto-main");
  if (main) {
    main.insertAdjacentHTML("afterbegin", `<div class="panel"><p class="muted">Errore caricamento cruscotto: ${escapeHtml(err.message)}</p></div>`);
  }
});
