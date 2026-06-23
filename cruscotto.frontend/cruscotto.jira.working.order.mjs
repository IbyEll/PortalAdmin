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
 *   - cruscotto.jira.backlog.insights.mjs — boardKeysForWorkingPlanBlock
 *   - cruscotto.jira.backlog.html, my-backlog.html — colonna devOrder / devSprint
 *   - admin.portal.JiraCORE/JiraCORE.sprint.create.mjs, admin.portal.JiraCORE/sync-repo-catalog.mjs — tooling sprint e catalogo
 *   - cruscotto.database/load-backlog.mjs — normalizeSprintLabel
 *
 * Export principali:
 *   - JLO_WORKING_PLAN, JLO_SPRINT_6_PHASES — definizione piano MVP
 *   - applyDevOrder, mergeWorkingSprintKeys, normalizeSprintLabel — ordine e sprint
 *   - isSprint6ObsoleteIssue, sprint6ObsoleteKeySet — policy sprint 6
 */

import { getWorkingPlanOverlayMeta } from "../lib/overlay/working.plan.overlay.mjs";

import {
  JLO_SPRINT_6_BOARD_NOISE
, JLO_SPRINT_6_OBSOLETE
, JLO_SPRINT_6_PHASES
, JLO_WORKING_PLAN
, sprint6ExecutionPlanKeys
} from "../PROJECT_JustLastOne/working.plan.data.JustLastOne.mjs";

export {
  JLO_SPRINT_6_BOARD_NOISE
, JLO_SPRINT_6_OBSOLETE
, JLO_SPRINT_6_PHASES
, JLO_WORKING_PLAN
, sprint6ExecutionPlanKeys
};

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

/**
 * @typedef {{
 *   key: string,
 *   replacedBy?: string,
 *   reason: string,
 * }} SprintObsoleteEntry
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
  if (!getWorkingPlanOverlayMeta().sprint6Enabled) {
    return issues;
  }

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
  if (!getWorkingPlanOverlayMeta().sprint6Enabled) {
    return false;
  }

  if (row.devSprint === 6) {
    return true;
  }

  const sprint6Name = getWorkingPlan().find((block) => block.sprint === 6)?.name ?? "";

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
  if (!getWorkingPlanOverlayMeta().sprint6Enabled) {
    return issues;
  }

  const planKeys     = new Set(sprint6ExecutionPlanKeys());
  const sprint6Block = getWorkingPlan().find((block) => block.sprint === 6);
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

/**
 * Piano working attivo per overlay attivo (PRJ_NAME).
 *
 * @returns {WorkingSprintBlock[]}
 */
export function getWorkingPlan() {
  return getWorkingPlanOverlayMeta().WORKING_PLAN ?? [];
}

/**
 * Config overlay working (catena critica, fasi, sprint 6).
 *
 * @returns {ReturnType<typeof getWorkingPlanOverlayMeta> & {
 *   WORKING_PLAN: WorkingSprintBlock[],
 *   SPRINT_6_PHASES?: import("./cruscotto.jira.working.order.mjs").SprintExecutionPhase[],
 *   SPRINT_6_BOARD_NOISE?: string[],
 * }}
 */
export function getWorkingPlanOverlay() {
  const meta = getWorkingPlanOverlayMeta();

  return {
    ...meta,
    WORKING_PLAN: meta.WORKING_PLAN ?? [],
  };
}

/**
 * IssueKEY flat dal piano MVP — tooling catalogo/sprint senza dipendere dal nome export.
 *
 * @returns {string[]}
 */
export function collectWorkingPlanTicketKeys() {
  return getWorkingPlan().flatMap((block) => block.keys);
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

  for (const block of getWorkingPlan()) {
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

  for (const block of getWorkingPlan()) {
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

  for (const block of getWorkingPlan()) {
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

  for (const block of getWorkingPlan()) {
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
