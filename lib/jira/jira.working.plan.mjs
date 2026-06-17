/**
 * Archivio e rigenerazione piano Jira Working (solo lettura Jira — non modifica sprint).
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fetchJiraBacklog, isJiraStatusDone } from "../jira/jira.backlog.mjs";
import { inspectRepoSignal } from "../jira/jira.backlog.insights.mjs";
import { buildWorkingInsights, buildKeyToBlockMap } from "../jira/jira.working.insights.mjs";
import { formatJiraKeyListsInNoteHtml, jiraLinkHtml } from "../jira/jira.issue.display.mjs";
import { JLO_SPRINT_6_BOARD_NOISE, JLO_SPRINT_6_PHASES, JLO_WORKING_PLAN, boardKeysForWorkingPlanBlock, isSprint6ObsoleteIssue, mergeWorkingSprintKeys, normalizeSprintLabel, sprint6ObsoleteKeySet } from "../jira/jira.working.order.mjs";

const LIB_DIR        = dirname(fileURLToPath(import.meta.url));
const ADMIN_DIR      = join(LIB_DIR, "..");
const CRUSCOTTO_DIR  = join(ADMIN_DIR, "cruscotto");
const WORKING_HTML     = join(CRUSCOTTO_DIR, "jira.working.html");
const WORKING_OLD_HTML = join(CRUSCOTTO_DIR, "jira.working.old.html");
const ARCHIVES_DIR   = join(ADMIN_DIR, "data", "jira.working", "archives");
const ARCHIVE_INDEX  = join(ARCHIVES_DIR, "index.json");

const JIRA_BASE      = "https://myfuturejobsearch.atlassian.net/browse/";
const PLAN_START     = "<!-- WORKING-PLAN-GENERATED-START -->";
const PLAN_END       = "<!-- WORKING-PLAN-GENERATED-END -->";
const HEADER_START   = "<!-- WORKING-HEADER-META-START -->";
const HEADER_END     = "<!-- WORKING-HEADER-META-END -->";
const UI_CHROME_START = "<!-- WORKING-UI-CHROME-START -->";
const UI_CHROME_END   = "<!-- WORKING-UI-CHROME-END -->";
const UI_EXTRA_START  = "<!-- WORKING-UI-EXTRA-START -->";
const UI_EXTRA_END    = "<!-- WORKING-UI-EXTRA-END -->";
const UI_MODALS_START   = "<!-- WORKING-UI-MODALS-START -->";
const UI_MODALS_END     = "<!-- WORKING-UI-MODALS-END -->";
const WORKFLOW_START    = "<!-- WORKING-WORKFLOW-START -->";
const WORKFLOW_END      = "<!-- WORKING-WORKFLOW-END -->";
const KEY_TO_BLOCK_START = "<!-- WORKING-KEY-TO-BLOCK-START -->";
const KEY_TO_BLOCK_END   = "<!-- WORKING-KEY-TO-BLOCK-END -->";

const CLEAN_WORKFLOW_INNER = [
  "    <section>"
, "      <h2>Workflow agente (Cursor)</h2>"
, "      <ul>"
, "        <li>Branch: <code>{TIPO}---JLO-{key}-{slug}</code> — <code>STORY</code> · <code>BUG</code> · <code>TODO</code> (tre trattini <code>---</code>)</li>"
, "        <li><code>procedi JLO-xxx FULL silent</code> — sequenza subtask in background</li>"
, "        <li><code>chiudi Story JLO-xxx</code> — push, PR e chiusura parent Jira</li>"
, "      </ul>"
, "    </section>",
].join("\n");

/** @type {Array<{ label: string, keys: string[] }>} */
const CRITICAL_CHAIN = [
  { label: "Match lifecycle", keys: ["JLO-690", "JLO-637"] }
, { label: "Housekeeping 97/247/637", keys: ["JLO-97", "JLO-247", "JLO-637"] }
, { label: "Export Admin", keys: ["JLO-930", "JLO-931", "JLO-932", "JLO-933"] }
, { label: "Notifiche fondamenta", keys: ["JLO-774", "JLO-775"] }
, { label: "Tornei iscrizione/bracket", keys: ["JLO-100", "JLO-103", "JLO-696"] }
, { label: "Release", keys: ["JLO-872", "JLO-121"] }
];

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
 * @param {Date} [date]
 */
function formatPlanLabel(date = new Date()) {
  return date.toLocaleString("it-IT", {
    day    : "2-digit",
    month  : "2-digit",
    year   : "numeric",
    hour   : "2-digit",
    minute : "2-digit",
  });
}

/**
 * @param {string} key
 * @param {string} [summary]
 * @param {string} [type]
 */
function jiraLink(key, summary, type) {
  return jiraLinkHtml(key, summary, type, JIRA_BASE);
}

/**
 * @param {string} key
 * @param {Map<string, { summary?: string, type?: string }>} byKey
 */
function jiraLinkFromMap(key, byKey) {
  const row = byKey.get(key);

  return jiraLink(key, row?.summary, row?.type);
}

/**
 * @param {boolean} done
 */
function statusBadge(done) {
  return done
    ? `<span class="badge pass">Fatto</span>`
    : `<span class="badge warn">Da fare</span>`;
}

/**
 * @param {string} state
 */
function sprintStateBadge(state) {
  if (state === "active") {
    return `<span class="badge pass sprint-state-badge">IN CORSO</span>`;
  }

  if (state === "future") {
    return `<span class="badge warn sprint-state-badge">FUTURO</span>`;
  }

  return `<span class="badge pass sprint-state-badge">COMPLETATO</span>`;
}

/**
 * @param {string | null | undefined} iso
 * @returns {string | null}
 */
function formatSprintDate(iso) {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("it-IT", {
    day   : "2-digit",
    month : "2-digit",
    year  : "numeric",
  });
}

/**
 * @param {{ id: number, state: string, startDate?: string | null, endDate?: string | null } | null} jiraSprint
 */
