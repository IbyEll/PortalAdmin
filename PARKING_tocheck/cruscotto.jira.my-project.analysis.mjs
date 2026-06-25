/**
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-17
 *
 * My Project — analisi indipendente repo vs Jira (overlay attivo).
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - la pagina My Project del cruscotto richiede un payload analitico separato dagli insight backlog/working
 *   - combina struttura repo, testScript, report test e backlog Jira in sezioni UI tipizzate
 *
 *   A cosa serve:
 *   - analyzeMyProject — summary, sections (tree, table, stats, backlog-embed) per API dashboard
 *   - non usa jira.backlog.insights né jira.working.insights (percorso analitico autonomo)
 *
 * Generalizzazione:
 *   Si — REPO_ROOT e product repo via test.catalog; fetchJiraBacklog condiviso; overlay PROJECT_* via page.my-project.analysis.mjs opzionale.
 *
 * Input:
 *   - REPO_ROOT — root product repo per scan file e testScript
 *   - fetchJiraBacklog — backlog live o cache DB
 *   - LATEST_JSON — ultimo report test da reporter.mjs
 *   - getPortalRoot — path PortalAdmin per asset e manifest
 *
 * Consumatori:
 *   - admin.portal.lib/dashboard.project.mjs — delega analyzeMyProject all'overlay o a questo modulo
 *   - runner/cruscotto.server.mjs — GET /api/my-project via dashboard.project
 *   - cruscotto.frontend/jira/jira.function.repo.refs.mjs — scanRepoJiraReferences condiviso
 *
 * Export principali:
 *   - analyzeMyProject — payload completo analisi My Project
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

import { discoverTestScripts, REPO_ROOT, BLOCKED_SCRIPTS, BLOCKED_REASONS } from "../admin.portal.lib/test.catalog.mjs";
import { getProjectConfig } from "../admin.portal.lib/project.config.mjs";
import { getPortalRoot } from "../admin.portal.lib/portal.paths.resolver.mjs";
import {
  fetchJiraBacklog
, isEpicType
, isJiraStatusDone
, isStoryLikeType
} from "../cruscotto.frontend/cruscotto.jira.backlog.mjs";
import { scanRepoJiraReferences, walkRepoTextFiles } from "../admin.portal.JiraCORE/jira.function.repo.refs.mjs";
import { LATEST_JSON, computeTestCountsBySuite, normalizeReport } from "../admin.portal.lib/reporter.mjs";

const JIRA_BOARD_ID = Number(process.env.JIRA_BOARD_ID ?? 68);
const JIRA_SITE_HOST = String(process.env.JIRA_SITE ?? "myfuturejobsearch.atlassian.net").replace(/^https?:\/\//, "");

/**
 * @returns {{
 *   repoName: string
 *   jiraPrefix: string
 *   jiraBrowseBase: string
 *   jiraBoardUrl: string
 * }}
 */
function getMyProjectContext() {
  const cfg = getProjectConfig();

  return {
    repoName       : cfg.PRJ_NAME
  , jiraPrefix     : cfg.PRJ_JIRA_PREFIX
  , jiraBrowseBase : `https://${JIRA_SITE_HOST}/browse/`
  , jiraBoardUrl   : `https://${JIRA_SITE_HOST}/jira/software/projects/${cfg.PRJ_JIRA_PREFIX}/boards/${JIRA_BOARD_ID}`
  };
}

/**
 * @typedef {{
 *   key?      : string
 * , label     : string
 * , detail?   : string
 * , href?     : string
 * , nodeType? : string
 * , tier?     : string
 * , done?     : boolean
 * , children? : TreeNode[]
 * }} TreeNode
 */

/**
 * @typedef {{
 *   id      : string
 * , title   : string
 * , kind    : "prose" | "table" | "tree" | "stats" | "list" | "progress" | "test-run" | "backlog-embed"
 * , text?   : string
 * , columns?: string[]
 * , rows?   : Array<Record<string, string | number>>
 * , tree?   : TreeNode[]
 * , items?  : Array<{ key?: string, label: string, detail?: string, href?: string, kind?: string }>
 * }} AnalysisSection
 */

/**
 * @returns {Array<{ label: string, value: string | number }>}
 */
