/**
 * Veve DB programmatico — leggi jira_issue, gap repo, crea subtask implementazione + test, merge veve raw_fields.
 *
 * writeTarget: jira_issue (CREA Matrix) | jira_issue_wip (workflow database).
 */

import { isEpicType } from "../cruscotto.frontend/cruscotto.jira.backlog.mjs";
import { openCruscottoDb } from "../cruscotto.database/cruscotto.db.config.mjs";
import { createJiraIssue } from "./jiraCORE.jira.create.mjs";
import {
  analyzeIssueKeys
, isRepoEsitoContemplated
, REPO_ANALYSIS_AREAS
, suggestSubtaskOrder
, TECHNICAL_LAYER_ORDER
} from "./JiraCORE.repo.issuekey.signal.analysis.mjs";
import { scanRepoJiraReferences } from "./jira.function.repo.refs.mjs";
import {
  buildVeveStoryParentMarkdown
, buildVeveSubtaskMarkdown
} from "./jiraCORE.workflow.description.mjs";
import { normalizeIssueKey, parseWipRawFields } from "./jiraCORE.wip.db.mjs";
import { ensureJiraIssuesInCache } from "../cruscotto.database/Jira.backlog.sync.mjs";

/** @typedef {"schema" | "shared" | "api" | "web" | "i18n" | "admin" | "manual"} VeveImplementationLayer */
/** @typedef {"technical-test" | "functional-test"} VeveTestSubtaskRole */
/** @typedef {VeveImplementationLayer | VeveTestSubtaskRole} VeveSubtaskRole */
/** @typedef {{ summary: string, role: VeveSubtaskRole, paths?: string[] }} VeveSubtaskProposal */

/** @type {Record<VeveImplementationLayer, { prefix: string, match: RegExp }>} */
const VEVE_LAYER_CONFIG = {
  schema: { prefix: "[Schema]", match: /\[schema\]|schema|prisma|migrat|sqlite|database/ }
, shared: { prefix: "[Shared]", match: /\[shared\]|packages\/shared|\/shared\// }
, api   : { prefix: "[API]", match: /\[api\]|api|backend|endpoint|nestjs/ }
, web   : { prefix: "[Web]", match: /\[web\]|web|ui|component|page|frontend|react/ }
, i18n  : { prefix: "[i18n]", match: /\[i18n\]|i18n|locale|traduz/ }
, admin : { prefix: "[Cruscotto]", match: /\[cruscotto\]|\[admin\]|cruscotto|dashboard|portal\.home/ }
, manual: { prefix: "[Manuale]", match: /\[manuale\]|verifica manuale|manual/ }
};

/**
 * @param {import("@prisma/client").PrismaClient} db
 * @param {string} jiraKey
 */
async function findJiraIssueInLatestSync(db, jiraKey) {
  const syncRun = await db.syncRun.findFirst({
    where  : { status: "success", issueCount: { gt: 0 } }
  , orderBy: { finishedAt: "desc" }
  });

  if (!syncRun) {
    return null;
  }

  const row = await db.jiraIssue.findFirst({
    where: { jiraKey, syncRunId: syncRun.id }
  });

  return row ? { row, syncRun } : null;
}

/**
 * @param {Array<{ jiraKey?: string, parentJiraKey?: string | null, issueType?: string, tier?: string }>} rows
 * @param {string} key
 * @returns {string | null}
 */
function findEpicKeyFromRows(rows, key) {
  /** @type {Map<string, typeof rows[number]>} */
  const byKey = new Map(rows.map((row) => [String(row.jiraKey), row]));
  let current = byKey.get(key);

  while (current) {
    const type = String(current.issueType ?? "");

    if (current.tier === "epic" || isEpicType(type)) {
      return String(current.jiraKey);
    }

    current = current.parentJiraKey ? byKey.get(current.parentJiraKey) ?? null : null;
  }

  return null;
}

/**
 * @param {ReturnType<typeof analyzeIssueKeys>["issues"][number] | undefined} row
 * @param {{ matrixPaths?: string[], matrixDetail?: string }} [opts]
 * @returns {Array<{ area: string, esito: string, note: string }>}
 */
function repoAreasFromAnalysis(row, opts = {}) {
  /** @type {Array<{ area: string, esito: string, note: string }>} */
  const areas = [];

  if (opts.matrixPaths?.length) {
    areas.push({
      area : "Matrice"
    , esito: "❌"
    , note : opts.matrixPaths.slice(0, 4).join(", ")
    });
  }

  if (!row) {
    return areas;
  }

  const note = row.gap
    ?? (row.paths?.length ? row.paths.slice(0, 3).join(", ") : "—");

  if (isRepoEsitoContemplated(row.symbol)) {
    areas.push({
      area : row.signalLabel ?? "Repo"
    , esito: row.symbol
    , note
    });
  }

  if (opts.matrixDetail?.trim() && !areas.some((hit) => hit.area === "Dettaglio")) {
    areas.push({
      area : "Dettaglio matrice"
    , esito: row.symbol === "✅" ? "✅" : "⚠️"
    , note : opts.matrixDetail.trim().slice(0, 120)
    });
  }

  return areas;
}

/**
 * @param {ReturnType<typeof analyzeIssueKeys>["issues"][number] | undefined} row
 * @returns {Array<{ text: string, checked: boolean }>}
 */
function defaultAcceptanceCriteria(row) {
  const done = row?.symbol === "✅";

  return [
    { text: "Gap repo analizzato e allineato al finding matrice", checked: done }
  , { text: "Implementazione verificata in codebase overlay attivo", checked: done }
  ];
}

/**
 * @returns {Array<{ text: string, checked: boolean }>}
 */
function defaultDefinitionOfDone() {
  return [
    { text: "Codice e test coerenti con AC", checked: false }
  , { text: "Ticket pronto per gogo workflow database", checked: false }
  ];
}

/**
 * @param {string} parentSummary
 * @param {string} parentKey
 * @returns {string}
 */
function truncateSummaryForSubtask(parentSummary, parentKey) {
  const base = String(parentSummary ?? parentKey).trim().replace(/^\[[^\]]+\]\s*/, "") || parentKey;

  return base.length > 96 ? `${base.slice(0, 93)}…` : base;
}