function renderSprintBoardCell(jiraSprint) {
  if (!jiraSprint) {
    return `<span class="sprint-board-cell sprint-board-cell--missing">non trovato</span>`;
  }

  const state     = jiraSprint.state;
  const showDates = state === "active" || state === "closed";
  const start     = showDates ? formatSprintDate(jiraSprint.startDate) : null;
  const end       = showDates ? formatSprintDate(jiraSprint.endDate) : null;
  const range     = [start, end].filter(Boolean).join(" – ");

  return [
    `<span class="sprint-board-cell">`
  , sprintStateBadge(state)
  , range ? `<span class="sprint-board-dates">${escapeHtml(range)}</span>` : ""
  , "</span>",
  ].join("");
}

/**
 * @param {string} label
 * @param {string} text
 */
function planNote(label, text) {
  const body = formatJiraKeyListsInNoteHtml(text, JIRA_BASE);

  return `<span class="plan-note"><span class="nota-label">[nota del: ${escapeHtml(label)}]</span> ${body}</span>`;
}

/**
 * @returns {string}
 */
function renderKeyToBlockJs() {
  const map = buildKeyToBlockMap();

  /** @type {Map<string, string[]>} */
  const byBlock = new Map();

  for (const key of Object.keys(map).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const block = map[key];
    const list  = byBlock.get(block) ?? [];

    list.push(key);
    byBlock.set(block, list);
  }

  /** @type {string[]} */
  const lines    = [];
  const blockKeys = [...byBlock.keys()].sort();

  blockKeys.forEach((block, blockIndex) => {
    const keys    = byBlock.get(block) ?? [];
    const entries = keys
      .map((key) => `"${key}": "${block}"`)
      .join(", ");
    const suffix  = blockIndex < blockKeys.length - 1 ? "," : "";

    lines.push(`      ${entries}${suffix}`);
  });

  return [
    "    const KEY_TO_BLOCK = {"
  , ...lines
  , "    };",
  ].join("\n");
}

/**
 * @param {string} html
 */
function injectKeyToBlockMap(html) {
  if (!html.includes(KEY_TO_BLOCK_START) || !html.includes(KEY_TO_BLOCK_END)) {
    throw new Error(`Marker KEY_TO_BLOCK mancanti in jira.working.html`);
  }

  return replaceBetweenMarkers(html, KEY_TO_BLOCK_START, KEY_TO_BLOCK_END, renderKeyToBlockJs());
}

/**
 * @param {Array<{ key: string, status: string, summary?: string }>} issues
 */
export async function buildWorkingPlanContext(issues) {
  const backlog     = await fetchJiraBacklog();
  const scannedAt   = new Date();
  const label       = formatPlanLabel(scannedAt);
  const byKey       = new Map(backlog.issues.map((row) => [row.key, row]));
  const insights    = buildWorkingInsights(
    backlog.issues
  , scannedAt.toISOString()
  , backlog.boardSprintKeysByPlanName
  );

  /** @type {typeof JLO_WORKING_PLAN} */
  const blocks = [];

  for (const plan of JLO_WORKING_PLAN) {
    const jiraSprint = backlog.jiraSprintsByName[normalizeSprintLabel(plan.name)] ?? null;
    const keys       = mergeWorkingSprintKeys(
      plan.keys
    , boardKeysForWorkingPlanBlock(backlog.boardSprintKeysByPlanName, plan.name)
    );
    /** @type {string[]} */
    const openKeys = [];
    let doneCount  = 0;

    for (const key of keys) {
      const row = byKey.get(key);

      if (row && isJiraStatusDone(row.status)) {
        doneCount += 1;
      } else {
        openKeys.push(key);
      }
    }

    blocks.push({
      plan,
      keys,
      jiraSprint,
      doneCount,
      openKeys,
      total: keys.length,
    });
  }

  /** @type {string | null} */
  let firstOpenKey = null;

  for (const block of blocks) {
    if (block.openKeys.length > 0) {
      firstOpenKey = block.openKeys[0];
      break;
    }
  }

  const activeSprint = backlog.jiraSprints.find((s) => s.state === "active") ?? null;

  /** @type {Array<{ key: string, summary: string, type?: string }>} */
  const doneInPlan = [];

  for (const plan of JLO_WORKING_PLAN) {
    for (const key of plan.keys) {
      const row = byKey.get(key);

      if (row && isJiraStatusDone(row.status)) {
        doneInPlan.push({
          key,
          summary : row.summary ?? key,
          type    : row.type,
        });
      }
    }
  }

  return {
    label,
    scannedAt  : scannedAt.toISOString(),
    issueCount : backlog.total,
    blocks,
    activeSprint,
    firstOpenKey,
    doneInPlan,
    insights,
    byKey,
  };
}

/**
 * @param {Awaited<ReturnType<typeof buildWorkingPlanContext>>} ctx
 */
export function renderWorkingHeaderMeta(ctx) {
  const activeName = ctx.activeSprint?.name ?? "—";

  return [
    `      <p class="meta">`
  , `        JustLastOne · rigenerato ${escapeHtml(ctx.label)} · ${ctx.issueCount} issue in JLO ·`
  , `        <a href="https://myfuturejobsearch.atlassian.net/jira/software/projects/JLO/boards/68">Board JLO</a> ·`
  , `        <a href="/jira.project.tree.html">Project Tree</a> ·`
  , `        <a href="/backlog.html">Backlog</a> ·`
  , `        <a href="/my-project.html">My Project</a> ·`
  , `        <a href="/jira.working.old.html">Working OLD</a>`
  , `      </p>`,
  ].join("\n");
}

/**
 * @param {string} keyA
 * @param {string} keyB
 * @param {string[]} keys
 */
function compareKeysPlanOrder(keyA, keyB, keys) {
  const indexA = keys.indexOf(keyA);
  const indexB = keys.indexOf(keyB);

  if (indexA !== -1 && indexB !== -1) {
    return indexA - indexB;
  }

  if (indexA !== -1) {
    return -1;
  }

  if (indexB !== -1) {
    return 1;
  }

  return keyA.localeCompare(keyB, undefined, { numeric: true });
}

/**
 * @param {string[]} keys
 * @param {Map<string, { tier?: string, parentKey?: string | null }>} byKey
 * @returns {string[]}
 */
function expandWorkingTreeKeys(keys, byKey) {
  /** @type {Set<string>} */
  const expanded = new Set(keys);

  for (const key of keys) {
    let row = byKey.get(key);

    while (row?.parentKey) {
      const parent = byKey.get(row.parentKey);

      if (!parent) {
        break;
      }

      if (parent.tier === "epic" || parent.tier === "task") {
        expanded.add(parent.key);
      }

      row = parent;
    }
  }

  return [...expanded].sort((a, b) => compareKeysPlanOrder(a, b, keys));
}

