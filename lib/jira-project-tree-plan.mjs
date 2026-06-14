/**
 * Rigenerazione Project Tree da Jira + piano Working (JLO_WORKING_PLAN).
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fetchJiraBacklog, isJiraStatusDone } from "./jira-backlog.mjs";
import { JLO_WORKING_PLAN, normalizeSprintLabel } from "./jira-working-order.mjs";

const LIB_DIR           = dirname(fileURLToPath(import.meta.url));
const CRUSCOTTO_DIR     = join(LIB_DIR, "..", "cruscotto");
const PROJECT_TREE_HTML = join(CRUSCOTTO_DIR, "jira-project-tree.html");

const TREE_DATA_START = "/* PROJECT-TREE-DATA-START */";
const TREE_DATA_END   = "/* PROJECT-TREE-DATA-END */";
const SPRINT_MAP_START = "/* PROJECT-TREE-SPRINT-MAP-START */";
const SPRINT_MAP_END   = "/* PROJECT-TREE-SPRINT-MAP-END */";
const HEADER_META_START = "<!-- PROJECT-TREE-HEADER-META-START -->";
const HEADER_META_END   = "<!-- PROJECT-TREE-HEADER-META-END -->";

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   meta?: string,
 *   jira?: string,
 *   issueType?: string,
 *   blocked?: boolean,
 *   doneDefault?: boolean,
 *   badge?: string,
 *   children?: TreeNode[],
 * }} TreeNode
 */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   badge: string,
 *   sprint: number,
 *   mode: "flat-keys" | "jira-epic" | "custom",
 *   epicKey?: string,
 *   syntheticChildren?: TreeNode[],
 * }} TreeBlockDef
 */

/** @type {TreeBlockDef[]} */
const TREE_BLOCK_DEFS = [
  {
    id    : "epic-done",
    label : "Già completato (repo + Jira)",
    badge : "epic",
    sprint: 1,
    mode  : "flat-keys",
  },
  {
    id    : "phase-0",
    label : "Fase 0 — Housekeeping",
    badge : "phase",
    sprint: 2,
    mode  : "custom",
    syntheticChildren: [
      {
        id          : "hk-97",
        label       : "Chiudere JLO-97 in Jira (create torneo già in repo)",
        jira        : "JLO-97",
        doneDefault : true,
      },
      {
        id    : "hk-247",
        label : "Chiudere JLO-247 in Jira (lista tornei già in repo)",
        jira  : "JLO-247",
      },
      {
        id    : "hk-637",
        label : "Chiudere epic JLO-637 in Jira",
        jira  : "JLO-637",
      },
      {
        id    : "JLO-846",
        label : "Gap test auth/API health",
        jira  : "JLO-846",
      },
      {
        id    : "JLO-924",
        label : "Scelta lingua creazione match",
        jira  : "JLO-924",
      },
    ],
  },
  {
    id      : "epic-849",
    label   : "Fase 1 — Admin MVP",
    badge   : "epic",
    sprint  : 3,
    mode    : "jira-epic",
    epicKey : "JLO-849",
    syntheticChildren: [
      {
        id    : "close-849",
        label : "Chiudere epic JLO-849",
        jira  : "JLO-849",
      },
    ],
  },
  {
    id      : "epic-773",
    label   : "Fase 2 — Notifiche P0",
    badge   : "epic",
    sprint  : 4,
    mode    : "jira-epic",
    epicKey : "JLO-773",
  },
  {
    id      : "epic-3",
    label   : "Fase 3 — Tornei Kill Race",
    badge   : "epic",
    sprint  : 5,
    mode    : "jira-epic",
    epicKey : "JLO-3",
  },
  {
    id    : "phase-chat",
    label : "Social · Chat & Gamebook",
    badge : "phase",
    sprint: 6,
    mode  : "flat-keys",
  },
  {
    id    : "phase-4",
    label : "Fase 4 — Sblocco test blocked",
    badge : "phase",
    sprint: 7,
    mode  : "custom",
    syntheticChildren: [
      {
        id    : "JLO-552",
        label : "API follow (UserFollow)",
        jira  : "JLO-552",
      },
      {
        id      : "JLO-886",
        label   : "Unblock test-user-follow-api",
        jira    : "JLO-886",
        blocked : true,
      },
      {
        id      : "JLO-847",
        label   : "Test follow reali",
        jira    : "JLO-847",
        blocked : true,
      },
      {
        id    : "unblock-696",
        label : "Completare JLO-696 BracketMatch API",
        jira  : "JLO-696",
      },
      {
        id      : "JLO-887",
        label   : "Unblock test-bracket-match-api",
        jira    : "JLO-887",
        blocked : true,
      },
      {
        id      : "JLO-848",
        label   : "Test bracket reali",
        jira    : "JLO-848",
        blocked : true,
      },
    ],
  },
  {
    id      : "epic-6",
    label   : "Fase 5 — Release",
    badge   : "epic",
    sprint  : 8,
    mode    : "jira-epic",
    epicKey : "JLO-6",
  },
  {
    id    : "postpone",
    label : "Posticipare (FuoriScope / Plus)",
    badge : "phase",
    sprint: 9,
    mode  : "flat-keys",
  },
];