function scanRepoStructure() {
  /** @type {Array<{ label: string, value: string | number }>} */
  const stats = [];

  /**
   * @param {string} label
   * @param {string} relDir
   * @param {string} [baseRoot]
   */
  function countTree(label, relDir, baseRoot = REPO_ROOT) {
    const root = join(baseRoot, relDir);

    if (!existsSync(root)) {
      stats.push({ label, value: "—" });

      return;
    }

    /** @type {string[]} */
    const files = [];

    walkRepoTextFiles(root, files);
    stats.push({ label, value: files.length });
  }

  const portalRoot = getPortalRoot();

  countTree("API (`apps/api/src`)", "apps/api/src");
  countTree("Web (`apps/web/src`)", "apps/web/src");
  countTree("Packages (`packages/`)", "packages");
  countTree("testScript/", "testScript");
  countTree("admin.portal.testscript/", "admin.portal.testscript", portalRoot);
  countTree("PortalAdmin (`lib/`)", "lib", portalRoot);
  countTree("PortalAdmin (`cruscotto.frontend/`)", "cruscotto.frontend", portalRoot);
  countTree("PortalAdmin (`admin.portal/`)", "admin.portal", portalRoot);
  countTree("PortalAdmin (`cruscotto.database/`)", "cruscotto.database", portalRoot);

  return stats;
}

/**
 * @returns {Promise<{
 *   generatedAt: string | null
 * , passed: number
 * , failed: number
 * , scripts: number
 * , bySuite: Array<{ suite: string, passed: number, failed: number, skipped: number }>
 * }>}
 */
async function loadTestReportSummary() {
  if (!existsSync(LATEST_JSON)) {
    return {
      generatedAt : null
    , passed      : 0
    , failed      : 0
    , scripts     : 0
    , bySuite     : []
    };
  }

  try {
    const raw  = await readFile(LATEST_JSON, "utf8");
    const data = normalizeReport(JSON.parse(raw));
    const bySuite = computeTestCountsBySuite(data.scripts);

    let passed = 0;
    let failed = 0;

    for (const row of bySuite) {
      passed += row.passed;
      failed += row.failed;
    }

    return {
      generatedAt : data.generatedAt
    , passed
    , failed
    , scripts     : data.scripts.length
    , bySuite
    };
  } catch {
    return {
      generatedAt : null
    , passed      : 0
    , failed      : 0
    , scripts     : 0
    , bySuite     : []
    };
  }
}

/**
 * @param {string} status
 */
function statusBucket(status) {
  const s = String(status ?? "").trim().toLowerCase();

  if (/^(fatto|done|completato|closed|resolved)/.test(s)) {
    return "Fatto";
  }

  if (/^(in corso|in progress|doing)/.test(s)) {
    return "In corso";
  }

  if (/^(da fare|to do|todo|open|backlog)/.test(s)) {
    return "Da fare";
  }

  return status || "—";
}

/**
 * @param {import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow} row
 * @param {Map<string, string[]>} repoRefs
 * @param {{ omitStatus?: boolean }} [options]
 * @returns {TreeNode}
 */
function rowToTreeNode(row, repoRefs, options = {}) {
  const refs = repoRefs.get(row.key) ?? [];
  /** @type {string | undefined} */
  let detail;

  if (options.omitStatus) {
    detail = undefined;
  } else {
    detail = `${row.status}${refs.length ? ` · ${refs.length} ref repo` : " · nessun ref repo"}`;
  }

  return {
    key      : row.key
  , label    : row.summary
  , detail
  , href     : `${getMyProjectContext().jiraBrowseBase}${row.key}`
  , nodeType : row.type
  , tier     : row.tier
  , done     : isJiraStatusDone(row.status)
  , children : []
  };
}

/**
 * @param {TreeNode[]} nodes
 */
function sortTreeNodes(nodes) {
  const tierOrder = { epic: 0, task: 1, subtask: 2 };

  nodes.sort((a, b) => {
    const ta = tierOrder[/** @type {keyof typeof tierOrder} */ (a.tier ?? "")] ?? 2;
    const tb = tierOrder[/** @type {keyof typeof tierOrder} */ (b.tier ?? "")] ?? 2;

    if (ta !== tb) {
      return ta - tb;
    }

    return (a.key ?? a.label).localeCompare(b.key ?? b.label, undefined, { numeric: true });
  });

  for (const node of nodes) {
    if (node.children?.length) {
      sortTreeNodes(node.children);
    }
  }
}

/**
 * @param {string[]} issueKeys
 * @param {Map<string, import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow>} byKey
 * @param {Map<string, string[]>} repoRefs
 * @param {{ omitStatus?: boolean }} [options]
 * @returns {TreeNode[]}
 */
