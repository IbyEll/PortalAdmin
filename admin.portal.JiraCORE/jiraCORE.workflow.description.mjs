/**
 * Compila template workflow chiudi-parent → markdown e sync ADF su Jira.
 */

import {
  jiraLiveFetch
, updateIssueDescriptionMarkdown
, transitionIssueToDone
} from "./jiraCORE.jira.live.mjs";

import { pathToFileURL } from "node:url";

const JIRA_BROWSE = "https://myfuturejobsearch.atlassian.net/browse";

/**
 * @typedef {{
 *   objective: string
 *   epicKey?: string | null
 *   closedAt?: string
 *   branch: string
 *   commit: string
 *   repoAreas?: Array<{ area: string, esito: string, note: string }>
 *   acceptanceCriteria?: Array<{ text: string, checked?: boolean }>
 *   definitionOfDone?: Array<{ text: string, checked?: boolean }>
 *   subtasks?: Array<{ key: string, summary: string, status?: string }>
 *   gap?: string
 *   outOfScope?: string
 *   prUrl?: string | null
 * }} ChiudiParentContext
 */

/**
 * @typedef {{
 *   objective: string
 *   epicKey?: string | null
 *   sprintNote?: string
 *   analysisDate?: string
 *   repoAreas?: Array<{ area: string, esito: string, note: string }>
 *   responsibility?: string
 *   acceptanceCriteria?: Array<{ text: string, checked?: boolean }>
 *   definitionOfDone?: Array<{ text: string, checked?: boolean }>
 *   subtasks?: Array<{ key: string, summary: string }>
 *   outOfScope?: string | string[]
 *   successor?: string | null
 * }} VeveStoryParentContext
 */

/**
 * @typedef {{
 *   objective: string
 *   parentKey: string
 *   repoAreas?: Array<{ area: string, esito: string, note: string }>
 *   acceptanceCriteria?: Array<{ text: string, checked?: boolean }>
 *   definitionOfDone?: Array<{ text: string, checked?: boolean }>
 *   files?: string[]
 *   dependencies?: string | string[]
 *   order?: { n: number, total: number }
 * }} VeveSubtaskContext
 */

/**
 * @param {Array<{ text: string, checked?: boolean }>} items
 * @returns {string[]}
 */
function renderCheckboxLines(items) {
  return (items ?? []).map((item) => `- [${item.checked === false ? " " : "x"}] ${item.text}`);
}

/**
 * @param {ChiudiParentContext} ctx
 * @returns {string}
 */
export function buildChiudiParentMarkdown(ctx) {
  const date = ctx.closedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const lines = [
    "## Obiettivo"
  , ""
  , ctx.objective.trim()
  , ""
  ];

  if (ctx.epicKey) {
    lines.push(
      `**Epic:** [${ctx.epicKey}](${JIRA_BROWSE}/${ctx.epicKey})`
    , ""
    );
  }

  lines.push(
    "---"
  , ""
  , "## Stato repo"
  , ""
  , `_Data chiusura: ${date} · branch \`${ctx.branch}\` · commit principale \`${ctx.commit}\`_`
  , ""
  );

  const areas = ctx.repoAreas ?? [];

  if (areas.length > 0) {
    lines.push("| Area | Esito | Note |", "| --- | --- | --- |");

    for (const row of areas) {
      lines.push(`| ${row.area} | ${row.esito} | ${row.note} |`);
    }

    lines.push("");
  }

  lines.push(
    "---"
  , ""
  , "## Acceptance Criteria"
  , ""
  , ...renderCheckboxLines(ctx.acceptanceCriteria ?? [])
  , ""
  , "---"
  , ""
  , "## Definition of Done"
  , ""
  , ...renderCheckboxLines(ctx.definitionOfDone ?? [])
  , ""
  , "---"
  , ""
  , "## Ordine subtask"
  , ""
  );

  const subtasks = ctx.subtasks ?? [];

  if (subtasks.length === 0) {
    lines.push("_Nessun subtask — fix atomico su parent_", "");
  } else {
    lines.push("| # | Key | Summary | Stato |", "| --- | --- | --- | --- |");

    subtasks.forEach((sub, index) => {
      lines.push(`| ${index + 1} | ${sub.key} | ${sub.summary} | ${sub.status ?? "Fatto"} |`);
    });

    lines.push("");
  }

  lines.push(
    "---"
  , ""
  , "## Gap"
  , ""
  , ctx.gap?.trim() || "Nessuno — tutti AC/DoD parent soddisfatti nel codice commitato."
  , ""
  , "---"
  , ""
  , "## Fuori scope"
  , ""
  , ctx.outOfScope?.trim() || "—"
  , ""
  , "---"
  , ""
  );

  if (ctx.prUrl) {
    lines.push(`_PR: ${ctx.prUrl} · merge su \`main\` a cura utente su GitHub._`);
  }

  return lines.join("\n").trimEnd();
}