/**
 * @param {string} summary
 * @param {VeveTestSubtaskRole} role
 * @returns {boolean}
 */
function subtaskMatchesTestRole(summary, role) {
  const text = String(summary ?? "").toLowerCase();

  if (role === "technical-test") {
    return /\[test\].*tecnic|testscript tecnico|test tecnici|testtecnici|meta\/test\.tecnici|\/technical\//i.test(text)
      || (/\[test\]|testscript/i.test(text) && !/funzional/i.test(text));
  }

  return /\[test\].*funzional|testscript funzionale|test funzionali|\/funzionali\//i.test(text)
    || (/\[test\]|testscript/i.test(text) && /funzional|cruscotto\.|portal\./i.test(text));
}

/**
 * @param {string} parentSummary
 * @param {ReturnType<typeof analyzeIssueKeys>["issues"][number] | undefined} parentGap
 * @param {{
 *   matrixPaths?: string[]
 * , matrixDetail?: string
 * , matrixKind?: string
 * }} opts
 * @returns {{ needsTechnical: boolean, needsFunctional: boolean }}
 */
export function inferVeveTestSubtaskNeeds(parentSummary, parentGap, opts = {}) {
  if (parentGap?.symbol === "✅") {
    return { needsTechnical: false, needsFunctional: false };
  }

  const paths  = (opts.matrixPaths ?? []).map((path) => String(path).toLowerCase());
  const blob   = [
    paths.join("\n")
  , String(opts.matrixDetail ?? "").toLowerCase()
  , String(parentSummary ?? "").toLowerCase()
  , String(opts.matrixKind ?? "").toLowerCase()
  ].join("\n");

  let needsTechnical  = /admin\.portal\.testscript\/technical|test\.tecnici|meta\/test\.tecnici|technical\//i.test(blob);
  let needsFunctional = /admin\.portal\.testscript\/funzionali|test\.cruscotto|test\.portal|cruscotto\.frontend|funzionali\//i.test(blob);

  if (opts.matrixKind === "test_coverage") {
    needsTechnical  = true;
    needsFunctional = true;
  }

  if (!needsTechnical && !needsFunctional && parentGap?.symbol !== "✅") {
    needsTechnical = true;

    if (/cruscotto|frontend|portal|matrix|\.html|ui\b|home\.js/i.test(blob)) {
      needsFunctional = true;
    }
  }

  return { needsTechnical, needsFunctional };
}

