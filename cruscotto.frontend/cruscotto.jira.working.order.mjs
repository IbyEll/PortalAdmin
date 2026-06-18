/**
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-17
 *
 * Ordine di sviluppo JLO — piano MVP, devOrder e regole sprint 6.
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - colonna «Ordine Sviluppo» backlog e pagine working/project tree devono condividere le stesse regole
 *   - JLO_WORKING_PLAN è la fonte unica sprint → issue key per cruscotto e JiraCORE
 *
 *   A cosa serve:
 *   - applyDevOrder, mergeWorkingSprintKeys — numerazione devOrder su righe backlog
 *   - JLO_SPRINT_6_PHASES, JLO_SPRINT_6_OBSOLETE — eccezioni sprint 6 e issue obsolete
 *   - normalizeSprintLabel, boardKeysForWorkingPlanBlock — allineamento nomi sprint Jira board
 *
 *   Regole colonna «Ordine Sviluppo» (backlog cruscotto):
 *   - Epic nel piano MVP → numero sprint; Story/Bug/Todo → sprint.seq; subtask → storyOrder.sub
 *   - Fuori piano → null; sprint 6 obsolete → null; tail sprint 6 → maxPlanSeq+1
 *
 * Generalizzazione:
 *   No — JLO_WORKING_PLAN e pin epic legacy hardcoded per JustLastOne.
 *
 * Input:
 *   - —
 *
 * Consumatori:
 *   - cruscotto.jira.backlog.mjs — applyDevOrder su fetchJiraBacklog
 *   - cruscotto.jira.backlog.insights.mjs, working.insights.mjs — boardKeysForWorkingPlanBlock
 *   - cruscotto.jira.working.plan.mjs, project.tree.plan.mjs — piano UI
 *   - JiraCORE/create-jlo-sprints.mjs, sync-repo-catalog.mjs — tooling sprint e catalogo
 *   - cruscotto.database/load-backlog.mjs — normalizeSprintLabel
 *
 * Export principali:
 *   - JLO_WORKING_PLAN, JLO_SPRINT_6_PHASES — definizione piano MVP
 *   - applyDevOrder, mergeWorkingSprintKeys, normalizeSprintLabel — ordine e sprint
 *   - isSprint6ObsoleteIssue, sprint6ObsoleteKeySet — policy sprint 6
 */

/**
 * @typedef {{
 *   sprint: number,
 *   name: string,
 *   keys: string[],
 * }} WorkingSprintBlock
 */

/**
 * @typedef {{
 *   label: string,
 *   roots: Array<{ key: string, subtasks?: string[] }>,
 * }} SprintExecutionPhase
 */

/** Ordine esecuzione Sprint 6 — allineato a jira.project.tree.html `sprint6-order`. */
/** @type {SprintExecutionPhase[]} */
export const JLO_SPRINT_6_PHASES = [
  {
    label : "Fase 0 — Social"
  , roots : [
      {
        key       : "JLO-507"
      , subtasks  : ["JLO-524", "JLO-525", "JLO-616", "JLO-526"]
      }
    ]
  }
, {
    label : "Fase 1 — Feed"
  , roots : [
      {
        key       : "JLO-533"
      , subtasks  : ["JLO-544", "JLO-545", "JLO-546"]
      }
    ]
  }
, {
    label : "Fase 2 — Gamebook"
  , roots : [
      {
        key       : "JLO-952"
      , subtasks  : ["JLO-953", "JLO-955", "JLO-954", "JLO-956", "JLO-957", "JLO-958"]
      }
    ]
  }
, {
    label : "Fase 3 — Chat DM"
  , roots : [
      {
        key       : "JLO-290"
      , subtasks  : ["JLO-291", "JLO-295", "JLO-293", "JLO-292", "JLO-296", "JLO-297", "JLO-294"]
      }
    ]
  }
, {
    label : "Fase 4 — Chat lobby"
  , roots : [
      {
        key       : "JLO-299"
      , subtasks  : ["JLO-301", "JLO-303", "JLO-300", "JLO-304", "JLO-302", "JLO-305", "JLO-306"]
      }
    ]
  }
];

