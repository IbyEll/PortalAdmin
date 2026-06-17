/**
 * Insight Jira Working — piano sprint vs repo e stato Jira live.
 */

import { fetchJiraBacklog, isEpicType, isJiraStatusDone } from "./jira.backlog.mjs";
import { buildInsightSnapshot, getCorrelatedOpenKeys, inspectRepoSignal, isInActiveJiraSprint } from "./jira.backlog.insights.mjs";
import { scanRepoJiraReferences } from "../function.repo.jira.refs.mjs";
import { JLO_WORKING_PLAN, boardKeysForWorkingPlanBlock, mergeWorkingSprintKeys } from "./jira.working.order.mjs";

/** @typedef {import("./jira.backlog.insights.mjs").BacklogInsight} WorkingInsight */

/** Issue chiave per housekeeping Fase 0 (zero codice atteso). */
const HOUSEKEEPING_KEYS = ["JLO-97", "JLO-247", "JLO-637"];

/** @type {Map<string, string>} */
const KEY_TO_FASE_BLOCK = new Map();

for (const plan of JLO_WORKING_PLAN) {
  const faseBlock = plan.sprint === 1
    ? "fatto"
    : plan.sprint === 2
      ? "fase-0"
      : plan.sprint === 3
        ? "fase-1"
        : plan.sprint === 4
          ? "fase-2"
          : plan.sprint === 5
            ? "fase-3"
            : plan.sprint === 6
              ? "fase-chat"
              : plan.sprint === 7
                ? "fase-4"
                : plan.sprint === 8
                  ? "fase-5"
                  : plan.sprint === 9
                    ? "sprint-9"
                    : `sprint-${plan.sprint}`;

  for (const key of plan.keys) {
    KEY_TO_FASE_BLOCK.set(key, faseBlock);
  }
}

/**
 * Mappa issue piano Working → blocco UI (`data-insight-block` / fase).
 * Allineata a `JLO_WORKING_PLAN` — rigenerata in `jira.working.html` ad ogni regenerate.
 *
 * @returns {Record<string, string>}
 */
export function buildKeyToBlockMap() {
  /** @type {Record<string, string>} */
  const out = {};

  for (const [key, block] of KEY_TO_FASE_BLOCK) {
    out[key] = block;
  }

  return out;
}

/**
 * @param {{ key?: string, text: string }} insight
 * @returns {string}
 */
function resolveWorkingBlock(insight) {
  const { key, text } = insight;

  if (text.includes("Catena MVP")) {
    return "catena";
  }

  if (text.includes("Prossimo nel piano") || text.includes("Prossimo ticket nel piano")) {
    return "prossimi";
  }

  if (
    text.includes("Housekeeping Fase 0")
    || text.includes("Housekeeping parziale")
    || text.includes("Fase 0 housekeeping")
  ) {
    return "fase-0";
  }

  if (
    text.includes("Piano Jira Working")
    || text.toLowerCase().includes("test report")
    || text.includes("Nessun report")
    || text.includes("Analisi fallita")
  ) {
    return "toolbar";
  }

  for (const plan of JLO_WORKING_PLAN) {
    if (text.startsWith(`${plan.name}:`)) {
      return `sprint-${plan.sprint}`;
    }
  }

  if (key && KEY_TO_FASE_BLOCK.has(key)) {
    return KEY_TO_FASE_BLOCK.get(key);
  }

  return "toolbar";
}

/**
 * @param {WorkingInsight[]} insights
 * @returns {WorkingInsight[]}
 */
function attachWorkingBlocks(insights) {
  return insights.map((insight) => ({
    ...insight,
    block: resolveWorkingBlock(insight),
  }));
}

/** Catena critica MVP (ordine operativo). */
const CRITICAL_CHAIN = [
  { label: "Match lifecycle", keys: ["JLO-690", "JLO-637"] }
, { label: "Housekeeping 97/247/637", keys: HOUSEKEEPING_KEYS }
, { label: "Export Admin", keys: ["JLO-930", "JLO-931", "JLO-932", "JLO-933"] }
, { label: "Notifiche fondamenta", keys: ["JLO-774", "JLO-775"] }
, { label: "Tornei iscrizione/bracket", keys: ["JLO-100", "JLO-103", "JLO-696"] }
, { label: "Release", keys: ["JLO-872", "JLO-121"] }
];

