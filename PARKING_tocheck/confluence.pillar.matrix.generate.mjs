#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-23 21:30
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-23 21:30   by: IbyEll
 * modificato il: 2026-06-23 21:30   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Matrice pilastri prodotto × Jira × repo — output HTML per Confluence.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Documentazione Confluence pilastri deve allineare backlog JLO, segnali repo e gap.
 *
 *   A cosa serve:
 *   - Fetch backlog, inspect repo signals e genera HTML matrice per pilastro prodotto.
 *
 * Generalizzazione:
 *   No — pilastri e key JLO hardcoded per documento 9076737 JustLastOne.
 *
 * Input:
 *   - argv --write — path file body HTML output opzionale
 *   - credenziali Jira env — fetchJiraBacklog live
 *
 * Uso:
 *   - node admin.script.standalone/confluence.pillar.matrix.generate.mjs
 *
 * Exit code:
 *   0 — HTML generato su stdout o file
 *   1 — fetch Jira o IO falliti
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { fetchJiraBacklog, isEpicType, isJiraStatusDone, isStoryLikeType } from "../cruscotto.frontend/cruscotto.jira.backlog.mjs";
import { inspectRepoSignal, REPO_IMPLEMENTATION_SIGNALS, assessIssueRepoInspect } from "../cruscotto.frontend/cruscotto.jira.backlog.insights.mjs";
import {
  GIT_EVIDENCE_COMMIT_LIMIT
, resolveTicketGitEvidence
} from "../admin.portal.JiraCORE/JiraCORE.signals.catalog.implementation.mjs";
import { scanRepoJiraReferences } from "../admin.portal.JiraCORE/jira.function.repo.refs.mjs";
import { OBSOLETE_ISSUE_ENTRIES, resolveIssueSprintName } from "../PARKING_tocheck/cruscotto.jira.working.order.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOC_URL = "https://myfuturejobsearch.atlassian.net/wiki/spaces/SDS/pages/9076737/Piattaforma+Social+per+Gamer+Documento+di+lavoro";
const JIRA_BROWSE = "https://myfuturejobsearch.atlassian.net/browse/";

/** @typedef {{ id: string, pillar: string, source: string, area: string, anchorKeys: string[], includeKeys?: string[], docExcerpt?: string }} ProductPillar */

