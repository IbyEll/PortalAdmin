/**
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-17
 *
 * Core badge/link Jira — etichette tipo issue e formattazione HTML note piano.
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Server (HTML stringhe) e browser (IIFE client) devono condividere la stessa logica
 *     per EPIC/STORY/SUB/BUG/TODO senza copiare regex e mapping a mano.
 *   - Unica fonte serializzata in cruscotto.jira.issue.display.client.js via jiraCORE.issuedisplay.client.mjs.
 *
 *   A cosa serve:
 *   - Normalizza issuetype Jira in etichette brevi e classi CSS, trasforma elenchi IssueKEY
 *     nelle note piano in <ul class="plan-note-keys-list">.
 *
 * Generalizzazione:
 *   Si — issuetype Jira generico; regex chunk link riusabile; nessun hardcode progetto nel mapping tipo.
 *
 * Input:
 *   - type — issuetype Jira passato dai consumer (badge/link)
 *   - html — stringa note piano per formatJiraKeyListsInNoteHtml
 *   - opts.jiraPrefix — override; altrimenti CRUSCOTTO_PROJECT o JLO
 *   - pretty — flag indent opzionale nel formatter
 *
 * Consumatori:
 *   - cruscotto.jira.issue.display.mjs — badge HTML server-side
 *   - admin.portal.JiraCORE/jiraCORE.issuedisplay.client.mjs — .toString() nel bundle browser
 *   - cruscotto.jira.issue.display.client.dom.part.js — funzioni DOM nello scope IIFE
 *
 * Export principali:
 *   - buildJiraLinkChunkRe — pattern chunk link per prefisso IssueKEY
 *   - resolveJiraPrefix — prefisso da opts o window.CRUSCOTTO_PROJECT
 *   - issueTypeShortLabel — EPIC | STORY | SUB | BUG | TODO | abbreviazione
 *   - issueTypeClass — slug CSS issue-type-*
 *   - formatJiraKeyListsInNoteHtml — virgole IssueKEY → elenco puntato HTML
 */

/**
 * @param {string} value
 * @returns {string}
 */
export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Prefisso IssueKEY — opts.jiraPrefix, poi window.CRUSCOTTO_PROJECT, fallback JLO.
 *
 * @param {{ jiraPrefix?: string }} [opts]
 * @returns {string}
 */
export function resolveJiraPrefix(opts = {}) {
  const explicit = String(opts.jiraPrefix ?? "").trim();

  if (explicit) {
    return explicit;
  }

  const g = typeof globalThis !== "undefined" ? globalThis : {};
  const project = /** @type {{ jiraPrefix?: string } | undefined} */ (
    g.CRUSCOTTO_PROJECT ?? g.__CRUSCOTTO_PROJECT__
  );
  const fromProject = String(project?.jiraPrefix ?? "").trim();

  return fromProject || "JLO";
}

/**
 * Regex chunk link Jira nelle note piano (badge tipo + link + summary opzionale).
 *
 * @param {string} [jiraPrefix]
 * @returns {string}
 */
export function buildJiraLinkChunkRe(jiraPrefix = "JLO") {
  const prefix = escapeRegExp(String(jiraPrefix).trim() || "JLO");

  return String.raw`(?:<span class="issue-type[^"]*"[^>]*>[\s\S]*?</span>\s*)?<a class="jira-link" href="[^"]*">${prefix}-\d+</a>(?:<span class="issue-summary">[\s\S]*?</span>)?`;
}

/** Regex chunk link Jira — default prefisso JLO (retrocompat). */
export const JIRA_LINK_CHUNK_RE = buildJiraLinkChunkRe("JLO");

/**
 * Etichetta compatta per badge da issuetype Jira (o null se assente).
 *
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
 * Slug CSS per issue-type-{class} da etichetta breve.
 *
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
 * Trasforma sequenze di link Jira separati da virgola in elenco puntato (note piano).
 *
 * @param {string} html
 * @param {string} [jiraBase]
 * @param {{ pretty?: boolean, jiraPrefix?: string }} [opts]
 */
export function formatJiraKeyListsInNoteHtml(
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