/**
 * @param {string} status
 * @returns {boolean}
 */
function jiraDone(status) {
  return isJiraStatusDone(status);
}

/**
 * @param {Array<{ key: string, status: string, summary?: string }>} issues
 * @param {string} at
 * @returns {WorkingInsight[]}
 */
export function buildWorkingInsights(issues, at = new Date().toISOString(), boardSprintKeysByPlanName = {}) {
  /** @type {WorkingInsight[]} */
  const insights = [];
  /** @type {Map<string, typeof issues[number]>} */
  const byKey = new Map(issues.map((row) => [row.key, row]));
  const repoRefs = scanRepoJiraReferences();

  insights.push({
    at,
    kind : "info",
    text : `Piano Jira Working · ${JLO_WORKING_PLAN.length} sprint nel piano · ${issues.length} issue scaricate da Jira`,
  });

  /** @type {string | null} */
  let firstOpenKey = null;
  /** @type {string | null} */
  let firstOpenSprint = null;

  for (const block of JLO_WORKING_PLAN) {
    const keys = mergeWorkingSprintKeys(
      block.keys
    , boardKeysForWorkingPlanBlock(boardSprintKeysByPlanName, block.name)
    );
    /** @type {string[]} */
    const openKeys = [];
    let doneCount = 0;

    for (const key of keys) {
      const row = byKey.get(key);

      if (row && jiraDone(row.status)) {
        doneCount += 1;
      } else {
        openKeys.push(key);

        if (!firstOpenKey) {
          firstOpenKey = key;
          firstOpenSprint = block.name;
        }
      }
    }

    const total = keys.length;
    const allDone = openKeys.length === 0;

    insights.push({
      at,
      kind : allDone ? "ok" : block.sprint <= 3 ? "comment" : "info",
      text : allDone
        ? `${block.name}: completato in Jira (${doneCount}/${total} Fatto)`
        : `${block.name}: ${doneCount}/${total} Fatto in Jira — ancora aperti ${openKeys.join(", ")}`,
    });

    if (block.sprint === 2) {
      /** @type {string[]} */
      const repoReady = [];

      for (const key of openKeys) {
        const inspect = inspectRepoSignal(key, repoRefs);
        const row = byKey.get(key);

        if (row && isEpicType(row.type)) {
          continue;
        }

        if (inspect?.scan.complete) {
          repoReady.push(key);
        }
      }

      if (repoReady.length > 0) {
        insights.push({
          at,
          kind : "suggestion",
          text : `Fase 0 housekeeping: ${repoReady.join(", ")} hanno già codice in repo — chiudi in Jira senza nuovo sviluppo`,
        });
      }
    }

    for (const key of openKeys) {
      const inspect = inspectRepoSignal(key, repoRefs);
      const row = byKey.get(key);
      const status = row?.status ?? "—";

      if (!row || !isInActiveJiraSprint(row)) {
        continue;
      }

      if (row && isEpicType(row.type)) {
        const correlatedOpen = getCorrelatedOpenKeys(issues, key);

        if (correlatedOpen.length === 0) {
          insights.push({
            at,
            kind : "suggestion",
            key,
            type : row.type,
            text : `${key} · ${inspect?.signal.label ?? row.summary}: tutte le task correlate sono Fatto, epic ancora «${status}» — valuta chiusura epic`,
          });
        }

        continue;
      }

      if (inspect?.scan.complete) {
        insights.push({
          at,
          kind : "suggestion",
          key,
          type : row.type,
          text : `${key} · ${inspect.signal.label}: codice presente in repo, Jira ancora «${status}» — ${block.name}`,
        });
      } else if (inspect && !inspect.scan.complete && !jiraDone(status)) {
        insights.push({
          at,
          kind : "comment",
          key,
          type : row.type,
          text : `${key} · ${inspect.signal.label}: da implementare (${inspect.scan.found.length}/${inspect.signal.paths.length} path nel catalogo) — Jira «${status}»`,
        });
      }
    }
  }

  if (firstOpenKey && firstOpenSprint) {
    const row = byKey.get(firstOpenKey);
    const firstTitle = row?.summary ? String(row.summary).slice(0, 60) : firstOpenKey;

    insights.push({
      at,
      kind : "suggestion",
      key  : firstOpenKey,
      type : row?.type,
      text : `Prossimo ticket nel piano: ${firstOpenKey} (${firstTitle}) — stato Jira «${row?.status ?? "—"}» in ${firstOpenSprint}`,
    });
  }

  /** @type {string[]} */
  const hkOpen = HOUSEKEEPING_KEYS.filter((key) => {
    const row = byKey.get(key);

    return !row || !jiraDone(row.status);
  });

  if (hkOpen.length === 0) {
    insights.push({
      at,
      kind : "ok",
      text : "Housekeeping Fase 0 completato in Jira — JLO-97, JLO-247 e JLO-637 sono Fatto",
    });
  } else if (hkOpen.length < HOUSEKEEPING_KEYS.length) {
    insights.push({
      at,
      kind : "warning",
      text : `Housekeeping parziale in Jira — restano da chiudere: ${hkOpen.join(", ")}`,
    });
  }

  for (const step of CRITICAL_CHAIN) {
    const rows = step.keys.map((key) => byKey.get(key)).filter(Boolean);
    const done = rows.filter((r) => jiraDone(r.status)).length;
    const total = step.keys.length;

    if (done === total) {
      insights.push({
        at,
        kind : "ok",
        text : `Catena MVP · ${step.label}: tutti i ticket sono Fatto in Jira (${done}/${total})`,
      });
    } else if (done > 0) {
      const pending = step.keys.filter((key) => {
        const row = byKey.get(key);

        return !row || !jiraDone(row.status);
      });

      insights.push({
        at,
        kind : "comment",
        text : `Catena MVP · ${step.label}: ${done}/${total} Fatto — mancano ancora ${pending.join(", ")}`,
      });
    } else {
      insights.push({
        at,
        kind : "warning",
        text : `Catena MVP · ${step.label}: nessun ticket ancora Fatto in Jira (${step.keys.join(", ")})`,
      });
    }
  }

  const exportInspect = inspectRepoSignal("JLO-930", repoRefs);
  const exportRow = byKey.get("JLO-930");

  if (exportRow && !jiraDone(exportRow.status)) {
    if (exportInspect && !exportInspect.scan.complete) {
      insights.push({
        at,
        kind : "comment",
        key  : "JLO-930",
        type : exportRow.type,
        text : "Export Excel (JLO-930): la cartella export/ è quasi vuota — subtask 931–933 ancora da completare",
      });
    }
  }

  for (const blockedKey of ["JLO-886", "JLO-887"]) {
    const row = byKey.get(blockedKey);

    if (row && !jiraDone(row.status)) {
      insights.push({
        at,
        kind : "comment",
        key  : blockedKey,
        type : row.type,
        text : `${blockedKey} è «${row.status}» in Jira — i test restano blocked finché non chiudi JLO-552 e JLO-696`,
      });
    }
  }

  return attachWorkingBlocks(insights);
}

/**
 * @returns {Promise<{ scannedAt: string, insights: WorkingInsight[], snapshot: ReturnType<typeof buildInsightSnapshot> }>}
 */
export async function fetchWorkingInsights() {
  const backlog = await fetchJiraBacklog();
  const scannedAt = new Date().toISOString();
  const repoRefs = scanRepoJiraReferences();
  const snapshot = buildInsightSnapshot(backlog.issues, backlog.boardSprintKeysByPlanName, repoRefs);
  const insights = buildWorkingInsights(backlog.issues, scannedAt, backlog.boardSprintKeysByPlanName);

  return { scannedAt, insights, snapshot };
}