/**
 * @param {string[]} keys
 * @param {Map<string, { tier?: string, parentKey?: string | null }>} byKey
 * @returns {Set<string>}
 */
function nestedKeysInPlan(keys, byKey) {
  const keySet = new Set(keys);
  /** @type {Set<string>} */
  const nested = new Set();

  for (const key of keySet) {
    const row = byKey.get(key);

    if (row?.parentKey && keySet.has(row.parentKey)) {
      nested.add(key);
    }
  }

  for (const key of keySet) {
    const row = byKey.get(key);

    if (row?.tier !== "task") {
      continue;
    }

    for (const child of byKey.values()) {
      if (child.tier === "subtask" && child.parentKey === key) {
        nested.add(child.key);
      }
    }
  }

  return nested;
}

/**
 * @param {string} parentKey
 * @param {string[]} keys
 * @param {Map<string, { key?: string, tier?: string, parentKey?: string | null }>} byKey
 * @returns {string[]}
 */
function childKeysForWorkingNode(parentKey, treeKeys, byKey) {
  const row = byKey.get(parentKey);

  if (!row) {
    return [];
  }

  if (row.tier === "epic") {
    return [...byKey.values()]
      .filter((child) => child.parentKey === parentKey && treeKeys.includes(child.key))
      .sort((a, b) => compareKeysPlanOrder(a.key, b.key, treeKeys))
      .map((child) => child.key);
  }

  if (row.tier === "task") {
    return [...byKey.values()]
      .filter((child) => child.tier === "subtask" && child.parentKey === parentKey)
      .sort((a, b) => compareKeysPlanOrder(a.key, b.key, treeKeys))
      .map((child) => child.key);
  }

  return [];
}

/**
 * @param {string[]} keys
 * @param {Map<string, { summary?: string, type?: string, tier?: string, parentKey?: string | null, status?: string }>} byKey
 * @param {{ mode?: "board" | "fase", listClass?: string, itemIndent?: string, nestedIndent?: string, outerIndent?: string }} [options]
 */
function renderJiraKeysTree(keys, byKey, options = {}) {
  const mode          = options.mode ?? "board";
  const listClass   = options.listClass ?? "sprint-keys-list";
  const itemIndent    = options.itemIndent ?? "              ";
  const nestedIndent  = options.nestedIndent ?? "                ";
  const outerIndent   = options.outerIndent ?? (mode === "board" ? "            " : "      ");
  const treeKeys      = expandWorkingTreeKeys(keys, byKey);
  const nestedKeys    = nestedKeysInPlan(treeKeys, byKey);
  const rootKeys      = treeKeys.filter((key) => !nestedKeys.has(key));

  /**
   * @param {string} key
   * @param {boolean} [nested]
   */
  function renderKeyItem(key, nested = false) {
    const row       = byKey.get(key);
    const done      = row ? isJiraStatusDone(row.status) : false;
    const obsolete  = isSprint6ObsoleteIssue(key, row);
    const cls       = `${done ? " is-done" : ""}${obsolete ? " is-obsolete" : ""}`;
    const check     = mode === "board" && done
      ? `<span class="sprint-key-check" aria-label="Fatto in Jira">✓</span>`
      : "";
    const nestedCls = nested ? " sprint-keys-nested-item" : "";
    const childKeys = childKeysForWorkingNode(key, treeKeys, byKey);
    const hasChildren = childKeys.length > 0;
    const groupCls  = hasChildren ? " sprint-keys-group" : "";
    const toggleBtn = hasChildren
      ? `<button type="button" class="sprint-keys-toggle" aria-expanded="true" aria-label="Espandi/collassa figli">▼</button>`
      : "";

    /** @type {string[]} */
    const subItems = [];

    for (const childKey of childKeys) {
      subItems.push(renderKeyItem(childKey, true));
    }

    const subList = subItems.length
      ? [
          `${nestedIndent}<ul class="${listClass} sprint-keys-nested">`
        , subItems.join("\n")
        , `${nestedIndent}</ul>`,
        ].join("\n")
      : "";

    const body = mode === "fase"
      ? (() => {
          const repo     = inspectRepoSignal(key);
          const repoHint = repo?.scan.complete ? " · repo ok" : "";

          return `${jiraLinkFromMap(key, byKey)} ${statusBadge(done)}${repoHint}`;
        })()
      : jiraLinkFromMap(key, byKey);

    return [
      `${itemIndent}<li class="sprint-keys-item${cls}${nestedCls}${groupCls}" data-tree-key="${key}">`
    , `${itemIndent}  ${check}${toggleBtn}<span class="sprint-key-dot" aria-hidden="true">•</span>`
    , `${itemIndent}  <span class="sprint-key-body">${body}</span>`
    , subList
    , `${itemIndent}</li>`,
    ].filter(Boolean).join("\n");
  }

  const items = rootKeys.map((key) => renderKeyItem(key)).join("\n");

  return [
    `${outerIndent}<ul class="${listClass}${mode === "fase" ? " fase-keys-list" : ""}">`
  , items
  , `${outerIndent}</ul>`,
  ].join("\n");
}

/**
 * @param {string[]} keys
 * @param {Map<string, { summary?: string, type?: string, tier?: string, parentKey?: string | null }>} byKey
 */
function renderJiraKeysList(keys, byKey) {
  return renderJiraKeysTree(keys, byKey, { mode: "board" });
}

/**
 * @param {string[]} keys
 * @param {Map<string, { summary?: string, type?: string, tier?: string, parentKey?: string | null, status?: string }>} byKey
 */
function renderFaseKeysList(keys, byKey) {
  return renderJiraKeysTree(keys, byKey, {
    mode         : "fase"
  , listClass    : "sprint-keys-list"
  , itemIndent   : "        "
  , nestedIndent : "          "
  });
}

/**
 * @param {import("./jira.working.order.mjs").SprintExecutionPhase[]} phases
 * @param {string[]} allKeys
 * @param {Map<string, { summary?: string, type?: string, tier?: string, parentKey?: string | null, status?: string }>} byKey
 * @param {{ mode?: "board" | "fase", listClass?: string, itemIndent?: string, nestedIndent?: string, phaseIndent?: string, outerIndent?: string }} [options]
 */