function buildIssueForest(issueKeys, byKey, repoRefs, options = {}) {
  const keySet = new Set(issueKeys);
  /** @type {Map<string, TreeNode>} */
  const nodes  = new Map();

  for (const key of issueKeys) {
    const row = byKey.get(key);

    if (row) {
      nodes.set(key, rowToTreeNode(row, repoRefs, options));
    }
  }

  /** @type {TreeNode[]} */
  const roots = [];

  for (const key of issueKeys) {
    const row  = byKey.get(key);
    const node = nodes.get(key);

    if (!row || !node) {
      continue;
    }

    const parentKey = row.parentKey;

    if (parentKey && keySet.has(parentKey) && nodes.has(parentKey)) {
      nodes.get(parentKey).children.push(node);
    } else {
      roots.push(node);
    }
  }

  sortTreeNodes(roots);

  return roots;
}

/**
 * @param {string} rootKey
 * @param {import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow[]} issues
 * @returns {string[]}
 */
function collectSubtreeKeys(rootKey, issues) {
  /** @type {Map<string, string[]>} */
  const byParent = new Map();

  for (const row of issues) {
    if (!row.parentKey) {
      continue;
    }

    const list = byParent.get(row.parentKey) ?? [];

    list.push(row.key);
    byParent.set(row.parentKey, list);
  }

  /** @type {string[]} */
  const keys  = [rootKey];
  /** @type {string[]} */
  const queue = [rootKey];

  while (queue.length) {
    const parent = queue.shift();

    for (const child of byParent.get(parent) ?? []) {
      keys.push(child);
      queue.push(child);
    }
  }

  return keys;
}

/**
 * @param {string[]} keys
 * @param {Map<string, import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow>} byKey
 * @returns {string[]}
 */
function expandWithAncestors(keys, byKey) {
  /** @type {Set<string>} */
  const expanded = new Set(keys);

  for (const key of keys) {
    let parentKey = byKey.get(key)?.parentKey;

    while (parentKey && byKey.has(parentKey)) {
      expanded.add(parentKey);
      parentKey = byKey.get(parentKey)?.parentKey;
    }
  }

  return [...expanded];
}

/**
 * @param {import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow[]} issues
 * @param {Map<string, string[]>} repoRefs
 * @returns {TreeNode[]}
 */
function buildEpicForest(issues, repoRefs) {
  /** @type {Map<string, import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow>} */
  const byKey = new Map(issues.map((row) => [row.key, row]));
  /** @type {TreeNode[]} */
  const forest = [];

  for (const row of issues) {
    if (!isEpicType(row.type)) {
      continue;
    }

    const subtreeKeys = collectSubtreeKeys(row.key, issues);
    const roots       = buildIssueForest(subtreeKeys, byKey, repoRefs);
    const epicNode    = roots.find((node) => node.key === row.key);

    if (!epicNode) {
      continue;
    }

    const counts = collectDoneCount(epicNode);
    const refs   = repoRefs.get(row.key) ?? [];

    epicNode.detail = `${row.status} · ${counts.done}/${counts.total} Fatto nei figli${refs.length ? ` · ${refs.length} ref repo` : ""}`;
    forest.push(epicNode);
  }

  sortTreeNodes(forest);

  return forest;
}

/**
 * @param {TreeNode} node
 * @returns {{ done: number, total: number }}
 */
function collectDoneCount(node) {
  if (!node.children?.length) {
    return { done: node.done ? 1 : 0, total: node.key ? 1 : 0 };
  }

  let done  = 0;
  let total = 0;

  for (const child of node.children) {
    const sub = collectDoneCount(child);

    done += sub.done;
    total += sub.total;
  }

  return { done, total };
}

/**
 * @param {import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow[]} rows
 * @param {Map<string, import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow>} byKey
 * @param {Map<string, string[]>} repoRefs
 * @returns {TreeNode[]}
 */
function buildFilteredStoryForest(rows, byKey, repoRefs) {
  const keys = expandWithAncestors(rows.map((row) => row.key), byKey);

  return buildIssueForest(keys, byKey, repoRefs);
}

/**
 * @param {string} summary
 */
function cleanFeatureLabel(summary) {
  let text = String(summary ?? "").trim();

  while (/^\[[^\]]+\]\s*/.test(text)) {
    text = text.replace(/^\[[^\]]+\]\s*/, "");
  }

  return text.trim();
}

/**
 * @param {import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow} row
 * @param {Map<string, import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow>} byKey
 */
function findEpicRow(row, byKey) {
  let parentKey = row.parentKey;

  while (parentKey) {
    const parent = byKey.get(parentKey);

    if (!parent) {
      break;
    }

    if (isEpicType(parent.type)) {
      return parent;
    }

    parentKey = parent.parentKey;
  }

  return null;
}

/**
 * @param {string} label
 */
function futureInline(label) {
  const safe = String(label ?? "").replace(/\}\}/g, "").trim();

  return `{{future:${safe}}}`;
}