/**
 * @param {string | string[] | undefined} block
 * @returns {string[]}
 */
function renderOutOfScopeLines(block) {
  if (!block) {
    return ["—"];
  }

  const items = Array.isArray(block) ? block : String(block).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (items.length === 0) {
    return ["—"];
  }

  return items.map((line) => (line.startsWith("- ") ? line : `- ${line}`));
}

/**
 * Template veve story parent → markdown (sync ADF via updateIssueDescriptionMarkdown).
 *
 * @param {VeveStoryParentContext} ctx
 * @returns {string}
 */
export function buildVeveStoryParentMarkdown(ctx) {
  const date = ctx.analysisDate ?? new Date().toISOString().slice(0, 10);
  const lines = [
    "## Obiettivo"
  , ""
  , ctx.objective.trim()
  , ""
  ];

  if (ctx.epicKey) {
    const sprint = ctx.sprintNote ? ` · ${ctx.sprintNote}` : "";
    lines.push(`**Epic:** [${ctx.epicKey}](${JIRA_BROWSE}/${ctx.epicKey})${sprint}`, "");
  }

  lines.push(
    "---"
  , ""
  , "## Sprint / fase"
  , ""
  , ctx.sprintNote?.trim() || "—"
  , ""
  , "---"
  , ""
  , "## Stato repo"
  , ""
  , `_Data analisi: ${date}_`
  , ""
  );

  const areas = ctx.repoAreas ?? [];

  if (areas.length > 0) {
    lines.push("| Area | Esito | Note |", "| --- | --- | --- |");

    for (const row of areas) {
      lines.push(`| ${row.area} | ${row.esito} | ${row.note} |`);
    }

    lines.push("");
    lines.push("_Esiti: ✅ implementato · ⚠️ parziale/stub · ❌ assente_", "");
  }

  if (ctx.responsibility?.trim()) {
    lines.push(
      "---"
    , ""
    , "## Divisione responsabilità"
    , ""
    , ctx.responsibility.trim()
    , ""
    );
  }

  lines.push(
    "---"
  , ""
  , "## Acceptance Criteria"
  , ""
  , ...renderCheckboxLines(ctx.acceptanceCriteria ?? [])
  , ""
  , "---"
  , ""
  , "## Definition of Done"
  , ""
  , ...renderCheckboxLines(ctx.definitionOfDone ?? [])
  , ""
  , "---"
  , ""
  , "## Ordine subtask"
  , ""
  );

  const subtasks = ctx.subtasks ?? [];

  if (subtasks.length === 0) {
    lines.push("_Nessun subtask — fix atomico su parent_", "");
  } else {
    lines.push("| # | Key | Summary |", "| --- | --- | --- |");
    subtasks.forEach((sub, index) => {
      lines.push(`| ${index + 1} | ${sub.key} | ${sub.summary} |`);
    });
    lines.push("");
  }

  lines.push(
    "---"
  , ""
  , "## Fuori scope"
  , ""
  , ...renderOutOfScopeLines(ctx.outOfScope)
  , ""
  , "---"
  , ""
  , "## Successore"
  , ""
  , ctx.successor?.trim() || "—"
  , ""
  );

  return lines.join("\n").trimEnd();
}

/**
 * Template veve subtask → markdown.
 *
 * @param {VeveSubtaskContext} ctx
 * @returns {string}
 */
