/**
 * Diff semantico matrice pilastri — confronto righe per data-issue-key.
 * Usato da publish-confluence-pillar-matrix.mjs per evidenziare aggiunte/modifiche/rimozioni.
 */

/** @typedef {{ key: string, cells: string[], cellHtml: string[], rowHtml: string }} MatrixRow */

/** @typedef {{ key: string, fields: string[] }} ModifiedRow */

/** @typedef {{ added: string[], removed: string[], modified: ModifiedRow[], unchanged: number }} MatrixDiff */

export const MATRIX_COLUMN_LABELS = [
  "Issue"
, "Summary"
, "Sprint"
, "Jira"
, "Repo"
, "Sviluppo (GitHub)"
, "Gap / note"
];

const CHANGELOG_MARKER = "data-pillar-matrix-changelog";
const REMOVED_SECTION_MARKER = "data-pillar-matrix-removed";
const DIFF_STAR = "★";

/** @type {Record<"added" | "modified" | "removed", string>} */
const DIFF_STAR_TITLE = {
  added    : "Aggiunta in questo aggiornamento"
, modified : "Modificata — vedi prima/dopo"
, removed  : "Rimossa in questo aggiornamento"
};

/** @type {Record<"added" | "modified" | "removed", string>} */
const ROW_STYLE = {
  added    : "background-color:#e3fcef;"
, modified : "background-color:#fffae6;"
, removed  : "background-color:#ffebe6;text-decoration:line-through;opacity:0.85;"
};

const FULL_ROW_RE = /<tr([^>]*\bdata-issue-key="(JLO-\d+)"[^>]*)>([\s\S]*?)<\/tr>/gi;
const TD_RE       = /<td[^>]*>([\s\S]*?)<\/td>/gi;

/**
 * @param {string} html
 */
function stripCellDiffMarkup(html) {
  return String(html ?? "")
    .replace(/<span class="matrix-diff-star"[^>]*>★<\/span>\s*/gi, "")
    .replace(/<span class="matrix-diff-after">([\s\S]*?)<\/span>/gi, "$1")
    .replace(/<br\s*\/?>\s*<small class="matrix-diff-before"[^>]*>[\s\S]*?<\/small>/gi, "")
    .replace(/<small class="matrix-diff-before"[^>]*>[\s\S]*?<\/small>\s*/gi, "");
}

/**
 * @param {"added" | "modified" | "removed"} kind
 */
function diffStarBadge(kind) {
  return [
    `<span class="matrix-diff-star" data-matrix-diff-star="${kind}" title="${DIFF_STAR_TITLE[kind]}"`
  , ` style="color:#f5a623;font-weight:700;margin-right:0.2rem">★</span>`
  ].join("");
}

/**
 * @param {string} html
 */
function stripDiffArtifacts(html) {
  return String(html ?? "")
    .replace(
      new RegExp(`<div[^>]*${CHANGELOG_MARKER}="true"[^>]*>[\\s\\S]*?<\\/div>\\s*`, "gi")
    , ""
    )
    .replace(
      new RegExp(`<h3>Rimoss[^<]*<\\/h3>[\\s\\S]*?${REMOVED_SECTION_MARKER}="true"[\\s\\S]*?<\\/table>\\s*`, "gi")
    , ""
    );
}

/**
 * @param {string} html
 */
function normalizeCellText(html) {
  return stripCellDiffMarkup(String(html ?? ""))
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} html
 * @returns {Map<string, MatrixRow>}
 */
export function extractMatrixRows(html) {
  /** @type {Map<string, MatrixRow>} */
  const rows = new Map();
  const clean = stripDiffArtifacts(html);

  for (const match of clean.matchAll(FULL_ROW_RE)) {
    const key      = match[2];
    const inner    = match[3];
    /** @type {string[]} */
    const cells    = [];
    /** @type {string[]} */
    const cellHtml = [];

    for (const cellMatch of inner.matchAll(TD_RE)) {
      cellHtml.push(cellMatch[1]);
      cells.push(normalizeCellText(cellMatch[1]));
    }

    rows.set(key, {
      key
    , cells
    , cellHtml
    , rowHtml: match[0]
    });
  }

  return rows;
}

