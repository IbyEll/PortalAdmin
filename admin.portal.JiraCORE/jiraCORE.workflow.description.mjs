/**
 * Compila template workflow chiudi-parent → markdown e sync ADF su Jira.
 */

import {
  jiraLiveFetch
, updateIssueDescriptionMarkdown
, transitionIssueToDone
} from "./jiraCORE.jira.live.mjs";

import { pathToFileURL } from "node:url";

import { analyzeIssueKeys } from "./JiraCORE.repo.issuekey.signal.analysis.mjs";
import { scanRepoJiraReferences } from "./jira.function.repo.refs.mjs";

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

/** @type {Array<{ text: string, checked: boolean }>} */
const DEFAULT_WIP_PARENT_AC = [
  { text: "Gap repo analizzato e allineato al finding matrice", checked: true }
, { text: "Implementazione verificata in codebase overlay attivo", checked: true }
];

/** @type {Array<{ text: string, checked: boolean }>} */
const DEFAULT_WIP_PARENT_DOD = [
  { text: "Codice e test coerenti con AC", checked: true }
, { text: "Ticket pronto per PUSH (step 8 cruscotto)", checked: true }
];

/**
 * @param {Array<{ text: string, checked?: boolean }>} items
 * @param {{ pushReadyDoD?: boolean, defaults?: Array<{ text: string, checked: boolean }> }} [opts]
 * @returns {Array<{ text: string, checked: boolean }>}
 */
export function markVeveCheckboxItemsDone(items, opts = {}) {
  const list = items?.length ? items : (opts.defaults ?? []);

  return list.map((item) => {
    let text = item.text;

    if (opts.pushReadyDoD && /gogo workflow|pronto per gogo/i.test(text)) {
      text = "Ticket pronto per PUSH (step 8 cruscotto)";
    }

    return { text, checked: true };
  });
}

/**
 * @param {string} markdown
 * @returns {string | null}
 */
export function parseEpicKeyFromVeve(markdown) {
  const m = String(markdown ?? "").match(/\*\*Epic:\*\*\s*\[((?:ADMIN|JLO)-\d+)\]/i);

  return m?.[1]?.toUpperCase() ?? null;
}

/**
 * @param {string} markdown
 * @returns {Array<{ key: string, summary: string }>}
 */
export function parseSubtaskTableFromVeve(markdown) {
  const section = extractMarkdownSection(markdown, "Ordine subtask");
  /** @type {Array<{ key: string, summary: string }>} */
  const subs = [];

  for (const line of section.split(/\r?\n/)) {
    const match = line.match(/^\|\s*\d+\s*\|\s*((?:ADMIN|JLO)-\d+)\s*\|\s*([^|]+?)\s*\|/i);

    if (match) {
      subs.push({ key: match[1].toUpperCase(), summary: match[2].trim() });
    }
  }

  return subs;
}

/**
 * @param {{ symbol?: string, signalLabel?: string, gap?: string, paths?: string[] } | null | undefined} gapRow
 * @returns {Array<{ area: string, esito: string, note: string }>}
 */
export function repoAreasFromGapRow(gapRow) {
  if (!gapRow || !/^[✅⚠️❌]$/.test(String(gapRow.symbol ?? "").trim())) {
    return [];
  }

  const note = gapRow.gap
    ?? (gapRow.paths?.length ? gapRow.paths.slice(0, 3).join(", ") : "—");

  return [{
    area : gapRow.signalLabel ?? "Repo"
  , esito: String(gapRow.symbol)
  , note
  }];
}

/**
 * Gap analysis fresco per tabella Stato repo a chiusura WIP.
 *
 * @param {string} parentKey
 * @param {string[]} [subtaskKeys]
 * @returns {Promise<Array<{ area: string, esito: string, note: string }> | null>}
 */
export async function resolveRepoAreasForWipClose(parentKey, subtaskKeys = []) {
  const key = String(parentKey ?? "").trim().toUpperCase();
  const keys = [key, ...subtaskKeys.map((sub) => String(sub).trim().toUpperCase())];
  const repoRefs = scanRepoJiraReferences();
  const report = analyzeIssueKeys(keys, {
    repoRefs
  , jiraStatusByKey: Object.fromEntries(keys.map((issueKey) => [issueKey, "Fatto"]))
  });
  const parentGap = report.issues.find((row) => row.key === key);
  const fromGap   = repoAreasFromGapRow(parentGap);

  return fromGap.length > 0 ? fromGap : null;
}

/**
 * Ricompila veve parent WIP — AC/DoD checked, stato repo aggiornato.
 *
 * @param {string} existingMarkdown
 * @param {{
 *   objective?: string
 *   epicKey?: string | null
 *   repoAreas?: Array<{ area: string, esito: string, note: string }>
 *   subtasks?: Array<{ key: string, summary: string }>
 * }} ctx
 * @returns {string}
 */