/**
 * @param {import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow[]} issues
 * @param {Map<string, import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow>} byKey
 * @param {Map<string, string[]>} repoRefs
 * @returns {string}
 */
function buildFunctionalSummaryText(issues, byKey, repoRefs) {
  const ctx = getMyProjectContext();
  const storyLike = issues.filter(
    (row) => isStoryLikeType(row.type) && row.tier !== "subtask"
  );
  const doneStories = storyLike.filter((row) => isJiraStatusDone(row.status));
  const openStories = storyLike.filter((row) => !isJiraStatusDone(row.status));

  /** @type {Map<string, { epic: import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow | null, done: import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow[], open: import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow[] }>} */
  const groups = new Map();

  /**
   * @param {import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow} row
   * @param {"done" | "open"} bucket
   */
  function addToGroup(row, bucket) {
    const epic     = findEpicRow(row, byKey);
    const groupKey = epic?.key ?? "_other";
    const group    = groups.get(groupKey) ?? { epic, done: [], open: [] };

    if (!groups.has(groupKey)) {
      groups.set(groupKey, group);
    } else if (epic && !group.epic) {
      group.epic = epic;
    }

    group[bucket].push(row);
  }

  for (const row of doneStories) {
    addToGroup(row, "done");
  }

  for (const row of openStories) {
    addToGroup(row, "open");
  }

  const orderedGroups = [...groups.entries()].sort((a, b) => {
    if (a[0] === "_other") {
      return 1;
    }

    if (b[0] === "_other") {
      return -1;
    }

    return a[0].localeCompare(b[0], undefined, { numeric: true });
  });

  const MAX_DONE_PER_GROUP = 8;
  const MAX_OPEN_PER_GROUP = 6;
  /** @type {string[]} */
  const paragraphs = [];

  paragraphs.push(
    `**${ctx.repoName}** (${ctx.jiraPrefix}) — stato per macro-area Epic: testo normale = **consegnato** (${doneStories.length} Story/Bug «Fatto»); testo **magenta** = ancora aperte in Jira (${openStories.length}):`
  );

  for (const [, group] of orderedGroups) {
    const { epic, done, open } = group;

    done.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
    open.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

    let areaName = "Cross-cutting, UX e fix puntuali";

    if (epic) {
      areaName = epic.summary.replace(/\s*[—–-]\s*.+$/, "").trim();
    }

    const doneLabels = done
      .map((row) => cleanFeatureLabel(row.summary))
      .filter((label, index, arr) => label && arr.indexOf(label) === index);

    const openLabels = open
      .map((row) => cleanFeatureLabel(row.summary))
      .filter((label, index, arr) => label && arr.indexOf(label) === index);

    const shownDone  = doneLabels.slice(0, MAX_DONE_PER_GROUP);
    const shownOpen  = openLabels.slice(0, MAX_OPEN_PER_GROUP);
    const overflowDone = doneLabels.length - shownDone.length;
    const overflowOpen = openLabels.length - shownOpen.length;
    const withRepo     = done.filter((row) => (repoRefs.get(row.key)?.length ?? 0) > 0).length;

    /** @type {string[]} */
    const parts = [...shownDone];

    if (overflowDone > 0) {
      parts.push(`…e altre ${overflowDone} Fatto`);
    }

    for (const label of shownOpen) {
      parts.push(futureInline(label));
    }

    if (overflowOpen > 0) {
      parts.push(futureInline(`…e altre ${overflowOpen} in backlog`));
    }

    if (!parts.length) {
      continue;
    }

    let block = `**${areaName}** — ${parts.join("; ")}`;

    if (withRepo > 0 && done.length) {
      block += ` (${withRepo}/${done.length} Fatto con codice nel repo)`;
    }

    block += ".";
    paragraphs.push(block);
  }

  const withRepoTotal = doneStories.filter((row) => (repoRefs.get(row.key)?.length ?? 0) > 0).length;

  paragraphs.push(
    `**Allineamento repo:** **${withRepoTotal}** capability «Fatto» hanno almeno un riferimento \`${ctx.jiraPrefix}-xxx\` nei sorgenti del product repo.`
  );

  return paragraphs.join("\n\n");
}

/**
 * @param {string} rel
 */
function repoExists(rel) {
  return existsSync(join(REPO_ROOT, rel));
}

/**
 * @param {import("../admin.portal.lib/test.catalog.mjs").ScriptEntry[]} testScripts
 */