function renderSprintExecutionPhaseTree(phases, allKeys, byKey, options = {}) {
  const mode          = options.mode ?? "board";
  const listClass     = options.listClass ?? "sprint-keys-list";
  const itemIndent    = options.itemIndent ?? "              ";
  const nestedIndent  = options.nestedIndent ?? "                ";
  const phaseIndent   = options.phaseIndent ?? itemIndent;
  const outerIndent   = options.outerIndent ?? (mode === "board" ? "            " : "      ");
  /** @type {Set<string>} */
  const plannedKeys   = new Set();

  for (const phase of phases) {
    for (const root of phase.roots) {
      plannedKeys.add(root.key);

      if (root.subtasks) {
        for (const sub of root.subtasks) {
          plannedKeys.add(sub);
        }
      }
    }
  }

  /**
   * @param {string} key
   * @param {string[] | undefined} subtaskKeys
   * @param {boolean} [nested]
   */
  function renderPlannedKeyItem(key, subtaskKeys, nested = false) {
    const row         = byKey.get(key);
    const done        = row ? isJiraStatusDone(row.status) : false;
    const obsolete    = isSprint6ObsoleteIssue(key, row);
    const cls         = `${done ? " is-done" : ""}${obsolete ? " is-obsolete" : ""}`;
    const check       = mode === "board" && done
      ? `<span class="sprint-key-check" aria-label="Fatto in Jira">✓</span>`
      : "";
    const nestedCls   = nested ? " sprint-keys-nested-item" : "";
    const childKeys   = (subtaskKeys ?? []).filter((sub) => byKey.has(sub));
    const hasChildren = childKeys.length > 0;
    const groupCls    = hasChildren ? " sprint-keys-group" : "";
    const toggleBtn   = hasChildren
      ? `<button type="button" class="sprint-keys-toggle" aria-expanded="true" aria-label="Espandi/collassa figli">▼</button>`
      : "";

    /** @type {string[]} */
    const subItems = [];

    for (const childKey of childKeys) {
      subItems.push(renderPlannedKeyItem(childKey, undefined, true));
    }

    const subList = subItems.length
      ? [
          `${nestedIndent}<ul class="${listClass} sprint-keys-nested">`
        , subItems.join("\n")
        , `${nestedIndent}</ul>`,
        ].join("\n")
      : "";

    const body = mode === "fase"
      ? (() => {
          const repo     = inspectRepoSignal(key);
          const repoHint = repo?.scan.complete ? " · repo ok" : "";

          return `${jiraLinkFromMap(key, byKey)} ${statusBadge(done)}${repoHint}`;
        })()
      : jiraLinkFromMap(key, byKey);

    return [
      `${itemIndent}<li class="sprint-keys-item${cls}${nestedCls}${groupCls}" data-tree-key="${key}">`
    , `${itemIndent}  ${check}${toggleBtn}<span class="sprint-key-dot" aria-hidden="true">•</span>`
    , `${itemIndent}  <span class="sprint-key-body">${body}</span>`
    , subList
    , `${itemIndent}</li>`,
    ].filter(Boolean).join("\n");
  }

  /** @type {string[]} */
  const phaseItems = [];

  for (const phase of phases) {
    /** @type {string[]} */
    const rootItems = [];

    for (const root of phase.roots) {
      if (!byKey.has(root.key)) {
        continue;
      }

      rootItems.push(renderPlannedKeyItem(root.key, root.subtasks));
    }

    if (!rootItems.length) {
      continue;
    }

    phaseItems.push([
      `${phaseIndent}<li class="sprint-phase-group sprint-keys-group" data-phase="${escapeHtml(phase.label)}">`
    , `${phaseIndent}  <button type="button" class="sprint-keys-toggle" aria-expanded="true" aria-label="Espandi/collassa ${escapeHtml(phase.label)}">▼</button>`
    , `${phaseIndent}  <span class="sprint-phase-label">${escapeHtml(phase.label)}</span>`
    , `${phaseIndent}  <ul class="${listClass} sprint-keys-nested sprint-phase-keys">`
    , rootItems.join("\n")
    , `${phaseIndent}  </ul>`
    , `${phaseIndent}</li>`,
    ].join("\n"));
  }

  const obsoleteSet = sprint6ObsoleteKeySet();
  const noiseSet    = new Set(JLO_SPRINT_6_BOARD_NOISE);
  const extraKeys   = allKeys.filter((key) => !plannedKeys.has(key) && byKey.has(key));
  const obsoleteKeys = extraKeys.filter((key) => obsoleteSet.has(key) || isSprint6ObsoleteIssue(key, byKey.get(key)));
  const noiseKeys    = extraKeys.filter((key) => noiseSet.has(key));
  const otherKeys    = extraKeys.filter((key) => !obsoleteKeys.includes(key) && !noiseKeys.includes(key));

  /**
   * @param {string} label
   * @param {string[]} keys
   */
  function renderExtraPhaseGroup(label, keys) {
    if (!keys.length) {
      return "";
    }

    const extraTree = renderJiraKeysTree(keys, byKey, {
      mode
    , listClass
    , itemIndent   : nestedIndent
    , nestedIndent : `${nestedIndent}  `
    , outerIndent  : `${phaseIndent}  `
    });

    return [
      `${phaseIndent}<li class="sprint-phase-group sprint-keys-group sprint-phase-obsolete" data-phase="${escapeHtml(label)}">`
    , `${phaseIndent}  <button type="button" class="sprint-keys-toggle" aria-expanded="true" aria-label="Espandi/collassa ${escapeHtml(label)}">▼</button>`
    , `${phaseIndent}  <span class="sprint-phase-label">${escapeHtml(label)}</span>`
    , extraTree.trimStart()
    , `${phaseIndent}</li>`,
    ].join("\n");
  }

  const extraGroups = [
    renderExtraPhaseGroup("Altro sul board Jira", otherKeys)
  , renderExtraPhaseGroup("Obsoleti / duplicati", obsoleteKeys)
  , renderExtraPhaseGroup("Epic di riferimento (non nel piano)", noiseKeys)
  ].filter(Boolean);

  if (extraGroups.length) {
    phaseItems.push(...extraGroups);
  }

  return [
    `${outerIndent}<ul class="${listClass} sprint-phase-tree${mode === "fase" ? " fase-keys-list" : ""}">`
  , phaseItems.join("\n")
  , `${outerIndent}</ul>`,
  ].join("\n");
}

