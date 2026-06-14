/**
 * Estrae ticket JLO correlati da descrizione Jira (sezione «Ticket correlati») e issue link.
 */

const JLO_KEY_RE = /\bJLO-\d+\b/gi;

/**
 * @param {unknown} node
 * @returns {string}
 */
function adfNodeText(node) {
  if (!node || typeof node !== "object") {
    return "";
  }

  /** @type {{ type?: string, text?: string, attrs?: { url?: string }, content?: unknown[] }} */
  const n = node;

  if (n.type === "text") {
    return n.text ?? "";
  }

  if (n.type === "inlineCard" && n.attrs?.url) {
    const match = String(n.attrs.url).match(JLO_KEY_RE);

    return match ? match[0].toUpperCase() : "";
  }

  if (n.type === "hardBreak") {
    return "\n";
  }

  return (n.content ?? []).map(adfNodeText).join("");
}

/**
 * @param {unknown} adf
 * @returns {string}
 */
export function adfToPlainText(adf) {
  if (!adf || typeof adf !== "object") {
    return "";
  }

  /** @type {{ content?: unknown[] }} */
  const doc = adf;

  return (doc.content ?? [])
    .map((block) => adfNodeText(block))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * @param {string} text
 * @param {string} [excludeKey]
 * @returns {string[]}
 */
export function extractJloKeysFromText(text, excludeKey) {
  const exclude = excludeKey?.toUpperCase();
  /** @type {Set<string>} */
  const keys = new Set();

  for (const match of String(text).matchAll(JLO_KEY_RE)) {
    const key = match[0].toUpperCase();

    if (key !== exclude) {
      keys.add(key);
    }
  }

  return [...keys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * Sezione markdown/ADF «## Ticket correlati» (o varianti) nella description.
 *
 * @param {unknown} description
 * @param {string} [issueKey]
 * @returns {string[]}
 */
export function extractRelatedKeysFromDescription(description, issueKey) {
  if (!description || typeof description !== "object") {
    return [];
  }

  /** @type {{ content?: Array<{ type?: string, attrs?: { level?: number }, content?: unknown[] }> }} */
  const doc = description;
  const blocks = doc.content ?? [];
  let inSection = false;
  /** @type {string[]} */
  const sectionParts = [];

  for (const block of blocks) {
    if (block.type === "heading") {
      const heading = adfNodeText(block).trim();

      if (/ticket\s*correlati/i.test(heading)) {
        inSection = true;
        continue;
      }

      if (inSection) {
        break;
      }

      continue;
    }

    if (inSection) {
      sectionParts.push(adfNodeText(block));
    }
  }

  if (!sectionParts.length) {
    return [];
  }

  return extractJloKeysFromText(sectionParts.join("\n"), issueKey);
}

/**
 * @param {Array<{ inwardIssue?: { key?: string }, outwardIssue?: { key?: string } }> | null | undefined} issueLinks
 * @param {string} [issueKey]
 * @returns {string[]}
 */
export function extractRelatedKeysFromIssueLinks(issueLinks, issueKey) {
  const exclude = issueKey?.toUpperCase();
  /** @type {Set<string>} */
  const keys = new Set();

  for (const link of issueLinks ?? []) {
    for (const side of ["inwardIssue", "outwardIssue"]) {
      const key = link[side]?.key?.toUpperCase();

      if (key && key !== exclude) {
        keys.add(key);
      }
    }
  }

  return [...keys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * @param {string} issueKey
 * @param {unknown} description
 * @param {Array<{ inwardIssue?: { key?: string }, outwardIssue?: { key?: string } }> | null | undefined} issueLinks
 * @returns {string[]}
 */
export function resolveRelatedTicketKeys(issueKey, description, issueLinks) {
  /** @type {Set<string>} */
  const keys = new Set([
    ...extractRelatedKeysFromDescription(description, issueKey)
  , ...extractRelatedKeysFromIssueLinks(issueLinks, issueKey)
  ]);

  return [...keys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
