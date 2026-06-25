/**
 * Vista issue Jira — fetch live dettaglio per key (ADMIN-*, JLO-*).
 */

import { getProjectConfig } from "../lib/project.config.mjs";
import { isJiraStatusDone } from "./cruscotto.jira.backlog.mjs";
import { adfToPlainText } from "../admin.portal.JiraCORE/jiraCORE.backlog.related.tickets.mjs";
import { jiraLiveFetch } from "../admin.portal.JiraCORE/jiraCORE.jira.live.mjs";
import { openCruscottoDb, cruscottoDbFileExists } from "../cruscotto.database/cruscotto.db.config.mjs";
import { fetchWipAdvancementForIssue, buildWipAdvancementEntry } from "./cruscotto.jira.wip.mjs";
import { hasWorkflowAdvancementData, parseWorkflowRawFields } from "../lib/jira.issue.workflow.raw.mjs";

const JIRA_BROWSE_BASE = "https://myfuturejobsearch.atlassian.net/browse";
const JIRA_SPRINT_FIELD = "customfield_10020";
const ISSUE_KEY_RE = /^(ADMIN|JLO)-\d+$/i;

const ISSUE_DETAIL_FIELDS = [
  "summary"
, "description"
, "status"
, "issuetype"
, "parent"
, "labels"
, "assignee"
, "reporter"
, "created"
, "updated"
, "issuelinks"
, "subtasks"
, JIRA_SPRINT_FIELD
].join(",");

/**
 * @param {string} raw
 * @returns {string}
 */