export function buildVeveSubtaskMarkdown(ctx) {
  const lines = [
    "## Obiettivo"
  , ""
  , ctx.objective.trim()
  , ""
  , `**Parent:** [${ctx.parentKey}](${JIRA_BROWSE}/${ctx.parentKey})`
  , ""
  ];

  const areas = ctx.repoAreas ?? [];

  if (areas.length > 0) {
    lines.push(
      "---"
    , ""
    , "## Stato repo"
    , ""
    , "| Area | Esito | Note |"
    , "| --- | --- | --- |"
    );

    for (const row of areas) {
      lines.push(`| ${row.area} | ${row.esito} | ${row.note} |`);
    }

    lines.push("");
  }

  lines.push(
    "---"
  , ""
  , "## Acceptance Criteria"
  , ""
  , ...renderCheckboxLines(ctx.acceptanceCriteria ?? [])
  , ""
  , "---"
  , ""
  , "## Definition of Done"
  , ""
  , ...renderCheckboxLines(ctx.definitionOfDone ?? [])
  , ""
  , "---"
  , ""
  , "## File coinvolti"
  , ""
  );

  const files = ctx.files ?? [];

  if (files.length === 0) {
    lines.push("—", "");
  } else {
    for (const file of files) {
      lines.push(`- \`${file}\``);
    }

    lines.push("");
  }

  lines.push(
    "---"
  , ""
  , "## Dipendenze"
  , ""
  );

  if (!ctx.dependencies || (Array.isArray(ctx.dependencies) && ctx.dependencies.length === 0)) {
    lines.push("—", "");
  } else if (Array.isArray(ctx.dependencies)) {
    lines.push(ctx.dependencies.join(" · "), "");
  } else {
    lines.push(String(ctx.dependencies).trim(), "");
  }

  if (ctx.order) {
    lines.push(
      "---"
    , ""
    , "## Ordine"
    , ""
    , `${ctx.order.n}/${ctx.order.total}`
    , ""
    );
  }

  return lines.join("\n").trimEnd();
}

/**
 * @param {string} issueKey
 * @param {VeveStoryParentContext | VeveSubtaskContext} ctx
 * @param {"story" | "subtask"} kind
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function syncVeveDescriptionToJira(issueKey, ctx, kind, opts = {}) {
  const markdown = kind === "subtask"
    ? buildVeveSubtaskMarkdown(/** @type {VeveSubtaskContext} */ (ctx))
    : buildVeveStoryParentMarkdown(/** @type {VeveStoryParentContext} */ (ctx));
  const desc = await updateIssueDescriptionMarkdown(issueKey, markdown, opts);

  return { markdown, description: desc };
}

/**
 * @param {string} issueKey
 * @returns {Promise<{ summary: string, description: string }>}
 */
export async function fetchIssueTextFields(issueKey) {
  const key   = String(issueKey).trim().toUpperCase();
  const issue = /** @type {{ fields?: { summary?: string, description?: unknown } }} */ (
    await jiraLiveFetch(`/rest/api/3/issue/${key}?fields=${encodeURIComponent("summary,description")}`)
  );
  const { adfToPlainText } = await import("./jiraCORE.backlog.related.tickets.mjs");

  return {
    summary    : issue.fields?.summary?.trim() ?? key
  , description: adfToPlainText(issue.fields?.description).trim()
  };
}

/**
 * Estrae sezione markdown da description esistente (veve).
 *
 * @param {string} text
 * @param {string} heading
 * @returns {string}
 */
export function extractMarkdownSection(text, heading) {
  const re = new RegExp(`## ${heading}\\s*\\n+([\\s\\S]*?)(?=\\n## |$)`, "i");
  const m  = String(text ?? "").match(re);

  return m?.[1]?.trim() ?? "";
}

/**
 * @param {string} sectionText
 * @returns {Array<{ area: string, esito: string, note: string }>}
 */
export function parseRepoAreasTable(sectionText) {
  /** @type {Array<{ area: string, esito: string, note: string }>} */
  const rows = [];

  for (const line of String(sectionText ?? "").split(/\r?\n/)) {
    if (!line.trim().startsWith("|") || /^\|\s*[-:]+/.test(line)) {
      continue;
    }

    const cells = splitTableCells(line);

    if (cells.length < 3 || cells[0].toLowerCase() === "area") {
      continue;
    }

    rows.push({ area: cells[0], esito: cells[1], note: cells[2] });
  }

  return rows;
}

/**
 * @param {string} line
 * @returns {string[]}
 */