/**
 * @param {Date} [date]
 */
function formatTreeLabel(date = new Date()) {
  return date.toLocaleString("it-IT", {
    day    : "2-digit",
    month  : "short",
    year   : "numeric",
  });
}

/**
 * @param {Awaited<ReturnType<typeof fetchJiraBacklog>>} backlog
 * @param {number} sprintNum
 */
function sprintBlockMeta(backlog, sprintNum) {
  const planBlock  = JLO_WORKING_PLAN.find((b) => b.sprint === sprintNum);
  const sprintName = planBlock?.name ?? `Sprint ${sprintNum}`;
  const jiraSprint = backlog.jiraSprintsByName[normalizeSprintLabel(sprintName)] ?? null;
  const stateWord  = jiraSprint
    ? (jiraSprint.state === "active" ? "attivo" : jiraSprint.state === "future" ? "future" : "chiuso")
    : "—";

  return `${sprintName}${jiraSprint ? ` · Jira id ${jiraSprint.id}` : ""} · ${stateWord}`;
}

/**
 * @param {{ status: string, summary: string, key: string }} row
 */
function issueMeta(row) {
  return `Jira: ${row.status} · ${row.summary}`;
}

/**
 * @param {{ key: string, status: string, summary: string, devSort?: number | null }} row
 * @param {boolean} [blocked]
 * @returns {TreeNode}
 */
function leafFromIssue(row, blocked = false) {
  /** @type {TreeNode} */
  const node = {
    id        : row.key,
    label     : row.summary,
    jira      : row.key,
    issueType : row.type,
    meta      : issueMeta(row),
  };

  if (blocked) {
    node.blocked = true;
  }

  if (isJiraStatusDone(row.status)) {
    node.doneDefault = true;
  }

  return node;
}

/**
 * @param {Awaited<ReturnType<typeof fetchJiraBacklog>>} backlog
 * @param {string} storyKey
 */
function allSubtasksForStory(backlog, storyKey) {
  return backlog.issues
    .filter((row) => row.tier === "subtask" && row.parentKey === storyKey)
    .sort((a, b) => {
      const sortA = a.devSort ?? Number.MAX_SAFE_INTEGER;
      const sortB = b.devSort ?? Number.MAX_SAFE_INTEGER;

      if (sortA !== sortB) {
        return sortA - sortB;
      }

      return a.key.localeCompare(b.key);
    });
}

/**
 * @param {TreeNode} node
 * @param {TreeNode} [synth]
 */
function applySyntheticOverlay(node, synth) {
  if (!synth) {
    return node;
  }

  return {
    ...node
  , id          : synth.id ?? node.id
  , label       : synth.label ?? node.label
  , blocked     : synth.blocked ?? node.blocked
  , doneDefault : synth.doneDefault ?? node.doneDefault
  };
}

/**
 * @param {Awaited<ReturnType<typeof fetchJiraBacklog>>} backlog
 * @param {typeof backlog.issues[number]} row
 * @param {TreeNode} [base]
 */
function enrichStoryNode(backlog, row, base = null) {
  /** @type {TreeNode} */
  const node     = base ?? leafFromIssue(row);
  const subtasks = allSubtasksForStory(backlog, row.key);

  if (subtasks.length) {
    node.children = subtasks.map((sub) => leafFromIssue(sub));
  }

  return node;
}

/**
 * Albero story → subtask per un blocco (piano keys o epic children).
 *
 * @param {Awaited<ReturnType<typeof fetchJiraBacklog>>} backlog
 * @param {string[]} orderedKeys
 * @param {Map<string, TreeNode>} [synthOverlay]
 */