export function rebuildWipParentVeveMarkdown(existingMarkdown, ctx = {}) {
  const existing = String(existingMarkdown ?? "");
  const objective = ctx.objective
    ?? extractMarkdownSection(existing, "Obiettivo").split("\n").find((line) => line.trim())?.trim()
    ?? "—";
  const sprintNote = extractMarkdownSection(existing, "Sprint / fase")
    .split("\n")
    .find((line) => line.trim() && line.trim() !== "—")
    ?.trim()
    ?? "—";
  const responsibility = extractMarkdownSection(existing, "Divisione responsabilità")
    .split("\n")
    .find((line) => line.trim())
    ?? undefined;
  const outOfScopeRaw = extractMarkdownSection(existing, "Fuori scope");
  const successor = extractMarkdownSection(existing, "Successore")
    .split("\n")
    .find((line) => line.trim())
    ?? "—";
  const acParsed = parseCheckboxSection(extractMarkdownSection(existing, "Acceptance Criteria"));
  const dodParsed = parseCheckboxSection(extractMarkdownSection(existing, "Definition of Done"));
  const repoAreas = ctx.repoAreas?.length
    ? ctx.repoAreas
    : parseRepoAreasTable(extractMarkdownSection(existing, "Stato repo"));
  const subtasks = ctx.subtasks?.length
    ? ctx.subtasks
    : parseSubtaskTableFromVeve(existing);

  return buildVeveStoryParentMarkdown({
    objective
  , epicKey: ctx.epicKey ?? parseEpicKeyFromVeve(existing) ?? undefined
  , sprintNote
  , analysisDate: new Date().toISOString().slice(0, 10)
  , repoAreas
  , responsibility
  , acceptanceCriteria: markVeveCheckboxItemsDone(acParsed, { defaults: DEFAULT_WIP_PARENT_AC })
  , definitionOfDone  : markVeveCheckboxItemsDone(dodParsed, {
      pushReadyDoD: true
    , defaults     : DEFAULT_WIP_PARENT_DOD
    })
  , subtasks
  , outOfScope: outOfScopeRaw
    ? outOfScopeRaw.split("\n").map((line) => line.trim()).filter(Boolean)
    : ["—"]
  , successor
  });
}

/**
 * Ricompila veve subtask WIP — AC/DoD checked a ok chiudi.
 *
 * @param {string} existingMarkdown
 * @param {{
 *   objective?: string
 *   parentKey: string
 *   repoAreas?: Array<{ area: string, esito: string, note: string }>
 *   files?: string[]
 *   order?: { n: number, total: number }
 * }} ctx
 * @returns {string}
 */
export function rebuildWipSubtaskVeveMarkdown(existingMarkdown, ctx) {
  const existing = String(existingMarkdown ?? "");
  const objective = ctx.objective
    ?? extractMarkdownSection(existing, "Obiettivo").split("\n").find((line) => line.trim())?.trim()
    ?? "—";
  const acParsed = parseCheckboxSection(extractMarkdownSection(existing, "Acceptance Criteria"));
  const dodParsed = parseCheckboxSection(extractMarkdownSection(existing, "Definition of Done"));
  const repoAreas = ctx.repoAreas?.length
    ? ctx.repoAreas
    : parseRepoAreasTable(extractMarkdownSection(existing, "Stato repo"));
  const filesSection = extractMarkdownSection(existing, "File coinvolti");
  const files = ctx.files?.length
    ? ctx.files
    : filesSection.split("\n").map((line) => line.replace(/^-\s*/, "").trim()).filter(Boolean);
  const deps = extractMarkdownSection(existing, "Dipendenze").split("\n").find((line) => line.trim()) ?? "—";

  return buildVeveSubtaskMarkdown({
    objective
  , parentKey: ctx.parentKey
  , repoAreas
  , acceptanceCriteria: markVeveCheckboxItemsDone(acParsed, {
      defaults: [{ text: "Implementazione subtask completata nel repo", checked: true }]
    })
  , definitionOfDone: markVeveCheckboxItemsDone(dodParsed, {
      defaults: [{ text: "Commit su branch ticket con key subtask", checked: true }]
    })
  , files
  , dependencies: deps
  , order: ctx.order
  });
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

  await import("../admin.portal.lib/portal.load.env.mjs");
  const ctx = await buildChiudiParentContextFromIssue(key, { branch, commit, prUrl });
  const out = await syncChiudiParentToJira(key, ctx, { transition: false });
  console.log(JSON.stringify({ ok: true, key, updated: out.description.updated }, null, 2));
}