/** @type {ProductPillar[]} — allineati a § Pilastri + domini doc 9076737 */
/** Ordine funzionale: accesso → profilo → community → social → play → admin */
const PRODUCT_PILLARS = [
  {
    id          : "auth-onboarding"
  , pillar      : "Auth & onboarding"
  , source      : "§ MVP · login + profilo base · Epic JLO-1"
  , area        : "Trasversale"
  , anchorKeys  : ["JLO-1", "JLO-353"]
  , includeKeys : ["JLO-896", "JLO-894", "JLO-895"]
  , docExcerpt  : [
      `<p><strong>MVP — fondamenta accesso</strong> (prerequisito di tutti i pilastri).</p>`
    , `<ul>`
    , `<li><strong>Epic JLO-1 Auth &amp; User Management</strong> — Sprint 1 Auth &amp; Registration (Fatto su <code>main</code>)</li>`
    , `<li>Registrazione, login, logout, refresh JWT · verifica email · forgot/reset password</li>`
    , `<li>Servizi <code>apps/authentication</code> :4001 + <code>apps/api</code> :4000 · web <code>/login</code>, <code>/register</code></li>`
    , `<li>Header utente connesso (JLO-896) · onboarding guidato post-login (Epic JLO-353, Da fare)</li>`
    , `<li><strong>Architettura:</strong> dominio Utenti e profili</li>`
    , `</ul>`
    ].join("\n")
  }
, {
    id          : "profilo-gamer"
  , pillar      : "Profilo gamer"
  , source      : "§ Core piattaforma · tab Profilo"
  , area        : "Profilo"
  , anchorKeys  : ["JLO-609", "JLO-611", "JLO-289"]
  , includeKeys : ["JLO-617", "JLO-618", "JLO-619"]
  , docExcerpt  : [
      `<p><strong>Core piattaforma — Profilo gamer</strong> (tab Profilo · area Gamebook).</p>`
    , `<ul>`
    , `<li>Profilo gamer: giochi preferiti, rank, clan</li>`
    , `<li>Lista amici</li>`
    , `<li>Statistiche, achievement, ranking globale/locale · Epic <strong>JLO-289</strong> Stats &amp; Ranking</li>`
    , `<li>Gamebook / storie, upload, share verso feed</li>`
    , `<li><strong>Tab Profilo:</strong> nickname, giochi, rank; statistiche; achievement; ranking</li>`
    , `</ul>`
    ].join("\n")
  }
, {
    id          : "trovare-giocatori"
  , pillar      : "Trovare giocatori"
  , source      : "Pilastri · Matchmaking, inviti, lobby"
  , area        : "Play · Community"
  , anchorKeys  : ["JLO-2"]
  , includeKeys : ["JLO-637", "JLO-247", "JLO-846", "JLO-924", "JLO-668"]
  , docExcerpt  : [
      `<p><strong>Pilastro definizione operativa:</strong> trovare giocatori — matchmaking, inviti, lobby, suggerimenti amici.</p>`
    , `<ul>`
    , `<li><strong>Area prodotto:</strong> Play · Community</li>`
    , `<li><strong>Tab Play:</strong> trova partita (gioco, livello, casual/ranked); entra in lobby con chat e countdown</li>`
    , `<li><strong>Problema:</strong> trovare persone con cui giocare è difficile; community frammentate tra Discord, Telegram, app varie</li>`
    , `<li><strong>Backlog JLO:</strong> match lifecycle · tornei Sprint 5 · voice chat match (JLO-924)</li>`
    , `</ul>`
    ].join("\n")
  }
, {
    id          : "chattare"
  , pillar      : "Chattare"
  , source      : "Pilastri · DM, chat lobby, gruppi"
  , area        : "Community · Play"
  , anchorKeys  : ["JLO-4", "JLO-290", "JLO-299"]
  , docExcerpt  : [
      `<p><strong>Pilastro definizione operativa:</strong> chattare — DM 1-to-1, chat lobby partita, gruppi.</p>`
    , `<ul>`
    , `<li><strong>Area prodotto:</strong> Community · Play</li>`
    , `<li><strong>Core piattaforma:</strong> chat (testo + vocale) — DM, lobby, gruppi</li>`
    , `<li><strong>Sprint 6:</strong> Fase 3 chat DM (JLO-290) · Fase 4 chat lobby (JLO-299)</li>`
    , `<li><strong>Sistema notifiche:</strong> messaggi DM e lobby; nuovo post/storia amico (evoluzione)</li>`
    , `</ul>`
    ].join("\n")
  }
, {
    id          : "notifiche"
  , pillar      : "Sistema notifiche"
  , source      : "§ Sistema notifiche doc 9076737"
  , area        : "Trasversale"
  , anchorKeys  : ["JLO-773"]
  , docExcerpt  : [
      `<p><strong>Sezione documento:</strong> Sistema notifiche (trasversale a Play, Chat, Social, Tornei).</p>`
    , `<ul>`
    , `<li>Invito partita</li>`
    , `<li>Match trovato</li>`
    , `<li>Torneo iniziato</li>`
    , `<li>Messaggi (DM e lobby)</li>`
    , `<li>Nuovo post / storia amico</li>`
    , `<li>Richiesta amicizia accettata (gate feed)</li>`
    , `</ul>`
    , `<p><strong>Implementazione JLO:</strong> Epic JLO-773 Notifiche JustLastOne · Sprint 4 — in-app first, email match, preferenze utente.</p>`
    ].join("\n")
  }
, {
    id          : "creare-feed"
  , pillar      : "Creare feed"
  , source      : "Pilastri · Post, gruppi, feed amici"
  , area        : "Home · Community"
  , anchorKeys  : ["JLO-507", "JLO-533"]
  , docExcerpt  : [
      `<p><strong>Pilastro definizione operativa:</strong> creare feed — post propri, gruppi, visibilità amici accettati.</p>`
    , `<ul>`
    , `<li><strong>Area prodotto:</strong> Home · Community</li>`
    , `<li><strong>Tab Home:</strong> feed (clip, risultati, post); attività amici; post e storie amici nel feed</li>`
    , `<li><strong>Core:</strong> creazione feed proprio — post e gruppi con visibilità tra amici accettati</li>`
    , `<li><strong>Sprint 6:</strong> Fase 0 Social JLO-507 (gate amicizie) · Fase 1 Feed JLO-533</li>`
    , `<li><strong>MVP:</strong> amicizie e feed minimo; post/gruppi JLO-526</li>`
    , `</ul>`
    ].join("\n")
  }
, {
    id          : "creare-storie"
  , pillar      : "Creare storie (GameBook)"
  , source      : "Pilastri · Pagina /gamebook"
  , area        : "Profilo · Gamebook"
  , anchorKeys  : ["JLO-445", "JLO-952"]
  , includeKeys : ["JLO-446", "JLO-447", "JLO-448"]
  , docExcerpt  : [
      `<p><strong>Pilastro definizione operativa:</strong> creare storie — pagina GameBook <code>/gamebook</code>: timeline storie, feed e clip video.</p>`
    , `<p>Superficie dedicata su JustLastOne: il gamer crea e visualizza <strong>storie, feed e clip video</strong> e li condivide verso il feed amici accettati.</p>`
    , `<table><thead><tr><th>Subtask</th><th>Scope</th></tr></thead><tbody>`
    , `<tr><td>JLO-953</td><td>Route /gamebook + shell UI</td></tr>`
    , `<tr><td>JLO-955</td><td>Timeline — feed, storie e clip</td></tr>`
    , `<tr><td>JLO-954</td><td>Upload immagine post GameBook</td></tr>`
    , `<tr><td>JLO-956</td><td>Upload video clip</td></tr>`
    , `<tr><td>JLO-957</td><td>Condividi storie/feed/clip su feed amici</td></tr>`
    , `<tr><td>JLO-958</td><td>testScript pagina GameBook</td></tr>`
    , `</tbody></table>`
    , `<p>Story parent <strong>JLO-952</strong> · Epic <strong>JLO-445</strong> GameBook. Legacy JLO-446/447/448 consolidati in JLO-952.</p>`
    ].join("\n")
  }
, {
    id          : "condividere-esterno"
  , pillar      : "Condividere verso social esterni"
  , source      : "Pilastri · share feed + share-out post-MVP"
  , area        : "Gamebook · Home"
  , anchorKeys  : ["JLO-957", "JLO-448"]
  , docExcerpt  : [
      `<p><strong>Pilastro definizione operativa:</strong> condividere verso social esterni — cross-post da Gamebook/contenuti verso feed amici e canali esterni.</p>`
    , `<ul>`
    , `<li><strong>Area prodotto:</strong> Gamebook · Home</li>`
    , `<li><strong>MVP:</strong> share su feed amici (JLO-957) · share-out verso TikTok/Instagram/X post-MVP</li>`
    , `<li><strong>Architettura:</strong> dominio Condivisione esterna — share-out, preview link, permessi visibilità</li>`
    , `<li><strong>User journey:</strong> pubblico storia/post partita → feed amici → opzionale share verso social esterno</li>`
    , `</ul>`
    ].join("\n")
  }
, {
    id          : "creare-partite"
  , pillar      : "Creare partite"
  , source      : "Pilastri · lobby, inviti, match amici"
  , area        : "Play"
  , anchorKeys  : ["JLO-2"]
  , includeKeys : ["JLO-690", "JLO-637"]
  , docExcerpt  : [
      `<p><strong>Pilastro definizione operativa:</strong> creare partite — crea lobby, invita amici, match tra amici.</p>`
    , `<ul>`
    , `<li><strong>Area prodotto:</strong> Play</li>`
    , `<li><strong>Tab Play:</strong> crea partita (pubblico/privato, inviti); chat lobby; countdown</li>`
    , `<li><strong>Differenziatore:</strong> partite tra amici — lobby, inviti, matchmaking</li>`
    , `<li><strong>Backlog JLO:</strong> Match Featuring JLO-637 · core gameplay · cancel host JLO-690</li>`
    , `</ul>`
    ].join("\n")
  }
, {
    id          : "organizzare-tornei"
  , pillar      : "Organizzare tornei"
  , source      : "Pilastri · creazione, bracket, risultati"
  , area        : "Tornei"
  , anchorKeys  : ["JLO-3"]
  , docExcerpt  : [
      `<p><strong>Pilastro definizione operativa:</strong> organizzare tornei — creazione torneo, iscrizione, bracket, risultati.</p>`
    , `<ul>`
    , `<li><strong>Area prodotto:</strong> Tornei</li>`
    , `<li><strong>Tab Tornei:</strong> lista attivi/in arrivo/conclusi; join; creazione (eliminazione diretta/girone); bracket e calendario automatici</li>`
    , `<li><strong>Differenziatore:</strong> creazione tornei — registrazione, team, bracket, risultati live</li>`
    , `<li><strong>Backlog JLO:</strong> Epic JLO-3 · Sprint 5 Tornei</li>`
    , `<li><strong>Monetizzazione:</strong> fee tornei premium; premi sponsorizzati / prize pool</li>`
    , `</ul>`
    ].join("\n")
  }
, {
    id          : "admin-dev"
  , pillar      : "Admin / Dev tooling"
  , source      : "Fuori pilastri prodotto — epic JLO-849"
  , area        : "Admin"
  , anchorKeys  : ["JLO-849", "JLO-6", "JLO-330"]
  , docExcerpt  : [
      `<p><strong>Fuori pilastri prodotto</strong> — tooling interno per sviluppo, test e allineamento backlog.</p>`
    , `<ul>`
    , `<li>Dashboard Admin (Epic JLO-849): runner testScript, report HTML/JSON, cruscotto Dev</li>`
    , `<li>Testing &amp; Release (Epic JLO-6) · Platform Hardening (Epic JLO-330)</li>`
    , `<li>Non compare nella definizione operativa utente; supporta qualità e tracciabilità JLO</li>`
    , `<li><strong>Stack repo (doc):</strong> web React, API Node, PostgreSQL + Prisma, i18n IT/EN</li>`
    , `</ul>`
    ].join("\n")
  }
];