function buildHierarchicalBlock(
  backlog
, orderedKeys
, synthOverlay = new Map()
) {
  /** @type {Map<string, typeof backlog.issues[number]>} */
  const byKey  = new Map(backlog.issues.map((row) => [row.key, row]));
  /** @type {Set<string>} */
  const emitKeys = new Set();
  /** @type {TreeNode[]} */
  const roots    = [];

  for (const key of orderedKeys) {
    const row = byKey.get(key);

    if (!row) {
      continue;
    }

    let rootKey = key;

    if (row.tier === "subtask" && row.parentKey) {
      const parent = byKey.get(row.parentKey);

      if (parent?.tier === "task") {
        rootKey = row.parentKey;
      }
    }

    if (emitKeys.has(rootKey)) {
      continue;
    }

    const rootRow = byKey.get(rootKey);

    if (!rootRow) {
      continue;
    }

    /** @type {TreeNode} */
    let node;

    if (rootRow.tier === "task") {
      node = enrichStoryNode(backlog, rootRow);
    } else {
      node = leafFromIssue(rootRow);
    }

    node = applySyntheticOverlay(node, synthOverlay.get(rootKey) ?? synthOverlay.get(key));
    roots.push(node);
    emitKeys.add(rootKey);
  }

  return roots;
}

/**
 * @param {Awaited<ReturnType<typeof fetchJiraBacklog>>["issues"]} issues
 * @param {string} parentKey
 */
function sortByDevOrder(issues, parentKey) {
  return issues
    .filter((row) => row.parentKey === parentKey)
    .sort((a, b) => {
      const sortA = a.devSort ?? Number.MAX_SAFE_INTEGER;
      const sortB = b.devSort ?? Number.MAX_SAFE_INTEGER;

      if (sortA !== sortB) {
        return sortA - sortB;
      }

      return a.key.localeCompare(b.key);
    });
}

/**
 * @param {Awaited<ReturnType<typeof fetchJiraBacklog>>} backlog
 * @param {number} sprintNum
 * @param {string} epicKey
 * @param {TreeNode[]} [syntheticAfter]
 */
function buildJiraEpicChildren(backlog, sprintNum, epicKey, syntheticAfter = []) {
  const inSprint = backlog.issues.filter(
    (row) => row.devSprint === sprintNum && row.key !== epicKey
  );
  const stories  = sortByDevOrder(inSprint, epicKey);
  const storyKeys  = stories.map((row) => row.key);
  const children   = buildHierarchicalBlock(backlog, storyKeys);

  const synthetics = (syntheticAfter ?? []).map((node) => {
    if (!node.jira) {
      return { ...node };
    }

    const row = backlog.issues.find((issue) => issue.key === node.jira);

    if (!row) {
      return { ...node };
    }

    /** @type {TreeNode} */
    const built = row.tier === "task"
      ? enrichStoryNode(backlog, row)
      : leafFromIssue(row);

    return applySyntheticOverlay(built, node);
  });

  return [...children, ...synthetics];
}

/**
 * @param {Awaited<ReturnType<typeof fetchJiraBacklog>>} backlog
 * @param {number} sprintNum
 */
function buildFlatChildren(backlog, sprintNum) {
  const planBlock = JLO_WORKING_PLAN.find((b) => b.sprint === sprintNum);

  if (!planBlock) {
    return [];
  }

  return buildHierarchicalBlock(backlog, planBlock.keys);
}

/**
 * @param {Awaited<ReturnType<typeof fetchJiraBacklog>>} backlog
 * @param {TreeBlockDef} def
 */
function buildBlockChildren(backlog, def) {
  if (def.mode === "jira-epic" && def.epicKey) {
    return buildJiraEpicChildren(
      backlog
    , def.sprint
    , def.epicKey
    , def.syntheticChildren ?? []
    );
  }

  if (def.mode === "custom") {
    const synthetics   = def.syntheticChildren ?? [];
    /** @type {Map<string, TreeNode>} */
    const synthOverlay = new Map(
      synthetics
        .filter((node) => node.jira)
        .map((node) => [/** @type {string} */ (node.jira), node])
    );
    const covered      = new Set(synthOverlay.keys());
    const planBlock    = JLO_WORKING_PLAN.find((b) => b.sprint === def.sprint);
    const extraKeys    = (planBlock?.keys ?? []).filter((key) => !covered.has(key));
    const orderedKeys  = [
      ...synthetics.map((node) => node.jira).filter(Boolean)
    , ...extraKeys
    ];

    return buildHierarchicalBlock(backlog, orderedKeys, synthOverlay);
  }

  return buildFlatChildren(backlog, def.sprint);
}

/**
 * @param {Awaited<ReturnType<typeof fetchJiraBacklog>>} backlog
 */
export function buildProjectTreeNodes(backlog) {
  /** @type {TreeNode[]} */
  const tree = [];

  for (const def of TREE_BLOCK_DEFS) {
    const planBlock = JLO_WORKING_PLAN.find((b) => b.sprint === def.sprint);

    if (!planBlock) {
      throw new Error(`TREE_BLOCK_DEFS: sprint ${def.sprint} (${def.id}) assente in JLO_WORKING_PLAN`);
    }

    const epicRow = def.epicKey
      ? backlog.issues.find((row) => row.key === def.epicKey)
      : null;

    /** @type {TreeNode} */
    const block = {
      id       : def.id,
      label    : def.label,
      badge    : def.badge,
      meta     : sprintBlockMeta(backlog, def.sprint),
      children : buildBlockChildren(backlog, def),
    };

    if (def.epicKey) {
      block.jira = def.epicKey;

      if (epicRow) {
        block.meta = `${sprintBlockMeta(backlog, def.sprint)} · epic ${epicRow.status}`;
      }
    }

    tree.push(block);
  }

  return tree;
}