/**
 * @param {string} name
 * @param {number} sprintNum
 */
function splitSprintPlanName(name, sprintNum) {
  const match = name.match(/^Sprint\s+\d+\s*[—–-]\s*(.+)$/i);

  return {
    idLabel : `Sprint ${sprintNum}`
  , title   : match?.[1]?.trim() ?? name
  };
}

/**
 * @param {Awaited<ReturnType<typeof buildWorkingPlanContext>>["blocks"][number]} block
 * @param {Map<string, { summary?: string }>} byKey
 */
function renderSprintBoardCard(block, byKey) {
  const { plan, keys, jiraSprint } = block;
  const { idLabel, title }         = splitSprintPlanName(plan.name, plan.sprint);
  const keysHtml                   = plan.sprint === 6
    ? renderSprintExecutionPhaseTree(JLO_SPRINT_6_PHASES, keys, byKey, {
        mode         : "board"
      , listClass    : "sprint-keys-list sprint-board-tree"
      , itemIndent   : "              "
      , nestedIndent : "                "
      , phaseIndent  : "            "
      , outerIndent  : "        "
      })
    : renderJiraKeysTree(keys, byKey, {
        mode         : "board"
      , listClass    : "sprint-keys-list sprint-board-tree"
      , itemIndent   : "          "
      , nestedIndent : "            "
      , outerIndent  : "        "
      });
  const boardCell      = renderSprintBoardCell(jiraSprint);
  const isActive       = jiraSprint?.state === "active";
  const defaultCollapsed = isActive ? "false" : "true";
  const collapsedCls   = isActive ? "" : " is-collapsed";
  const expanded       = isActive ? "true" : "false";
  const toggleIcon     = isActive ? "▼" : "▶";
  const activeCls      = isActive ? " is-active" : "";

  return [
    `        <article class="sprint-board-card${collapsedCls}${activeCls}" data-sprint="${plan.sprint}" data-default-collapsed="${defaultCollapsed}" data-sprint-name="${escapeHtml(plan.name)}">`
  , `          <header class="sprint-board-card-head">`
  , `            <button type="button" class="sprint-board-toggle" aria-expanded="${expanded}" aria-label="Espandi/collassa ${escapeHtml(plan.name)}">${toggleIcon}</button>`
  , `            <div class="sprint-board-card-title">`
  , `              <span class="sprint-board-card-id">${escapeHtml(idLabel)}</span>`
  , `              <span class="sprint-board-card-name">${escapeHtml(title)}</span>`
  , `            </div>`
  , `            <span class="sprint-card-tree-bulk" role="group" aria-label="Espandi o collassa albero story">`
  , `              <button type="button" class="sprint-card-tree-btn" data-tree-action="expand" title="Espandi albero story" aria-label="Espandi albero story">`
  , `                <svg class="sprint-card-tree-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 5.83 15.17 9l1.41-1.41L12 3 7.41 7.59 8.83 9 12 5.83zm0 12.34L8.83 15l-1.41 1.41L12 21l4.59-4.59L15.17 15 12 18.17z"/></svg>`
  , `              </button>`
  , `              <button type="button" class="sprint-card-tree-btn" data-tree-action="collapse" title="Collassa albero story" aria-label="Collassa albero story">`
  , `                <svg class="sprint-card-tree-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M7.41 18.59 8.83 20 12 16.83 15.17 20l1.41-1.41L12 14l-4.59 4.59zM7.41 5.41 8.83 4 12 7.17 15.17 4l1.41 1.41L12 10 7.41 5.41z"/></svg>`
  , `              </button>`
  , `            </span>`
  , `            <div class="sprint-board-card-meta">${boardCell}</div>`
  , `          </header>`
  , `          <div class="sprint-board-card-body">`
  , keysHtml.trimStart()
  , `            <div class="insight-notes" data-insight-block="sprint-${plan.sprint}"></div>`
  , `          </div>`
  , `        </article>`,
  ].join("\n");
}

/**
 * @param {Awaited<ReturnType<typeof buildWorkingPlanContext>>} ctx
 */