const OBSOLETE_KEYS = new Set(OBSOLETE_ISSUE_ENTRIES.map((row) => row.key));

/**
 * @param {string} key
 * @param {Array<{ key: string, parentKey?: string | null }>} issues
 */
function collectSubtreeKeys(key, issues) {
  /** @type {Set<string>} */
  const keys = new Set();

  function walk(k) {
    if (keys.has(k)) {
      return;
    }

    keys.add(k);

    for (const row of issues) {
      if (row.parentKey === k) {
        walk(row.key);
      }
    }
  }

  walk(key);
  return keys;
}

/**
 * Segna ticket in chiusura (e sotto-albero) come Fatto prima del render cruscotto.
 * @param {Array<{ key: string, parentKey?: string | null, status?: string, done?: boolean }>} issues
 * @param {string} closingKey
 */
function applyClosingAssumedDone(issues, closingKey) {
  const subtree = collectSubtreeKeys(closingKey, issues);

  for (const row of issues) {
    if (subtree.has(row.key)) {
      row.status = "Fatto";
      row.done   = true;
    }
  }
}

/**
 * @param {ProductPillar} pillar
 * @param {Array<{ key: string, parentKey?: string | null, summary?: string, status?: string, type?: string, depth?: number }>} issues
 */
export function keysForPillar(pillar, issues) {
  /** @type {Set<string>} */
  const keys = new Set();

  for (const anchor of pillar.anchorKeys) {
    for (const k of collectSubtreeKeys(anchor, issues)) {
      keys.add(k);
    }
  }

  for (const extra of pillar.includeKeys ?? []) {
    keys.add(extra);

    for (const k of collectSubtreeKeys(extra, issues)) {
      keys.add(k);
    }
  }

  return [...keys].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * Issue del pilastro in ordine ad albero (anchor → figli DFS).
 * @param {ProductPillar} pillar
 * @param {Array<{ key: string, parentKey?: string | null }>} issues
 */
export function keysForPillarTreeOrder(pillar, issues) {
  const keysSet = new Set(keysForPillar(pillar, issues));
  /** @type {string[]} */
  const ordered = [];
  /** @type {Set<string>} */
  const seen = new Set();

  /**
   * @param {string} key
   */
  function dfs(key) {
    if (!keysSet.has(key) || seen.has(key)) {
      return;
    }

    seen.add(key);
    ordered.push(key);

    const children = issues
      .filter((row) => row.parentKey === key && keysSet.has(row.key))
      .map((row) => row.key)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    for (const childKey of children) {
      dfs(childKey);
    }
  }

  for (const anchor of pillar.anchorKeys) {
    dfs(anchor);
  }

  for (const extra of pillar.includeKeys ?? []) {
    dfs(extra);
  }

  for (const key of [...keysSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    if (seen.has(key)) {
      continue;
    }

    const row = issues.find((entry) => entry.key === key);

    if (row?.parentKey && keysSet.has(row.parentKey)) {
      continue;
    }

    dfs(key);
  }

  return ordered;
}

/**
 * @param {ProductPillar[]} pillars
 * @param {Array<{ key: string, parentKey?: string | null }>} issues
 * @returns {Set<string>}
 */
export function computePillarCoveredKeys(pillars, issues) {
  /** @type {Set<string>} */
  const covered = new Set();

  for (const pillar of pillars) {
    for (const key of keysForPillar(pillar, issues)) {
      covered.add(key);
    }
  }

  return covered;
}

/**
 * Pilastri Confluence che contengono la key (anchor, include o sotto-albero).
 * @param {string} ticketKey
 * @param {ProductPillar[]} pillars
 * @param {Array<{ key: string, parentKey?: string | null }>} issues
 * @returns {ProductPillar[]}
 */
export function findPillarsForKey(ticketKey, pillars, issues) {
  const key = String(ticketKey).trim().toUpperCase().match(/JLO-\d+/)?.[0];

  if (!key) {
    return [];
  }

  return pillars.filter((pillar) => keysForPillar(pillar, issues).includes(key));
}

/**
 * Pilastro dinamico — epic/story/bug/todo non coperti da altri pilastri.
 * @param {Array<{ key: string, summary?: string, type?: string, parentKey?: string | null }>} issues
 * @param {Set<string>} covered
 * @returns {ProductPillar | null}
 */
export function buildOrphansPillar(issues, covered) {
  const orphanRoots = issues
    .filter((row) => (isEpicType(row.type ?? "") || isStoryLikeType(row.type ?? "")) && !covered.has(row.key))
    .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

  if (orphanRoots.length === 0) {
    return null;
  }

  const orphanKeySet = new Set(orphanRoots.map((row) => row.key));
  const anchorKeys   = orphanRoots
    .filter((row) => {
      const parentKey = row.parentKey ?? null;

      return !parentKey || !orphanKeySet.has(parentKey);
    })
    .map((row) => row.key);

  return {
    id          : "orfani"
  , pillar      : "Orfani / fuori scope"
  , source      : "Issue non mappate ad altri pilastri"
  , area        : "Varie"
  , anchorKeys
  , docExcerpt  : [
      `<p><strong>Backlog non ancora ancorato</strong> a un pilastro prodotto — generato automaticamente.</p>`
    , `<ul>`
    , `<li>Epic Beta/GTM (JLO-410, JLO-411) · monetizzazione (JLO-530) · TODO grafica/backend (JLO-603, JLO-630)</li>`
    , `<li>Epic <strong>JLO-695 FuoriScope</strong> — idee fuori MVP corrente</li>`
    , `<li>Bug/Todo/Story senza epic mappata altrove</li>`
    , `<li>Per includere un ticket in un pilastro: aggiungi la key in <code>anchorKeys</code> o <code>includeKeys</code> in <code>generate-confluence-pillar-matrix.mjs</code></li>`
    , `</ul>`
    , `<p><strong>Radici orfane (${anchorKeys.length}):</strong> ${anchorKeys.join(", ")}</p>`
    ].join("\n")
  };
}

/**
 * @param {string | undefined} type
 */
function isSubtaskIssueType(type) {
  return String(type ?? "").toLowerCase().includes("sub");
}

/**
 * @param {string | undefined} type
 */
function matrixTreeTier(type) {
  const t = String(type ?? "").toLowerCase();

  if (t.includes("epic")) {
    return "epic";
  }

  if (isSubtaskIssueType(t)) {
    return "subtask";
  }

  return "task";
}

/**
 * @param {string} key
 * @param {Map<string, { parentKey?: string | null }>} byKey
 * @param {Set<string>} keysSet
 */
function computePillarTreeDepth(key, byKey, keysSet) {
  let depth   = 0;
  let current = byKey.get(key);

  while (current?.parentKey && keysSet.has(current.parentKey)) {
    depth += 1;
    current = byKey.get(current.parentKey);
  }

  return depth;
}

/**
 * @param {string} key
 * @param {Array<{ key: string, parentKey?: string | null }>} issues
 * @param {Set<string>} keysSet
 */
function hasPillarTreeChildren(key, issues, keysSet) {
  return issues.some((row) => row.parentKey === key && keysSet.has(row.key));
}

/**
 * @param {number} depth
 */
function matrixTreeIndentHtml(depth) {
  if (depth <= 0) {
    return "";
  }

  const px = depth * 20;

  return `<span class="matrix-tree-indent" style="display:inline-block;width:${px}px;min-width:${px}px"></span>`;
}

/**
 * @param {string} key
 * @param {string} innerHtml
 * @param {number} depth
 * @param {boolean} hasChildren
 */
function matrixTreeIssueCell(key, innerHtml, depth, hasChildren) {
  const toggle = hasChildren
    ? `<button type="button" class="matrix-tree-toggle" aria-expanded="true" aria-label="Espandi o collassa ${esc(key)}">▼</button>`
    : `<span class="matrix-tree-toggle matrix-tree-leaf" aria-hidden="true">·</span>`;

  return [
    `<td class="matrix-tree-issue-col">`
  , `<div class="matrix-tree-cell">`
  , matrixTreeIndentHtml(depth)
  , toggle
  , `<span class="matrix-tree-content">${innerHtml}</span>`
  , `</div></td>`
  ].join("");
}

/**
 * @param {string} type
 */
function issueTypeBadge(type) {
  const t = String(type ?? "").toLowerCase();

  if (t.includes("epic")) {
    return `<span data-type="status" data-color="purple">EPIC</span> `;
  }

  if (t.includes("sub")) {
    return `<span data-type="status" data-color="blue">SUB</span> `;
  }

  if (t.includes("bug")) {
    return `<span data-type="status" data-color="red">BUG</span> `;
  }

  if (t.includes("todo")) {
    return `<span data-type="status" data-color="blue">TODO</span> `;
  }

  if (t.includes("story")) {
    return `<span data-type="status" data-color="green">STORY</span> `;
  }

  return `<span data-type="status" data-color="neutral">${esc(String(type || "ISSUE").toUpperCase())}</span> `;
}

/**
 * @param {string} key
 * @param {string} type
 * @param {string} obsolete
 */
function issueKeyCell(key, type, obsolete) {
  const badge = type !== "—" ? issueTypeBadge(type) : "";

  return `${badge}<a href="${JIRA_BROWSE}${esc(key)}">${esc(key)}</a>${obsolete}`;
}

/**
 * Cella vuota matrice (epic — colonne stato non applicabili).
 */
function matrixEmptyCell() {
  return `<span data-type="status" data-color="neutral">—</span>`;
}

/**
 * @param {boolean} done
 */
function jiraCell(done, missing) {
  if (missing) {
    return `<span data-type="status" data-color="red">Jira assente</span>`;
  }

  return done
    ? `<span data-type="status" data-color="green">Jira Fatto</span>`
    : `<span data-type="status" data-color="yellow">Jira Da fare</span>`;
}

/**
 * @param {{ complete?: boolean, found?: number, total?: number, metaOnly?: boolean } | null} inspect
 */
function repoCell(inspect) {
  if (!inspect) {
    return `<span data-type="status" data-color="neutral">Repo assente</span>`;
  }

  if (inspect.metaOnly) {
    return `<span data-type="status" data-color="neutral">Repo assente</span>`;
  }

  if (inspect.complete) {
    return `<span data-type="status" data-color="green">Repo ok</span>`;
  }

  if ((inspect.found ?? 0) > 0) {
    return `<span data-type="status" data-color="yellow">Repo parziale</span>`;
  }

  return `<span data-type="status" data-color="neutral">Repo assente</span>`;
}

/**
 * @param {string} key
 * @param {Map<string, { parentKey?: string | null, jiraParentKey?: string | null }>} byKey
 * @returns {string[]}
 */
function jiraAncestorKeys(key, byKey) {
  /** @type {string[]} */
  const keys     = [];
  let current    = byKey.get(key);

  while (current) {
    const parentKey = current.jiraParentKey ?? current.parentKey ?? null;

    if (!parentKey) {
      break;
    }

    keys.push(parentKey);
    current = byKey.get(parentKey) ?? null;
  }

  return keys;
}

/**
 * @param {ReturnType<typeof resolveTicketGitEvidence>} git
 * @param {string} rowKey
 * @returns {string}
 */
function formatGitCell(git, rowKey) {
  const viaParent = git.matchedKey && git.matchedKey !== rowKey
    ? `<div class="git-commit-via"><small>via ${esc(git.matchedKey)}</small></div>`
    : "";

  const commits = git.commits?.length
    ? git.commits
    : (git.commitShort && git.githubUrl
      ? [{
          commitShort   : git.commitShort
        , commitSubject : git.commitSubject ?? null
        , githubUrl     : git.githubUrl
        }]
      : []);

  if (git.source === "main" && commits.length > 0) {
    const branchNote = git.branch
      ? `<div class="git-commit-branch"><small>branch ${esc(git.branch)}</small></div>`
      : "";

    const items = commits.map((commit) => {
      const subject = commit.commitSubject
        ? `<small>${esc(commit.commitSubject.slice(0, 64))}${commit.commitSubject.length > 64 ? "…" : ""}</small>`
        : "";

      return [
        `<div class="git-commit-item">`
      , `<a href="${esc(commit.githubUrl)}"><code>main</code> @ ${esc(commit.commitShort ?? "—")}</a>`
      , subject ? `<br/>${subject}` : ""
      , `</div>`
      ].join("");
    }).join("");

    return [
      `<div class="git-commit-stack">${items}</div>`
    , branchNote
    , viaParent
    ].join("");
  }

  if (git.branch && git.githubUrl) {
    const branchLink = [
      `<a href="${esc(git.githubUrl)}"><code>${esc(git.branch)}</code></a>`
    , git.commitShort ? ` @ ${esc(git.commitShort)}` : ""
    ].join("");

    const items = commits.length > 1
      ? commits.map((commit) => {
          const subject = commit.commitSubject
            ? `<small>${esc(commit.commitSubject.slice(0, 64))}${commit.commitSubject.length > 64 ? "…" : ""}</small>`
            : "";

          return [
            `<div class="git-commit-item">`
          , `<a href="${esc(commit.githubUrl)}"><code>${esc(commit.commitShort ?? "—")}</code></a>`
          , subject ? `<br/>${subject}` : ""
          , `</div>`
          ].join("");
        }).join("")
      : (git.commitSubject
        ? `<br/><small>${esc(git.commitSubject.slice(0, 64))}${git.commitSubject.length > 64 ? "…" : ""}</small>`
        : "");

    return [
      `<div class="git-commit-stack">${branchLink}${items ? `<br/>${items}` : ""}</div>`
    , viaParent
    ].join("");
  }

  return `<span data-type="status" data-color="yellow">in repo · no branch</span>`;
}

/**
 * @param {string} key
 * @param {{ complete?: boolean, metaOnly?: boolean, found?: number } | null} inspect
 * @param {Map<string, ReturnType<typeof resolveTicketGitEvidence>>} gitCache
 * @param {string[]} [fallbackKeys]
 */
function devCell(key, inspect, gitCache, fallbackKeys = []) {
  const cacheKey = `${key}::${fallbackKeys.join(",")}`;

  if (!gitCache.has(cacheKey)) {
    gitCache.set(cacheKey, resolveTicketGitEvidence(key, fallbackKeys));
  }

  const git     = gitCache.get(cacheKey);
  const hasCode = inspect && !inspect.metaOnly && (inspect.complete || (inspect.found ?? 0) > 0);

  if (git) {
    return formatGitCell(git, key);
  }

  if (!hasCode) {
    return `<span data-type="status" data-color="neutral">—</span>`;
  }

  return `<span data-type="status" data-color="yellow">in repo · no branch</span>`;
}

/**
 * @param {string} key
 * @param {Map<string, string[]>} repoRefs
 */
function assessRepoInspect(key, repoRefs) {
  return assessIssueRepoInspect(key, repoRefs);
}

/**
 * @param {{ devSprintName?: string | null, jiraSprints?: Array<{ name: string, state: string }>, status?: string } | undefined} row
 */
function sprintCell(row) {
  const name = resolveIssueSprintName(row ?? null);

  if (!name) {
    return `<span data-type="status" data-color="neutral">—</span>`;
  }

  const short = name.length > 52 ? `${name.slice(0, 51)}…` : name;

  return `<span title="${esc(name)}">${esc(short)}</span>`;
}

/**
 * @param {string} text
 */
function esc(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {ProductPillar} pillar
 */
function renderPillarDocExcerpt(pillar) {
  if (!pillar.docExcerpt) {
    return `<p><strong>Riferimento concetto:</strong> <a href="${DOC_URL}">Documento di lavoro 9076737</a> — ${esc(pillar.source)} · <em>${esc(pillar.area)}</em></p>`;
  }

  return [
    `<h3>Estratto documento prodotto</h3>`
  , `<div data-type="panel-info">`
  , `<p><strong>Fonte:</strong> <a href="${DOC_URL}">Piattaforma Social per Gamer — Documento di lavoro</a> · ${esc(pillar.source)} · <em>${esc(pillar.area)}</em></p>`
  , pillar.docExcerpt
  , `</div>`
  ].join("\n");
}

/**
 * @param {string} key
 * @param {Map<string, { key: string, summary?: string, status?: string, type?: string, parentKey?: string | null, depth?: number }>} byKey
 * @param {Map<string, string[]>} repoRefs
 * @param {Map<string, ReturnType<typeof resolveTicketGitEvidence>>} gitCache
 * @param {{ depth: number, hasChildren: boolean, parentKey?: string | null }} tree
 */
function buildMatrixIssueRow(key, byKey, repoRefs, gitCache, tree) {
  const row = byKey.get(key);
  const missing = !row;
  const done = row ? isJiraStatusDone(row.status) : false;
  const inspectView = assessRepoInspect(key, repoRefs);
  const obsolete = OBSOLETE_KEYS.has(key) ? ` <span data-type="status" data-color="neutral">obsoleto</span>` : "";
  const type = row?.type ?? "—";
  const summary = row?.summary ?? "(non presente in backlog JLO)";
  /** @type {string[]} */
  const gaps = [];

  if (missing) {
    gaps.push("mancante su Jira");
  }

  if (!missing && inspectView && inspectView.complete && !inspectView.metaOnly && !done) {
    gaps.push("fatto su repo · Jira aperto");
  }

  if (!missing && done && inspectView && !inspectView.metaOnly && !inspectView.complete && (inspectView.found ?? 0) === 0) {
    gaps.push("Jira Fatto · repo assente");
  }

  if (!missing && inspectView?.metaOnly) {
    gaps.push("citazione solo tooling Admin");
  }

  const tier = matrixTreeTier(type);
  const isEpic = tier === "epic";
  const parentAttr = tree.parentKey
    ? ` data-parent-key="${esc(tree.parentKey)}"`
    : "";
  const childrenAttr = tree.hasChildren
    ? ` data-has-children="true"`
    : "";

  const issueInner = issueKeyCell(key, type, obsolete);
  const gitFallbacks = jiraAncestorKeys(key, byKey);

  const html = [
    `<tr class="matrix-tree-row tier-${tier}" data-issue-key="${esc(key)}" data-depth="${tree.depth}"${parentAttr}${childrenAttr}>`
  , matrixTreeIssueCell(key, issueInner, tree.depth, tree.hasChildren)
  , `<td>${esc(summary.slice(0, 72))}${summary.length > 72 ? "…" : ""}</td>`
  , `<td>${sprintCell(row)}</td>`
  , `<td>${isEpic ? matrixEmptyCell() : jiraCell(done, missing)}</td>`
  , `<td>${isEpic ? matrixEmptyCell() : repoCell(inspectView)}</td>`
  , `<td>${isEpic ? matrixEmptyCell() : devCell(key, inspectView, gitCache, gitFallbacks)}</td>`
  , `<td>${isEpic ? matrixEmptyCell() : esc(gaps.length ? gaps.join("; ") : "—")}</td>`
  , `</tr>`
  ].join("");

  return { html, done, missing, inspectView, gaps, isEpic };
}

/**
 * @param {ProductPillar} pillar
 * @param {Array<{ key: string, summary?: string, status?: string, type?: string, parentKey?: string | null, depth?: number }>} issues
 * @param {Map<string, { key: string, summary?: string, status?: string, type?: string, parentKey?: string | null, depth?: number }>} byKey
 * @param {Map<string, string[]>} repoRefs
 * @param {Map<string, ReturnType<typeof resolveTicketGitEvidence>>} gitCache
 */
function renderPillarSection(pillar, issues, byKey, repoRefs, gitCache) {
  const orderedKeys = keysForPillarTreeOrder(pillar, issues);
  const keysSet     = new Set(orderedKeys);
  /** @type {string[]} */
  const rowHtml     = [];
  let jiraDone      = 0;
  let jiraOpen      = 0;
  let repoOk        = 0;
  let gapRepoJira   = 0;

  for (const key of orderedKeys) {
    const row = byKey.get(key);
    const built = buildMatrixIssueRow(key, byKey, repoRefs, gitCache, {
      depth       : computePillarTreeDepth(key, byKey, keysSet)
    , hasChildren : hasPillarTreeChildren(key, issues, keysSet)
    , parentKey   : row?.parentKey && keysSet.has(row.parentKey) ? row.parentKey : null
    });

    rowHtml.push(built.html);

    if (built.isEpic) {
      continue;
    }

    if (!built.missing && built.done) {
      jiraDone += 1;
    } else if (!built.missing) {
      jiraOpen += 1;
    }

    if (built.inspectView?.complete && !built.inspectView.metaOnly) {
      repoOk += 1;
    }

    if (built.gaps.includes("fatto su repo · Jira aperto")) {
      gapRepoJira += 1;
    }
  }

  return {
    html: [
      `<h2 class="pillar-title">${esc(pillar.pillar)}</h2>`
    , renderPillarDocExcerpt(pillar)
    , `<p><strong>Riepilogo matrice:</strong> ${orderedKeys.length} issue · Jira Fatto ${jiraDone} · Jira aperte ${jiraOpen} · Repo ok ${repoOk} · gap repo/Jira ${gapRepoJira}</p>`
    , `<p><em>Albero Epic → Story → Subtask (indentato). Espandi/collassa interattivo nel cruscotto Admin; su Confluence la gerarchia resta visibile per rientro.</em></p>`
    , `<table class="matrix-table matrix-tree">`
    , `<thead><tr><th>Issue</th><th>Summary</th><th>Sprint</th><th>Jira</th><th>Repo</th><th>Sviluppo (GitHub)</th><th>Gap / note</th></tr></thead>`
    , `<tbody class="matrix-tree-body">`
    , rowHtml.join("\n")
    , `</tbody>`
    , `</table>`
    ].join("\n")
  , stats: { total: orderedKeys.length, jiraDone, jiraOpen, repoOk, gapRepoJira }
  };
}

/**
 * Trova implementazioni repo senza ticket Jira nel pilastro.
 * @param {Map<string, string[]>} repoRefs
 * @param {Set<string>} jiraKeys
 */
function repoOnlySignals(repoRefs, jiraKeys) {
  /** @type {Array<{ path: string, keys: string[] }>} */
  const orphan = [];

  for (const [key, paths] of repoRefs) {
    if (!key.startsWith("JLO-") || jiraKeys.has(key)) {
      continue;
    }

    const inspect = inspectRepoSignal(key, repoRefs);

    if (inspect?.scan.complete) {
      orphan.push({ path: paths[0] ?? "—", keys: [key] });
    }
  }

  return orphan.slice(0, 15);
}

async function buildMatrix(opts = {}) {
  const backlog = await fetchJiraBacklog();

  if (opts.closingKey) {
    applyClosingAssumedDone(backlog.issues, opts.closingKey);
  }

  const repoRefs = scanRepoJiraReferences();
  const byKey = new Map(backlog.issues.map((row) => [row.key, row]));
  const jiraKeys = new Set(backlog.issues.map((row) => row.key));
  /** @type {Map<string, ReturnType<typeof resolveTicketGitEvidence>>} */
  const gitCache = new Map();

  const intro = [
    `<p><strong>Fonte prodotto:</strong> <a href="${DOC_URL}">Piattaforma Social per Gamer — Documento di lavoro</a></p>`
  , `<p><strong>Backlog Jira:</strong> ${backlog.total} issue (tutti gli stati) · generato <time datetime="${backlog.fetchedAt.slice(0, 10)}">${backlog.fetchedAt.slice(0, 10)}</time></p>`
  , `<div data-type="panel-info"><p>Legenda: per ogni <strong>concetto/pilastro</strong> del documento 9076737, albero issue Jira (Epic → Story → Subtask) incrociato con segnali repo (<code>REPO_IMPLEMENTATION_SIGNALS</code> + citazioni JLO nel codice).</p></div>`
  , `<h2>Legenda gap</h2>`
  , `<ul>`
  , `<li><strong>mancante su Jira</strong> — key elencata nel mapping pilastro ma assente dal backlog</li>`
  , `<li><strong>fatto su repo · Jira aperto</strong> — codice presente, ticket non ancora Fatto</li>`
  , `<li><strong>Jira Fatto · repo assente</strong> — chiuso in Jira senza segnali path nel repo</li>`
  , `<li><strong>citazione solo tooling Admin</strong> — key solo in HTML cruscotto/matrice, non in codice prodotto</li>`
  , `<li><span data-type="status" data-color="neutral">obsoleto</span> — duplicato/consolidato (es. JLO-446→952)</li>`
  , `<li><strong>Sprint</strong> — piano Working (<code>devSprintName</code>) o sprint Jira (active/future/closed in base allo stato issue)</li>`
  , `<li><strong>Sviluppo (GitHub)</strong> — fino a ${GIT_EVIDENCE_COMMIT_LIMIT} commit su <code>main</code> che citano la key (anche subtask senza segnale Repo), branch ticket o parent story/epic</li>`
  , `</ul>`
  ].join("\n");

  /** @type {ProductPillar[]} */
  const staticPillars = PRODUCT_PILLARS;
  const coveredStatic = computePillarCoveredKeys(staticPillars, backlog.issues);
  const orphansPillar = buildOrphansPillar(backlog.issues, coveredStatic);
  const allPillars    = orphansPillar
    ? [...staticPillars, orphansPillar]
    : staticPillars;

  /** @type {Array<{ id: string, title: string, html: string, stats: ReturnType<typeof renderPillarSection>["stats"] }>} */
  const pillars = [];
  let totalIssues = 0;
  let totalJiraDone = 0;
  let totalRepoOk = 0;
  let totalGap = 0;

  for (const pillar of allPillars) {
    const block = renderPillarSection(pillar, backlog.issues, byKey, repoRefs, gitCache);
    pillars.push({ id: pillar.id, title: pillar.pillar, html: block.html, stats: block.stats });
    totalIssues += block.stats.total;
    totalJiraDone += block.stats.jiraDone;
    totalRepoOk += block.stats.repoOk;
    totalGap += block.stats.gapRepoJira;
  }

  const coveredAll = computePillarCoveredKeys(allPillars, backlog.issues);
  const topLevel   = backlog.issues.filter((row) => isEpicType(row.type) || isStoryLikeType(row.type));
  const uncoveredTop = topLevel.filter((row) => !coveredAll.has(row.key));

  const repoOrphans = repoOnlySignals(repoRefs, jiraKeys);
  /** @type {string[]} */
  const footerParts = [
    `<h2>Riepilogo globale (pilastri mappati)</h2>`
  , `<table><thead><tr><th>Metrica</th><th>Valore</th></tr></thead><tbody>`
  , `<tr><td>Issue nei pilastri (con duplicati tra pilastri)</td><td>${totalIssues}</td></tr>`
  , `<tr><td>Jira Fatto (conteggio righe)</td><td>${totalJiraDone}</td></tr>`
  , `<tr><td>Repo ok (conteggio righe)</td><td>${totalRepoOk}</td></tr>`
  , `<tr><td>Gap repo ok + Jira aperto</td><td>${totalGap}</td></tr>`
  , `<tr><td>Backlog JLO totale</td><td>${backlog.total}</td></tr>`
  , `<tr><td>Epic/Story/Bug/Todo coperti (≥1 pilastro)</td><td>${topLevel.length - uncoveredTop.length} / ${topLevel.length}</td></tr>`
  , `<tr><td>Epic/Story/Bug/Todo orfani</td><td>${uncoveredTop.length}</td></tr>`
  , `</tbody></table>`
  ];

  if (repoOrphans.length) {
    footerParts.unshift([
      `<h2>Segnali repo senza ticket Jira</h2>`
    , `<p>Citazioni JLO nel codice con path catalogo completo ma key non presente nel backlog (campione):</p>`
    , `<ul>`
    , ...repoOrphans.map((row) => `<li>${esc(row.keys.join(", "))} — ${esc(row.path)}</li>`)
    , `</ul>`
    ].join("\n"));
  }

  const footer = footerParts.join("\n");
  const html = [intro, `<h2>Matrice per pilastro / concetto</h2>`, ...pillars.map((p) => p.html), footer].join("\n\n");

  return {
    intro
  , footer
  , pillars
  , allPillars
  , issues  : backlog.issues
  , html
  , backlog : backlog.total
  , fetchedAt: backlog.fetchedAt
  , coverage: {
      topLevel     : topLevel.length
    , covered      : topLevel.length - uncoveredTop.length
    , orphans      : uncoveredTop.length
    , orphanKeys   : uncoveredTop.map((row) => row.key)
    }
  };
}

/**
 * @param {{ closingKey?: string }} [opts]
 */
export async function generatePillarMatrixHtml(opts = {}) {
  return buildMatrix(opts);
}

async function main() {
  const bundle = await buildMatrix();
  const outPath = join(__dirname, "confluence-pillar-matrix-body.html");

  writeFileSync(outPath, bundle.html, "utf8");
  console.log(JSON.stringify({ outPath, bytes: bundle.html.length, backlog: bundle.backlog }));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}

export { PRODUCT_PILLARS };
