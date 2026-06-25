#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-18 21:32
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 21:32   by: IbyEll
 * modificato il: 2026-06-18 21:32   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Crea sprint Jira da JLO_WORKING_PLAN — board agile e assegnazione issue + figli.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Allinea board Jira Software ai 9 sprint del piano MVP (project tree e working plan cruscotto).
 *   - Automatizza creazione sprint, chiusura storici e spostamento issue con regole duplicati e figli.
 *
 *   A cosa serve:
 *   - Crea o riusa sprint per nome, assegna issue da JLO_WORKING_PLAN, eredita figli story-like.
 *   - Supporta dry-run per anteprima senza chiamate API di scrittura.
 *
 * Generalizzazione:
 *   No — board JLO (JIRA_BOARD_ID), metadati SPRINT_META e piano da cruscotto.jira.working.order.mjs.
 *
 * Input:
 *   - JIRA_EMAIL, JIRA_API_TOKEN — Basic auth API Atlassian (obbligatori)
 *   - JIRA_CLOUD_ID, JIRA_BOARD_ID, JIRA_SITE — target board agile
 *   - JLO_WORKING_PLAN — issue per sprint da cruscotto.jira.working.order.mjs
 *   - argv --dry-run — simula creazione e assegnazione
 *
 * Uso:
 *   - node admin.portal.JiraCORE/JiraCORE.sprint.create.mjs
 *   - node admin.portal.JiraCORE/JiraCORE.sprint.create.mjs --dry-run
 *
 * Flag CLI:
 *   --dry-run   anteprima sprint e assegnazioni senza POST/PUT Jira
 *
 * Regole operative:
 *   - Nome sprint max 29 caratteri (limite Jira)
 *   - Issue duplicate: vince lo sprint con N più alto
 *   - Sprint chiusi: non assegnano issue (es. Sprint 1 storico)
 *   - Story/Bug/Todo + subtask figlie: spostate col parent (salvo key esplicita nel piano)
 *
 * Consumatori:
 *   - Operatore backlog — allineamento board dopo aggiornamento JLO_WORKING_PLAN
 *   - PARKING_tocheck\cruscotto.jira.working.order.mjs — sorgente issue per sprint
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import "../admin.portal.lib/portal.load.env.mjs";
import { fetchJiraBacklog } from "../cruscotto.frontend/cruscotto.jira.backlog.mjs";
import { getWorkingPlan } from "../PARKING_tocheck/cruscotto.jira.working.order.mjs";
import { resolveJiraBoardId } from "../admin.portal.lib/project.config.mjs";

const MOVE_BATCH_SIZE = 50;

const BOARD_ID = resolveJiraBoardId();
const CLOUD_ID = process.env.JIRA_CLOUD_ID ?? "3caddd74-469e-4ca3-adf8-926f79c98e7c";
const SITE = process.env.JIRA_SITE ?? "myfuturejobsearch.atlassian.net";
const API_BASE = `https://api.atlassian.com/ex/jira/${CLOUD_ID}`;

const DRY_RUN = process.argv.includes("--dry-run");

/** Ticket citati nel tree ma assenti in Jira — aggiornare se ne servono altri. */
const PENDING_CREATE_KEYS = new Set();

/**
 * Metadati sprint (date, epic, note). Le issue vengono da JLO_WORKING_PLAN.
 * @type {Array<{
 *   n: number,
 *   treeId: string,
 *   title: string,
 *   jiraName: string,
 *   epicJira?: string,
 *   pendingCreate?: string[],
 *   startDate?: string,
 *   endDate?: string,
 *   state?: string,
 *   note?: string,
 * }>}
 */