/**
 * Chiavi piano Sprint 6 in ordine esecuzione (story + subtask esplicite).
 * @returns {string[]}
 */
export function sprint6ExecutionPlanKeys() {
  /** @type {string[]} */
  const keys = [];

  for (const phase of JLO_SPRINT_6_PHASES) {
    for (const root of phase.roots) {
      keys.push(root.key);

      if (root.subtasks) {
        keys.push(...root.subtasks);
      }
    }
  }

  return keys;
}

/**
 * @typedef {{
 *   key: string,
 *   replacedBy?: string,
 *   reason: string,
 * }} SprintObsoleteEntry
 */

/** Duplicati / legacy Sprint 6 — scope in JLO-952 o fuori piano Fase 0–4. */
/** @type {SprintObsoleteEntry[]} */
export const JLO_SPRINT_6_OBSOLETE = [
  {
    key        : "JLO-446"
  , replacedBy : "JLO-953"
  , reason     : "Shell UI Gamebook → story JLO-952"
  }
, {
    key        : "JLO-447"
  , replacedBy : "JLO-954"
  , reason     : "Upload immagine → story JLO-952"
  }
, {
    key        : "JLO-448"
  , replacedBy : "JLO-957"
  , reason     : "Share feed amici → story JLO-952"
  }
, {
    key        : "JLO-539"
  , replacedBy : "JLO-290"
  , reason     : "Real-time OneNote — sostituito da chat REST JLO-290/299"
  }
, {
    key        : "JLO-307"
  , replacedBy : "JLO-773"
  , reason     : "Notifiche inviti partita — epic Sprint 4 Notifiche"
  }
, {
    key        : "JLO-313"
  , replacedBy : "JLO-773"
  , reason     : "Notifiche tornei — epic Sprint 4 Notifiche"
  }
];

/** Epic / issue sul board Jira ma non nel piano esecuzione (contenitori o sprint errato). */
export const JLO_SPRINT_6_BOARD_NOISE = [
  "JLO-445"
, "JLO-4"
, "JLO-3"
, "JLO-849"
];

/**
 * @returns {Set<string>}
 */
export function sprint6ObsoleteKeySet() {
  return new Set(JLO_SPRINT_6_OBSOLETE.map((entry) => entry.key));
}

/**
 * @returns {Map<string, SprintObsoleteEntry>}
 */
export function sprint6ObsoleteByKey() {
  return new Map(JLO_SPRINT_6_OBSOLETE.map((entry) => [entry.key, entry]));
}

/**
 * Story root Sprint 6 in ordine esecuzione (rank board Jira).
 * @returns {string[]}
 */
export function sprint6BoardStoryRankKeys() {
  /** @type {string[]} */
  const keys = [];

  for (const phase of JLO_SPRINT_6_PHASES) {
    for (const root of phase.roots) {
      keys.push(root.key);
    }
  }

  return keys;
}

/**
 * Coda board Sprint 6 — obsoleti + epic rumore (dopo le story attive).
 * @returns {string[]}
 */
export function sprint6BoardTailKeys() {
  return [
    ...JLO_SPRINT_6_OBSOLETE.map((entry) => entry.key)
  , ...JLO_SPRINT_6_BOARD_NOISE
  ];
}

/**
 * @param {string} key
 * @param {{ summary?: string } | undefined} row
 * @returns {boolean}
 */
export function isSprint6ObsoleteIssue(key, row) {
  if (sprint6ObsoleteKeySet().has(key)) {
    return true;
  }

  const summary = row?.summary ?? "";

  return /^\[Obsoleto\]/i.test(summary) || /\[Obsoleto\]/i.test(summary);
}