export function renderWorkingPlanBody(ctx) {
  const { label, blocks, byKey, firstOpenKey } = ctx;

  const sprintCards = blocks.map((block) => renderSprintBoardCard(block, byKey)).join("\n");

  /** @type {string[]} */
  const sintesiRows = [];

  const adminBlock = blocks.find((b) => b.plan.sprint === 3);
  const hkBlock    = blocks.find((b) => b.plan.sprint === 2);
  const notifBlock = blocks.find((b) => b.plan.sprint === 4);

  if (adminBlock) {
    const exportDone = ["JLO-930", "JLO-931", "JLO-932", "JLO-933"].every(
      (key) => !adminBlock.openKeys.includes(key)
    );

    sintesiRows.push([
      "          <tr>"
    , `            <td><strong>Admin MVP</strong> (${jiraLinkFromMap("JLO-849", byKey)})</td>`
    , `            <td>Epic ${statusBadge(!adminBlock.openKeys.includes("JLO-849"))} · export 930–933 ${statusBadge(exportDone)}</td>`
    , "            <td>—</td>"
    , "          </tr>",
    ].join("\n"));
  }

  if (hkBlock) {
    sintesiRows.push([
      "          <tr>"
    , "            <td><strong>Housekeeping</strong> (Fase 0)</td>"
    , `            <td>${hkBlock.doneCount}/${hkBlock.total} Fatto · aperti ${hkBlock.openKeys.length ? `${renderJiraKeysList(hkBlock.openKeys, byKey)}` : "—"}</td>`
    , "            <td>—</td>"
    , "          </tr>",
    ].join("\n"));
  }

  if (notifBlock) {
    sintesiRows.push([
      "          <tr>"
    , `            <td><strong>Notifiche P0</strong> (${jiraLinkFromMap("JLO-773", byKey)})</td>`
    , `            <td>${notifBlock.doneCount}/${notifBlock.total} Fatto in Jira</td>`
    , "            <td>—</td>"
    , "          </tr>",
    ].join("\n"));
  }

  /** @type {string[]} */
  const faseSections = [];

  const faseDefs = [
    { sprint: 2, title: "Fase 0 — Housekeeping · Sprint 2", blockId: "fase-0" }
  , { sprint: 3, title: "Fase 1 — Admin MVP · Sprint 3 · epic JLO-849", blockId: "fase-1" }
  , { sprint: 4, title: "Fase 2 — Notifiche P0 · Sprint 4 · epic JLO-773", blockId: "fase-2" }
  , { sprint: 5, title: "Fase 3 — Tornei Kill Race · Sprint 5 · epic JLO-3", blockId: "fase-3" }
  , { sprint: 6, title: "Social · Chat & Gamebook · Sprint 6 · epic JLO-445", blockId: "fase-chat" }
  , { sprint: 7, title: "Fase 4 — Sblocco test blocked · Sprint 7", blockId: "fase-4" }
  , { sprint: 8, title: "Fase 5 — Release · Sprint 8 · epic JLO-6", blockId: "fase-5" }
  ];

  for (const fase of faseDefs) {
    const block = blocks.find((b) => b.plan.sprint === fase.sprint);

    if (!block) {
      continue;
    }

    const items = block.plan.sprint === 6
      ? renderSprintExecutionPhaseTree(JLO_SPRINT_6_PHASES, block.keys, byKey, {
          mode         : "fase"
        , listClass    : "sprint-keys-list"
        , itemIndent   : "          "
        , nestedIndent : "            "
        , phaseIndent  : "        "
        , outerIndent  : "      "
        })
      : renderFaseKeysList(block.keys, byKey);

    faseSections.push([
      "    <section>"
    , `      <h2>${fase.title}</h2>`
    , items
    , `      <div class="insight-notes" data-insight-block="${fase.blockId}" aria-label="Appunti ${escapeHtml(fase.title)}"></div>`
    , "    </section>",
    ].join("\n"));
  }

  /** @type {string[]} */
  const chainSteps = [];

  for (const step of CRITICAL_CHAIN) {
    const rows = step.keys.map((key) => byKey.get(key)).filter(Boolean);
    const done = rows.filter((r) => isJiraStatusDone(r.status)).length;
    const cls  = done === step.keys.length ? "step done" : "step";

    chainSteps.push(`<span class="${cls}">${escapeHtml(step.label)}${done === step.keys.length ? " ✅" : ""}</span>`);
    chainSteps.push(`<span class="arrow">→</span>`);
  }

  if (chainSteps.length) {
    chainSteps.pop();
  }

  const prossimi = firstOpenKey
    ? `<p class="meta">Prossimo ticket nel piano Working: ${jiraLinkFromMap(firstOpenKey, byKey)} (${escapeHtml(byKey.get(firstOpenKey)?.status ?? "—")}).</p>`
    : `<p class="meta">Tutte le issue del piano Working risultano Fatte in Jira.</p>`;

  const doneRows = ctx.doneInPlan.slice(0, 24).map((row) => (
    `          <tr><td>${jiraLink(row.key, row.summary, row.type)}</td></tr>`
  )).join("\n");

  return [
    ""
  , '    <div class="insight-notes" data-insight-block="toolbar" aria-label="Appunti generali"></div>'
  , ""
  , "    <section>"
  , "      <h2>Stato attuale (sintesi Jira)</h2>"
  , "      <table>"
  , "        <thead>"
  , "          <tr><th>Area</th><th>Stato Jira</th><th>Prossimo step</th></tr>"
  , "        </thead>"
  , "        <tbody>"
  , sintesiRows.join("\n")
  , "        </tbody>"
  , "      </table>"
  , '      <div class="insight-notes" data-insight-block="sintesi" aria-label="Appunti sintesi"></div>'
  , "    </section>"
  , ""
  , "    <section>"
  , "      <div class=\"sprint-board-head\">"
  , "        <h2>Sprint board 68</h2>"
  , "        <div class=\"sprint-board-bulk\" role=\"group\" aria-label=\"Espandi o collassa sprint\">"
  , "          <button type=\"button\" class=\"action sprint-board-bulk-btn\" id=\"btn-sprint-board-expand-all\" title=\"Espandi tutti gli sprint\" aria-label=\"Espandi tutti gli sprint\">Espandi tutti</button>"
  , "          <button type=\"button\" class=\"action sprint-board-bulk-btn\" id=\"btn-sprint-board-collapse-all\" title=\"Collassa tutti gli sprint\" aria-label=\"Collassa tutti gli sprint\">Collassa tutti</button>"
  , "        </div>"
  , "      </div>"
  , "      <div class=\"sprint-board-cards\">"
  , sprintCards
  , "      </div>"
  , "    </section>"
  , ""
  , faseSections.join("\n\n")
  , ""
  , "    <section>"
  , "      <h2>Catena critica MVP Warzone</h2>"
  , '      <div class="flow">'
  , chainSteps.join("\n        ")
  , "      </div>"
  , '      <div class="insight-notes" data-insight-block="catena" aria-label="Appunti catena MVP"></div>'
  , "    </section>"
  , ""
  , "    <section>"
  , "      <h2>Prossimi 3 passi (operativi)</h2>"
  , '      <div class="panel rec">'
  , `        ${prossimi}`
  , "      </div>"
  , '      <div class="insight-notes" data-insight-block="prossimi" aria-label="Appunti prossimi passi"></div>'
  , "    </section>"
  , ""
  , "    <section>"
  , "      <h2>Già fatto (Jira verificato)</h2>"
  , "      <table>"
  , "        <thead>"
  , "          <tr><th>Issue</th></tr>"
  , "        </thead>"
  , "        <tbody>"
  , doneRows
  , "        </tbody>"
  , "      </table>"
  , '      <div class="insight-notes" data-insight-block="fatto" aria-label="Appunti completati"></div>'
  , "    </section>"
  , "",
  ].join("\n");
}

/**
 * Rimuove note manuali obsolete (workflow, footer) — non tocca il piano rigenerato.
 *
 * @param {string} html
 */
function resetWorkingStaticExtras(html) {
  let out = html;

  if (out.includes(WORKFLOW_START) && out.includes(WORKFLOW_END)) {
    out = replaceBetweenMarkers(out, WORKFLOW_START, WORKFLOW_END, CLEAN_WORKFLOW_INNER);
  }

  out = out.replace(
    /(<footer>[\s\S]*?)<span class="plan-note">[\s\S]*?<\/span>/g,
    "$1"
  );

  return out;
}

