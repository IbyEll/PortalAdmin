/**
 * Etichette compatte tipo issue Jira — mirror client di lib/jira-issue-display.mjs
 */
(function jiraIssueDisplayModule(global) {
  /**
   * @param {string} [type]
   * @returns {string | null}
   */
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

  /**
   * @param {string | null} label
   * @returns {string}
   */
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

  /**
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

  /** @type {Map<string, string> | null} */
  let issueTypeMapCache = null;

  /**
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
   * @param {string} key
   * @returns {string | undefined}
   */
  function issueTypeForKey(key) {
    return issueTypeMapCache?.get(key);
  }

  /**
   * @param {ParentNode} parent
   * @param {string} key
   * @param {string} [type]
   * @param {string} [jiraBase]
   */
  function appendIssueKey(parent, key, type, jiraBase = "https://myfuturejobsearch.atlassian.net/browse/") {
    const resolvedType = type ?? issueTypeForKey(key);
    const badge        = createIssueTypeBadge(resolvedType);

    if (badge) {
      parent.appendChild(badge);
    }

    const link = document.createElement("a");
    link.className = "jira-link";
    link.href      = `${jiraBase}${key}`;
    link.target    = "_blank";
    link.rel       = "noopener";
    link.textContent = key;
    parent.appendChild(link);
  }

  /**
   * @param {string} href
   * @returns {string | null}
   */
  function keyFromJiraHref(href) {
    const match = String(href).match(/JLO-\d+/i);

    return match ? match[0].toUpperCase() : null;
  }

  /**
   * @param {ParentNode} root
   * @param {Record<string, string> | Map<string, string>} [typeByKey]
   */
  function decorateJiraLinks(root, typeByKey) {
    const lookup = typeByKey instanceof Map
      ? (/** @type {string} */ key) => typeByKey.get(key)
      : (/** @type {string} */ key) => typeByKey?.[key];

    for (const link of root.querySelectorAll('a.jira-link, a[href*="/browse/JLO-"]')) {
      const key = keyFromJiraHref(link.href);

      if (!key) {
        continue;
      }

      const parent = link.parentElement;

      if (!parent) {
        continue;
      }

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
   * @returns {Promise<Map<string, string>>}
   */
  async function fetchIssueTypeMap() {
    const res = await fetch("/api/jira/backlog");

    if (!res.ok) {
      throw new Error(`Backlog API → ${res.status}`);
    }

    const data = await res.json();
    /** @type {Map<string, string>} */
    const map = new Map();

    for (const row of data.issues ?? []) {
      if (row?.key && row?.type) {
        map.set(row.key, row.type);
      }
    }

    setIssueTypeMap(map);

    return map;
  }

  /**
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

  const JIRA_LINK_CHUNK_RE = String.raw`(?:<span class="issue-type[^"]*"[^>]*>[\s\S]*?</span>\s*)?<a class="jira-link" href="[^"]*">JLO-\d+</a>(?:<span class="issue-summary">[\s\S]*?</span>)?`;

  /**
   * @param {string} html
   * @param {string} [jiraBase]
   */
  function formatJiraKeyListsInNoteHtml(html, jiraBase = "https://myfuturejobsearch.atlassian.net/browse/") {
    let out = String(html ?? "");

    const linkRunRe = new RegExp(
      `((?:${JIRA_LINK_CHUNK_RE})(?:,\\s*(?:${JIRA_LINK_CHUNK_RE})){1,})`,
      "gi"
    );

    out = out.replace(linkRunRe, (run) => {
      const chunkRe = new RegExp(JIRA_LINK_CHUNK_RE, "gi");
      /** @type {string[]} */
      const chunks = [];
      let match     = chunkRe.exec(run);

      while (match) {
        chunks.push(match[0].trim());
        match = chunkRe.exec(run);
      }

      if (chunks.length < 2) {
        return run;
      }

      const items = chunks.map((chunk) => (
        `<li class="sprint-keys-item"><span class="sprint-key-dot" aria-hidden="true">•</span><span class="sprint-key-body">${chunk}</span></li>`
      )).join("");

      return `<ul class="sprint-keys-list plan-note-keys-list">${items}</ul>`;
    });

    out = out.replace(
      /(\b(?:ancora aperti|aperti|restano)\s*:?\s*)((?:JLO-\d+\s*(?:,\s*)?)+)/gi
    , (full, prefix, keysPart) => {
      const keys = [...keysPart.matchAll(/JLO-\d+/gi)].map((m) => m[0].toUpperCase());

      if (keys.length < 2) {
        return full;
      }

      const items = keys.map((key) => (
        `<li class="sprint-keys-item"><span class="sprint-key-dot" aria-hidden="true">•</span><span class="sprint-key-body"><a class="jira-link" href="${jiraBase}${key}">${key}</a></span></li>`
      )).join("");

      return `${prefix}<ul class="sprint-keys-list plan-note-keys-list">${items}</ul>`;
    });

    return out;
  }

  /**
   * @param {ParentNode} [root]
   * @param {string} [jiraBase]
   */
  function decoratePlanNoteKeyLists(root = document, jiraBase = "https://myfuturejobsearch.atlassian.net/browse/") {
    for (const note of root.querySelectorAll(".plan-note")) {
      if (note.querySelector(".plan-note-keys-list")) {
        continue;
      }

      const labelEl = note.querySelector(".nota-label");
      const labelHtml = labelEl?.outerHTML ?? "";
      const rest = note.innerHTML.replace(labelHtml, "").trim();
      const formatted = formatJiraKeyListsInNoteHtml(rest, jiraBase);

      if (formatted !== rest) {
        note.innerHTML = labelHtml ? `${labelHtml} ${formatted}` : formatted;
      }
    }
  }

  global.JiraIssueDisplay = {
    issueTypeShortLabel,
    issueTypeClass,
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
