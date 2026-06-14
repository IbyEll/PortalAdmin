/**
 * Etichette compatte tipo issue Jira (EPIC, STORY, SUB, BUG, TODO) — server HTML.
 */

/**
 * @param {string} raw
 */
function escapeHtml(raw) {
  return String(raw)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {string} [type]
 * @returns {string | null}
 */
export function issueTypeShortLabel(type) {
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
export function issueTypeClass(label) {
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
 * @returns {string}
 */
export function issueTypeBadgeHtml(type) {
  const label = issueTypeShortLabel(type);

  if (!label) {
    return "";
  }

  const cls = issueTypeClass(label);

  return `<span class="issue-type issue-type-${cls}" title="${escapeHtml(type ?? "")}">${escapeHtml(label)}</span>`;
}

/**
 * @param {string} key
 * @param {string} [summary]
 * @param {string} [type]
 * @param {string} [jiraBase]
 * @returns {string}
 */
export function jiraLinkHtml(key, summary, type, jiraBase = "https://myfuturejobsearch.atlassian.net/browse/") {
  const typeHtml    = issueTypeBadgeHtml(type);
  const summaryHtml = summary
    ? `<span class="issue-summary"> — ${escapeHtml(summary)}</span>`
    : "";

  return `${typeHtml}<a class="jira-link" href="${jiraBase}${escapeHtml(key)}">${escapeHtml(key)}</a>${summaryHtml}`;
}

const JIRA_LINK_CHUNK_RE = String.raw`(?:<span class="issue-type[^"]*"[^>]*>[\s\S]*?</span>\s*)?<a class="jira-link" href="[^"]*">JLO-\d+</a>(?:<span class="issue-summary">[\s\S]*?</span>)?`;

/**
 * Trasforma sequenze di link Jira separati da virgola in elenco puntato (note piano).
 *
 * @param {string} html
 * @param {string} [jiraBase]
 */
export function formatJiraKeyListsInNoteHtml(html, jiraBase = "https://myfuturejobsearch.atlassian.net/browse/") {
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
      `              <li class="sprint-keys-item"><span class="sprint-key-dot" aria-hidden="true">•</span><span class="sprint-key-body">${chunk}</span></li>`
    )).join("\n");

    return [
      "            <ul class=\"sprint-keys-list plan-note-keys-list\">"
    , items
    , "            </ul>",
    ].join("\n");
  });

  out = out.replace(
    /(\b(?:ancora aperti|aperti|restano)\s*:?\s*)((?:JLO-\d+\s*(?:,\s*)?)+)/gi
  , (full, prefix, keysPart) => {
    const keys = [...keysPart.matchAll(/JLO-\d+/gi)].map((m) => m[0].toUpperCase());

    if (keys.length < 2) {
      return full;
    }

    const items = keys.map((key) => (
      `              <li class="sprint-keys-item"><span class="sprint-key-dot" aria-hidden="true">•</span><span class="sprint-key-body"><a class="jira-link" href="${jiraBase}${key}">${key}</a></span></li>`
    )).join("\n");

    return [
      `${prefix}`
    , "            <ul class=\"sprint-keys-list plan-note-keys-list\">"
    , items
    , "            </ul>",
    ].join("\n");
  });

  return out;
}