/**
 * @param {string} html
 * @param {string} startMarker
 * @param {string} endMarker
 * @param {string} replacement
 */
function replaceBetweenMarkers(html, startMarker, endMarker, replacement) {
  const start = html.indexOf(startMarker);
  const end   = html.indexOf(endMarker);

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Marker piano mancanti (${startMarker} / ${endMarker}) in jira.working.html`);
  }

  return `${html.slice(0, start + startMarker.length)}\n${replacement}\n${html.slice(end)}`;
}

/**
 * @param {string} html
 * @param {string} startMarker
 * @param {string} endMarker
 */
function removeBetweenMarkers(html, startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  const end   = html.indexOf(endMarker);

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Marker mancanti (${startMarker} / ${endMarker}) in jira.working.html`);
  }

  return `${html.slice(0, start)}${html.slice(end + endMarker.length)}`;
}

/**
 * @param {string} html
 * @param {string} startMarker
 * @param {string} endMarker
 */
function tryRemoveBetweenMarkers(html, startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  const end   = html.indexOf(endMarker);

  if (start === -1) {
    return html;
  }

  if (end === -1 || end <= start) {
    return html;
  }

  return `${html.slice(0, start)}${html.slice(end + endMarker.length)}`;
}

/**
 * @param {string} html
 */
function removeUiChrome(html) {
  if (html.includes(UI_CHROME_START) && html.includes(UI_CHROME_END)) {
    return removeBetweenMarkers(html, UI_CHROME_START, UI_CHROME_END);
  }

  if (html.includes(UI_CHROME_START)) {
    const start = html.indexOf(UI_CHROME_START);
    const plan  = html.indexOf(PLAN_START);

    if (plan > start) {
      return `${html.slice(0, start)}${html.slice(plan)}`;
    }
  }

  return html
    .replace(/\s*<div class="toolbar">[\s\S]*?(?=<!-- WORKING-PLAN-GENERATED-START -->)/, "\n")
    .replace(/\s*<div class="plan-cards"[\s\S]*?(?=<!-- WORKING-PLAN-GENERATED-START -->)/, "\n")
    .replace(/\s*<div class="plan-update-drawer"[\s\S]*?(?=<!-- WORKING-PLAN-GENERATED-START -->)/, "\n");
}

/**
 * @param {string} html
 */
function removeUiExtra(html) {
  let out = tryRemoveBetweenMarkers(html, UI_EXTRA_START, UI_EXTRA_END);

  if (out.includes(UI_EXTRA_START)) {
    const start = out.indexOf(UI_EXTRA_START);
    const next  = out.indexOf("<!-- WORKING-UI-MODALS-START -->", start);

    if (next > start) {
      out = `${out.slice(0, start)}${out.slice(next)}`;
    } else {
      const workflow = out.indexOf("<section>\n      <h2>Workflow agente", start);

      if (workflow > start) {
        out = `${out.slice(0, start)}${out.slice(workflow)}`;
      }
    }
  }

  return out.replace(
    /\s*<section id="plan-notes-journal-section">[\s\S]*?<\/section>/,
    ""
  );
}

/**
 * @param {string} html
 */
function removeUiModals(html) {
  let out = tryRemoveBetweenMarkers(html, UI_MODALS_START, UI_MODALS_END);

  if (out.includes(UI_MODALS_START)) {
    const start  = out.indexOf(UI_MODALS_START);
    const script = out.indexOf("<script", start);

    if (script > start) {
      out = `${out.slice(0, start)}${out.slice(script)}`;
    }
  }

  return out.replace(/\s*<div[^>]*id="archive-confirm-modal"[\s\S]*?<\/div>\s*(?=<script)/, "\n");
}

/**
 * @param {string} html
 */
function stripScripts(html) {
  return html.replace(/\s*<script[\s\S]*?<\/script>/gi, "");
}

/**
 * HTML archivio: solo piano leggibile, senza toolbar, card, cronologia o script.
 *
 * @param {string} html
 * @param {string} label
 */
export function buildArchiveSnapshotHtml(html, label) {
  let out = removeUiChrome(html);
  out = removeUiExtra(out);
  out = removeUiModals(out);
  out = stripScripts(out);

  const archiveBadge = [
    `      <p class="meta archive-snapshot-badge">`
  , `        📦 Archivio snapshot · ${escapeHtml(label)} · sola lettura`
  , `      </p>`,
  ].join("\n");

  if (out.includes("archive-snapshot-badge")) {
    out = out.replace(
      /\s*<p class="meta archive-snapshot-badge">[\s\S]*?<\/p>/,
      `\n${archiveBadge}`
    );
  } else {
    out = out.replace("</header>", `${archiveBadge}\n    </header>`);
  }

  out = out.replace(
    "<title>Jira Working — ordine di sviluppo backlog</title>",
    `<title>Jira Working — archivio ${escapeHtml(label)}</title>`
  );

  out = out.replace(
    /<title>Jira Working — archivio [^<]+<\/title>/,
    `<title>Jira Working — archivio ${escapeHtml(label)}</title>`
  );

  return out;
}

/**
 * Ripulisce archivi già salvati (toolbar, card, script).
 *
 * @returns {Promise<number>}
 */
export async function resanitizeWorkingPlanArchives() {
  const index = await listWorkingPlanArchives();
  let count   = 0;

  for (const entry of index) {
    const filePath = join(ARCHIVES_DIR, `${entry.id}.html`);
    const html     = await readFile(filePath, "utf8");
    const cleaned  = buildArchiveSnapshotHtml(html, entry.label);

    await writeFile(filePath, cleaned, "utf8");
    count += 1;
  }

  return count;
}

/**
 * @returns {Promise<Array<{ id: string, savedAt: string, label: string, issueCount: number }>>}
 */