/**
 * Mappa nome sprint piano Working → id blocco Project Tree (per insight e UI).
 *
 * @returns {Record<string, string>}
 */
export function buildSprintNameToTreeBlockMap() {
  /** @type {Record<string, string>} */
  const map = {};

  for (const def of TREE_BLOCK_DEFS) {
    const planBlock = JLO_WORKING_PLAN.find((b) => b.sprint === def.sprint);

    if (planBlock) {
      map[planBlock.name] = def.id;
    }
  }

  for (const planBlock of JLO_WORKING_PLAN) {
    if (!Object.prototype.hasOwnProperty.call(map, planBlock.name)) {
      throw new Error(`JLO_WORKING_PLAN sprint ${planBlock.sprint} (${planBlock.name}) senza blocco in TREE_BLOCK_DEFS`);
    }
  }

  return map;
}

/**
 * @param {Record<string, string>} map
 */
export function renderSprintNameToTreeBlockJs(map) {
  const entries = Object.entries(map);
  const body    = entries.map(([name, id], index) => {
    const prefix = index === 0 ? " " : ",";

    return `${prefix} ${JSON.stringify(name)} : ${JSON.stringify(id)}`;
  }).join("\n");

  return `    const SPRINT_NAME_TO_TREE_BLOCK = {\n${body}\n    };\n`;
}

/**
 * @param {string} html
 */
function injectSprintNameToTreeBlockMap(html) {
  const map = buildSprintNameToTreeBlockMap();
  const js  = renderSprintNameToTreeBlockJs(map);

  return replaceBetweenMarkers(html, SPRINT_MAP_START, SPRINT_MAP_END, js);
}

/**
 * @param {TreeNode[]} tree
 */
export function renderProjectTreeJs(tree) {
  const json = JSON.stringify(tree, null, 2)
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");

  return `    const PROJECT_TREE = ${json.trimStart()};\n`;
}

/**
 * @param {Date} scannedAt
 */
export function renderProjectTreeHeaderMeta(scannedAt) {
  const label = formatTreeLabel(scannedAt);

  return [
    "      <p class=\"meta\">"
  , `        Albero di sviluppo con check <strong>Fatto</strong> · rigenerato ${label} da Jira + piano Working ·`
  , `        <a href="https://myfuturejobsearch.atlassian.net/jira/software/projects/JLO/boards/68">Board JLO</a> ·`
  , `        <a href="/jira-working.html">vista testuale</a> ·`
  , `        <a href="/backlog.html">Backlog</a> ·`
  , `        <a href="/my-project.html">My Project</a>`
  , "      </p>",
  ].join("\n");
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
    throw new Error(`Marker mancanti (${startMarker} / ${endMarker}) in jira-project-tree.html`);
  }

  return `${html.slice(0, start + startMarker.length)}\n${replacement}\n${html.slice(end)}`;
}

/**
 * @returns {Promise<{ regeneratedAt: string, issueCount: number, sprint4Keys: string[] }>}
 */
export async function regenerateProjectTreeHtml() {
  if (!existsSync(PROJECT_TREE_HTML)) {
    throw new Error("jira-project-tree.html non trovato");
  }

  const htmlBefore = await readFile(PROJECT_TREE_HTML, "utf8");
  const backlog    = await fetchJiraBacklog();
  const scannedAt  = new Date();
  const tree       = buildProjectTreeNodes(backlog);
  const treeJs     = renderProjectTreeJs(tree);
  const headerMeta = renderProjectTreeHeaderMeta(scannedAt);

  let html = replaceBetweenMarkers(htmlBefore, HEADER_META_START, HEADER_META_END, headerMeta);
  html = replaceBetweenMarkers(html, TREE_DATA_START, TREE_DATA_END, treeJs);
  html = injectSprintNameToTreeBlockMap(html);

  await writeFile(PROJECT_TREE_HTML, html, "utf8");

  const epic773 = tree.find((block) => block.id === "epic-773");
  const sprint4Keys = (epic773?.children ?? [])
    .flatMap((node) => [
      node.jira,
      ...(node.children ?? []).map((child) => child.jira),
    ])
    .filter(Boolean);

  return {
    regeneratedAt : scannedAt.toISOString(),
    issueCount    : backlog.total,
    sprint4Keys,
  };
}