const SPRINT_META = [
  {
    n            : 1,
    treeId       : "epic-done",
    title        : "Già completato (repo + Jira)",
    jiraName     : "Sprint 1 — Completato",
    startDate    : "2026-05-26T09:00:00.000Z",
    endDate      : "2026-06-08T17:00:00.000Z",
    state        : "closed",
    note         : "637 spostata in Sprint 2 (housekeeping epic)",
  },
  {
    n            : 2,
    treeId       : "phase-0",
    title        : "Fase 0 — Housekeeping",
    jiraName     : "Sprint 2 — Fase 0",
    startDate    : "2026-06-09T09:00:00.000Z",
    endDate      : "2026-06-23T17:00:00.000Z",
    note         : "JLO-924 voice chat match",
  },
  {
    n            : 3,
    treeId       : "epic-849",
    title        : "Fase 1 — Admin MVP",
    jiraName     : "Sprint 3 — Admin MVP",
    epicJira     : "JLO-849",
    startDate    : "2026-06-23T09:00:00.000Z",
    endDate      : "2026-07-07T17:00:00.000Z",
    note         : "export JLO-930 + subtask 931–933; poi chiudere epic 849",
  },
  {
    n            : 4,
    treeId       : "epic-773",
    title        : "Fase 2 — Notifiche P0",
    jiraName     : "Sprint 4 — Notifiche",
    epicJira     : "JLO-773",
    startDate    : "2026-07-07T09:00:00.000Z",
    endDate      : "2026-07-21T17:00:00.000Z",
  },
  {
    n            : 5,
    treeId       : "epic-3",
    title        : "Fase 3 — Tornei Kill Race",
    jiraName     : "Sprint 5 — Tornei",
    epicJira     : "JLO-3",
    startDate    : "2026-07-21T09:00:00.000Z",
    endDate      : "2026-08-04T17:00:00.000Z",
    note         : "JLO-696 in Sprint 7 (sblocco test)",
  },
  {
    n            : 6,
    treeId       : "epic-chat-gamebook",
    title        : "Chat, Gamebook e Feed home",
    jiraName     : "Sprint 6 — Chat & Gamebook",
    epicJira     : "JLO-445",
    startDate    : "2026-08-04T09:00:00.000Z",
    endDate      : "2026-08-18T17:00:00.000Z",
    note         : "prima release: feed + gamebook + chat REST; amici-only feed v1",
  },
  {
    n            : 7,
    treeId       : "phase-4",
    title        : "Fase 4 — Sblocco test blocked",
    jiraName     : "Sprint 7 — Sblocco",
    startDate    : "2026-08-18T09:00:00.000Z",
    endDate      : "2026-09-01T17:00:00.000Z",
    note         : "696 vince su Sprint 5 se duplicata",
  },
  {
    n            : 8,
    treeId       : "epic-6",
    title        : "Fase 5 — Release",
    jiraName     : "Sprint 8 — Release",
    epicJira     : "JLO-6",
    startDate    : "2026-09-01T09:00:00.000Z",
    endDate      : "2026-09-15T17:00:00.000Z",
    note         : "JLO-121 include feed, gamebook, chat DM",
  },
  {
    n            : 9,
    treeId       : "postpone",
    title        : "Posticipare (FuoriScope / Plus)",
    jiraName     : "Sprint 9 — Plus",
    note         : "874 parent di 886,887,922,923",
  },
];

/** @type {typeof SPRINT_META[number] & { issues: string[] }[]} */
const SPRINTS = SPRINT_META.map((meta) => {
  const block = getWorkingPlan().find((row) => row.sprint === meta.n);

  return {
    ...meta,
    issues: block?.keys ?? [],
  };
});

function sprintName(def) {
  const name = def.jiraName ?? `Sprint ${def.n} — ${def.title}`;

  if (name.length > 29) {
    throw new Error(`Nome sprint troppo lungo (${name.length}/29): ${name}`);
  }

  return name;
}

function authHeader() {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!email || !token) {
    console.error("Mancano JIRA_EMAIL e/o JIRA_API_TOKEN in .env");
    console.error("Copia .env.example → .env e compila i valori.");
    console.error("API token: https://id.atlassian.com/manage-profile/security/api-tokens");
    process.exit(1);
  }

  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

/**
 * @param {string} path
 * @param {RequestInit} init
 */