function scanRepoCapabilities(testScripts) {
  /** @type {Array<{ area: string, items: string[] }>} */
  const areas = [];

  /** @type {string[]} */
  const stackItems = [];

  if (repoExists("apps/web")) {
    stackItems.push("web Next.js App Router + next-intl IT/EN");
  }

  if (repoExists("apps/api")) {
    stackItems.push("API NestJS (:4000)");
  }

  if (repoExists("apps/authentication")) {
    stackItems.push("authentication NestJS (:4001)");
  }

  if (repoExists("apps/mobile")) {
    stackItems.push("mobile Expo (scaffold)");
  }

  if (repoExists("packages/database/prisma/schema.prisma")) {
    stackItems.push("Prisma SQLite + package condivisi (shared, auth-kit, i18n, mail)");
  }

  if (stackItems.length) {
    areas.push({ area: "Stack monorepo", items: stackItems });
  }

  /** @type {string[]} */
  const authItems = [];

  if (repoExists("apps/authentication/src/auth/auth.controller.ts")) {
    authItems.push(
      "register, login, refresh, logout JWT"
    , "verify-email, forgot/reset password, resend verification"
    , "GET/PUT profilo su auth/me"
    );
  }

  if (repoExists("apps/web/src/app/[locale]/login/page.tsx")) {
    authItems.push("pagine web login, register, verify-email, forgot/reset password");
  }

  if (repoExists("apps/web/src/components/Authentication/AuthProvider.tsx")) {
    authItems.push("sessione client AuthProvider, RequireAuth, HeaderAuth, gate email verificata");
  }

  if (authItems.length) {
    areas.push({ area: "Identità e autenticazione", items: authItems });
  }

  /** @type {string[]} */
  const matchItems = [];

  if (repoExists("apps/api/src/matches/matches.controller.ts")) {
    matchItems.push(
      "API match: lista pubblica (filtri, search, paginazione)"
    , "creazione match, join/leave/ready, cancel/close host"
    , "lifecycle open→full→in_game→closed/cancelled, lobby code, scheduler"
    );
  }

  if (repoExists("apps/web/src/app/[locale]/matches/page.tsx")) {
    matchItems.push("UI web elenco + creazione match, countdown avvio, card lobby");
  }

  if (matchItems.length) {
    areas.push({ area: "Match e matchmaking", items: matchItems });
  }

  /** @type {string[]} */
  const tournamentItems = [];

  if (repoExists("apps/api/src/tournaments/tournaments.controller.ts")) {
    tournamentItems.push("API tornei: GET lista con filtri, POST creazione (email verificata)");
  }

  if (repoExists("apps/web/src/app/[locale]/tournaments/page.tsx")) {
    tournamentItems.push("UI web elenco + creazione torneo");
  }

  if (tournamentItems.length) {
    areas.push({ area: "Tornei", items: tournamentItems });
  }

  /** @type {string[]} */
  const profileItems = [];

  if (repoExists("apps/api/src/game-profile/game-profile.controller.ts")) {
    profileItems.push("game-profile Warzone/Activision (GET/PUT/DELETE /game-profile/me)");
  }

  if (repoExists("apps/api/src/gamer-profile/gamer-profile.controller.ts")) {
    profileItems.push("gamer-world: setup, skills, piattaforme, giochi preferiti, achievement, team, highlight");
  }

  if (repoExists("apps/api/src/cod/cod.controller.ts")) {
    profileItems.push("statistiche COD esterne (/cod/stats, /cod/me/stats, env-gated)");
  }

  if (repoExists("apps/web/src/app/[locale]/profile/user/page.tsx")) {
    profileItems.push("web profilo utente, Warzone, gamer-world, upload avatar/banner");
  }

  if (repoExists("apps/web/src/components/Profile/NotificationPreferencesSection.tsx")) {
    profileItems.push("preferenze notifiche nel profilo");
  }

  if (profileItems.length) {
    areas.push({ area: "Profilo giocatore", items: profileItems });
  }

  /** @type {string[]} */
  const socialItems = [];

  if (repoExists("apps/api/src/social/friends.controller.ts")) {
    socialItems.push("amicizie: lista, richieste, accept (REST /social/friends)");
  }

  if (socialItems.length) {
    areas.push({ area: "Social", items: socialItems });
  }

  /** @type {string[]} */
  const notifItems = [];

  if (repoExists("apps/api/src/notifications/notifications.controller.ts")) {
    notifItems.push(
      "in-app: lista, unread count, mark read, preferenze CRUD"
    , "eventi match: cancelled_by_host, started, auto_closed_no_quorum, closed_by_host, starting_soon, ready_reminder"
    );
  }

  if (repoExists("apps/web/src/components/Notifications/NotificationBell.tsx")) {
    notifItems.push("campanella notifiche in header web");
  }

  if (notifItems.length) {
    areas.push({ area: "Notifiche", items: notifItems });
  }

  /** @type {string[]} */
  const webUxItems = [];

  if (repoExists("apps/web/src/components/LocaleSwitcher.tsx")) {
    webUxItems.push("switch lingua IT/EN, nav home/match/tornei, AppHeader");
  }

  if (repoExists("apps/web/src/middleware.ts")) {
    webUxItems.push("middleware locale next-intl");
  }

  if (webUxItems.length) {
    areas.push({ area: "Web UX", items: webUxItems });
  }

  /** @type {string[]} */
  const adminItems = [];

  if (repoExists("cruscotto.frontend/cruscotto.server.mjs")) {
    adminItems.push("dashboard dev :3999 — run test, report HTML, export, health servizi");
  }

  if (repoExists("admin.portal.lib/test.run.all.mjs")) {
    adminItems.push("runner testScript orchestrato + report latest.json/html");
  }

  if (repoExists("cruscotto.frontend/cruscotto.server.mjs")) {
    adminItems.push("cruscotto SPA: HOME, Test, Jira Working, Backlog, My Project");
  }

  if (repoExists("PARKING_tocheck/cruscotto.jira.my-project.analysis.mjs")) {
    adminItems.push("analisi repo vs Jira (questa pagina)");
  }

  if (repoExists("lib/my-project-analysis.mjs")) {
    adminItems.push("analisi repo vs Jira (overlay legacy)");
  }

  if (adminItems.length) {
    areas.push({ area: "Admin e tooling dev", items: adminItems });
  }

  /** @type {string[]} */
  const future = [];

  if (repoExists("packages/database/prisma/schema.prisma")) {
    let schema = "";

    try {
      schema = readFileSync(join(REPO_ROOT, "packages/database/prisma/schema.prisma"), "utf8");
    } catch {
      /* ignore */
    }

    if (schema.includes("model UserFollow") && !repoExists("apps/api/src/social/follow.controller.ts")) {
      future.push("API follow utenti (modello Prisma presente, controller assente)");
    }

    if (schema.includes("model BracketMatch") && !repoExists("apps/api/src/tournaments/bracket.controller.ts")) {
      future.push("bracket torneo e dispute (modelli Prisma, API bracket assente)");
    }
  }

  if (repoExists("apps/mobile/app/index.tsx")) {
    future.push("mobile Expo — solo scaffold, senza parità funzionale col web");
  }

  for (const rel of BLOCKED_SCRIPTS) {
    const reason = BLOCKED_REASONS[rel] ?? rel;

    future.push(reason.replace(/^blocked\s*[—-]\s*/i, "").trim());
  }

  const suites = [...new Set(testScripts.map((row) => row.suite))].sort();

  return {
    areas
  , future: [...new Set(future)]
  , testScriptCount : testScripts.length
  , testSuites      : suites
  };
}