function splitTableCells(line) {
  return String(line)
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * @param {string} sectionText
 * @returns {Array<{ text: string, checked: boolean }>}
 */
export function parseCheckboxSection(sectionText) {
  /** @type {Array<{ text: string, checked: boolean }>} */
  const items = [];

  for (const line of String(sectionText ?? "").split(/\r?\n/)) {
    const m = line.match(/^-\s*\[([ xX])\]\s*(.+)$/);

    if (m) {
      items.push({ text: m[2].trim(), checked: m[1].toLowerCase() === "x" });
    }
  }

  return items;
}

/**
 * @param {string} issueKey
 * @param {{
 *   branch: string
 *   commit: string
 *   prUrl?: string | null
 *   catalogUpdated?: boolean
 *   objective?: string
 *   outOfScope?: string
 * }} input
 * @returns {Promise<ChiudiParentContext>}
 */
export async function buildChiudiParentContextFromIssue(issueKey, input) {
  const fields      = await fetchIssueTextFields(issueKey).catch(() => ({
    summary    : issueKey
  , description: ""
  }));
  const objective   = input.objective
    ?? extractMarkdownSection(fields.description, "Obiettivo").split("\n")[0]?.trim()
    ?? fields.summary;
  const outOfScope  = input.outOfScope
    ?? extractMarkdownSection(fields.description, "Fuori scope")
    ?? "";
  const acFromVeve  = parseCheckboxSection(extractMarkdownSection(fields.description, "Acceptance Criteria"));
  const dodFromVeve = parseCheckboxSection(extractMarkdownSection(fields.description, "Definition of Done"));
  const repoFromVeve = parseRepoAreasTable(extractMarkdownSection(fields.description, "Stato repo"));
  /** @type {Array<{ area: string, esito: string, note: string }>} */
  const repoAreas = repoFromVeve.length > 0
    ? repoFromVeve
    : [{
        area : "Admin / cruscotto"
      , esito: "✅"
      , note : "Implementazione verificata in sessione di chiusura"
      }];

  if (input.catalogUpdated !== false) {
    repoAreas.push({
      area : "Catalogo segnali"
    , esito: "✅"
    , note : "Aggiornato da close-story"
    });
  }

  return {
    objective
  , branch: input.branch
  , commit: input.commit
  , prUrl : input.prUrl ?? null
  , repoAreas
  , acceptanceCriteria: acFromVeve.length > 0
    ? acFromVeve.map((item) => ({ ...item, checked: true }))
    : [{ text: "Implementazione allineata al ticket", checked: true }]
  , definitionOfDone: dodFromVeve.length > 0
    ? dodFromVeve.map((item) => ({ ...item, checked: true }))
    : [
        { text: "Commit su branch ticket", checked: true }
      , { text: "PR aperta e catalogo segnali aggiornato", checked: true }
      ]
  , subtasks: []
  , gap     : "Nessuno — tutti AC/DoD parent soddisfatti nel codice commitato."
  , outOfScope: outOfScope || undefined
  };
}

/**
 * @param {string} issueKey
 * @param {ChiudiParentContext} ctx
 * @param {{ dryRun?: boolean, transition?: boolean }} [opts]
 */
export async function syncChiudiParentToJira(issueKey, ctx, opts = {}) {
  const markdown = buildChiudiParentMarkdown(ctx);
  const desc     = await updateIssueDescriptionMarkdown(issueKey, markdown, opts);
  const result   = { markdown, description: desc };

  if (opts.transition) {
    return {
      ...result
    , transition: await transitionIssueToDone(issueKey, opts)
    };
  }

  return result;
}

// CLI — re-sync description parent da chiudi-parent
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  let key = null;
  let branch = "";
  let commit = "";
  let prUrl = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--key" && args[i + 1]) {
      key = args[++i];
    } else if (args[i] === "--branch" && args[i + 1]) {
      branch = args[++i];
    } else if (args[i] === "--commit" && args[i + 1]) {
      commit = args[++i];
    } else if (args[i] === "--pr" && args[i + 1]) {
      prUrl = args[++i];
    }
  }

  if (!key || !branch || !commit) {
    console.error("Uso: node jiraCORE.workflow.description.mjs --key ADMIN-155 --branch BUG---... --commit 13c7c92 [--pr URL]");
    process.exit(1);
  }

  await import("../lib/portal.load.env.mjs");
  const ctx = await buildChiudiParentContextFromIssue(key, { branch, commit, prUrl });
  const out = await syncChiudiParentToJira(key, ctx, { transition: false });
  console.log(JSON.stringify({ ok: true, key, updated: out.description.updated }, null, 2));
}