/**
 * Azzera ordine sviluppo per issue Sprint 6 obsolete (duplicati / fuori piano Fase 0–4).
 *
 * @param {Array<{ key: string, tier?: string, type?: string, summary?: string, parentKey?: string | null, devOrder?: string | null, devSort?: number | null, isSprint6Obsolete?: boolean }>} issues
 */
export function applySprint6ObsoleteDevOrder(issues) {
  const byKey = new Map(issues.map((row) => [row.key, row]));

  for (const row of issues) {
    if (!isSprint6ObsoleteIssue(row.key, row)) {
      continue;
    }

    row.isSprint6Obsolete = true;
    row.devOrder          = null;
    row.devSort           = null;
  }

  for (const row of issues) {
    if (row.tier !== "subtask" || !row.parentKey) {
      continue;
    }

    const parent = byKey.get(row.parentKey);

    if (parent?.isSprint6Obsolete) {
      row.isSprint6Obsolete = true;
      row.devOrder          = null;
      row.devSort           = null;
    }
  }

  return issues;
}

/**
 * @param {{ key?: string, devSprint?: number | null, devSprintName?: string | null, jiraSprints?: Array<{ name?: string }> }} row
 * @returns {boolean}
 */
export function isSprint6AffiliatedRow(row) {
  if (row.devSprint === 6) {
    return true;
  }

  const sprint6Name = JLO_WORKING_PLAN.find((block) => block.sprint === 6)?.name ?? "";

  if (
    sprint6Name
    && normalizeSprintLabel(row.devSprintName ?? "") === normalizeSprintLabel(sprint6Name)
  ) {
    return true;
  }

  for (const sprint of row.jiraSprints ?? []) {
    const label = normalizeSprintLabel(sprint.name ?? "");

    if (label.includes("sprint 6") && label.includes("chat")) {
      return true;
    }
  }

  return Boolean(row.key && JLO_SPRINT_6_BOARD_NOISE.includes(row.key));
}

/**
 * Sprint 6 — ordine dopo il piano: seq = planMaxSeq(6) + 1, +2, … per issue sul board non nel piano.
 *
 * @param {Array<{ key: string, tier?: string, type?: string, summary?: string, parentKey?: string | null, devOrder?: string | null, devSprint?: number | null, devSprintName?: string | null, devSort?: number | null, jiraSprints?: Array<{ name?: string }> }>} issues
 */
export function applySprint6TailDevOrder(issues) {
  const planKeys     = new Set(sprint6ExecutionPlanKeys());
  const sprint6Block = JLO_WORKING_PLAN.find((block) => block.sprint === 6);
  const sprint6Name  = sprint6Block?.name ?? "Sprint 6 — Chat & Gamebook";
  const planMaxSeq   = planMaxSeqForSprint(6) ?? 0;

  /** @type {typeof issues} */
  const tailRoots = [];

  for (const row of issues) {
    if (row.tier === "subtask") {
      continue;
    }

    if (isSprint6ObsoleteIssue(row.key, row)) {
      continue;
    }

    if (planKeys.has(row.key)) {
      continue;
    }

    if (!isSprint6AffiliatedRow(row)) {
      continue;
    }

    tailRoots.push(row);
  }

  tailRoots.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

  /** @type {Map<string, number>} */
  const parentTailSeq = new Map();

  tailRoots.forEach((row, index) => {
    const seq           = planMaxSeq + index + 1;
    row.devOrder        = `6.${seq}`;
    row.devSprint       = 6;
    row.devSprintName   = sprint6Name;
    row.devSort         = buildSortKey(6, seq);
    parentTailSeq.set(row.key, seq);
  });

  /** @type {Map<string, typeof issues>} */
  const subtasksByParent = new Map();

  for (const row of issues) {
    if (row.tier !== "subtask" || !row.parentKey) {
      continue;
    }

    if (!subtasksByParent.has(row.parentKey)) {
      subtasksByParent.set(row.parentKey, []);
    }

    subtasksByParent.get(row.parentKey).push(row);
  }

  for (const [parentKey, subtasks] of subtasksByParent) {
    const parentSeq = parentTailSeq.get(parentKey);

    if (parentSeq == null) {
      continue;
    }

    subtasks.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

    subtasks.forEach((row, index) => {
      if (isSprint6ObsoleteIssue(row.key, row)) {
        return;
      }

      row.devOrder      = `6.${parentSeq}.${index + 1}`;
      row.devSprint     = 6;
      row.devSprintName = sprint6Name;
      row.devSort       = buildSortKey(6, parentSeq, index + 1);
    });
  }

  return issues;
}

