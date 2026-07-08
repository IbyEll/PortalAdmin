/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:30
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:30   by: IbyEll
 * modificato il: 2026-06-23 21:30   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Metadati piano sprint — overlay JustLastOne (prefisso JLO, fasi sprint).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - UI working JLO usa catena critica, fasi e sprint 6 oltre a JLO_WORKING_PLAN in working.order.
 *
 *   A cosa serve:
 *   - CRITICAL_CHAIN, FASE_DEFS, helper titoli fase e flag sprint6 per pagina working JLO.
 *
 * Generalizzazione:
 *   No — metadati piano dedicati JustLastOne; WORKING_PLAN in cruscotto.jira.working.order.mjs.
 *
 * Input:
 *   - —
 *
 * Consumatori:
 *   - lib/working.plan.overlay.mjs — useJloPlan true quando PRJ_JIRA_PREFIX=JLO
 *   - cruscotto.frontend/cruscotto.jira.working.insights.mjs — catena critica e fasi
 *
 * Export principali:
 *   - CRITICAL_CHAIN, HOUSEKEEPING_KEYS, CRITICAL_CHAIN_TITLE
 *   - FASE_DEFS, sprint6Enabled — definizioni fasi sprint working
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

/** @type {Array<{ label: string, keys: string[] }>} */
export const CRITICAL_CHAIN = [
  { label: "Match lifecycle", keys: ["JLO-690", "JLO-637"] },
  { label: "Housekeeping 97/247/637", keys: ["JLO-97", "JLO-247", "JLO-637"] },
  { label: "Export Admin", keys: ["JLO-930", "JLO-931", "JLO-932", "JLO-933"] },
  { label: "Notifiche fondamenta", keys: ["JLO-774", "JLO-775"] },
  { label: "Tornei iscrizione/bracket", keys: ["JLO-100", "JLO-103", "JLO-696"] },
  { label: "Release", keys: ["JLO-872", "JLO-121"] },
];

export const HOUSEKEEPING_KEYS = ["JLO-97", "JLO-247", "JLO-637"];

export const CRITICAL_CHAIN_TITLE = "Catena critica MVP Warzone";

export const sprint6Enabled = true;

/** @type {Array<{ sprint: number, title: string, blockId: string, phaseTreeSprint?: number }>} */
export const FASE_DEFS = [
  { sprint: 2, title: "Fase 0 — Housekeeping · Sprint 2", blockId: "fase-0" },
  { sprint: 3, title: "Fase 1 — Admin MVP · Sprint 3 · epic JLO-849", blockId: "fase-1" },
  { sprint: 4, title: "Fase 2 — Notifiche P0 · Sprint 4 · epic JLO-773", blockId: "fase-2" },
  { sprint: 5, title: "Fase 3 — Tornei Kill Race · Sprint 5 · epic JLO-3", blockId: "fase-3" },
  { sprint: 6, title: "Social · Chat & Gamebook · Sprint 6 · epic JLO-445", blockId: "fase-chat", phaseTreeSprint: 6 },
  { sprint: 7, title: "Fase 4 — Sblocco test blocked · Sprint 7", blockId: "fase-4" },
  { sprint: 8, title: "Fase 5 — Release · Sprint 8 · epic JLO-6", blockId: "fase-5" },
];

/**
 * @param {number} sprint
 * @returns {string}
 */
export function faseBlockForSprint(sprint) {
  if (sprint === 1) {
    return "fatto";
  }

  const hit = FASE_DEFS.find((row) => row.sprint === sprint);

  if (hit) {
    return hit.blockId;
  }

  return `sprint-${sprint}`;
}

/**
 * @param {Array<{ plan: { sprint: number }, openKeys: string[], doneCount: number, total: number }>} blocks
 * @param {Map<string, { key?: string, status?: string, summary?: string, type?: string }>} byKey
 * @param {{ jiraLinkFromMap: (key: string, byKey: Map<string, unknown>) => string, statusBadge: (done: boolean) => string, renderJiraKeysList: (keys: string[], byKey: Map<string, unknown>) => string }} helpers
 * @returns {string[]}
 */
export function buildSintesiRows(blocks, byKey, helpers) {
  const { jiraLinkFromMap, statusBadge, renderJiraKeysList } = helpers;
  /** @type {string[]} */
  const rows = [];

  const adminBlock = blocks.find((b) => b.plan.sprint === 3);
  const hkBlock    = blocks.find((b) => b.plan.sprint === 2);
  const notifBlock = blocks.find((b) => b.plan.sprint === 4);

  if (adminBlock) {
    const exportDone = ["JLO-930", "JLO-931", "JLO-932", "JLO-933"].every(
      (key) => !adminBlock.openKeys.includes(key)
    );

    rows.push([
      "          <tr>"
    , `            <td><strong>Admin MVP</strong> (${jiraLinkFromMap("JLO-849", byKey)})</td>`
    , `            <td>Epic ${statusBadge(!adminBlock.openKeys.includes("JLO-849"))} · export 930–933 ${statusBadge(exportDone)}</td>`
    , "            <td>—</td>"
    , "          </tr>",
    ].join("\n"));
  }

  if (hkBlock) {
    rows.push([
      "          <tr>"
    , "            <td><strong>Housekeeping</strong> (Fase 0)</td>"
    , `            <td>${hkBlock.doneCount}/${hkBlock.total} Fatto · aperti ${hkBlock.openKeys.length ? renderJiraKeysList(hkBlock.openKeys, byKey) : "—"}</td>`
    , "            <td>—</td>"
    , "          </tr>",
    ].join("\n"));
  }

  if (notifBlock) {
    rows.push([
      "          <tr>"
    , `            <td><strong>Notifiche P0</strong> (${jiraLinkFromMap("JLO-773", byKey)})</td>`
    , `            <td>${notifBlock.doneCount}/${notifBlock.total} Fatto in Jira</td>`
    , "            <td>—</td>"
    , "          </tr>",
    ].join("\n"));
  }

  return rows;
}

/**
 * @param {string} jiraPrefix
 * @returns {string}
 */
export function buildWorkflowInner(jiraPrefix) {
  const key = jiraPrefix.toUpperCase();

  return [
    "    <section>"
  , "      <h2>Workflow agente (Cursor)</h2>"
  , "      <ul>"
  , `        <li>Branch: <code>{TIPO}---${key}-{key}-{slug}</code> — <code>STORY</code> · <code>BUG</code> · <code>TODO</code> (tre trattini <code>---</code>)</li>`
  , `        <li><code>procedi ${key}-xxx FULL silent</code> — sequenza subtask in background</li>`
  , `        <li><code>chiudi Story ${key}-xxx</code> — push, PR e chiusura parent Jira</li>`
  , "      </ul>"
  , "    </section>",
  ].join("\n");
}