/**
 * @param {string} attrs
 * @param {"added" | "modified" | "removed"} kind
 */
function applyRowHighlightAttrs(attrs, kind) {
  const stripped = String(attrs)
    .replace(/\s*style="[^"]*"/gi, "")
    .replace(/\s*data-matrix-diff="[^"]*"/gi, "");

  return `${stripped} style="${ROW_STYLE[kind]}" data-matrix-diff="${kind}"`;
}

/**
 * @param {string | undefined} oldHtml
 * @param {string} newHtml
 * @returns {MatrixDiff}
 */
export function diffMatrixHtml(oldHtml, newHtml) {
  const oldRows = extractMatrixRows(oldHtml ?? "");
  const newRows = extractMatrixRows(newHtml);

  /** @type {string[]} */
  const added = [];
  /** @type {string[]} */
  const removed = [];
  /** @type {ModifiedRow[]} */
  const modified = [];
  let unchanged = 0;

  for (const [key, row] of newRows) {
    const prev = oldRows.get(key);

    if (!prev) {
      added.push(key);
      continue;
    }

    /** @type {string[]} */
    const changedFields = [];

    for (let index = 1; index < MATRIX_COLUMN_LABELS.length; index += 1) {
      const label = MATRIX_COLUMN_LABELS[index];
      const oldVal = prev.cells[index] ?? "";
      const newVal = row.cells[index] ?? "";

      if (oldVal !== newVal) {
        changedFields.push(label);
      }
    }

    if (changedFields.length) {
      modified.push({ key, fields: changedFields });
    } else {
      unchanged += 1;
    }
  }

  for (const key of oldRows.keys()) {
    if (!newRows.has(key)) {
      removed.push(key);
    }
  }

  added.sort();
  removed.sort();
  modified.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

  return { added, removed, modified, unchanged };
}

/**
 * @param {MatrixDiff} diff
 */
export function diffHasChanges(diff) {
  return diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0;
}

/**
 * @param {string} key
 */
function issueLink(key) {
  return `<a href="https://myfuturejobsearch.atlassian.net/browse/${key}">${key}</a>`;
}

/**
 * @param {MatrixDiff} diff
 * @param {{ updatedAt?: string, title?: string }} [opts]
 */
export function buildChangelogPanel(diff, opts = {}) {
  if (!diffHasChanges(diff)) {
    return "";
  }

  const dateLabel = opts.updatedAt
    ? opts.updatedAt.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  /** @type {string[]} */
  const items = [];

  if (diff.added.length) {
    items.push(
      `<li>${diffStarBadge("added")}<span data-type="status" data-color="green"><strong>+ Aggiunte</strong></span> `
      + `${diff.added.map(issueLink).join(", ")}</li>`
    );
  }

  if (diff.modified.length) {
    for (const row of diff.modified) {
      items.push(
        `<li>${diffStarBadge("modified")}<span data-type="status" data-color="yellow"><strong>~ Modificata</strong></span> `
        + `${issueLink(row.key)} — ${row.fields.join(", ")} (prima/dopo in tabella)</li>`
      );
    }
  }

  if (diff.removed.length) {
    items.push(
      `<li>${diffStarBadge("removed")}<span data-type="status" data-color="red"><strong>− Rimossa</strong></span> `
      + `${diff.removed.map(issueLink).join(", ")}</li>`
    );
  }

  const title = opts.title ? `<strong>${opts.title}</strong> · ` : "";

  return [
    `<div data-type="panel-info" ${CHANGELOG_MARKER}="true">`
  , `<p>${title}<strong>Aggiornamento ${dateLabel}</strong> — rispetto alla versione precedente su Confluence:</p>`
  , `<ul>`
  , ...items
  , `</ul>`
  , `<p><em>${diffLegendEm()}</em></p>`
  , `</div>`
  ].join("\n");
}

/**
 * @param {string} text
 */