/**
 * Ultimo seq nel piano Working per numero sprint (es. Sprint 6 → 32).
 *
 * @param {number} sprint
 * @returns {number | null}
 */
export function planMaxSeqForSprint(sprint) {
  return maxPlanSeqBySprint().get(sprint) ?? null;
}

/** @type {WorkingSprintBlock[]} */
export const JLO_WORKING_PLAN = [
  {
    sprint: 1,
    name  : "Sprint 1 — Completato",
    keys  : ["JLO-850", "JLO-851", "JLO-852", "JLO-913", "JLO-690", "JLO-922", "JLO-923"],
  },
  {
    sprint: 2,
    name  : "Sprint 2 — Fase 0",
    keys  : ["JLO-97", "JLO-247", "JLO-637", "JLO-846", "JLO-924"],
  },
  {
    sprint: 3,
    name  : "Sprint 3 — Admin MVP",
    keys  : ["JLO-849", "JLO-930", "JLO-931", "JLO-932", "JLO-933"],
  },
  {
    sprint: 4,
    name  : "Sprint 4 — Notifiche",
    keys  : [
      "JLO-773",
      "JLO-774",
      "JLO-779",
      "JLO-780",
      "JLO-781",
      "JLO-775",
      "JLO-784",
      "JLO-785",
      "JLO-786",
      "JLO-776",
      "JLO-711",
    ],
  },
  {
    sprint: 5,
    name  : "Sprint 5 — Tornei",
    keys  : ["JLO-3", "JLO-100", "JLO-103", "JLO-256", "JLO-257", "JLO-500"],
  },
  {
    sprint: 6,
    name  : "Sprint 6 — Chat & Gamebook",
    keys  : sprint6ExecutionPlanKeys(),
  },
  {
    sprint: 7,
    name  : "Sprint 7 — Sblocco",
    keys  : ["JLO-552", "JLO-886", "JLO-847", "JLO-696", "JLO-887", "JLO-848"],
  },
  {
    sprint: 8,
    name  : "Sprint 8 — Release",
    keys  : ["JLO-6", "JLO-872", "JLO-871", "JLO-121"],
  },
  {
    sprint: 9,
    name  : "Sprint 9 — Plus",
    keys  : ["JLO-873", "JLO-875", "JLO-876", "JLO-874", "JLO-95", "JLO-695"],
  },
];

/**
 * IssueKEY flat dal piano MVP — tooling catalogo/sprint senza dipendere dal nome export.
 *
 * @returns {string[]}
 */
export function collectWorkingPlanTicketKeys() {
  return JLO_WORKING_PLAN.flatMap((block) => block.keys);
}

/**
 * @typedef {{
 *   sprint: number,
 *   seq: number,
 *   sprintName: string,
 *   label: string,
 *   sortKey: number,
 *   isEpic: boolean,
 * }} DevOrderInfo
 */

/**
 * @returns {Map<number, string>}
 */
function sprintNameByNumber() {
  /** @type {Map<number, string>} */
  const map = new Map();

  for (const block of JLO_WORKING_PLAN) {
    map.set(block.sprint, block.name);
  }

  return map;
}

/**
 * @returns {Map<number, number>}
 */