export async function listWorkingPlanArchives() {
  if (!existsSync(ARCHIVE_INDEX)) {
    return [];
  }

  const raw    = await readFile(ARCHIVE_INDEX, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter((entry) => (
    entry
    && typeof entry.id === "string"
    && existsSync(join(ARCHIVES_DIR, `${entry.id}.html`))
  ));
}

/**
 * @param {string} id
 */
export function workingArchivePath(id) {
  if (!/^[0-9T\-Z]+$/.test(id)) {
    throw new Error("Id archivio non valido");
  }

  return join(ARCHIVES_DIR, `${id}.html`);
}

/**
 * @param {string} html
 * @param {string} label
 */
export function buildWorkingOldSnapshot(html, label) {
  let out = html;

  out = out.replace(
    /<title>Jira Working[^<]*<\/title>/i,
    `<title>Jira Working OLD — snapshot ${escapeHtml(label)}</title>`
  );

  out = out.replace(
    /<h1>Jira Working[^<]*<\/h1>/i,
    `<h1>Jira Working OLD <span class="old-snapshot-label">(${escapeHtml(label)})</span></h1>`
  );

  if (!out.includes("old-snapshot-notice")) {
    out = out.replace(
      "<!-- WORKING-HEADER-META-END -->",
      [
        `      <p class="meta old-snapshot-notice">`
      , `        📦 Snapshot precedente · sola lettura ·`
      , `        <a href="/jira-working.html">versione corrente</a>`
      , `      </p>`
      , "<!-- WORKING-HEADER-META-END -->",
      ].join("\n")
    );
  }

  if (!out.includes("old-snapshot-styles")) {
    out = out.replace(
      "</head>",
      [
        "  <style id=\"old-snapshot-styles\">"
      , "    .old-snapshot-label { font-size: 0.72em; font-weight: 600; color: var(--muted); }"
      , "    .old-snapshot-notice { margin-top: 0.35rem; padding: 0.45rem 0.65rem; border-radius: 6px;"
      , "      border: 1px solid var(--border); background: rgba(251, 191, 36, 0.08); color: var(--muted); }"
      , "    body[data-working-old=\"1\"] #btn-archive-regenerate,"
      , "    body[data-working-old=\"1\"] #btn-save-old-rebuild { display: none; }"
      , "  </style>"
      , "</head>",
      ].join("\n")
    );
  }

  if (!out.includes('data-working-old="1"')) {
    out = out.replace(/<body(\s[^>]*)?>/i, '<body data-working-old="1">');
  }

  return out;
}

/**
 * @returns {Promise<{ oldUrl: string, oldSavedAt: string, regeneratedAt: string, issueCount: number, projectTreeRegeneratedAt: string }>}
 */
export async function saveOldAndRebuildWorking() {
  if (!existsSync(WORKING_HTML)) {
    throw new Error("jira-working.html non trovato");
  }

  const htmlBefore = await readFile(WORKING_HTML, "utf8");
  const savedAt    = new Date();
  const label      = formatPlanLabel(savedAt);
  const oldHtml    = buildWorkingOldSnapshot(htmlBefore, label);

  await writeFile(WORKING_OLD_HTML, oldHtml, "utf8");

  const { regenerateProjectTreeHtml } = await import("./jira-project-tree-plan.mjs");
  const working                       = await regenerateWorkingPlanHtml();
  const projectTree                   = await regenerateProjectTreeHtml();

  return {
    oldUrl                    : "/jira-working-old.html",
    oldSavedAt                : label,
    regeneratedAt             : working.regeneratedAt,
    issueCount                : working.issueCount,
    projectTreeRegeneratedAt  : projectTree.regeneratedAt,
  };
}

/**
 * @returns {Promise<{ regeneratedAt: string, issueCount: number }>}
 */
export async function regenerateWorkingPlanHtml() {
  if (!existsSync(WORKING_HTML)) {
    throw new Error("jira-working.html non trovato");
  }

  const htmlBefore = await readFile(WORKING_HTML, "utf8");
  const ctx        = await buildWorkingPlanContext();
  const headerMeta = renderWorkingHeaderMeta(ctx);
  const planBody   = renderWorkingPlanBody(ctx);

  let html = replaceBetweenMarkers(htmlBefore, HEADER_START, HEADER_END, headerMeta);
  html = replaceBetweenMarkers(html, PLAN_START, PLAN_END, planBody);
  html = resetWorkingStaticExtras(html);
  html = injectKeyToBlockMap(html);

  await writeFile(WORKING_HTML, html, "utf8");

  return {
    regeneratedAt: ctx.scannedAt,
    issueCount   : ctx.issueCount,
  };
}

/**
 * @returns {Promise<{ archiveId: string, archiveUrl: string, regeneratedAt: string, issueCount: number }>}
 */
export async function archiveAndRegenerateWorkingPlan() {
  if (!existsSync(WORKING_HTML)) {
    throw new Error("jira-working.html non trovato");
  }

  await mkdir(ARCHIVES_DIR, { recursive: true });

  const htmlBefore  = await readFile(WORKING_HTML, "utf8");
  const ctx         = await buildWorkingPlanContext();
  const archiveId   = ctx.scannedAt.replace(/[:.]/g, "-");
  const archivePath = join(ARCHIVES_DIR, `${archiveId}.html`);
  const archiveHtml = buildArchiveSnapshotHtml(htmlBefore, ctx.label);

  await writeFile(archivePath, archiveHtml, "utf8");

  const headerMeta = renderWorkingHeaderMeta(ctx);
  const planBody   = renderWorkingPlanBody(ctx);

  let html = replaceBetweenMarkers(htmlBefore, HEADER_START, HEADER_END, headerMeta);
  html = replaceBetweenMarkers(html, PLAN_START, PLAN_END, planBody);
  html = resetWorkingStaticExtras(html);
  html = injectKeyToBlockMap(html);

  await writeFile(WORKING_HTML, html, "utf8");

  /** @type {Array<{ id: string, savedAt: string, label: string, issueCount: number }>} */
  const index = await listWorkingPlanArchives();
  const entry = {
    id         : archiveId,
    savedAt    : ctx.scannedAt,
    label      : ctx.label,
    issueCount : ctx.issueCount,
  };

  index.unshift(entry);
  await writeFile(ARCHIVE_INDEX, JSON.stringify(index.slice(0, 40), null, 2), "utf8");

  return {
    archiveId,
    archiveUrl   : `/jira-working-archive/${archiveId}.html`,
    regeneratedAt: ctx.scannedAt,
    issueCount   : ctx.issueCount,
  };
}
