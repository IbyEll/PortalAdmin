/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** PAGE SCRIPT ** -- commentato il: 2026-06-30 02:04
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 06:03   by: IbyEll
 * modificato il: 2026-06-30 02:04   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                JiraIssueDisplay — bundle browser IIFE core + DOM per pagine cruscotto Jira
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Le pagine cruscotto HTML non possono importare ESM Node; espongono window.JiraIssueDisplay.
 *   - Bundle unico servito come static asset senza build step (concat core + dom.part).
 *
 *   A cosa serve:
 *   - Etichette EPIC/STORY/SUB/BUG/TODO, decorazione link IssueKEY, fetch tipi da backlog API.
 *   - Formattazione elenchi IssueKEY nelle celle .plan-note del working plan.
 *
 * Generalizzazione:
 *   Si — prefisso IssueKEY e URL browse da window.CRUSCOTTO_PROJECT (overlay PRJ_JIRA_PREFIX).
 *
 * Input:
 *   - window.CRUSCOTTO_PROJECT / __CRUSCOTTO_PROJECT__ — jiraPrefix, jiraBrowseBase opzionale
 *   - GET /api/jira/backlog — mappa key → issuetype
 *   - jiraBase — argomento opzionale sulle funzioni decorate
 *
 * Consumatori:
 *   - cruscotto.jira.backlog.html, cruscotto.jira.working.html, cruscotto.jira.my-project.html
 *   - PROJECT_JustLastOne/cruscotto.jira.project.tree.html — script tag /jira-issue-display.js
 *
 * Pagina HTML:
 *   - Pagine cruscotto che caricano /jira-issue-display.js (backlog, working, pillar matrix, …)
 *
 * Servito da:
 *   - cruscotto.frontend/cruscotto.server.mjs — alias statico /jira-issue-display.js
 *
 * Asset correlati:
 *   - cruscotto.jira.issue.display.core.mjs — funzioni core serializzate nello scope IIFE
 *   - cruscotto.jira.issue.display.client.dom.part.js — parte DOM concatenata sotto il core
 *   - cruscotto.jira.issue.display.css — classi issue-type-* sui badge
 *
 * API (fetch same-origin):
 *   - GET /api/jira/backlog — tipi issue per decorateJiraLinksFromApi
 *
 * Dipendenze runtime:
 *   - window.CRUSCOTTO_PROJECT — config iniettata da bootstrap o inline script server
 *   - elementi a.jira-link, .plan-note — markup pagine cruscotto Jira
 *
 * Note:
 *   - File generato — non editare a mano le funzioni core serializzate; modificare core o dom.part.
 *   - Rigenerare: npm run sync:jira-issue-display (admin.portal.JiraCORE/jiraCORE.issuedisplay.client.mjs)
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */
(function jiraIssueDisplayModule(global) {

// --- funzioni core — serializzate da cruscotto.jira.issue.display.core.mjs ---
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveJiraPrefix(opts = {}) {
  const explicit = String(opts.jiraPrefix ?? "").trim();

  if (explicit) {
    return explicit;
  }

  const g = typeof globalThis !== "undefined" ? globalThis : {};
  const project = /** @type {{ jiraPrefix?: string } | undefined} */ (
    g.CRUSCOTTO_PROJECT ?? g.__CRUSCOTTO_PROJECT__
  );
  const fromProject = String(project?.jiraPrefix ?? "").trim();

  if (fromProject) {
    return fromProject;
  }

  try {
    return getProjectConfig().PRJ_JIRA_PREFIX;
  } catch {
    return "";
  }
}

function buildJiraLinkChunkRe(jiraPrefix) {
  const prefix = escapeRegExp(String(jiraPrefix ?? resolveJiraPrefix()).trim());

  if (!prefix) {
    throw new Error("buildJiraLinkChunkRe — jiraPrefix mancante");
  }

  return String.raw`(?:<span class="issue-type[^"]*"[^>]*>[\s\S]*?</span>\s*)?<a class="jira-link" href="[^"]*">${prefix}-\d+</a>(?:<span class="issue-summary">[\s\S]*?</span>)?`;
}

function issueTypeShortLabel(type) {
  const t = String(type ?? "").toLowerCase().trim();

  if (!t || t === "—") {
    return null;
  }

  if (t.includes("epic")) {
    return "EPIC";
  }

  if (t.includes("sub-task") || t.includes("subtask")) {
    return "SUB";
  }

  if (t.includes("story")) {
    return "STORY";
  }

  if (t.includes("bug")) {
    return "BUG";
  }

  if (t.includes("todo") || t.includes("to do")) {
    return "TODO";
  }

  return String(type).toUpperCase().replace(/\s+/g, " ").split(" ")[0].slice(0, 8);
}

function issueTypeClass(label) {
  if (label === "EPIC") {
    return "epic";
  }

  if (label === "STORY") {
    return "story";
  }

  if (label === "BUG") {
    return "bug";
  }

  if (label === "SUB") {
    return "sub";
  }

  if (label === "TODO") {
    return "todo";
  }

  return "other";
}

function formatJiraKeyListsInNoteHtml(
  html
, jiraBase = "https://myfuturejobsearch.atlassian.net/browse/"
, opts = {}
) {
  const pretty       = opts.pretty === true;
  const jiraPrefix   = resolveJiraPrefix(opts);
  const prefixEsc  = escapeRegExp(jiraPrefix);
  const chunkPattern = buildJiraLinkChunkRe(jiraPrefix);
  let out            = String(html ?? "");

  const linkRunRe = new RegExp(
    `((?:${chunkPattern})(?:,\\s*(?:${chunkPattern})){1,})`
  , "gi"
  );

  // 1. Chunk HTML già linkati — virgole → <ul class="plan-note-keys-list">
  out = out.replace(linkRunRe, (run) => {
    const chunkRe = new RegExp(chunkPattern, "gi");
    /** @type {string[]} */
    const chunks  = [];
    let match     = chunkRe.exec(run);

    while (match) {
      chunks.push(match[0].trim());
      match = chunkRe.exec(run);
    }

    if (chunks.length < 2) {
      return run;
    }

    const items = chunks.map((chunk) => (
      pretty
        ? `              <li class="sprint-keys-item"><span class="sprint-key-dot" aria-hidden="true">•</span><span class="sprint-key-body">${chunk}</span></li>`
        : `<li class="sprint-keys-item"><span class="sprint-key-dot" aria-hidden="true">•</span><span class="sprint-key-body">${chunk}</span></li>`
    )).join(pretty ? "\n" : "");

    if (pretty) {
      return [
        "            <ul class=\"sprint-keys-list plan-note-keys-list\">"
      , items
      , "            </ul>",
      ].join("\n");
    }

    return `<ul class="sprint-keys-list plan-note-keys-list">${items}</ul>`;
  });

  // 2. Testo plain «ancora aperti: PREFIX-1, PREFIX-2» — key nude → link in elenco
  out = out.replace(
    new RegExp(
      `(\\b(?:ancora aperti|aperti|restano)\\s*:?\\s*)((?:${prefixEsc}-\\d+\\s*(?:,\\s*)?)+)`
    , "gi"
    )
  , (full, prefix, keysPart) => {
    const keys = [...keysPart.matchAll(new RegExp(`${prefixEsc}-\\d+`, "gi"))].map((m) => m[0].toUpperCase());

    if (keys.length < 2) {
      return full;
    }

    const items = keys.map((key) => (
      pretty
        ? `              <li class="sprint-keys-item"><span class="sprint-key-dot" aria-hidden="true">•</span><span class="sprint-key-body"><a class="jira-link" href="${jiraBase}${key}">${key}</a></span></li>`
        : `<li class="sprint-keys-item"><span class="sprint-key-dot" aria-hidden="true">•</span><span class="sprint-key-body"><a class="jira-link" href="${jiraBase}${key}">${key}</a></span></li>`
    )).join(pretty ? "\n" : "");

    if (pretty) {
      return [
        `${prefix}`
      , "            <ul class=\"sprint-keys-list plan-note-keys-list\">"
      , items
      , "            </ul>",
      ].join("\n");
    }

    return `${prefix}<ul class="sprint-keys-list plan-note-keys-list">${items}</ul>`;
  });

  return out;
}

// --- parte DOM — cruscotto.jira.issue.display.client.dom.part.js (testata comcom solo nel sorgente) ---
// --- costanti browse Jira — default cloud se overlay senza jiraBrowseBase ---
  const DEFAULT_JIRA_BROWSE = "https://myfuturejobsearch.atlassian.net/browse/";

  /**
   * Config progetto iniettata dal server (bootstrap o inline script).
   *
   * @returns {Record<string, unknown>}
   */
  function getCruscottoProject() {
    const w = /** @type {Window & { CRUSCOTTO_PROJECT?: Record<string, unknown>, __CRUSCOTTO_PROJECT__?: Record<string, unknown> }} */ (
      typeof window !== "undefined" ? window : globalThis
    );

    return w.CRUSCOTTO_PROJECT ?? w.__CRUSCOTTO_PROJECT__ ?? {};
  }

  /**
   * Prefisso IssueKEY attivo — delega a resolveJiraPrefix del core serializzato.
   *
   * @returns {string}
   */
  function cruscottoJiraPrefix() {
    return resolveJiraPrefix({});
  }

  /**
   * Base URL browse Jira — da overlay o DEFAULT_JIRA_BROWSE.
   *
   * @returns {string}
   */
  function defaultJiraBrowseBase() {
    const fromProject = String(getCruscottoProject().jiraBrowseBase ?? "").trim();

    if (fromProject) {
      return fromProject.endsWith("/") ? fromProject : `${fromProject}/`;
    }

    return DEFAULT_JIRA_BROWSE;
  }

  // --- regex IssueKEY — cache invalidata al cambio prefisso progetto ---
  /** @type {RegExp | null} */
  let jiraKeyReCache = null;
  /** @type {string | null} */
  let jiraKeyRePrefix = null;

  /**
   * Regex IssueKEY-{num} per il prefisso corrente (case-insensitive).
   *
   * @returns {RegExp}
   */
  function jiraKeyRe() {
    const prefix = cruscottoJiraPrefix();

    if (!jiraKeyReCache || jiraKeyRePrefix !== prefix) {
      jiraKeyRePrefix = prefix;
      jiraKeyReCache  = new RegExp(
        `${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-\\d+`
      , "i"
      );
    }

    return jiraKeyReCache;
  }

  /**
   * Fragment href /browse/{PREFIX}- per querySelector su link Jira.
   *
   * @returns {string}
   */
  function jiraBrowseHrefFragment() {
    return `/browse/${cruscottoJiraPrefix()}-`;
  }

  /**
   * Span.issue-type con etichetta breve (EPIC, STORY, …) o null se tipo assente.
   *
   * @param {string} [type]
   * @returns {HTMLSpanElement | null}
   */
  function createIssueTypeBadge(type) {
    const label = issueTypeShortLabel(type);

    if (!label) {
      return null;
    }

    const span = document.createElement("span");
    span.className = `issue-type issue-display-tipo issue-type-${issueTypeClass(label)}`;
    span.title = String(type ?? "");
    span.textContent = label;

    return span;
  }

  // --- cache tipi issue — popolata da setIssueTypeMap o fetchIssueTypeMap ---
  /** @type {Map<string, string> | null} */
  let issueTypeMapCache = null;

  /**
   * Imposta mappa key → issuetype in memoria (Map o plain object).
   *
   * @param {Map<string, string> | Record<string, string> | null} [map]
   */
  function setIssueTypeMap(map) {
    if (!map) {
      issueTypeMapCache = null;
      return;
    }

    issueTypeMapCache = map instanceof Map
      ? map
      : new Map(Object.entries(map));
  }

  /**
   * Tipo issue dalla cache backlog per una key.
   *
   * @param {string} key
   * @returns {string | undefined}
   */
  function issueTypeForKey(key) {
    return issueTypeMapCache?.get(key);
  }

  /**
   * Aggiunge badge + link browse per una IssueKEY in un contenitore DOM.
   *
   * @param {ParentNode} parent
   * @param {string} key
   * @param {string} [type]
   * @param {string} [jiraBase]
   */
  function appendIssueKey(parent, key, type, jiraBase) {
    const base         = jiraBase ?? defaultJiraBrowseBase();
    const resolvedType = type ?? issueTypeForKey(key);
    const badge        = createIssueTypeBadge(resolvedType);

    if (badge) {
      parent.appendChild(badge);
    }

    const link = document.createElement("a");
    link.className = "jira-link";
    link.href      = `${base}${key}`;
    link.target    = "_blank";
    link.rel       = "noopener";
    link.textContent = key;
    parent.appendChild(link);
  }

  /**
   * Estrae IssueKEY da href browse Jira.
   *
   * @param {string} href
   * @returns {string | null}
   */
  function keyFromJiraHref(href) {
    const match = String(href).match(jiraKeyRe());

    return match ? match[0].toUpperCase() : null;
  }

  /**
   * Inserisce badge tipo issue prima dei link Jira già nel DOM (senza duplicare badge).
   *
   * @param {ParentNode} root
   * @param {Record<string, string> | Map<string, string>} [typeByKey]
   */
  function decorateJiraLinks(root, typeByKey) {
    const lookup     = typeByKey instanceof Map
      ? (/** @type {string} */ key) => typeByKey.get(key)
      : (/** @type {string} */ key) => typeByKey?.[key];
    const browseFrag = jiraBrowseHrefFragment();

    // 1. Selettore link — classe jira-link o href con fragment browse prefisso progetto
    for (const link of root.querySelectorAll(`a.jira-link, a[href*="${browseFrag}"]`)) {
      const key = keyFromJiraHref(link.href);

      if (!key) {
        continue;
      }

      const parent = link.parentElement;

      if (!parent) {
        continue;
      }

      // 2. Skip — badge già presente (scope o sibling precedente)
      if (parent.querySelector(":scope > .issue-type")) {
        continue;
      }

      const prev = link.previousElementSibling;

      if (prev?.classList?.contains("issue-type")) {
        continue;
      }

      const type = lookup?.(key);

      if (!type) {
        continue;
      }

      const badge = createIssueTypeBadge(type);

      if (badge) {
        parent.insertBefore(badge, link);
      }
    }
  }

  /**
   * Scarica backlog same-origin e costruisce mappa key → issuetype.
   *
   * @returns {Promise<Map<string, string>>}
   */
  async function fetchIssueTypeMap() {
    // 1. Fetch backlog — errori HTTP propagati al chiamante
    const res = await fetch("/api/jira/backlog");

    if (!res.ok) {
      throw new Error(`Backlog API → ${res.status}`);
    }

    const data = await res.json();
    /** @type {Map<string, string>} */
    const map = new Map();

    // 2. Indicizza issues con key e type valorizzati
    for (const row of data.issues ?? []) {
      if (row?.key && row?.type) {
        map.set(row.key, row.type);
      }
    }

    setIssueTypeMap(map);

    return map;
  }

  /**
   * Decorazione link con tipi da API — tollera dashboard offline (catch silenzioso).
   *
   * @param {ParentNode} [root]
   */
  async function decorateJiraLinksFromApi(root = document) {
    try {
      const typeByKey = await fetchIssueTypeMap();
      decorateJiraLinks(root, typeByKey);
    } catch {
      /* dashboard offline — badge solo dove già in HTML */
    }
  }

  /**
   * Trasforma virgole IssueKEY in elenco puntato dentro le celle .plan-note.
   *
   * @param {ParentNode} [root]
   * @param {string} [jiraBase]
   */
  function decoratePlanNoteKeyLists(root = document, jiraBase) {
    const base   = jiraBase ?? defaultJiraBrowseBase();
    const prefix = cruscottoJiraPrefix();

    // 1. Ogni .plan-note senza lista già formattata
    for (const note of root.querySelectorAll(".plan-note")) {
      if (note.querySelector(".plan-note-keys-list")) {
        continue;
      }

      const labelEl   = note.querySelector(".nota-label");
      const labelHtml = labelEl?.outerHTML ?? "";
      const rest      = note.innerHTML.replace(labelHtml, "").trim();

      // 2. Delega al core — pretty indent e prefisso progetto
      const formatted = formatJiraKeyListsInNoteHtml(rest, base, { jiraPrefix: prefix });

      if (formatted !== rest) {
        note.innerHTML = labelHtml ? `${labelHtml} ${formatted}` : formatted;
      }
    }
  }


  // --- export globale — API window.JiraIssueDisplay per pagine HTML ---
  global.JiraIssueDisplay = {
    issueTypeShortLabel,
    issueTypeClass,
    resolveJiraPrefix,
    buildJiraLinkChunkRe,
    cruscottoJiraPrefix,
    defaultJiraBrowseBase,
    createIssueTypeBadge,
    appendIssueKey,
    setIssueTypeMap,
    issueTypeForKey,
    decorateJiraLinks,
    decorateJiraLinksFromApi,
    decoratePlanNoteKeyLists,
    formatJiraKeyListsInNoteHtml,
    fetchIssueTypeMap,
  };
}(typeof window !== "undefined" ? window : globalThis));