function esc(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function diffLegendEm() {
  return [
    "Legenda: "
  , `<strong>${DIFF_STAR}</strong> = differenza · righe `
  , `<span style="${ROW_STYLE.added}">verdi</span> = nuove · `
  , `<span style="${ROW_STYLE.modified}">gialle</span> = modificate (`
  , `${DIFF_STAR} + <em>prima:</em> sotto la cella) · sezione «Rimosse» = issue non più in matrice.`
  ].join("");
}

/**
 * @param {string} rowHtml
 * @param {"added" | "modified" | "removed"} kind
 */
function injectStarInFirstCell(rowHtml, kind) {
  let done = false;

  return rowHtml.replace(/<td([^>]*)>/i, (match) => {
    if (done) {
      return match;
    }

    done = true;
    return `${match}${diffStarBadge(kind)}`;
  });
}

/**
 * @param {string} rowHtml
 * @param {ModifiedRow} mod
 * @param {MatrixRow} prev
 */
function applyModifiedCellDiff(rowHtml, mod, prev) {
  const changedFields = new Set(mod.fields);
  let cellIndex       = -1;

  return rowHtml.replace(/<td([^>]*)>([\s\S]*?)<\/td>/gi, (full, attrs, inner) => {
    cellIndex += 1;
    const label = MATRIX_COLUMN_LABELS[cellIndex];

    if (cellIndex === 0) {
      return `<td${attrs}>${diffStarBadge("modified")}${inner}</td>`;
    }

    if (!changedFields.has(label)) {
      return full;
    }

    const beforeText = prev.cells[cellIndex] ?? "—";
    const cleanInner = stripCellDiffMarkup(inner);

    return [
      `<td${attrs}>`
    , diffStarBadge("modified")
    , `<span class="matrix-diff-after">${cleanInner}</span>`
    , `<br/><small class="matrix-diff-before" style="opacity:0.82">prima: ${esc(beforeText)}</small>`
    , `</td>`
    ].join("");
  });
}

/**
 * @param {string} newHtml
 * @param {MatrixDiff} diff
 * @param {Map<string, MatrixRow>} oldRows
 */
function applyRowHighlights(newHtml, diff, oldRows) {
  const addedSet      = new Set(diff.added);
  /** @type {Map<string, ModifiedRow>} */
  const modifiedByKey = new Map(diff.modified.map((row) => [row.key, row]));

  let html = newHtml.replace(FULL_ROW_RE, (full, attrs, key) => {
    if (addedSet.has(key)) {
      const row = full.replace(
        /^<tr([^>]*)>/
      , `<tr${applyRowHighlightAttrs(attrs, "added")}>`
      );

      return injectStarInFirstCell(row, "added");
    }

    if (modifiedByKey.has(key)) {
      const mod  = modifiedByKey.get(key);
      const prev = oldRows.get(key);
      let row    = full.replace(
        /^<tr([^>]*)>/
      , `<tr${applyRowHighlightAttrs(attrs, "modified")}>`
      );

      if (mod && prev) {
        return applyModifiedCellDiff(row, mod, prev);
      }

      return injectStarInFirstCell(row, "modified");
    }

    return full;
  });

  if (!diff.removed.length) {
    return html;
  }

  /** @type {string[]} */
  const removedRows = [];

  for (const key of diff.removed) {
    const row = oldRows.get(key);

    if (!row) {
      continue;
    }

    removedRows.push(
      injectStarInFirstCell(
        row.rowHtml.replace(
          /^<tr([^>]*)>/
        , `<tr${applyRowHighlightAttrs(attrsFromRow(row.rowHtml), "removed")}>`
        )
      , "removed"
      )
    );
  }

  if (!removedRows.length) {
    return html;
  }

  const removedBlock = [
    `<h3>Issue rimosse in questo aggiornamento</h3>`
  , `<table class="matrix-table matrix-removed" ${REMOVED_SECTION_MARKER}="true">`
  , `<thead><tr><th>Issue</th><th>Summary</th><th>Sprint</th><th>Jira</th><th>Repo</th><th>Sviluppo (GitHub)</th><th>Gap / note</th></tr></thead>`
  , `<tbody>`
  , removedRows.join("\n")
  , `</tbody></table>`
  ].join("\n");

  const tableClose = html.lastIndexOf("</table>");

  if (tableClose === -1) {
    return `${html}\n\n${removedBlock}`;
  }

  return `${html.slice(0, tableClose + 8)}\n\n${removedBlock}${html.slice(tableClose + 8)}`;
}

/**
 * @param {string} rowHtml
 */
function attrsFromRow(rowHtml) {
  const match = /^<tr([^>]*)>/.exec(rowHtml);
  return match?.[1] ?? "";
}

/**
 * @param {string | undefined} oldHtml
 * @param {string} newHtml
 * @param {{ updatedAt?: string, title?: string }} [opts]
 */
export function prepareMatrixBodyWithDiff(oldHtml, newHtml, opts = {}) {
  const cleanNew = stripDiffArtifacts(newHtml);
  const oldRows  = extractMatrixRows(oldHtml ?? "");
  const diff     = diffMatrixHtml(oldHtml, cleanNew);

  if (!diffHasChanges(diff)) {
    return { html: cleanNew, diff, hasChanges: false };
  }

  let html = applyRowHighlights(cleanNew, diff, oldRows);
  const panel = buildChangelogPanel(diff, opts);

  if (panel) {
    html = `${panel}\n\n${html}`;
  }

  return { html, diff, hasChanges: true };
}

/**
 * @param {MatrixDiff} diff
 */
export function summarizeDiff(diff) {
  if (!diffHasChanges(diff)) {
    return "nessuna modifica issue";
  }

  /** @type {string[]} */
  const parts = [];

  if (diff.added.length) {
    parts.push(`+${diff.added.length}`);
  }

  if (diff.modified.length) {
    parts.push(`~${diff.modified.length}`);
  }

  if (diff.removed.length) {
    parts.push(`−${diff.removed.length}`);
  }

  return parts.join(" ");
}

/**
 * @param {Array<{ label: string, diff: MatrixDiff }>} sections
 * @param {{ updatedAt?: string }} [opts]
 */
export function buildAggregateChangelogPanel(sections, opts = {}) {
  /** @type {MatrixDiff} */
  const total = {
    added     : []
  , removed   : []
  , modified  : []
  , unchanged : 0
  };

  for (const section of sections) {
    total.added.push(...section.diff.added);
    total.removed.push(...section.diff.removed);
    total.modified.push(...section.diff.modified);
    total.unchanged += section.diff.unchanged;
  }

  total.added.sort();
  total.removed.sort();
  total.modified.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

  if (!diffHasChanges(total)) {
    return "";
  }

  const dateLabel = opts.updatedAt
    ? opts.updatedAt.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  /** @type {string[]} */
  const items = [];

  if (total.added.length) {
    items.push(
      `<li>${diffStarBadge("added")}<span data-type="status" data-color="green"><strong>+ Aggiunte</strong></span> `
      + `${total.added.map(issueLink).join(", ")}</li>`
    );
  }

  if (total.modified.length) {
    for (const row of total.modified) {
      items.push(
        `<li>${diffStarBadge("modified")}<span data-type="status" data-color="yellow"><strong>~ Modificata</strong></span> `
        + `${issueLink(row.key)} — ${row.fields.join(", ")} (prima/dopo in tabella)</li>`
      );
    }
  }

  if (total.removed.length) {
    items.push(
      `<li>${diffStarBadge("removed")}<span data-type="status" data-color="red"><strong>− Rimossa</strong></span> `
      + `${total.removed.map(issueLink).join(", ")}</li>`
    );
  }

  /** @type {string[]} */
  const byPillar = sections
    .filter((section) => diffHasChanges(section.diff))
    .map((section) => `<li><strong>${section.label}</strong> — ${summarizeDiff(section.diff)}</li>`);

  return [
    `<div data-type="panel-info" ${CHANGELOG_MARKER}="true">`
  , `<p><strong>Matrice pilastri — riepilogo globale</strong> · <strong>Aggiornamento ${dateLabel}</strong> — rispetto alla versione precedente su Confluence:</p>`
  , `<ul>`
  , ...items
  , `</ul>`
  , byPillar.length
    ? [`<p><strong>Per pilastro:</strong></p>`, `<ul>`, ...byPillar, `</ul>`].join("\n")
    : ""
  , `<p><em>${diffLegendEm()}</em></p>`
  , `</div>`
  ].filter(Boolean).join("\n");
}