async function jiraFetch(path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept        : "application/json",
      "Content-Type": "application/json",
      Authorization : authHeader(),
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const parts = [];

    if (typeof body === "object" && body?.errorMessages?.length) {
      parts.push(...body.errorMessages);
    }

    if (typeof body === "object" && body?.errors) {
      parts.push(...Object.entries(body.errors).map(([k, v]) => `${k}: ${v}`));
    }

    if (typeof body === "object" && body?.message) {
      parts.push(body.message);
    }

    const msg = parts.join("; ") || text || res.statusText;
    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${msg}`);
  }

  return body;
}

/**
 * @returns {Promise<Array<{ id: number, name: string, state: string }>>}
 */
async function listBoardSprints() {
  if (DRY_RUN) {
    return [];
  }

  const data = await jiraFetch(
    `/rest/agile/1.0/board/${BOARD_ID}/sprint?state=active,future,closed&maxResults=100`
  );

  return Array.isArray(data.values) ? data.values : [];
}

/**
 * @param {number} sprintId
 * @param {typeof SPRINTS[0]} def
 * @param {string} name
 */
async function closeSprint(sprintId, def, name) {
  await jiraFetch(`/rest/agile/1.0/sprint/${sprintId}`, {
    method: "PUT",
    body  : JSON.stringify({
      name,
      state    : "active",
      startDate: def.startDate,
      endDate  : def.endDate,
    }),
  });

  await jiraFetch(`/rest/agile/1.0/sprint/${sprintId}`, {
    method: "PUT",
    body  : JSON.stringify({
      name,
      state    : "closed",
      startDate: def.startDate,
      endDate  : def.endDate,
    }),
  });
}

/**
 * @param {typeof SPRINTS[0]} def
 */
async function createSprint(def, existingByName) {
  const name = sprintName(def);

  if (DRY_RUN) {
    console.log(`[dry-run] create sprint: ${name}`);
    return { id: 9000 + def.n, name };
  }

  const existing = existingByName.get(name);

  if (existing) {
    console.log(`  (già esistente, id ${existing.id})`);

    if (def.state === "closed" && existing.state !== "closed") {
      await closeSprint(existing.id, def, name);
    }

    return existing;
  }

  const payload = {
    name,
    originBoardId: BOARD_ID,
  };

  if (def.startDate && def.state !== "closed") {
    payload.startDate = def.startDate;
  }

  if (def.endDate && def.state !== "closed") {
    payload.endDate = def.endDate;
  }

  const sprint = await jiraFetch("/rest/agile/1.0/sprint", {
    method: "POST",
    body  : JSON.stringify(payload),
  });

  if (def.state === "closed") {
    await closeSprint(sprint.id, def, name);
  }

  return sprint;
}

/**
 * @param {number} sprintId
 */
async function getSprintState(sprintId) {
  if (DRY_RUN) {
    return "future";
  }

  const sprint = await jiraFetch(`/rest/agile/1.0/sprint/${sprintId}`);
  return sprint.state ?? "future";
}

/**
 * @param {number} sprintId
 * @param {string[]} issueKeys
 */
async function moveIssuesToSprint(sprintId, issueKeys) {
  if (issueKeys.length === 0) {
    return;
  }

  if (DRY_RUN) {
    console.log(`[dry-run] sprint ${sprintId} ← ${issueKeys.length} issue`);
    return;
  }

  for (let offset = 0; offset < issueKeys.length; offset += MOVE_BATCH_SIZE) {
    const batch = issueKeys.slice(offset, offset + MOVE_BATCH_SIZE);

    await jiraFetch(`/rest/agile/1.0/sprint/${sprintId}/issue`, {
      method: "POST",
      body  : JSON.stringify({ issues: batch }),
    });
  }
}

/**
 * @param {Array<{ key: string, parentKey?: string | null }>} issues
 * @returns {Map<string, string[]>}
 */
function buildChildrenByParent(issues) {
  /** @type {Map<string, string[]>} */
  const map = new Map();

  for (const row of issues) {
    if (!row.parentKey) {
      continue;
    }

    const list = map.get(row.parentKey) ?? [];
    list.push(row.key);
    map.set(row.parentKey, list);
  }

  return map;
}

/**
 * @param {string} rootKey
 * @param {Map<string, string[]>} childrenByParent
 * @returns {string[]}
 */
function collectDescendantKeys(rootKey, childrenByParent) {
  /** @type {string[]} */
  const out = [];
  /** @type {string[]} */
  const queue = [...(childrenByParent.get(rootKey) ?? [])];

  while (queue.length > 0) {
    const key = queue.shift();

    if (!key) {
      continue;
    }

    out.push(key);
    queue.push(...(childrenByParent.get(key) ?? []));
  }

  return out;
}

/**
 * @param {string} key
 */
async function issueExists(key) {
  if (DRY_RUN) {
    return !PENDING_CREATE_KEYS.has(key);
  }

  try {
    await jiraFetch(`/rest/api/3/issue/${key}?fields=key`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Duplicati: ultimo sprint (numero più alto) vince.
 * Le issue nel piano espandono story-like/subtask figlie (salvo key già nel piano).
 *
 * @param {typeof sprintResults} sprintResults
 * @param {Map<string, string[]>} childrenByParent
 * @returns {Map<string, { sprintId: number, sprintName: string, n: number }>}
 */
function resolveIssueSprintMap(sprintResults, childrenByParent) {
  /** @type {Map<string, { sprintId: number, sprintName: string, n: number }>} */
  const explicit = new Map();
  /** @type {Set<number>} */
  const closedPlanSprints = new Set();

  for (const row of sprintResults) {
    if (row.def.state === "closed") {
      closedPlanSprints.add(row.def.n);
    }

    for (const key of row.validIssues) {
      const prev = explicit.get(key);

      if (!prev || row.def.n > prev.n) {
        explicit.set(key, {
          sprintId  : row.sprintId,
          sprintName: row.sprintName,
          n         : row.def.n,
        });
      }
    }
  }

  /**
   * Key esplicita nel piano su sprint chiuso → non blocca ereditarietà da parent aperto.
   *
   * @param {string} key
   * @returns {boolean}
   */
  function blocksInheritance(key) {
    const entry = explicit.get(key);

    if (!entry) {
      return false;
    }

    return !closedPlanSprints.has(entry.n);
  }

  /** @type {Map<string, { sprintId: number, sprintName: string, n: number }>} */
  const expanded = new Map();

  for (const [key, target] of explicit) {
    if (closedPlanSprints.has(target.n)) {
      continue;
    }

    for (const desc of collectDescendantKeys(key, childrenByParent)) {
      if (blocksInheritance(desc)) {
        continue;
      }

      const prev = expanded.get(desc);

      if (!prev || target.n > prev.n) {
        expanded.set(desc, target);
      }
    }
  }

  for (const [key, target] of explicit) {
    if (closedPlanSprints.has(target.n)) {
      continue;
    }

    expanded.set(key, target);
  }

  return expanded;
}

async function main() {
  // 1. Banner — board URL e modalità dry-run
  console.log(`Board JLO: https://${SITE}/jira/software/projects/JLO/boards/${BOARD_ID}`);
  console.log(DRY_RUN ? "Modalità dry-run\n" : "Creazione sprint…\n");

  // 2. Backlog Jira — albero parent/figli per ereditarietà issue (skip se dry-run)
  const backlog = DRY_RUN
    ? { issues: [] }
    : await fetchJiraBacklog();
  const childrenByParent = buildChildrenByParent(backlog.issues);

  /** @type {Array<{ def: typeof SPRINTS[0], sprintId: number, sprintName: string, validIssues: string[], skipped: string[] }>} */
  const sprintResults = [];
  const existingSprints = await listBoardSprints();
  const existingByName = new Map(existingSprints.map((s) => [s.name, s]));

  // 3. Creazione sprint — loop SPRINT_META + validazione issue esistenti
  for (const def of SPRINTS) {
    const name = sprintName(def);
    const skipped = [];
    /** @type {string[]} */
    const validIssues = [];

    for (const key of def.issues) {
      if (await issueExists(key)) {
        validIssues.push(key);
      } else {
        skipped.push(key);
      }
    }

    const sprint = await createSprint(def, existingByName);
    const sprintId = sprint.id;
    existingByName.set(sprint.name ?? sprintName(def), sprint);

    console.log(`✓ [${def.treeId}] ${name} — ${def.title} (id ${sprintId})`);

    if (def.epicJira) {
      console.log(`  epic: ${def.epicJira}`);
    }

    if (def.note) {
      console.log(`  nota: ${def.note}`);
    }

    console.log(`  issue ok: ${validIssues.length ? validIssues.join(", ") : "(nessuna)"}`);

    if (skipped.length) {
      console.log(`  saltate (inesistenti): ${skipped.join(", ")}`);
    }

    if (def.pendingCreate?.length) {
      console.log(`  da creare in Jira: ${def.pendingCreate.join(", ")}`);
    }

    sprintResults.push({ def, sprintId, sprintName: name, validIssues, skipped });
  }

  // 4. Mappa issue → sprint — duplicati: sprint con N più alto; espansione figli
  const issueMap = resolveIssueSprintMap(sprintResults, childrenByParent);

  /** @type {Map<number, string[]>} */
  const bySprint = new Map();

  for (const [key, target] of issueMap) {
    const list = bySprint.get(target.sprintId) ?? [];
    list.push(key);
    bySprint.set(target.sprintId, list);
  }

  console.log("\nAssegnazione issue + figli (duplicati → sprint con N più alto)…");

  // 5. Assegnazione batch — moveIssuesToSprint per ogni sprint non chiuso
  for (const row of sprintResults) {
    const keys = bySprint.get(row.sprintId) ?? [];

    if (keys.length === 0) {
      continue;
    }

    const state = await getSprintState(row.sprintId);

    if (state === "closed") {
      console.log(`⊘ ${row.sprintName}: sprint chiuso — ${keys.length} issue (non assegnate)`);
      continue;
    }

    const planOnly = keys.filter((k) => row.validIssues.includes(k)).length;
    const inherited = keys.length - planOnly;

    await moveIssuesToSprint(row.sprintId, keys);
    console.log(
      `✓ ${row.sprintName}: ${keys.length} issue`
      + ` (${planOnly} piano`
      + (inherited > 0 ? ` + ${inherited} figli` : "")
      + ")"
    );
  }

  console.log("\nFatto.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
