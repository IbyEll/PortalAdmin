/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-23 21:30
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:30   by: IbyEll
 * modificato il: 2026-06-23 21:30   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Piano sprint — overlay AdminDashBoard (prefisso ADMIN, sprint blocks).
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Pagina working e ordinamento sprint ADMIN richiedono elenco key per sprint senza hardcode
 *     nel frontend generico.
 *
 *   A cosa serve:
 *   - Espone WORKING_PLAN come array WorkingSprintBlock per cruscotto.jira.working.order.
 *
 * Generalizzazione:
 *   No — dati piano fissi ticket ADMIN; selezionato da lib/working.plan.overlay.mjs.
 *
 * Input:
 *   - —
 *
 * Consumatori:
 *   - lib/working.plan.overlay.mjs — merge quando PRJ_JIRA_PREFIX non è JLO
 *   - PARKING_tocheck\cruscotto.jira.working.order.mjs — ordinamento backlog working
 *
 * Export principali:
 *   - WORKING_PLAN — array sprint, name, keys ticket ADMIN
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

/** @type {import("../cruscotto.jira.working.order.mjs").WorkingSprintBlock[]} */
export const WORKING_PLAN = [
  {
    sprint: 1,
    name  : "Migration ADMIN Portal",
    keys  : [
      "ADMIN-88",
      "ADMIN-89", "ADMIN-90", "ADMIN-91", "ADMIN-92", "ADMIN-93", "ADMIN-94", "ADMIN-95",
      "ADMIN-96", "ADMIN-97", "ADMIN-99", "ADMIN-100", "ADMIN-101", "ADMIN-102", "ADMIN-103",
      "ADMIN-104", "ADMIN-105", "ADMIN-106", "ADMIN-107", "ADMIN-108", "ADMIN-109", "ADMIN-110",
      "ADMIN-111", "ADMIN-112", "ADMIN-113", "ADMIN-114", "ADMIN-115", "ADMIN-116", "ADMIN-117",
      "ADMIN-118", "ADMIN-119", "ADMIN-120", "ADMIN-121", "ADMIN-122", "ADMIN-123", "ADMIN-124",
      "ADMIN-125", "ADMIN-126", "ADMIN-127", "ADMIN-128", "ADMIN-129", "ADMIN-130", "ADMIN-131",
      "ADMIN-132", "ADMIN-133", "ADMIN-134", "ADMIN-135", "ADMIN-136", "ADMIN-141", "ADMIN-142",
      "ADMIN-143", "ADMIN-144", "ADMIN-145", "ADMIN-146", "ADMIN-148",
    ],
  },
  {
    sprint: 2,
    name  : "Sprint 3 — Admin MVP",
    keys  : [
      "ADMIN-1",
      "ADMIN-5", "ADMIN-7", "ADMIN-8", "ADMIN-10", "ADMIN-14",
      "ADMIN-31", "ADMIN-32", "ADMIN-33", "ADMIN-34", "ADMIN-35", "ADMIN-36", "ADMIN-37",
      "ADMIN-38", "ADMIN-39", "ADMIN-40", "ADMIN-41", "ADMIN-42", "ADMIN-43",
      "ADMIN-50", "ADMIN-51", "ADMIN-52",
      "ADMIN-63", "ADMIN-64", "ADMIN-65", "ADMIN-69", "ADMIN-70", "ADMIN-71", "ADMIN-72",
    ],
  },
  {
    sprint: 3,
    name  : "Backlog corrente",
    backlogPool: true,
    keys  : [
      "ADMIN-73",
      "ADMIN-3", "ADMIN-4", "ADMIN-6", "ADMIN-9", "ADMIN-12", "ADMIN-13",
      "ADMIN-83", "ADMIN-84", "ADMIN-85", "ADMIN-86", "ADMIN-87", "ADMIN-98",
    ],
  },
];

/** @type {Array<{ label: string, keys: string[] }>} */
export const CRITICAL_CHAIN = [
  { label: "Migration portal", keys: ["ADMIN-89", "ADMIN-96", "ADMIN-100"] },
  { label: "Cruscotto base", keys: ["ADMIN-5", "ADMIN-10", "ADMIN-14"] },
  { label: "Workflow Jira", keys: ["ADMIN-121", "ADMIN-122"] },
  { label: "Backlog WIP DB", keys: ["ADMIN-83", "ADMIN-84"] },
];

export const HOUSEKEEPING_KEYS = [];

export const CRITICAL_CHAIN_TITLE = "Catena critica ADMIN";

export const sprint6Enabled = false;

/** @type {Array<{ label: string, roots: Array<{ key: string, subtasks?: string[] }> }>} */
export const SPRINT_6_PHASES = [];

export const SPRINT_6_BOARD_NOISE = [];

/** @type {Array<{ sprint: number, title: string, blockId: string, phaseTreeSprint?: number }>} */
export const FASE_DEFS = [
  { sprint: 1, title: "Migration ADMIN Portal · epic ADMIN-88", blockId: "fase-migration" },
  { sprint: 2, title: "Admin MVP · Sprint 3 · epic ADMIN-1", blockId: "fase-mvp" },
  { sprint: 3, title: "Backlog corrente · epic ADMIN-73", blockId: "fase-backlog" },
];

/**
 * @param {number} sprint
 * @returns {string}
 */
export function faseBlockForSprint(sprint) {
  const hit = FASE_DEFS.find((row) => row.sprint === sprint);

  return hit?.blockId ?? `sprint-${sprint}`;
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

  const migration = blocks.find((b) => b.plan.sprint === 1);
  const mvp       = blocks.find((b) => b.plan.sprint === 2);
  const backlog   = blocks.find((b) => b.plan.sprint === 3);

  if (migration) {
    rows.push([
      "          <tr>"
    , `            <td><strong>Migration portal</strong> (${jiraLinkFromMap("ADMIN-88", byKey)})</td>`
    , `            <td>${migration.doneCount}/${migration.total} Fatto · aperti ${migration.openKeys.length ? renderJiraKeysList(migration.openKeys, byKey) : "—"}</td>`
    , "            <td>—</td>"
    , "          </tr>",
    ].join("\n"));
  }

  if (mvp) {
    rows.push([
      "          <tr>"
    , `            <td><strong>Admin MVP</strong> (${jiraLinkFromMap("ADMIN-1", byKey)})</td>`
    , `            <td>Epic ${statusBadge(!mvp.openKeys.includes("ADMIN-1"))} · ${mvp.doneCount}/${mvp.total} Fatto</td>`
    , "            <td>—</td>"
    , "          </tr>",
    ].join("\n"));
  }

  if (backlog) {
    rows.push([
      "          <tr>"
    , `            <td><strong>Backlog aperto</strong> (${jiraLinkFromMap("ADMIN-73", byKey)})</td>`
    , `            <td>${backlog.openKeys.length} aperti · ${backlog.doneCount}/${backlog.total} Fatto</td>`
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
