/**
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-17
 *
 * Insight Jira Working — piano sprint vs repo e stato Jira live.
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - la pagina working plan mostra insight contestuali per blocco sprint/fase, distinti dal backlog generico
 *   - riusa snapshot backlog insight ma filtra per KEY_TO_FASE_BLOCK derivato da JLO_WORKING_PLAN
 *
 *   A cosa serve:
 *   - buildWorkingInsights — insight per UI working con block data-insight-block
 *   - buildKeyToBlockMap — mappa issue → blocco fase per embed in cruscotto.jira.working.html
 *   - fetchWorkingInsights — fetch backlog + build completo per API
 *
 * Generalizzazione:
 *   Si — piano sprint via JLO_WORKING_PLAN; repo scan condiviso con backlog.insights.
 *
 * Input:
 *   - issues — righe backlog Jira
 *   - boardSprintKeysByPlanName — chiavi issue per sprint board (mergeWorkingSprintKeys)
 *   - repoRefs — scanRepoJiraReferences sul product repo
 *
 * Consumatori:
 *   - runner/cruscotto.server.mjs — fetchWorkingInsights
 *   - cruscotto.jira.working.plan.mjs — buildWorkingInsights, buildKeyToBlockMap
 *
 * Export principali:
 *   - fetchWorkingInsights — insight working async
 *   - buildWorkingInsights, buildKeyToBlockMap — core insight e mappa blocchi UI
 */

import { fetchJiraBacklog, isEpicType, isJiraStatusDone } from "../cruscotto.frontend/cruscotto.jira.backlog.mjs";
import { buildInsightSnapshot, getCorrelatedOpenKeys, inspectRepoSignal, isInActiveJiraSprint } from "../cruscotto.frontend/cruscotto.jira.backlog.insights.mjs";
import { scanRepoJiraReferences } from "../admin.portal.JiraCORE/jira.function.repo.refs.mjs";
import { boardKeysForWorkingPlanBlock, getWorkingPlan, getWorkingPlanOverlay, mergeWorkingSprintKeys } from "../PARKING_tocheck/cruscotto.jira.working.order.mjs";

/** @typedef {import("./cruscotto.jira.backlog.insights.mjs").BacklogInsight} WorkingInsight */

/**
 * @returns {Map<string, string>}
 */
function buildKeyToFaseBlockMap() {
  const overlay = getWorkingPlanOverlay();
  /** @type {Map<string, string>} */
  const map = new Map();

  for (const plan of getWorkingPlan()) {
    const faseBlock = overlay.faseBlockForSprint(plan.sprint);

    for (const key of plan.keys) {
      map.set(key, faseBlock);
    }
  }

  return map;
}

/**
 * Mappa issue piano Working → blocco UI (`data-insight-block` / fase).
 * Allineata a `JLO_WORKING_PLAN` — rigenerata in `jira.working.html` ad ogni regenerate.
 *
 * @returns {Record<string, string>}
 */
export function buildKeyToBlockMap() {
  const keyToFase = buildKeyToFaseBlockMap();
  /** @type {Record<string, string>} */
  const out = {};

  for (const [key, block] of keyToFase) {
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
  const KEY_TO_FASE_BLOCK = buildKeyToFaseBlockMap();

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

  for (const plan of getWorkingPlan()) {
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
  const overlay = getWorkingPlanOverlay();
  const workingPlan = getWorkingPlan();
  const CRITICAL_CHAIN = overlay.CRITICAL_CHAIN ?? [];
  const HOUSEKEEPING_KEYS = overlay.HOUSEKEEPING_KEYS ?? [];
  /** @type {WorkingInsight[]} */
  const insights = [];
  /** @type {Map<string, typeof issues[number]>} */
  const byKey = new Map(issues.map((row) => [row.key, row]));
  const repoRefs = scanRepoJiraReferences();

  insights.push({
    at,
    kind : "info",
    text : `Piano Jira Working · ${workingPlan.length} sprint nel piano · ${issues.length} issue scaricate da Jira`,
  });

  /** @type {string | null} */
  let firstOpenKey = null;
  /** @type {string | null} */
  let firstOpenSprint = null;

  for (const block of workingPlan) {
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

    if (block.sprint === 2 && HOUSEKEEPING_KEYS.length > 0) {
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

  if (HOUSEKEEPING_KEYS.length > 0) {
    /** @type {string[]} */
    const hkOpen = HOUSEKEEPING_KEYS.filter((key) => {
      const row = byKey.get(key);

      return !row || !jiraDone(row.status);
    });

    if (hkOpen.length === 0) {
      insights.push({
        at,
        kind : "ok",
        text : `Housekeeping Fase 0 completato in Jira — ${HOUSEKEEPING_KEYS.join(", ")} sono Fatto`,
      });
    } else if (hkOpen.length < HOUSEKEEPING_KEYS.length) {
      insights.push({
        at,
        kind : "warning",
        text : `Housekeeping parziale in Jira — restano da chiudere: ${hkOpen.join(", ")}`,
      });
    }
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

  if (overlay.sprint6Enabled) {
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