/**
 * @param {string} filePath
 * @returns {VeveImplementationLayer | null}
 */
function classifyRepoPathToLayer(filePath) {
  const normalized = String(filePath).replace(/\\/g, "/").toLowerCase();

  if (!normalized || /admin\.portal\.testscript|testscript\/|\/test\.tecnici|\/funzionali\//i.test(normalized)) {
    return null;
  }

  for (const area of REPO_ANALYSIS_AREAS) {
    if (area.id === "test" || area.id === "catalog" || area.id === "backlog-doc") {
      continue;
    }

    if (area.paths.some((prefix) => normalized.includes(prefix.toLowerCase()))) {
      if (area.id === "shared" && /i18n|locale|traduz/.test(normalized)) {
        return "i18n";
      }

      return /** @type {VeveImplementationLayer} */ (area.id);
    }
  }

  if (/prisma\/|cruscotto\.database|migrate|schema\.prisma/i.test(normalized)) {
    return "schema";
  }

  if (/apps\/api|\/api\.|backend|nestjs|endpoint/i.test(normalized)) {
    return "api";
  }

  if (/apps\/web|react|\.tsx|components\//i.test(normalized)) {
    return "web";
  }

  if (/cruscotto\.|admin\.portal|portal\.home|scripts\//i.test(normalized)) {
    return "admin";
  }

  return "admin";
}

/**
 * @param {string[]} paths
 * @returns {string}
 */
function shortPathLabel(paths) {
  const first = paths[0] ?? "";

  if (!first) {
    return "";
  }

  const base = first.split("/").pop() || first;

  return base.length > 52 ? `${base.slice(0, 49)}…` : base;
}

/**
 * @param {{
 *   matrixPaths?: string[]
 * , matrixDetail?: string
 * }} opts
 * @param {ReturnType<typeof analyzeIssueKeys>["issues"][number] | undefined} parentGap
 * @returns {string[]}
 */
function collectVeveAnalysisPaths(opts, parentGap) {
  /** @type {Set<string>} */
  const paths = new Set();

  for (const path of opts.matrixPaths ?? []) {
    const trimmed = String(path).trim();

    if (trimmed) {
      paths.add(trimmed);
    }
  }

  for (const path of parentGap?.paths ?? []) {
    const trimmed = String(path).trim();

    if (trimmed) {
      paths.add(trimmed);
    }
  }

  return [...paths];
}

/**
 * @param {string} summary
 * @param {VeveImplementationLayer} layer
 * @returns {boolean}
 */
function subtaskMatchesImplementationLayer(summary, layer) {
  const text = String(summary ?? "").toLowerCase();

  if (subtaskMatchesTestRole(summary, "technical-test") || subtaskMatchesTestRole(summary, "functional-test")) {
    return false;
  }

  return VEVE_LAYER_CONFIG[layer].match.test(text);
}

/**
 * Subtask implementazione mancanti — da path matrice / gap repo (layer schema → … → admin).
 *
 * @param {string} parentKey
 * @param {string} parentSummary
 * @param {Array<{ summary?: string | null }>} existingSubtasks
 * @param {ReturnType<typeof analyzeIssueKeys>["issues"][number] | undefined} parentGap
 * @param {{
 *   matrixPaths?: string[]
 * , matrixDetail?: string
 * , matrixKind?: string
 * }} [opts]
 * @returns {VeveSubtaskProposal[]}
 */
