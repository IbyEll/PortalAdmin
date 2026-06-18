  /**
   * ------------------------------------------------------------------------------------------------------------------------
   * ** PAGE SCRIPT ** -- commentato il: 2026-06-18 05:57
   * ------------------------------------------------------------------------------------------------------------------------
   * creato     il: 2026-06-18 05:57   by: IbyEll
   * modificato il: 2026-06-18 05:57   by: IbyEll
   * ------------------------------------------------------------------------------------------------------------------------
   *
   * ************************************************************************************************************************
   *                      Parte DOM JiraIssueDisplay — badge, link IssueKEY e note piano (bundle IIFE)
   * ************************************************************************************************************************
   *
   * Descrizione funzionale:
   *
   *   Perché esiste:
   *   - Le funzioni che toccano document e fetch non stanno nel core ESM Node condiviso col server HTML.
   *   - Permette di estendere JiraIssueDisplay lato browser senza rigenerare il core a ogni tweak DOM.
   *
   *   A cosa serve:
   *   - Crea badge EPIC/STORY/SUB/BUG/TODO accanto ai link IssueKEY e decora link già presenti nel DOM.
   *   - Carica tipi da GET /api/jira/backlog e formatta elenchi key nelle celle .plan-note.
   *
   * Generalizzazione:
   *   Si — prefisso IssueKEY e URL browse da window.CRUSCOTTO_PROJECT (overlay PRJ_JIRA_PREFIX).
   *
   * Input:
   *   - window.CRUSCOTTO_PROJECT / __CRUSCOTTO_PROJECT__ — jiraPrefix, jiraBrowseBase opzionale
   *   - GET /api/jira/backlog — mappa key → issuetype (decorateJiraLinksFromApi)
   *   - jiraBase — argomento opzionale; default da progetto o sito Atlassian
   *   - issueTypeShortLabel, issueTypeClass, formatJiraKeyListsInNoteHtml, resolveJiraPrefix — core IIFE
   *
   * Consumatori:
   *   - admin.portal.JiraCORE/jiraCORE.issuedisplay.client.mjs — concatena nel bundle browser
   *   - cruscotto.frontend/cruscotto.jira.issue.display.client.js — output IIFE window.JiraIssueDisplay
   *
   * Pagina HTML:
   *   - cruscotto.jira.backlog.html, cruscotto.jira.working.html, pillar matrix, my-project, …
   *
   * Servito da:
   *   - cruscotto.frontend/cruscotto.server.mjs — alias statico /jira-issue-display.js (bundle generato)
   *
   * Asset correlati:
   *   - cruscotto.jira.issue.display.core.mjs — funzioni serializzate nello scope IIFE
   *   - cruscotto.jira.issue.display.css — classi issue-type-* emesse dai badge
   *
   * API (fetch same-origin):
   *   - GET /api/jira/backlog — mappa key → issuetype per decorateJiraLinksFromApi
   *
   * Dipendenze runtime:
   *   - window.JiraIssueDisplay — export globale dopo caricamento script tag
   *   - elementi a.jira-link, .plan-note — markup pagine cruscotto Jira
   *
   * Note:
   *   - Non servito direttamente: fragment concatenato nel bundle IIFE (testata omessa nell’output).
   *   - Dopo modifica: npm run sync:jira-issue-display
   *
   * ------------------------------------------------------------------------------------------------------------------------
   */

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
    span.className = `issue-type issue-type-${issueTypeClass(label)}`;
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