function maxPlanSeqBySprint() {
  /** @type {Map<number, number>} */
  const map = new Map();

  for (const block of JLO_WORKING_PLAN) {
    map.set(block.sprint, block.keys.length);
  }

  return map;
}

/**
 * @param {string} type
 * @returns {boolean}
 */
function isEpicType(type) {
  return type.toLowerCase().includes("epic");
}

/**
 * @returns {Map<string, DevOrderInfo>}
 */
export function buildDevOrderMap() {
  /** @type {Map<string, DevOrderInfo>} */
  const map = new Map();

  for (const block of JLO_WORKING_PLAN) {
    block.keys.forEach((key, index) => {
      if (map.has(key)) {
        return;
      }

      const seq = index + 1;

      map.set(key, {
        sprint    : block.sprint,
        seq,
        sprintName: block.name,
        label     : `${block.sprint}.${seq}`,
        sortKey   : block.sprint * 100 + seq,
        isEpic    : false,
      });
    });
  }

  return map;
}

/**
 * @param {number} sprint
 * @param {number} storySeq
 * @param {number} [subSeq]
 * @returns {number}
 */
function buildSortKey(sprint, storySeq, subSeq = 0) {
  return sprint * 1_000_000 + storySeq * 1_000 + subSeq;
}

/**
 * @param {{ tier?: string, parentKey?: string | null, type?: string }} row
 * @param {Map<string, { tier?: string, parentKey?: string | null, type?: string, key: string }>} byKey
 * @returns {string | null}
 */
function findPlannedEpicKey(row, byKey, orderMap) {
  let current = row;

  while (current) {
    if (current.tier === "epic" || isEpicType(current.type ?? "")) {
      return orderMap.has(/** @type {{ key: string }} */ (current).key)
        ? /** @type {{ key: string }} */ (current).key
        : null;
    }

    current = current.parentKey ? byKey.get(current.parentKey) ?? null : null;
  }

  return null;
}

/**
 * @param {Array<{ key: string, tier?: string, type?: string, parentKey?: string | null, devOrder?: string | null, devSprint?: number | null, devSprintName?: string | null, devSort?: number | null }>} issues
 */
export function applyDevOrder(issues) {
  const orderMap = buildDevOrderMap();
  const maxSeqBySprint = maxPlanSeqBySprint();
  const sprintNames = sprintNameByNumber();
  const byKey = new Map(issues.map((row) => [row.key, row]));

  for (const row of issues) {
    row.devOrder = null;
    row.devSprint = null;
    row.devSprintName = null;
    row.devSort = null;
  }

  for (const row of issues) {
    const plan = orderMap.get(row.key);

    if (!plan) {
      continue;
    }

    const epic = row.tier === "epic" || isEpicType(row.type ?? "");

    row.devSprint = plan.sprint;
    row.devSprintName = plan.sprintName;

    if (epic) {
      row.devOrder = String(plan.sprint);
      row.devSort = buildSortKey(plan.sprint, 0);
      continue;
    }

    row.devOrder = `${plan.sprint}.${plan.seq}`;
    row.devSort = buildSortKey(plan.sprint, plan.seq);
  }

  /** @type {Map<string, typeof issues>} */
  const unplannedByEpic = new Map();

  for (const row of issues) {
    if (row.devOrder || row.tier !== "task") {
      continue;
    }

    const epicKey = findPlannedEpicKey(row, byKey, orderMap);

    if (!epicKey) {
      continue;
    }

    if (!unplannedByEpic.has(epicKey)) {
      unplannedByEpic.set(epicKey, []);
    }

    unplannedByEpic.get(epicKey).push(row);
  }

  for (const [epicKey, stories] of unplannedByEpic) {
    const epicPlan = orderMap.get(epicKey);

    if (!epicPlan) {
      continue;
    }

    const base = maxSeqBySprint.get(epicPlan.sprint) ?? epicPlan.seq;

    stories.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

    stories.forEach((row, index) => {
      const storySeq = base + index + 1;

      row.devOrder = `${epicPlan.sprint}.${storySeq}`;
      row.devSprint = epicPlan.sprint;
      row.devSprintName = epicPlan.sprintName;
      row.devSort = buildSortKey(epicPlan.sprint, storySeq);
    });
  }

  /** @type {Map<string, typeof issues>} */
  const subtasksByParent = new Map();

  for (const row of issues) {
    if (row.tier !== "subtask") {
      continue;
    }

    const bucket = row.parentKey ?? "__none__";

    if (!subtasksByParent.has(bucket)) {
      subtasksByParent.set(bucket, []);
    }

    subtasksByParent.get(bucket).push(row);
  }

  for (const [parentKey, subtasks] of subtasksByParent) {
    const parent = byKey.get(parentKey);
    const parentOrder = parent?.devOrder;

    if (!parentOrder || !parentOrder.includes(".")) {
      continue;
    }

    const [sprintPart, storyPart] = parentOrder.split(".");
    const sprint = Number(sprintPart);
    const storySeq = Number(storyPart);

    if (!Number.isFinite(sprint) || !Number.isFinite(storySeq)) {
      continue;
    }

    subtasks.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

    subtasks.forEach((row, index) => {
      const subSeq = index + 1;

      row.devOrder = `${sprint}.${storySeq}.${subSeq}`;
      row.devSprint = sprint;
      row.devSprintName = sprintNames.get(sprint) ?? null;
      row.devSort = buildSortKey(sprint, storySeq, subSeq);
    });
  }

  return issues;
}