/**
 * @param {ReturnType<typeof scanRepoCapabilities>} capabilities
 * @param {import("../admin.portal.lib/test.catalog.mjs").ScriptEntry[]} testScripts
 * @param {{ generatedAt: string | null, passed: number, failed: number, scripts: number }} testReport
 * @returns {string}
 */
function buildRepoSummaryText(capabilities, testScripts, testReport) {
  /** @type {string[]} */
  const paragraphs = [];

  paragraphs.push(
    "Panorama **dedotto dal repository** (route, controller, componenti, schema Prisma, suite test) — **non** dallo stato Jira. Il testo normale descrive codice presente; il **magenta** segnala gap o aree incomplete nel repo."
  );

  for (const { area, items } of capabilities.areas) {
    paragraphs.push(`**${area}** — ${items.join("; ")}.`);
  }

  if (capabilities.future.length) {
    paragraphs.push(
      `**Gap / work in progress nel repo** — ${capabilities.future.map((item) => futureInline(item)).join("; ")}.`
    );
  }

  const suiteLabel = capabilities.testSuites.length
    ? capabilities.testSuites.join(", ")
    : "—";

  let quality = `**Verifica automatica:** ${capabilities.testScriptCount} script \`testScript/\` (${suiteLabel})`;

  if (testReport.generatedAt) {
    quality += `; ultimo report ${testReport.passed} pass · ${testReport.failed} fail · ${testReport.scripts} script (${new Date(testReport.generatedAt).toLocaleString("it-IT")})`;
  } else {
    quality += "; nessun \`latest.json\` — esegui \`run-all\`";
  }

  quality += ".";
  paragraphs.push(quality);

  return paragraphs.join("\n\n");
}