export function suggestVeveImplementationSubtasks(
  parentKey
, parentSummary
, existingSubtasks
, parentGap
, opts = {}
) {
  const analysisPaths = collectVeveAnalysisPaths(opts, parentGap);
  const hasClearGap   = parentGap?.symbol === "⚠️"
    || parentGap?.symbol === "❌"
    || analysisPaths.length > 0
    || Boolean(String(opts.matrixDetail ?? "").trim());

  if (!hasClearGap) {
    return [];
  }

  /** @type {Map<VeveImplementationLayer, string[]>} */
  const pathsByLayer = new Map();

  for (const path of analysisPaths) {
    const layer = classifyRepoPathToLayer(path);

    if (!layer) {
      continue;
    }

    const bucket = pathsByLayer.get(layer) ?? [];

    bucket.push(path);
    pathsByLayer.set(layer, bucket);
  }

  if (pathsByLayer.size === 0 && parentGap?.symbol !== "✅") {
    const fallbackLayer = /schema|prisma|migrat|sqlite|database/i.test(String(parentSummary))
      ? "schema"
      : /api|backend|endpoint|nestjs/i.test(String(parentSummary))
        ? "api"
        : /web|ui|react|frontend/i.test(String(parentSummary))
          ? "web"
          : "admin";

    pathsByLayer.set(fallbackLayer, analysisPaths.length ? analysisPaths : ["—"]);
  }

  const label     = truncateSummaryForSubtask(parentSummary, parentKey);
  /** @type {VeveSubtaskProposal[]} */
  const proposals = [];

  for (const layer of TECHNICAL_LAYER_ORDER) {
  /** @type {VeveImplementationLayer} */
    const layerId = /** @type {VeveImplementationLayer} */ (layer);

    if (!VEVE_LAYER_CONFIG[layerId]) {
      continue;
    }

    const layerPaths = pathsByLayer.get(layerId);

    if (!layerPaths?.length) {
      continue;
    }

    if (existingSubtasks.some((row) => subtaskMatchesImplementationLayer(row.summary, layerId))) {
      continue;
    }

    const pathNote = shortPathLabel(layerPaths);
    const summary  = pathNote
      ? `${VEVE_LAYER_CONFIG[layerId].prefix} ${label} — ${pathNote}`
      : `${VEVE_LAYER_CONFIG[layerId].prefix} ${label}`;

    proposals.push({
      summary
    , role   : layerId
    , paths  : layerPaths
    });
  }

  return proposals;
}

/**
 * Subtask test mancanti — tecnico e/o funzionale (aggiuntive rispetto all'analisi).
 *
 * @param {string} parentKey
 * @param {string} parentSummary
 * @param {Array<{ summary?: string | null }>} existingSubtasks
 * @param {ReturnType<typeof analyzeIssueKeys>["issues"][number] | undefined} parentGap
 * @param {{
 *   matrixPaths?: string[]
 * , matrixDetail?: string
 * , matrixKind?: string
 * }} [opts]
 * @returns {VeveSubtaskProposal[]}
 */
export function suggestVeveTestSubtasks(parentKey, parentSummary, existingSubtasks, parentGap, opts = {}) {
  const { needsTechnical, needsFunctional } = inferVeveTestSubtaskNeeds(parentSummary, parentGap, opts);
  /** @type {VeveSubtaskProposal[]} */
  const proposals = [];
  const label     = truncateSummaryForSubtask(parentSummary, parentKey);

  if (
    needsTechnical
    && !existingSubtasks.some((row) => subtaskMatchesTestRole(row.summary, "technical-test"))
  ) {
    proposals.push({
      summary: `[Test] TestScript tecnico — ${label}`
    , role   : "technical-test"
    });
  }

  if (
    needsFunctional
    && !existingSubtasks.some((row) => subtaskMatchesTestRole(row.summary, "functional-test"))
  ) {
    proposals.push({
      summary: `[Test] TestScript funzionale — ${label}`
    , role   : "functional-test"
    });
  }

  return proposals;
}

/**
 * Subtask mancanti — implementazione da analisi + test tecnico/funzionale se necessario.
 *
 * @param {string} parentKey
 * @param {string} parentSummary
 * @param {Array<{ summary?: string | null }>} existingSubtasks
 * @param {ReturnType<typeof analyzeIssueKeys>["issues"][number] | undefined} parentGap
 * @param {{
 *   matrixPaths?: string[]
 * , matrixDetail?: string
 * , matrixKind?: string
 * }} [opts]
 * @returns {VeveSubtaskProposal[]}
 */