/**
 * @param {string} name
 */
export function normalizeSprintLabel(name) {
  return String(name)
    .toLowerCase()
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Chiavi issue sullo sprint board Jira (Agile API) per un blocco piano Working.
 *
 * @param {Record<string, string[]> | undefined} boardSprintKeysByPlanName
 * @param {string} sprintName
 * @returns {string[]}
 */
export function boardKeysForWorkingPlanBlock(boardSprintKeysByPlanName, sprintName) {
  return boardSprintKeysByPlanName?.[sprintName] ?? [];
}

/**
 * Chiavi piano Working + issue sul board Jira non ancora nel piano (ordine: piano, poi board).
 *
 * @param {string[]} planKeys
 * @param {string[]} boardKeys
 * @returns {string[]}
 */
export function mergeWorkingSprintKeys(planKeys, boardKeys) {
  /** @type {Set<string>} */
  const seen   = new Set(planKeys);
  /** @type {string[]} */
  const merged = [...planKeys];

  for (const key of boardKeys) {
    if (!seen.has(key)) {
      merged.push(key);
      seen.add(key);
    }
  }

  return merged;
}

/**
 * Sprint Jira chiusi/storici non nel piano Working → bucket distinti in vista Per Sprint.
 *
 * @type {Array<{ pattern: RegExp, sprint: number, sprintName: string, jiraId: number, sortKey: number, epicKey?: string }>}
 */
export const JIRA_HISTORICAL_SPRINTS = [
  {
    pattern   : /sprint\s*admin\s*1/i
  , sprint    : 1
  , sprintName: "Sprint Admin 1 – Portal ADMIN"
  , jiraId    : 248
  , sortKey   : 1_030_000
  }
, {
    pattern   : /sprint\s*1\.1.*profile/i
  , sprint    : 1
  , sprintName: "Sprint 1.1 -Profile"
  , jiraId    : 215
  , sortKey   : 1_040_000
  , epicKey   : "JLO-609"
  }
, {
    pattern   : /sprint\s*1.*auth/i
  , sprint    : 1
  , sprintName: "Sprint 1 – Auth & Registration"
  , jiraId    : 173
  , sortKey   : 1_050_000
  , epicKey   : "JLO-1"
  }
, {
    pattern   : /sprint\s*2.*core\s*gameplay/i
  , sprint    : 2
  , sprintName: "Sprint 2 – Core Gameplay"
  , jiraId    : 175
  , sortKey   : 2_050_000
  }
];

/**
 * Epic → sprint board Jira chiuso (story dirette sotto epic).
 *
 * @type {Array<{ epicKey: string, jiraSprintId: number, sprintName: string, sortKey: number }>}
 */
export const JLO_EPIC_LEGACY_SPRINT_PINS = [
  {
    epicKey     : "JLO-1"
  , jiraSprintId: 173
  , sprintName  : "Sprint 1 – Auth & Registration"
  , sortKey     : 1_050_000
  }
, {
    epicKey     : "JLO-609"
  , jiraSprintId: 215
  , sprintName  : "Sprint 1.1 -Profile"
  , sortKey     : 1_060_000
  }
, {
    epicKey     : "JLO-2"
  , jiraSprintId: 175
  , sprintName  : "Sprint 2 – Core Gameplay"
  , sortKey     : 1_070_000
  }
];

/**
 * @param {string} name
 * @returns {{ sprint: number, sprintName: string, sortKey: number } | null}
 */
function resolveJiraSprintBucket(name) {
  const normalized = normalizeSprintLabel(name);

  for (const block of JLO_WORKING_PLAN) {
    if (normalizeSprintLabel(block.name) === normalized) {
      return {
        sprint    : block.sprint
      , sprintName: block.name
      , sortKey   : block.sprint * 1_000_000
      };
    }
  }

  for (const entry of JIRA_HISTORICAL_SPRINTS) {
    if (entry.pattern.test(name)) {
      return {
        sprint    : entry.sprint
      , sprintName: entry.sprintName
      , sortKey   : entry.sortKey
      };
    }
  }

  return null;
}

/**
 * @param {Array<{ id: number, name: string, state: string }>} jiraSprints
 * @param {boolean} isDone
 * @returns {{ id: number, name: string, state: string } | null}
 */
function pickJiraSprint(jiraSprints, isDone) {
  if (!Array.isArray(jiraSprints) || jiraSprints.length === 0) {
    return null;
  }

  const score = (/** @type {{ state: string }} */ sprint) => {
    let points = 0;

    if (isDone && sprint.state === "closed") {
      points += 20;
    }

    if (!isDone && sprint.state === "active") {
      points += 20;
    }

    if (sprint.state === "future") {
      points += 5;
    }

    return points;
  };

  return [...jiraSprints].sort((a, b) => {
    const diff = score(b) - score(a);

    if (diff !== 0) {
      return diff;
    }

    return Number(b.id) - Number(a.id);
  })[0] ?? null;
}

/**
 * Assegna devSprint/devSprintName alle issue senza piano Working, usando lo sprint Jira
 * (inclusi sprint board chiusi in passato).
 *
 * @param {Array<{ key: string, tier?: string, type?: string, status?: string, parentKey?: string | null, devOrder?: string | null, devSprint?: number | null, devSprintName?: string | null, devSort?: number | null, jiraSprints?: Array<{ id: number, name: string, state: string }> }>} issues
 */
export function applyJiraSprintFallback(issues) {
  const byKey = new Map(issues.map((row) => [row.key, row]));

  for (const row of issues) {
    if (row.devSprint != null || row.tier !== "task") {
      continue;
    }

    const picked = pickJiraSprint(
      row.jiraSprints ?? []
    , /^(fatto|completato|done|closed|resolved)$/i.test(String(row.status ?? "").trim())
    );

    if (!picked?.name) {
      continue;
    }

    const bucket = resolveJiraSprintBucket(picked.name);

    if (bucket) {
      row.devSprint = bucket.sprint;
      row.devSprintName = bucket.sprintName;
      row.devSort = bucket.sortKey + 500;
      continue;
    }

    row.devSprint = 900 + (Number(picked.id) % 50);
    row.devSprintName = picked.name;
    row.devSort = 900_000_000 + Number(picked.id);
  }

  for (const row of issues) {
    if (row.tier !== "subtask" || row.devSprintName) {
      continue;
    }

    const parent = row.parentKey ? byKey.get(row.parentKey) : null;

    if (!parent?.devSprintName) {
      continue;
    }

    row.devSprint = parent.devSprint ?? null;
    row.devSprintName = parent.devSprintName;
    row.devSort = parent.devSort ?? null;
  }

  return issues;
}

/**
 * Story dirette sotto epic con sprint legacy noto → devSprintName + jiraSprints sintetico.
 * Sovrascrive bucket storico errato (es. JLO-813 su Core Gameplay).
 *
 * @param {Array<{ key: string, tier?: string, parentKey?: string | null, devSprint?: number | null, devSprintName?: string | null, devSort?: number | null, jiraSprints?: Array<{ id: number, name: string, state: string }> }>} issues
 * @param {Map<string, { key: string, tier?: string, parentKey?: string | null, devSprint?: number | null, devSprintName?: string | null, devSort?: number | null }>} byKey
 */
export function applyEpicLegacySprintPins(issues, byKey) {
  for (const pin of JLO_EPIC_LEGACY_SPRINT_PINS) {
    const bucket = JIRA_HISTORICAL_SPRINTS.find((entry) => entry.jiraId === pin.jiraSprintId);

    for (const row of issues) {
      if (row.tier !== "task" || row.parentKey !== pin.epicKey) {
        continue;
      }

      const currentIds = (row.jiraSprints ?? []).map((sprint) => Number(sprint.id));

      if (currentIds.includes(pin.jiraSprintId)) {
        if (!row.devSprintName) {
          row.devSprint     = bucket?.sprint ?? 1;
          row.devSprintName = pin.sprintName;
          row.devSort       = pin.sortKey + 500;
        }

        continue;
      }

      row.devSprint     = bucket?.sprint ?? 1;
      row.devSprintName = pin.sprintName;
      row.devSort       = pin.sortKey + 500;
      row.jiraSprints   = [{
        id    : pin.jiraSprintId
      , name  : pin.sprintName
      , state : "closed"
      }];
    }
  }

  for (const row of issues) {
    if (row.tier !== "subtask" || !row.parentKey) {
      continue;
    }

    const parent = byKey.get(row.parentKey);

    if (!parent?.devSprintName) {
      continue;
    }

    const parentUnderPinnedEpic = JLO_EPIC_LEGACY_SPRINT_PINS.some(
      (pin) => parent.tier === "task" && parent.parentKey === pin.epicKey
    );

    if (!parentUnderPinnedEpic && row.devSprintName) {
      continue;
    }

    row.devSprint     = parent.devSprint ?? null;
    row.devSprintName = parent.devSprintName;
    row.devSort       = parent.devSort ?? null;

    if (parentUnderPinnedEpic && parent.jiraSprints?.length) {
      row.jiraSprints = parent.jiraSprints;
    }
  }

  return issues;
}

/**
 * Sprint di riferimento per matrice Confluence / cruscotto.
 * Preferisce `devSprintName` (piano Working o fallback Jira), altrimenti sprint Jira grezzo.
 *
 * @param {{ devSprintName?: string | null, jiraSprints?: Array<{ id?: number, name: string, state: string }>, status?: string } | null | undefined} row
 * @returns {string | null}
 */
export function resolveIssueSprintName(row) {
  if (!row) {
    return null;
  }

  if (row.devSprintName) {
    return row.devSprintName;
  }

  const picked = pickJiraSprint(
    row.jiraSprints ?? []
  , /^(fatto|completato|done|closed|resolved)$/i.test(String(row.status ?? "").trim())
  );

  return picked?.name ?? null;
}