/**
 * @returns {Promise<{
 *   analyzedAt: string
 *   jiraFetchedAt: string
 *   summary: Record<string, string | number>
 *   testBySuite: Array<{ suite: string, passed: number, failed: number, skipped: number }>
 *   sections: AnalysisSection[]
 * }>}
 */
export async function analyzeMyProject() {
  const ctx         = getMyProjectContext();
  const analyzedAt  = new Date().toISOString();
  const backlog     = await fetchJiraBacklog();
  const issues      = backlog.issues;
  /** @type {Map<string, import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow>} */
  const byKey       = new Map(issues.map((row) => [row.key, row]));
  const repoRefs    = scanRepoJiraReferences();
  const repoStats   = scanRepoStructure();
  const testScripts = await discoverTestScripts();
  const testReport  = await loadTestReportSummary();

  /** @type {Set<string>} */
  const jiraKeys = new Set(issues.map((row) => row.key));

  /** @type {Record<string, number>} */
  const statusCounts = {};
  /** @type {Record<string, number>} */
  const typeCounts   = {};

  for (const row of issues) {
    const bucket = statusBucket(row.status);

    statusCounts[bucket] = (statusCounts[bucket] ?? 0) + 1;
    typeCounts[row.type] = (typeCounts[row.type] ?? 0) + 1;
  }

  const doneCount = issues.filter((row) => isJiraStatusDone(row.status)).length;
  const inProgressCount = statusCounts["In corso"] ?? 0;
  const todoCount       = statusCounts["Da fare"] ?? 0;
  const donePercent     = Math.round((doneCount / Math.max(issues.length, 1)) * 100);
  const otherCount      = Math.max(
    0
  , issues.length - doneCount - inProgressCount - todoCount
  );

  const storyLikeOpen = issues.filter(
    (row) => isStoryLikeType(row.type)
      && row.tier !== "subtask"
      && !isJiraStatusDone(row.status)
  );

  const openNoRepo = storyLikeOpen
    .filter((row) => !(repoRefs.get(row.key)?.length));

  const openWithRepo = storyLikeOpen
    .filter((row) => (repoRefs.get(row.key)?.length ?? 0) > 0);

  const repoKeysInJira = [...repoRefs.keys()].filter((key) => jiraKeys.has(key));
  const repoKeysGhost  = [...repoRefs.keys()]
    .filter((key) => !jiraKeys.has(key))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .slice(0, 30);

  const activeSprint = backlog.jiraSprints.find((s) => s.state === "active") ?? null;

  /** @type {import("../cruscotto.frontend/cruscotto.jira.backlog.mjs").JiraBacklogRow[]} */
  const sprintIssues = activeSprint
    ? issues.filter((row) => (row.jiraSprints ?? []).some((s) => s.id === activeSprint.id))
    : [];

  const sprintOpen = sprintIssues.filter((row) => !isJiraStatusDone(row.status));
  const epicForest = buildEpicForest(issues, repoRefs);
  const openEpics  = epicForest.filter((node) => {
    const counts = collectDoneCount(node);

    return counts.total > 0 && counts.done < counts.total;
  }).length;
  const refsTotal  = repoKeysInJira.length;

  /** @type {TreeNode[]} */
  const sprintTree = activeSprint
    ? [{
        label    : activeSprint.name
      , nodeType : "Sprint"
      , tier     : "epic"
      , detail   : `${sprintIssues.length - sprintOpen.length}/${sprintIssues.length} Fatto · ${sprintOpen.length} aperti`
      , children : buildIssueForest(
          sprintIssues.map((row) => row.key)
        , byKey
        , repoRefs
        , { omitStatus: true }
        )
      }]
    : [];

  const repoCapabilities = scanRepoCapabilities(testScripts);

  /** @type {AnalysisSection[]} */
  const sections = [
    {
      id         : "jira-status"
    , title      : "Avanzamento lavori"
    , kind       : "progress"
    , percent    : donePercent
    , done       : doneCount
    , inProgress : inProgressCount
    , todo       : todoCount + otherCount
    , total      : issues.length
    }
  , {
      id    : "active-sprint"
    , title : activeSprint ? `Sprint attivo — ${activeSprint.name}` : "Sprint attivo"
    , kind  : "tree"
    , tree  : sprintTree.length
        ? sprintTree
        : [{ label: "Nessuna issue nello sprint attivo.", detail: `Verifica board ${JIRA_BOARD_ID} su Jira.`, children: [] }]
    }
  , {
      id    : "backlog-full"
    , title : `Backlog completa ${ctx.repoName}`
    , kind  : "backlog-embed"
    }
  , {
      id    : "intro"
    , title : "Sintesi"
    , kind  : "prose"
    , text  : buildFunctionalSummaryText(issues, byKey, repoRefs)
    }
  , {
      id    : "repo-summary"
    , title : "Sintesi By Repo"
    , kind  : "prose"
    , text  : buildRepoSummaryText(repoCapabilities, testScripts, testReport)
    }
  , {
      id          : "last-test-run"
    , title       : "Last Test Run"
    , kind        : "test-run"
    , generatedAt : testReport.generatedAt
    , suites      : testReport.bySuite
    , totalPassed : testReport.passed
    , totalFailed : testReport.failed
    , totalScripts: testReport.scripts
    }
  , {
      id      : "jira-type"
    , title   : "Jira — per tipo issue"
    , kind    : "table"
    , columns : ["Tipo", "Conteggio"]
    , rows    : Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([type, count]) => ({ Tipo: type, Conteggio: count }))
    }
  , {
      id    : "epics"
    , title : `Epic — albero gerarchico (${epicForest.length}, ${openEpics} con lavoro residuo)`
    , kind  : "tree"
    , tree  : epicForest
    }
  , {
      id    : "gap-open-no-repo"
    , title : `Gap — aperti in Jira senza riferimento nel repo (${openNoRepo.length})`
    , kind  : "tree"
    , tree  : openNoRepo.length
        ? buildFilteredStoryForest(openNoRepo, byKey, repoRefs)
        : [{ label: `Nessuno — ogni story aperta ha almeno un riferimento ${ctx.jiraPrefix}-xxx nel codice.`, detail: "Heuristica: grep su sorgenti testo del product repo.", children: [] }]
    }
  , {
      id    : "tracked-open"
    , title : `Allineati — aperti in Jira con traccia nel repo (${openWithRepo.length})`
    , kind  : "tree"
    , tree  : openWithRepo.length
        ? buildFilteredStoryForest(openWithRepo, byKey, repoRefs)
        : [{ label: "Nessuna story aperta con traccia nel repository.", children: [] }]
    }
  , {
      id    : "repo-ghost-keys"
    , title : `Repo — key citate nel codice ma assenti in Jira (${repoKeysGhost.length}${repoRefs.size > repoKeysGhost.length + 30 ? "+" : ""})`
    , kind  : "list"
    , items : repoKeysGhost.map((key) => ({
        key
      , label  : key
      , detail : (repoRefs.get(key) ?? []).slice(0, 2).join(", ")
      , href   : `${ctx.jiraBrowseBase}${key}`
      }))
    }
  , {
      id    : "repo-structure"
    , title : "Repository — struttura"
    , kind  : "stats"
    , items : [
        ...repoStats.map((row) => ({ label: row.label, detail: String(row.value) }))
      , { label: "testScript (script)", detail: String(testScripts.length) }
      , {
          label  : "Ultimo report test"
        , detail : testReport.generatedAt
            ? `${testReport.passed} pass · ${testReport.failed} fail · ${testReport.scripts} script (${new Date(testReport.generatedAt).toLocaleString("it-IT")})`
            : "Nessun latest.json — esegui run-all"
        }
      ]
    }
  , {
      id    : "method"
    , title : "Metodo"
    , kind  : "prose"
    , text  : [
        `Questa pagina **non** riusa le insight di Backlog o Jira Working. Legge Jira via API (progetto \`${ctx.jiraPrefix}\`) e scansiona il product repo cercando pattern \`${ctx.jiraPrefix}-\\\\d+\` in file di testo (TS, JS, JSON, MD, Prisma, HTML, …).`
      , "«Ref repo» = almeno un file contiene la key. Non implica che la funzionalità sia completa: indica solo tracciabilità nel codice."
      , "Epic, sprint e story sono mostrati come **albero** (Epic → Story/Bug → Subtask). Lo sprint attivo raggruppa le issue del board con la stessa gerarchia parent Jira."
      ].join("\n\n")
    }
  ];

  return {
    configured    : true
  , overlay       : ctx.repoName
  , jiraPrefix    : ctx.jiraPrefix
  , jiraBoardUrl  : ctx.jiraBoardUrl
  , analyzedAt
  , jiraFetchedAt : backlog.fetchedAt
  , summary       : {
      jiraTotal       : issues.length
    , jiraDone        : doneCount
    , jiraOpenStories : storyLikeOpen.length
    , repoKeysCited   : repoRefs.size
    , repoKeysInJira  : refsTotal
    , sprintActive    : activeSprint?.name ?? "—"
    , sprintIssues    : sprintIssues.length
    , testScripts     : testScripts.length
    , testPassed      : testReport.passed
    , testFailed      : testReport.failed
    }
  , testBySuite       : testReport.bySuite
  , sections
  };
}