export function normalizeIssueKey(raw) {
  return String(raw ?? "").trim().toUpperCase();
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
export function isValidIssueKey(raw) {
  return ISSUE_KEY_RE.test(normalizeIssueKey(raw));
}

/**
 * @param {string} html
 * @returns {string}
 */
export function rewriteJiraBrowseLinksInHtml(html) {
  return String(html ?? "")
    .replace(
      /href="https:\/\/myfuturejobsearch\.atlassian\.net\/browse\/((?:ADMIN|JLO)-\d+)"/gi
    , 'href="?key=$1"'
    )
    .replace(/href="\/browse\/((?:ADMIN|JLO)-\d+)"/gi, 'href="?key=$1"');
}

/**
 * HTML description da Jira renderedFields (come browse Atlassian).
 *
 * @param {unknown} renderedFields
 * @returns {string}
 */
export function descriptionHtmlFromRenderedFields(renderedFields) {
  const raw = /** @type {{ description?: string }} */ (renderedFields ?? {}).description;

  if (!raw || typeof raw !== "string") {
    return "";
  }

  return rewriteJiraBrowseLinksInHtml(raw.trim());
}

/**
 * Testo cella tabella Jira — strip tag e entity comuni.
 *
 * @param {string} html
 * @returns {string}
 */
function stripTableCellText(html) {
  return String(html ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8212;/g, "—")
    .replace(/&mdash;/g, "—")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Esito Stato repo non contemplato (⬜, N/A, trattino, vuoto).
 *
 * @param {string} esitoHtml
 * @returns {boolean}
 */
export function isStatoRepoEsitoNa(esitoHtml) {
  const text = stripTableCellText(esitoHtml);

  if (!text || text === "—" || text === "-") {
    return true;
  }

  if (text === "⬜" || /^n\/?a$/i.test(text)) {
    return true;
  }

  return !(/✅|⚠️|❌/.test(text));
}

/**
 * Estrae righe da blocchi table-wrap Jira (una riga per tabella).
 *
 * @param {string} blockHtml
 * @returns {string[][]}
 */
function extractTableWrapRows(blockHtml) {
  /** @type {string[][]} */
  const rows = [];
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRe.exec(blockHtml)) !== null) {
    /** @type {string[]} */
    const cells = [];
    const cellRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    let cellMatch;

    while ((cellMatch = cellRe.exec(trMatch[1])) !== null) {
      cells.push(cellMatch[1].trim());
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return rows;
}

const TABLE_WRAP_RE = /<div class=['"]table-wrap['"]>[\s\S]*?<\/div>\s*/gi;

/**
 * @param {string} src
 * @param {RegExp | string} titlePattern
 * @returns {{ sectionStart: number, sectionEnd: number, section: string } | null}
 */
function findH2SectionBounds(src, titlePattern) {
  const pattern = typeof titlePattern === "string" ? titlePattern : titlePattern.source;
  const h2Re    = new RegExp(`<h2[^>]*>[\\s\\S]*?${pattern}[\\s\\S]*?<\\/h2>`, "i");
  const h2Match = src.match(h2Re);

  if (!h2Match || h2Match.index === undefined) {
    return null;
  }

  const sectionStart = h2Match.index + h2Match[0].length;
  const tail         = src.slice(sectionStart);
  const nextH2       = tail.search(/<h2[\s>]/i);
  const sectionEnd   = nextH2 === -1 ? src.length : sectionStart + nextH2;

  return {
    sectionStart
  , sectionEnd
  , section: src.slice(sectionStart, sectionEnd)
  };
}

/**
 * @param {string[][]} cellsList
 * @returns {boolean}
 */
function isDashOnlyRow(cellsList) {
  return cellsList.every((cell) => {
    const text = stripTableCellText(cell);

    return !text || text === "—" || text === "-";
  });
}

/**
 * @param {string[][]} cells
 * @returns {boolean}
 */
function isTableHeaderRow(cells) {
  const texts = cells.map((cell) => stripTableCellText(cell));

  if (texts.some((t) => /^area$/i.test(t))) {
    return true;
  }

  if (texts.some((t) => /^key$/i.test(t))) {
    return true;
  }

  if (texts.some((t) => /^esito$/i.test(t))) {
    return true;
  }

  return texts.some((t) => /^#$/i.test(t))
    && texts.some((t) => /^summary$/i.test(t));
}

/**
 * Unisce table-wrap spezzati in una sezione h2 e sostituisce il blocco nel documento.
 *
 * @param {string} html
 * @param {RegExp | string} sectionTitle
 * @param {{
 *   tableClass?: string
 *   colClassPrefix?: string
 *   shouldKeepRow?: (cells: string[]) => boolean
 *   emptyFallback?: (allRows: string[][], removedRows: string[][]) => string | null
 * }} [opts]
 * @returns {string}
 */
function normalizeH2SectionSplitTables(html, sectionTitle, opts = {}) {
  const src    = String(html ?? "");
  const bounds = findH2SectionBounds(src, sectionTitle);

  if (!bounds) {
    return src;
  }

  const wraps = [...bounds.section.matchAll(TABLE_WRAP_RE)];

  if (wraps.length === 0) {
    return src;
  }

  if (wraps.length === 1) {
    const singleRows = extractTableWrapRows(wraps[0][0]);

    if (singleRows.length > 1) {
      return src;
    }
  }

  /** @type {string[][]} */
  const allRows = [];

  for (const wrap of wraps) {
    allRows.push(...extractTableWrapRows(wrap[0]));
  }

  /** @type {string[]} */
  let headerCells = [];
  /** @type {string[][]} */
  const kept      = [];
  /** @type {string[][]} */
  const removed   = [];

  for (const cells of allRows) {
    if (isTableHeaderRow(cells)) {
      headerCells = cells.map((cell) => stripTableCellText(cell));
      continue;
    }

    if (opts.shouldKeepRow && !opts.shouldKeepRow(cells)) {
      removed.push(cells);
      continue;
    }

    kept.push(cells);
  }

  const tableClass    = opts.tableClass ?? "jira-merged-table";
  const colClassPrefix = opts.colClassPrefix ?? "jira-merged-col";

  let mergedBlock = "";

  if (kept.length > 0) {
    if (headerCells.length === 0 && kept[0]) {
      headerCells = kept[0].map((_, index) => `Col ${index + 1}`);
    }

    const headerHtml = headerCells
      .map((label) => `<th scope="col">${label}</th>`)
      .join("");

    const bodyHtml = kept
      .map((cells) => {
        const tds = cells.map((cell, index) => {
          const cls = `${colClassPrefix}-${index + 1}`;

          return `<td class="${cls}">${cell}</td>`;
        }).join("");

        return `  <tr>${tds}</tr>`;
      })
      .join("\n");

    mergedBlock = [
      `<div class="table-wrap ${tableClass}-wrap">`
    , `<table class="confluenceTable ${tableClass}">`
    , `<thead><tr>${headerHtml}</tr></thead>`
    , "<tbody>"
    , bodyHtml
    , "</tbody></table></div>"
    ].join("\n");
  } else if (opts.emptyFallback) {
    mergedBlock = opts.emptyFallback(allRows, removed) ?? "";
  }

  const firstWrap  = wraps[0];
  const lastWrap   = wraps[wraps.length - 1];
  const before     = bounds.section.slice(0, firstWrap.index ?? 0);
  const afterStart = (lastWrap.index ?? 0) + lastWrap[0].length;
  const after      = bounds.section.slice(afterStart);
  const newSection = `${before}${mergedBlock}${after}`;

  return `${src.slice(0, bounds.sectionStart)}${newSection}${src.slice(bounds.sectionEnd)}`;
}

/**
 * @param {string[][]} cells
 * @returns {boolean}
 */
function isOrdineSubtaskPlaceholderRow(cells) {
  if (isDashOnlyRow(cells)) {
    return true;
  }

  const keyText = stripTableCellText(cells[1] ?? "");

  if (/^(ADMIN|JLO)-\d+$/i.test(keyText)) {
    return false;
  }

  const summaryText = stripTableCellText(cells[cells.length - 1] ?? "");

  return /nessun subtask/i.test(summaryText);
}

/**
 * Jira ADF→HTML spezza ogni riga Stato repo in un table-wrap separato → colonne disallineate.
 * Unifica in una tabella e omette righe con esito non contemplato (⬜ / N/A).
 *
 * @param {string} html
 * @returns {string}
 */
export function normalizeStatoRepoTables(html) {
  return normalizeH2SectionSplitTables(html, "Stato repo", {
    tableClass     : "stato-repo-table"
  , colClassPrefix : "stato-repo"
  , shouldKeepRow(cells) {
      if (cells.length < 2) {
        return false;
      }

      const areaText = stripTableCellText(cells[0]);

      if (!areaText || areaText === "—") {
        return false;
      }

      return !isStatoRepoEsitoNa(cells[1]);
    }
  });
}

/**
 * Unifica tabella Ordine subtask spezzata da Jira; omette righe placeholder (— / nessun subtask).
 *
 * @param {string} html
 * @returns {string}
 */
export function normalizeOrdineSubtaskTables(html) {
  return normalizeH2SectionSplitTables(html, "Ordine subtask", {
    tableClass     : "ordine-subtask-table"
  , colClassPrefix : "ordine-subtask"
  , shouldKeepRow(cells) {
      return !isOrdineSubtaskPlaceholderRow(cells);
    }
  , emptyFallback(_allRows, removed) {
      const placeholder = removed.find((cells) => !isDashOnlyRow(cells));

      if (!placeholder) {
        return null;
      }

      const note = placeholder[placeholder.length - 1] ?? "";

      return `<p class="veve-empty-note"><em>${note}</em></p>`;
    }
  });
}

/**
 * Unisce tutte le sequenze di table-wrap a riga singola nel documento (sezioni veve residue).
 *
 * @param {string} html
 * @returns {string}
 */
export function normalizeRemainingSplitTables(html) {
  let out   = String(html ?? "");
  let match = null;
  const re  = new RegExp(
    /(?:<div class=['"]table-wrap['"]>[\s\S]*?<\/div>\s*){2,}/.source
  , "gi"
  );

  while ((match = re.exec(out)) !== null) {
    const sequence = match[0];
    const wraps    = [...sequence.matchAll(/<div class=['"]table-wrap['"]>[\s\S]*?<\/div>/gi)];

    if (wraps.some((wrap) => extractTableWrapRows(wrap[0]).length > 1)) {
      continue;
    }

    /** @type {string[][]} */
    const rows = [];

    for (const wrap of wraps) {
      rows.push(...extractTableWrapRows(wrap[0]));
    }

    if (rows.length < 2) {
      continue;
    }

    /** @type {string[]} */
    let headerCells = [];
    /** @type {string[][]} */
    const bodyRows    = [];

    for (const cells of rows) {
      if (isTableHeaderRow(cells)) {
        headerCells = cells.map((cell) => stripTableCellText(cell));
        continue;
      }

      if (!isDashOnlyRow(cells)) {
        bodyRows.push(cells);
      }
    }

    if (bodyRows.length === 0) {
      continue;
    }

    if (headerCells.length === 0) {
      headerCells = bodyRows[0].map((_, index) => `Col ${index + 1}`);
    }

    const merged = [
      '<div class="table-wrap jira-merged-table-wrap">'
    , '<table class="confluenceTable jira-merged-table">'
    , `<thead><tr>${headerCells.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead>`
    , "<tbody>"
    , bodyRows.map((cells) => (
        `  <tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`
      )).join("\n")
    , "</tbody></table></div>"
    ].join("\n");

    out = `${out.slice(0, match.index)}${merged}${out.slice(match.index + sequence.length)}`;
    re.lastIndex = match.index + merged.length;
  }

  return out;
}

/**
 * Badge esito Stato repo veve — ⬜ su tema scuro è invisibile; uniforma legenda.
 *
 * @param {string} html
 * @returns {string}
 */
export function enhanceVeveDescriptionHtml(html) {
  let out = normalizeStatoRepoTables(String(html ?? ""));
  out = normalizeOrdineSubtaskTables(out);
  out = normalizeRemainingSplitTables(out);

  out = out
    .replace(/✅/g, '<span class="repo-esito repo-esito-ok" title="implementato">✅</span>')
    .replace(/⚠️/g, '<span class="repo-esito repo-esito-warn" title="parziale/stub">⚠️</span>')
    .replace(/❌/g, '<span class="repo-esito repo-esito-miss" title="assente">❌</span>')
    .replace(/⬜/g, '<span class="repo-esito repo-esito-na" title="N/A">N/A</span>');

  return out;
}

/**
 * @param {unknown} user
 * @returns {string | null}
 */
function formatJiraUser(user) {
  if (!user || typeof user !== "object") {
    return null;
  }

  const row = /** @type {{ displayName?: string }} */ (user);

  return row.displayName?.trim() || null;
}

/**
 * @param {string} key
 * @returns {Promise<import("./cruscotto.jira.wip.mjs").WipAdvancementEntry | null>}
 */
async function loadWipAdvancement(key) {
  if (!cruscottoDbFileExists()) {
    return null;
  }

  return fetchWipAdvancementForIssue(key).catch(() => null);
}

/**
 * @param {string} issueKey
 * @returns {Promise<{
 *   key: string
 *   summary: string
 *   status: string
 *   statusCategory: string
 *   done: boolean
 *   issueType: string
 *   parentKey: string | null
 *   parentSummary: string | null
 *   labels: string[]
 *   assignee: string | null
 *   reporter: string | null
 *   created: string | null
 *   updated: string | null
 *   descriptionText: string
 *   descriptionHtml: string
 *   descriptionMarkdown: string
 *   sprints: Array<{ id: number, name: string, state: string }>
 *   subtasks: Array<{ key: string, summary: string, status: string, issueType: string }>
 *   links: Array<{ type: string, direction: "inward" | "outward", key: string, summary: string, issueType: string }>
 *   browseUrl: string
 *   projectKey: string
 *   wip: ReturnType<typeof buildWipStatusEntry> | null
 *   wipAdvancement: import("./cruscotto.jira.wip.mjs").WipAdvancementEntry | null
 * }>}
 */
export async function fetchJiraIssueDetail(issueKey) {
  const key = normalizeIssueKey(issueKey);

  if (!isValidIssueKey(key)) {
    throw new Error(`Issue key non valida: ${issueKey}`);
  }

  const issue = /** @type {{
    key: string
    fields?: Record<string, unknown>
    renderedFields?: Record<string, unknown>
  }} */ (
    await jiraLiveFetch(
      `/rest/api/3/issue/${encodeURIComponent(key)}?fields=${encodeURIComponent(ISSUE_DETAIL_FIELDS)}&expand=${encodeURIComponent("renderedFields")}`
    )
  );

  const fields = issue.fields ?? {};
  const status = /** @type {{ name?: string, statusCategory?: { key?: string } }} */ (fields.status ?? {});
  const statusName = status.name ?? "—";
  const statusCategory = status.statusCategory?.key ?? "";
  const issueType = /** @type {{ name?: string }} */ (fields.issuetype ?? {}).name ?? "—";
  const parent = /** @type {{ key?: string, fields?: { summary?: string } }} */ (fields.parent);
  const description = fields.description;
  const descriptionHtml = enhanceVeveDescriptionHtml(
    descriptionHtmlFromRenderedFields(issue.renderedFields)
  );
  const descriptionText = adfToPlainText(description).trim();
  const sprints = (/** @type {Array<{ id: number, name: string, state: string }>} */ (fields[JIRA_SPRINT_FIELD] ?? []))
    .map((sprint) => ({
      id   : Number(sprint.id)
    , name : String(sprint.name ?? "")
    , state: String(sprint.state ?? "")
    }));

  const subtasks = (/** @type {Array<{ key?: string, fields?: { summary?: string, status?: { name?: string, statusCategory?: { key?: string } }, issuetype?: { name?: string } } }>} */ (
    fields.subtasks ?? []
  )).map((row) => {
    const st = row.fields?.status?.name ?? "—";
    const cat = row.fields?.status?.statusCategory?.key ?? "";

    return {
      key      : String(row.key ?? "")
    , summary  : row.fields?.summary ?? ""
    , status   : st
    , done     : isJiraStatusDone(st, cat)
    , issueType: row.fields?.issuetype?.name ?? "—"
    };
  }).filter((row) => row.key);

  /** @type {Array<{ type: string, direction: "inward" | "outward", key: string, summary: string, issueType: string }>} */
  const links = [];

  for (const link of /** @type {Array<Record<string, unknown>>} */ (fields.issuelinks ?? [])) {
    const typeName = /** @type {{ name?: string, inward?: string, outward?: string }} */ (link.type ?? {}).name ?? "Link";
    const inward = /** @type {{ key?: string, fields?: { summary?: string, issuetype?: { name?: string } } }} */ (link.inwardIssue);
    const outward = /** @type {{ key?: string, fields?: { summary?: string, issuetype?: { name?: string } } }} */ (link.outwardIssue);

    if (inward?.key) {
      links.push({
        type     : typeName
      , direction: "inward"
      , key      : inward.key
      , summary  : inward.fields?.summary ?? ""
      , issueType: inward.fields?.issuetype?.name ?? "—"
      });
    }

    if (outward?.key) {
      links.push({
        type     : typeName
      , direction: "outward"
      , key      : outward.key
      , summary  : outward.fields?.summary ?? ""
      , issueType: outward.fields?.issuetype?.name ?? "—"
      });
    }
  }

  const wipAdvancement = await loadWipAdvancement(key);

  return {
    key
  , summary           : String(fields.summary ?? "")
  , status            : statusName
  , statusCategory
  , done              : isJiraStatusDone(statusName, statusCategory)
  , issueType
  , parentKey         : parent?.key ?? null
  , parentSummary     : parent?.fields?.summary ?? null
  , labels            : Array.isArray(fields.labels) ? fields.labels.map(String) : []
  , assignee          : formatJiraUser(fields.assignee)
  , reporter          : formatJiraUser(fields.reporter)
  , created           : typeof fields.created === "string" ? fields.created : null
  , updated           : typeof fields.updated === "string" ? fields.updated : null
  , descriptionText
  , descriptionHtml
  , descriptionMarkdown: descriptionText
  , sprints
  , subtasks
  , links
  , browseUrl         : `${JIRA_BROWSE_BASE}/${encodeURIComponent(key)}`
  , projectKey        : getProjectConfig().PRJ_JIRA_PREFIX
  , viewSource        : "jira"
  , wip               : wipAdvancement ?? null
  , wipAdvancement
  };
}

/**
 * @param {string | null | undefined} raw
 * @returns {string[]}
 */
function parseRelatedKeysJson(raw) {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * @param {string | null | undefined} rawFields
 * @returns {Record<string, unknown>}
 */
function parseDbRawFields(rawFields) {
  if (!rawFields) {
    return {};
  }

  try {
    const parsed = typeof rawFields === "string" ? JSON.parse(rawFields) : rawFields;

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function dbValuesDiffer(a, b) {
  if (a === b) {
    return false;
  }

  if (a == null && b == null) {
    return false;
  }

  if (typeof a === "boolean" || typeof b === "boolean") {
    return Boolean(a) !== Boolean(b);
  }

  return String(a ?? "").trim() !== String(b ?? "").trim();
}

/**
 * @param {{
 *   jiraKey?: string
 *   issueType?: string
 *   summary?: string
 *   status?: string
 *   statusCategory?: string | null
 *   tier?: string
 *   isStoryLike?: boolean
 *   isDone?: boolean
 *   depth?: number
 *   hasChildren?: boolean
 *   devOrder?: string | null
 *   devSprint?: number | null
 *   devSprintName?: string | null
 *   devSort?: number | null
 *   isSprint6Obsolete?: boolean
 *   relatedKeys?: string | null
 *   syncedAt?: Date | null
 * } | null | undefined} cache
 * @param {{
 *   issueType?: string
 *   summary?: string
 *   status?: string
 *   statusCategory?: string | null
 *   tier?: string
 *   isStoryLike?: boolean
 *   isDone?: boolean
 *   depth?: number
 *   hasChildren?: boolean
 *   devOrder?: string | null
 *   devSprint?: number | null
 *   devSprintName?: string | null
 *   devSort?: number | null
 *   isSprint6Obsolete?: boolean
 *   relatedKeys?: string | null
 *   syncedAt?: Date | null
 * } | null | undefined} wip
 * @param {string} field
 * @param {keyof NonNullable<typeof cache>} prop
 * @param {Set<string>} overrides
 * @returns {unknown}
 */
function pickDbField(cache, wip, field, prop, overrides) {
  if (!wip) {
    return cache?.[prop] ?? null;
  }

  const cacheVal = cache?.[prop];
  const wipVal   = wip[prop];

  if (cache && dbValuesDiffer(cacheVal, wipVal)) {
    overrides.add(field);
    return wipVal ?? cacheVal ?? null;
  }

  return wipVal ?? cacheVal ?? null;
}

/**
 * @param {NonNullable<typeof cache>} cache
 * @param {typeof wip} wip
 * @returns {{
 *   issueType: string
 *   summary: string
 *   status: string
 *   statusCategory: string
 *   tier: string
 *   isStoryLike: boolean
 *   isDone: boolean
 *   depth: number
 *   hasChildren: boolean
 *   devOrder: string | null
 *   devSprint: number | null
 *   devSprintName: string | null
 *   devSort: number | null
 *   isSprint6Obsolete: boolean
 *   relatedKeys: string | null
 *   syncedAt: Date | null
 *   wipFieldOverrides: string[]
 * }}
 */
function mergeJiraIssueCacheWithWip(cache, wip) {
  /** @type {Set<string>} */
  const overrides = new Set();

  const statusName = String(pickDbField(cache, wip, "status", "status", overrides) ?? "—");
  const statusCategory = String(
    pickDbField(cache, wip, "statusCategory", "statusCategory", overrides) ?? ""
  );
  const isDoneRaw = pickDbField(cache, wip, "isDone", "isDone", overrides);

  return {
    issueType        : String(pickDbField(cache, wip, "issueType", "issueType", overrides) ?? "—")
  , summary          : String(pickDbField(cache, wip, "summary", "summary", overrides) ?? "")
  , status           : statusName
  , statusCategory
  , tier             : String(pickDbField(cache, wip, "tier", "tier", overrides) ?? "")
  , isStoryLike      : Boolean(pickDbField(cache, wip, "isStoryLike", "isStoryLike", overrides))
  , isDone           : typeof isDoneRaw === "boolean"
      ? isDoneRaw
      : isJiraStatusDone(statusName, statusCategory)
  , depth            : Number(pickDbField(cache, wip, "depth", "depth", overrides) ?? 0)
  , hasChildren      : Boolean(pickDbField(cache, wip, "hasChildren", "hasChildren", overrides))
  , devOrder         : /** @type {string | null} */ (pickDbField(cache, wip, "devOrder", "devOrder", overrides) ?? null)
  , devSprint        : /** @type {number | null} */ (
      pickDbField(cache, wip, "devSprint", "devSprint", overrides) ?? null
    )
  , devSprintName    : /** @type {string | null} */ (
      pickDbField(cache, wip, "devSprintName", "devSprintName", overrides) ?? null
    )
  , devSort          : /** @type {number | null} */ (
      pickDbField(cache, wip, "devSort", "devSort", overrides) ?? null
    )
  , isSprint6Obsolete: Boolean(
      pickDbField(cache, wip, "isSprint6Obsolete", "isSprint6Obsolete", overrides)
    )
  , relatedKeys      : /** @type {string | null} */ (
      pickDbField(cache, wip, "relatedKeys", "relatedKeys", overrides) ?? null
    )
  , syncedAt         : /** @type {Date | null} */ (
      pickDbField(cache, wip, "syncedAt", "syncedAt", overrides) ?? null
    )
  , wipFieldOverrides: [...overrides]
  };
}

/**
 * @param {Array<{
 *   jiraKey: string
 *   issueType: string
 *   summary: string
 *   status: string
 *   statusCategory?: string | null
 *   isDone?: boolean
 * }>} cacheSubtasks
 * @param {Array<{
 *   jiraKey: string
 *   issueType: string
 *   summary: string
 *   status: string
 *   statusCategory?: string | null
 *   isDone?: boolean
 * }>} wipSubtasks
 */
function mergeDbSubtasks(cacheSubtasks, wipSubtasks) {
  const wipMap   = new Map(wipSubtasks.map((row) => [row.jiraKey, row]));
  const cacheMap = new Map(cacheSubtasks.map((row) => [row.jiraKey, row]));
  const keys     = [...new Set([...wipMap.keys(), ...cacheMap.keys()])].sort();

  return keys.map((key) => {
    const cache = cacheMap.get(key);
    const wip   = wipMap.get(key);
    const src   = wip ?? cache;

    if (!src) {
      return null;
    }

    /** @type {string[]} */
    const wipOverrides = [];

    if (wip && cache) {
      if (dbValuesDiffer(cache.summary, wip.summary)) {
        wipOverrides.push("summary");
      }

      if (dbValuesDiffer(cache.status, wip.status)) {
        wipOverrides.push("status");
      }

      if (dbValuesDiffer(cache.issueType, wip.issueType)) {
        wipOverrides.push("issueType");
      }

      const cacheDone = cache.isDone ?? isJiraStatusDone(cache.status, cache.statusCategory ?? "");
      const wipDone   = wip.isDone ?? isJiraStatusDone(wip.status, wip.statusCategory ?? "");

      if (dbValuesDiffer(cacheDone, wipDone)) {
        wipOverrides.push("done");
      }
    } else if (wip) {
      wipOverrides.push("summary", "status", "issueType", "done");
    }

    const useWip = Boolean(wip);
    const row    = useWip ? wip : cache;
    const status = row?.status ?? "—";
    const cat    = row?.statusCategory ?? "";

    return {
      key
    , summary     : row?.summary ?? ""
    , status
    , done        : row?.isDone ?? isJiraStatusDone(status, cat)
    , issueType   : row?.issueType ?? "—"
    , wipOverrides
    };
  }).filter((row) => row != null);
}

/**
 * @param {string} text
 * @returns {string}
 */
function escapeHtmlText(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Markdown veve (description WIP) → HTML basilare per vista DB.
 *
 * @param {string} markdown
 * @returns {string}
 */
export function veveMarkdownToHtml(markdown) {
  const lines = String(markdown ?? "").replace(/\r\n/g, "\n").split("\n");
  /** @type {string[]} */
  const out   = [];
  let i       = 0;

  /**
   * @param {string} text
   * @returns {string}
   */
  function inline(text) {
    return escapeHtmlText(text)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g
      , (_match, label, href) => {
          const browse = String(href).match(
            /https:\/\/myfuturejobsearch\.atlassian\.net\/browse\/((?:ADMIN|JLO)-\d+)/i
          );

          const url = browse ? `?key=${browse[1]}` : href;

          return `<a href="${url}">${label}</a>`;
        }
      );
  }

  /**
   * @param {string[]} tableLines
   * @returns {string}
   */
  function renderTable(tableLines) {
    if (tableLines.length === 0) {
      return "";
    }

    /**
     * @param {string} line
     * @returns {string[]}
     */
    function parseRow(line) {
      return line.split("|").slice(1, -1).map((cell) => cell.trim());
    }

    const header = parseRow(tableLines[0]);
    let bodyStart = 1;

    if (tableLines[1] && /^[\s|:-]+$/.test(tableLines[1].replace(/\|/g, ""))) {
      bodyStart = 2;
    }

    const body = tableLines.slice(bodyStart).map(parseRow);
    const headHtml = header.map((cell) => `<th scope="col">${inline(cell)}</th>`).join("");
    const bodyHtml = body.map((row) => (
      `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`
    )).join("");

    return [
      '<div class="table-wrap">'
    , '<table class="confluenceTable"><thead><tr>'
    , headHtml
    , "</tr></thead><tbody>"
    , bodyHtml
    , "</tbody></table></div>"
    ].join("");
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed === "---") {
      out.push("<hr />");
      i += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      out.push(`<h2>${inline(trimmed.slice(3))}</h2>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      out.push(`<h3>${inline(trimmed.slice(4))}</h3>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith("|") && trimmed.includes("|")) {
      /** @type {string[]} */
      const tableLines = [];

      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i += 1;
      }

      out.push(renderTable(tableLines));
      continue;
    }

    if (/^- \[[ xX✓✔☑]\]/.test(trimmed)) {
      /** @type {string[]} */
      const items = [];

      while (i < lines.length && /^- \[[ xX✓✔☑]\]/.test(lines[i].trim())) {
        const match = lines[i].trim().match(/^- \[([ xX✓✔☑])\]\s*(.*)$/);
        const mark  = match?.[1] ?? " ";
        const checked = mark.trim() !== "" && mark.toLowerCase() !== " ";
        const glyph   = checked ? "☑" : "☐";

        items.push(`<li>${glyph} ${inline(match?.[2] ?? "")}</li>`);
        i += 1;
      }

      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (trimmed.startsWith("- ")) {
      /** @type {string[]} */
      const items = [];

      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(`<li>${inline(lines[i].trim().slice(2))}</li>`);
        i += 1;
      }

      out.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (
      (trimmed.startsWith("_") && trimmed.endsWith("_"))
      || (trimmed.startsWith("*") && trimmed.endsWith("*") && !trimmed.startsWith("**"))
    ) {
      out.push(`<p><em>${inline(trimmed.slice(1, -1))}</em></p>`);
      i += 1;
      continue;
    }

    out.push(`<p>${inline(trimmed)}</p>`);
    i += 1;
  }

  return out.join("\n");
}

/**
 * Description Jira live — solo campi description + renderedFields.
 *
 * @param {string} issueKey
 * @returns {Promise<{ descriptionHtml: string, descriptionText: string }>}
 */
export async function fetchJiraIssueDescriptionOnly(issueKey) {
  const key = normalizeIssueKey(issueKey);

  if (!isValidIssueKey(key)) {
    throw new Error(`Issue key non valida: ${issueKey}`);
  }

  const issue = /** @type {{
    fields?: Record<string, unknown>
    renderedFields?: Record<string, unknown>
  }} */ (
    await jiraLiveFetch(
      `/rest/api/3/issue/${encodeURIComponent(key)}?fields=description&expand=${encodeURIComponent("renderedFields")}`
    )
  );

  const fields          = issue.fields ?? {};
  const descriptionHtml = enhanceVeveDescriptionHtml(
    descriptionHtmlFromRenderedFields(issue.renderedFields)
  );
  const descriptionText = adfToPlainText(fields.description).trim();

  return { descriptionHtml, descriptionText };
}

/**
 * Dettaglio issue da cache SQLite cruscotto (`jira_issue` + opz. `jira_issue_wip`).
 *
 * @param {string} issueKey
 * @returns {Promise<ReturnType<typeof fetchJiraIssueDetail> & {
 *   viewSource: "db"
 *   dbMeta: {
 *     syncRunId: string
 *     syncedAt: string | null
 *     hasWip: boolean
 *     descriptionFrom: "wip" | "cache" | "jira-cache" | "jira-live" | "none"
 *   }
 * }>}
 */
export async function fetchJiraIssueDetailFromDb(issueKey) {
  const key = normalizeIssueKey(issueKey);

  if (!isValidIssueKey(key)) {
    throw new Error(`Issue key non valida: ${issueKey}`);
  }

  if (!cruscottoDbFileExists()) {
    throw new Error("Database cruscotto non disponibile");
  }

  const db = await openCruscottoDb();

  const syncRun = await db.syncRun.findFirst({
    where  : { status: "success", issueCount: { gt: 0 } }
  , orderBy: { finishedAt: "desc" }
  });

  if (!syncRun) {
    throw new Error("Nessun sync DB disponibile — esegui npm run db:sync");
  }

  const row = await db.jiraIssue.findFirst({
    where  : { jiraKey: key, syncRunId: syncRun.id }
  , include: {
      sprints: { include: { sprint: true } }
    }
  });

  if (!row) {
    throw new Error(`Issue ${key} assente in cache DB (ultimo sync)`);
  }

  const wipRow = await db.jiraIssueWip.findFirst({
    where: { jiraKey: key }
  });

  const cacheSubtasks = await db.jiraIssue.findMany({
    where  : { parentJiraKey: key, syncRunId: syncRun.id }
  , orderBy: { jiraKey: "asc" }
  });

  const wipSubtasks = await db.jiraIssueWip.findMany({
    where  : { parentJiraKey: key }
  , orderBy: { jiraKey: "asc" }
  });

  const subtasks = mergeDbSubtasks(cacheSubtasks, wipSubtasks);

  const parentRow = row.parentJiraKey
    ? await db.jiraIssue.findFirst({
        where: { jiraKey: row.parentJiraKey, syncRunId: syncRun.id }
      })
    : null;

  const issueRaw     = parseDbRawFields(row.rawFields);
  const wipRaw       = parseDbRawFields(wipRow?.rawFields);
  const hadWipVeve       = typeof wipRaw.veveDescription === "string" && Boolean(wipRaw.veveDescription.trim());
  const hadCacheVeve     = typeof issueRaw.veveDescription === "string" && Boolean(issueRaw.veveDescription.trim());
  const hadCacheJiraDesc = typeof issueRaw.jiraDescription === "string" && Boolean(issueRaw.jiraDescription.trim());
  let veveMd             = hadWipVeve
    ? wipRaw.veveDescription.trim()
    : hadCacheVeve
      ? issueRaw.veveDescription.trim()
      : hadCacheJiraDesc
        ? issueRaw.jiraDescription.trim()
        : "";

  /** @type {{ descriptionHtml: string, descriptionText: string } | null} */
  let liveDesc    = null;
  let syncedToWip = false;

  if (!veveMd) {
    try {
      liveDesc = await fetchJiraIssueDescriptionOnly(key);
      const snap = liveDesc.descriptionText.trim();

      if (snap || liveDesc.descriptionHtml) {
        if (wipRow && snap) {
          await db.jiraIssueWip.update({
            where: { jiraKey: key }
          , data : {
              rawFields: JSON.stringify({
                ...wipRaw
              , veveDescription         : snap
              , jiraDescriptionSyncedAt : new Date().toISOString()
              })
            }
          });
          syncedToWip = true;
          veveMd      = snap;
        } else if (snap) {
          veveMd = snap;
        }
      }
    } catch {
      // Jira live non disponibile — description resta vuota
    }
  }

  /** @type {"wip" | "cache" | "jira-cache" | "jira-live" | "none"} */
  const descriptionFrom = !veveMd && !liveDesc?.descriptionHtml
    ? "none"
    : hadWipVeve || syncedToWip
      ? "wip"
      : hadCacheVeve
        ? "cache"
        : hadCacheJiraDesc
          ? "jira-cache"
          : "jira-live";

  const merged = mergeJiraIssueCacheWithWip(row, wipRow ?? undefined);

  /** @type {Set<string>} */
  const wipFieldOverrideSet = new Set(wipRow ? merged.wipFieldOverrides : []);

  if (descriptionFrom === "wip") {
    wipFieldOverrideSet.add("description");
  }

  const mergedFields = {
    ...merged
  , wipFieldOverrides: [...wipFieldOverrideSet]
  };

  const descriptionText = veveMd || liveDesc?.descriptionText?.trim() || "";

  let descriptionHtml = "";

  if (hadWipVeve || hadCacheVeve || syncedToWip || hadCacheJiraDesc) {
    descriptionHtml = veveMd
      ? enhanceVeveDescriptionHtml(rewriteJiraBrowseLinksInHtml(veveMarkdownToHtml(veveMd)))
      : "";
  } else if (liveDesc?.descriptionHtml) {
    descriptionHtml = liveDesc.descriptionHtml;
  } else if (veveMd) {
    descriptionHtml = enhanceVeveDescriptionHtml(rewriteJiraBrowseLinksInHtml(veveMarkdownToHtml(veveMd)));
  }

  const sprints = row.sprints.map(({ sprint }) => ({
    id   : sprint.id
  , name : sprint.name
  , state: sprint.state
  }));

  /** @type {Array<{ type: string, direction: "inward" | "outward", key: string, summary: string, issueType: string }>} */
  const links = [];

  const relatedKeys = parseRelatedKeysJson(mergedFields.relatedKeys ?? row.relatedKeys);

  if (relatedKeys.length > 0) {
    const linkedRows = await db.jiraIssue.findMany({
      where: {
        jiraKey   : { in: relatedKeys }
      , syncRunId : syncRun.id
      }
    });
    const linkedByKey = new Map(linkedRows.map((linked) => [linked.jiraKey, linked]));

    for (const relatedKey of relatedKeys) {
      const linked = linkedByKey.get(relatedKey);

      links.push({
        type     : "Related"
      , direction: "outward"
      , key      : relatedKey
      , summary  : linked?.summary ?? ""
      , issueType: linked?.issueType ?? "—"
      });
    }
  }

  const wipAdvancement = wipRow
    ? buildWipAdvancementEntry(wipRow, wipSubtasks, { inWip: true })
    : hasWorkflowAdvancementData(parseWorkflowRawFields(row.rawFields))
      ? buildWipAdvancementEntry(row, cacheSubtasks, { inWip: false })
      : null;

  return {
    key
  , summary           : mergedFields.summary
  , status            : mergedFields.status
  , statusCategory    : mergedFields.statusCategory
  , done              : mergedFields.isDone
  , issueType         : mergedFields.issueType
  , parentKey         : row.parentJiraKey ?? null
  , parentSummary     : parentRow?.summary ?? null
  , labels            : []
  , assignee          : null
  , reporter          : null
  , created           : row.syncedAt?.toISOString() ?? null
  , updated           : row.jiraUpdatedAt?.toISOString() ?? row.syncedAt?.toISOString() ?? null
  , descriptionText
  , descriptionHtml
  , descriptionMarkdown: descriptionText
  , sprints
  , subtasks
  , links
  , browseUrl         : `${JIRA_BROWSE_BASE}/${encodeURIComponent(key)}`
  , projectKey        : getProjectConfig().PRJ_JIRA_PREFIX
  , viewSource        : "db"
  , wipFieldOverrides : mergedFields.wipFieldOverrides
  , dbFields          : {
      tier             : mergedFields.tier
    , isStoryLike      : mergedFields.isStoryLike
    , depth            : mergedFields.depth
    , hasChildren      : mergedFields.hasChildren
    , devOrder         : mergedFields.devOrder
    , devSprint        : mergedFields.devSprint
    , devSprintName    : mergedFields.devSprintName
    , devSort          : mergedFields.devSort
    , isSprint6Obsolete: mergedFields.isSprint6Obsolete
    , wipSyncedAt      : mergedFields.syncedAt?.toISOString() ?? null
    }
  , dbMeta            : {
      syncRunId      : syncRun.id
    , syncedAt       : syncRun.finishedAt?.toISOString() ?? syncRun.startedAt.toISOString()
    , hasWip         : Boolean(wipRow)
    , hasWorkflowCache: Boolean(wipAdvancement && !wipRow)
    , descriptionFrom
    , subtasksFromWip: wipSubtasks.length > 0
    }
  , wip               : wipAdvancement ?? null
  , wipAdvancement
  };
}