export function suggestVeveMissingSubtasks(parentKey, parentSummary, existingSubtasks, parentGap, opts = {}) {
  const implementation = suggestVeveImplementationSubtasks(
    parentKey
  , parentSummary
  , existingSubtasks
  , parentGap
  , opts
  );
  const tests = suggestVeveTestSubtasks(
    parentKey
  , parentSummary
  , existingSubtasks
  , parentGap
  , opts
  );

  return [...implementation, ...tests];
}

/**
 * @param {string} parentKey
 * @returns {string}
 */
function projectKeyFromIssueKey(parentKey) {
  const match = String(parentKey).trim().toUpperCase().match(/^([A-Z]+)-\d+$/);

  if (!match) {
    throw new Error(`Issue key non valida per creazione subtask: ${parentKey}`);
  }

  return match[1];
}

/**
 * @param {string} parentKey
 * @param {VeveSubtaskProposal[]} proposals
 * @param {boolean} dryRun
 * @returns {Promise<Array<{ key: string | null, summary: string, role: VeveSubtaskRole, created: boolean, error?: string }>>}
 */
async function createMissingVeveSubtasks(parentKey, proposals, dryRun) {
  if (!proposals.length) {
    return [];
  }

  const projectKey = projectKeyFromIssueKey(parentKey);
  /** @type {Array<{ key: string | null, summary: string, role: VeveSubtaskRole, created: boolean, error?: string }>} */
  const results = [];

  for (const proposal of proposals) {
    if (dryRun) {
      results.push({
        key    : null
      , summary: proposal.summary
      , role   : proposal.role
      , created: false
      });
      continue;
    }

    try {
      const created = await createJiraIssue({
        projectKey
      , issueTypeKey: "SUBTASK"
      , summary     : proposal.summary
      , parentKey
      });

      results.push({
        key    : created.key
      , summary: proposal.summary
      , role   : proposal.role
      , created: true
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      results.push({
        key    : null
      , summary: proposal.summary
      , role   : proposal.role
      , created: false
      , error  : message
      });
    }
  }

  const createdKeys = results.map((row) => row.key).filter(Boolean);

  if (createdKeys.length) {
    await ensureJiraIssuesInCache(createdKeys);
  }

  return results;
}

/**
 * @param {import("@prisma/client").JiraIssue} row
 * @param {Record<string, unknown>} rawMerge
 */
function wipPayloadFromJiraIssue(row, rawMerge = {}) {
  const prev = parseWipRawFields(row.rawFields);

  return {
    jiraKey        : row.jiraKey
  , issueType      : row.issueType
  , summary        : row.summary
  , status         : row.status
  , statusCategory : row.statusCategory
  , parentJiraKey  : row.parentJiraKey
  , jiraUpdatedAt  : row.jiraUpdatedAt
  , tier           : row.tier
  , isStoryLike    : row.isStoryLike
  , isDone         : row.isDone
  , depth          : row.depth
  , hasChildren    : row.hasChildren
  , devOrder       : row.devOrder
  , devSprint      : row.devSprint
  , devSprintName  : row.devSprintName
  , devSort        : row.devSort
  , isObsolete     : row.isObsolete
  , relatedKeys    : row.relatedKeys
  , syncRunId      : row.syncRunId
  , rawFields      : JSON.stringify({ ...prev, ...rawMerge })
  , syncedAt       : new Date()
  };
}

/**
 * @param {import("@prisma/client").PrismaClient} db
 * @param {import("@prisma/client").JiraIssue} row
 * @param {Record<string, unknown>} rawMerge
 */
async function upsertJiraIssueWipRow(db, row, rawMerge) {
  const data = wipPayloadFromJiraIssue(row, rawMerge);

  await db.jiraIssueWip.upsert({
    where : { jiraKey: row.jiraKey }
  , create: data
  , update: data
  });
}

/**
 * @param {import("@prisma/client").PrismaClient} db
 * @param {import("@prisma/client").JiraIssue} row
 * @param {Record<string, unknown>} rawMerge
 */
async function patchJiraIssueVeveRow(db, row, rawMerge) {
  const prev = parseWipRawFields(row.rawFields);

  await db.jiraIssue.update({
    where: { jiraKey: row.jiraKey }
  , data : {
      rawFields: JSON.stringify({ ...prev, ...rawMerge })
    , syncedAt : new Date()
    }
  });
}

/** @typedef {"jira_issue" | "jira_issue_wip" | "both"} VeveDbWriteTarget */

/**
 * @param {import("@prisma/client").PrismaClient} db
 * @param {import("@prisma/client").JiraIssue} row
 * @param {Record<string, unknown>} rawMerge
 * @param {VeveDbWriteTarget} writeTarget
 */
async function writeVeveDbRow(db, row, rawMerge, writeTarget) {
  if (writeTarget === "jira_issue" || writeTarget === "both") {
    await patchJiraIssueVeveRow(db, row, rawMerge);
  }

  if (writeTarget === "jira_issue_wip" || writeTarget === "both") {
    await upsertJiraIssueWipRow(db, row, rawMerge);
  }
}

/**
 * Esegue veve DB completo per parent story/bug/todo — cache → gap → raw_fields.
 *
 * @param {string} issueKey
 * @param {{
 *   dryRun?: boolean
 * , writeTarget?: VeveDbWriteTarget
 * , matrixPaths?: string[]
 * , matrixDetail?: string
 * , matrixFindingId?: string
 * , matrixKind?: string
 * , createSubtasks?: boolean
 * }} [opts]
 */
export async function runVeveDbForIssueKey(issueKey, opts = {}) {
  const key           = normalizeIssueKey(issueKey);
  const dryRun        = Boolean(opts.dryRun);
  const writeTarget   = opts.writeTarget === "jira_issue"
    ? "jira_issue"
    : opts.writeTarget === "both"
      ? "both"
      : "jira_issue_wip";
  const createSubs    = opts.createSubtasks !== false;

  await ensureJiraIssuesInCache([key]);

  const db  = await openCruscottoDb();
  let hit = await findJiraIssueInLatestSync(db, key);

  if (!hit) {
    throw new Error(`Issue ${key} assente in jira_issue dopo ensure cache — esegui npm run db:sync`);
  }

  let { row: parentRow, syncRun } = hit;

  /**
   * @param {import("@prisma/client").PrismaClient} database
   * @param {string} syncRunId
   * @param {string} parentJiraKey
   */
  const loadSubtaskRows = async (database, syncRunId, parentJiraKey) => {
    const allCacheRows = await database.jiraIssue.findMany({
      where: { syncRunId }
    });

    return allCacheRows.filter((row) => row.parentJiraKey === parentJiraKey);
  };

  let subtaskRows = await loadSubtaskRows(db, syncRun.id, key);

  const repoRefs         = scanRepoJiraReferences();
  const parentGapPreview = analyzeIssueKeys([key], {
    repoRefs
  , jiraStatusByKey: { [key]: String(parentRow.status ?? "—") }
  }).issues[0];
  const missingProposals = suggestVeveMissingSubtasks(
    key
  , String(parentRow.summary ?? key)
  , subtaskRows
  , parentGapPreview
  , opts
  );
  const createdSubtasks  = createSubs
    ? await createMissingVeveSubtasks(key, missingProposals, dryRun)
    : [];

  if (createdSubtasks.some((row) => row.created)) {
    hit = await findJiraIssueInLatestSync(db, key);

    if (!hit) {
      throw new Error(`Issue ${key} assente in jira_issue dopo creazione subtask`);
    }

    ({ row: parentRow, syncRun } = hit);
    subtaskRows = await loadSubtaskRows(db, syncRun.id, key);
  }
  const orderedSubKeys              = suggestSubtaskOrder(
    subtaskRows.map((row) => ({ key: row.jiraKey, summary: row.summary }))
  );
  const orderedSubtasks             = orderedSubKeys
    .map((subKey) => subtaskRows.find((row) => row.jiraKey === subKey))
    .filter(Boolean);

  const keys            = [key, ...orderedSubKeys];
  const jiraStatusByKey = Object.fromEntries(
    keys.map((subKey) => {
      const row = subKey === key
        ? parentRow
        : orderedSubtasks.find((item) => item.jiraKey === subKey);

      return [subKey, String(row?.status ?? "—")];
    })
  );
  const gapReport       = analyzeIssueKeys(keys, {
    repoRefs
  , jiraStatusByKey
  });
  /** @type {Map<string, typeof gapReport.issues[number]>} */
  const gapByKey = new Map(gapReport.issues.map((item) => [item.key, item]));
  const parentGap  = gapByKey.get(key);
  const epicKey    = findEpicKeyFromRows(
    await db.jiraIssue.findMany({ where: { syncRunId: syncRun.id } })
  , key
  );
  const nowIso     = new Date().toISOString();
  const parentVeve = buildVeveStoryParentMarkdown({
    objective: String(parentRow.summary ?? key)
  , epicKey
  , sprintNote: opts.matrixKind
    ? `Matrice ${opts.matrixKind}${opts.matrixFindingId ? ` · ${opts.matrixFindingId}` : ""}`
    : "—"
  , analysisDate: nowIso.slice(0, 10)
  , repoAreas   : repoAreasFromAnalysis(parentGap, opts)
  , responsibility: opts.matrixFindingId
    ? `Finding matrice ${opts.matrixFindingId} — grooming automatico post CREA`
    : "Grooming automatico veve DB"
  , acceptanceCriteria: defaultAcceptanceCriteria(parentGap)
  , definitionOfDone: defaultDefinitionOfDone()
  , subtasks    : orderedSubtasks.map((sub) => ({
      key     : sub.jiraKey
    , summary : sub.summary
    }))
  , outOfScope: opts.matrixDetail?.trim() ? [] : ["—"]
  , successor : "—"
  });

  const parentRaw = {
    veveDescription: parentVeve
  , gapSummary     : parentGap?.gap ?? parentGap?.symbol ?? "—"
  , gap            : parentGap ?? null
  , updatedAt      : nowIso
  , workflowSource : "veve-db"
  , matrixFindingId: opts.matrixFindingId ?? null
  , matrixKind     : opts.matrixKind ?? null
  };

  if (!dryRun) {
    await writeVeveDbRow(db, parentRow, parentRaw, writeTarget);
  }

  /** @type {Array<{ key: string, updated: boolean }>} */
  const subtaskResults = [];
  const total          = orderedSubtasks.length;

  for (let index = 0; index < orderedSubtasks.length; index += 1) {
    const subRow = orderedSubtasks[index];

    if (!subRow) {
      continue;
    }

    const subGap  = gapByKey.get(subRow.jiraKey);
    const subVeve = buildVeveSubtaskMarkdown({
      objective: String(subRow.summary ?? subRow.jiraKey)
    , parentKey: key
    , repoAreas: repoAreasFromAnalysis(subGap, {
        matrixPaths : opts.matrixPaths
      , matrixDetail: opts.matrixDetail
      })
    , acceptanceCriteria: defaultAcceptanceCriteria(subGap)
    , definitionOfDone  : defaultDefinitionOfDone()
    , files             : opts.matrixPaths ?? []
    , dependencies      : index > 0 ? orderedSubKeys[index - 1] : "—"
    , order             : { n: index + 1, total }
    });
    const subRaw = {
      veveDescription: subVeve
    , gap            : subGap ?? null
    , updatedAt      : nowIso
    , workflowSource : "veve-db"
    , parentVeveKey  : key
    , orderN         : index + 1
    , orderM         : total
    };

    if (!dryRun) {
      await writeVeveDbRow(db, subRow, subRaw, writeTarget);
    }

    subtaskResults.push({ key: subRow.jiraKey, updated: !dryRun });
  }

  return {
    ok       : true
  , key
  , dryRun
  , epicKey
  , subtasks : subtaskResults
  , createdSubtasks
  , missingSubtaskProposals: missingProposals
  , gapSymbol: parentGap?.symbol ?? "—"
  , writeTarget
  , wipTable : writeTarget === "both" ? "jira_issue+jira_issue_wip" : writeTarget
  };
}
