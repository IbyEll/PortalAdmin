#!/usr/bin/env node
/**
 * Pubblica matrice pilastri su Confluence (pagina indice + sotto-pagine).
 * Uso:
 *   node scripts/publish-confluence-pillar-matrix.mjs          # crea nuove pagine
 *   node scripts/publish-confluence-pillar-matrix.mjs --update # aggiorna + evidenzia diff issue
 */

import "../lib/load-env.mjs";
import { pathToFileURL } from "node:url";
import { findPillarsForKey, generatePillarMatrixHtml } from "./generate-confluence-pillar-matrix.mjs";
import {
  buildAggregateChangelogPanel
, prepareMatrixBodyWithDiff
, summarizeDiff
} from "../lib/pillar-matrix-diff.mjs";

const CLOUD_ID = process.env.JIRA_CLOUD_ID ?? "3caddd74-469e-4ca3-adf8-926f79c98e7c";
const API_BASE = `https://api.atlassian.com/ex/confluence/${CLOUD_ID}`;
const SPACE_ID = "5079044";
const PARENT_DOC_ID = "9076737";
const DOC_URL = "https://myfuturejobsearch.atlassian.net/wiki/spaces/SDS/pages/9076737/Piattaforma+Social+per+Gamer+Documento+di+lavoro";

/** Pagina indice + sotto-pagine pilastri (2026-06-13). */
const EXISTING_PAGES = {
  index               : "8912914"
, "trovare-giocatori"  : "9207820"
, chattare            : "9076779"
, "creare-storie"     : "9273347"
, "creare-feed"       : "9011225"
, "condividere-esterno": "9175043"
, "creare-partite"    : "9306115"
, "organizzare-tornei": "9011365"
, notifiche           : "8912937"
, "profilo-gamer"     : "9011567"
, "auth-onboarding"   : "8978447"
, "admin-dev"         : "8913019"
, orfani              : "9011702"
};

const UPDATE_MODE = process.argv.some((arg) => /^--update($|[.=])/.test(arg));

/** Larghezza pagina Confluence — `max` = full width (come pagina Orfani). */
const CONFLUENCE_PAGE_APPEARANCE = "max";

/** @type {readonly string[]} */
const CONTENT_APPEARANCE_KEYS = [
  "content-appearance-published"
, "content-appearance-draft"
];

/**
 * @returns {string}
 */
function authHeader() {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!email || !token) {
    throw new Error("Mancano JIRA_EMAIL e/o JIRA_API_TOKEN in .env");
  }

  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

/**
 * @param {string} path
 * @param {RequestInit} [init]
 * @param {{ attempt?: number }} [meta]
 */
async function confluenceFetch(path, init = {}, meta = {}) {
  const attempt = meta.attempt ?? 1;
  const maxAttempts = 4;
  const url = `${API_BASE}${path}`;

  /** @type {unknown} */
  let res;

  try {
    res = await fetch(url, {
      ...init
    , headers: {
        Accept        : "application/json"
      , "Content-Type": "application/json"
      , Authorization : authHeader()
      , ...(init.headers ?? {}),
      }
    });
  } catch (err) {
    const cause = /** @type {{ code?: string, message?: string }} */ (/** @type {{ cause?: unknown }} */ (err).cause ?? err);
    const detail = [
      cause?.code
    , cause?.message ?? (err instanceof Error ? err.message : String(err))
    ].filter(Boolean).join(" — ");

    if (attempt < maxAttempts) {
      const waitMs = attempt * 1500;

      console.warn(`Confluence fetch retry ${attempt}/${maxAttempts - 1} tra ${waitMs}ms (${path}): ${detail}`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return confluenceFetch(path, init, { attempt: attempt + 1 });
    }

    const error = new Error(`Confluence fetch failed (${path}): ${detail || "fetch failed"}`);
    error.cause = err;
    throw error;
  }

  const text = await res.text();
  /** @type {unknown} */
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (res.status === 429 && attempt < maxAttempts) {
    const waitMs = attempt * 2000;

    console.warn(`Confluence 429 rate limit — retry ${attempt}/${maxAttempts - 1} tra ${waitMs}ms (${path})`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return confluenceFetch(path, init, { attempt: attempt + 1 });
  }

  if (!res.ok) {
    const errBody = /** @type {{ errors?: Array<{ title?: string, detail?: string }>, message?: string } | null} */ (body);
    const detail  = errBody?.errors?.map((e) => e.title ?? e.detail).filter(Boolean).join("; ")
      ?? (typeof body === "object" && body && "message" in body
        ? String(/** @type {{ message?: string }} */ (body).message)
        : text.slice(0, 400));

    const err = new Error(`Confluence ${res.status} (${path}): ${detail}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }

  return body;
}

/**
 * @param {string} pageId
 */
async function listPageProperties(pageId) {
  /** @type {{ results?: Array<{ id: string, key: string, value?: string, version?: { number?: number } }> }} */
  const body = await confluenceFetch(`/wiki/api/v2/pages/${pageId}/properties`);

  return body.results ?? [];
}

/**
 * @param {string} pageId
 * @param {string} key
 * @param {string} value
 */
async function upsertPageProperty(pageId, key, value) {
  const existing = (await listPageProperties(pageId)).find((row) => row.key === key);

  if (!existing) {
    return confluenceFetch(`/wiki/api/v2/pages/${pageId}/properties`, {
      method: "POST"
    , body  : JSON.stringify({ key, value })
    });
  }

  if (existing.value === value) {
    return existing;
  }

  const version = (existing.version?.number ?? 1) + 1;

  return confluenceFetch(`/wiki/api/v2/pages/${pageId}/properties/${existing.id}`, {
    method: "PUT"
  , body  : JSON.stringify({
      key
    , value
    , version: { number: version, message: "pillar matrix full width" }
    })
  });
}

/**
 * Imposta larghezza contenuto al 100% (proprietà `max`, come Orfani).
 * @param {string} pageId
 */
async function ensurePageFullWidth(pageId) {
  for (const key of CONTENT_APPEARANCE_KEYS) {
    await upsertPageProperty(pageId, key, CONFLUENCE_PAGE_APPEARANCE);
  }
}

/**
 * @param {string} pageId
 * @param {string} label
 */
async function ensurePageFullWidthLogged(pageId, label) {
  await ensurePageFullWidth(pageId);
  console.log(`  → full width (${CONFLUENCE_PAGE_APPEARANCE}): ${label} (${pageId})`);
}

/**
 * @param {{ title: string, parentId: string, bodyHtml: string }} opts
 */
async function createPage(opts) {
  return confluenceFetch("/wiki/api/v2/pages", {
    method: "POST"
  , body  : JSON.stringify({
      spaceId : SPACE_ID
    , status  : "current"
    , title   : opts.title
    , parentId: opts.parentId
    , body    : {
        representation: "storage"
      , value         : opts.bodyHtml
      }
    }),
  });
}

/**
 * @param {string} pageId
 */
async function fetchPageStorage(pageId) {
  /** @type {{ version?: { number?: number }, body?: { storage?: { value?: string } } }} */
  const current = await confluenceFetch(
    `/wiki/api/v2/pages/${pageId}?body-format=storage`
  );

  return {
    version : current.version?.number ?? 1
  , bodyHtml: current.body?.storage?.value ?? ""
  };
}

/**
 * @param {{ pageId: string, title: string, parentId: string, bodyHtml: string, versionMessage: string, version?: number }} opts
 */
async function updatePage(opts) {
  const version = (opts.version ?? (await fetchPageStorage(opts.pageId)).version) + 1;

  return confluenceFetch(`/wiki/api/v2/pages/${opts.pageId}`, {
    method: "PUT"
  , body  : JSON.stringify({
      id        : opts.pageId
    , status    : "current"
    , title     : opts.title
    , spaceId   : SPACE_ID
    , parentId  : opts.parentId
    , version   : { number: version, message: opts.versionMessage }
    , body      : {
        representation: "storage"
      , value         : opts.bodyHtml
      }
    }),
  });
}

/**
 * @param {Awaited<ReturnType<typeof generatePillarMatrixHtml>>} bundle
 * @param {string} [linksHtml]
 */
function buildIndexBody(bundle, linksHtml = "") {
  return [
    `<div data-type="panel-info"><p><strong>Incrocio:</strong> backlog JLO completo · <a href="${DOC_URL}">Documento di lavoro 9076737</a> · segnali repo (<code>REPO_IMPLEMENTATION_SIGNALS</code> + citazioni codice significative, colonna GitHub branch/commit).</p></div>`
  , bundle.intro
  , `<h2>Sotto-pagine per pilastro</h2>`
  , `<p>Ogni pilastro/concepto del documento 9076737 ha una sotto-pagina con albero issue, stato Jira, stato repo, sviluppo GitHub e gap.</p>`
  , linksHtml ? `<h2>Indice pilastri</h2>\n${linksHtml}` : ""
  , bundle.footer
  ].filter(Boolean).join("\n\n");
}

/**
 * @param {{ id: string, title: string, html: string }} pillar
 * @param {{ fetchedAt?: string }} bundle
 * @param {{ indexId: string, updatedAt: string, dryRun?: boolean }} ctx
 */
async function updateSinglePillarPage(pillar, bundle, ctx) {
  const indexId   = ctx.indexId;
  const updatedAt = ctx.updatedAt;
  let pageId      = EXISTING_PAGES[/** @type {keyof typeof EXISTING_PAGES} */ (pillar.id)] || "";

  if (ctx.dryRun) {
    return {
      pillarId   : pillar.id
    , title      : pillar.title
    , pageId     : pageId || `(dry-run) ${pillar.id}`
    , diff       : { added: [], removed: [], modified: [], unchanged: 0 }
    , hasChanges : Boolean(pageId)
    , webui      : undefined
    };
  }

  /** @type {{ id?: string, _links?: { webui?: string } }} */
  let page = {};

  if (pageId) {
    console.log(`Updating pillar: ${pillar.title} (${pageId})…`);

    const { bodyHtml: previousBody, version } = await fetchPageStorage(pageId);
    const prepared = prepareMatrixBodyWithDiff(previousBody, pillar.html, {
      updatedAt
    , title: pillar.title
    });

    if (prepared.hasChanges) {
      console.log(`  → diff: ${summarizeDiff(prepared.diff)}`);
    } else {
      console.log("  → diff: nessuna modifica issue");
    }

    if (!ctx.dryRun) {
      page = await updatePage({
        pageId         : pageId
      , title          : `[Pilastro] ${pillar.title}`
      , parentId       : indexId
      , bodyHtml       : prepared.html
      , version
      , versionMessage : prepared.hasChanges
        ? `Matrice pilastri — ${summarizeDiff(prepared.diff)}`
        : "Matrice pilastri — rigenerazione senza diff issue"
      });

      await ensurePageFullWidthLogged(pageId, pillar.title);
    }

    return {
      pillarId : pillar.id
    , title    : pillar.title
    , pageId
    , diff     : prepared.diff
    , hasChanges: prepared.hasChanges
    , webui    : page._links?.webui
    };
  }

  console.log(`Creating pillar page: ${pillar.title}…`);

  page = await createPage({
    title    : `[Pilastro] ${pillar.title}`
  , parentId : indexId
  , bodyHtml : pillar.html
  });

  pageId = String(page.id ?? "");

  if (!pageId) {
    throw new Error(`Creazione pagina fallita per pilastro ${pillar.id}`);
  }

  console.log(`  → new page id ${pageId} (${pillar.id})`);
  await ensurePageFullWidthLogged(pageId, pillar.title);

  return {
    pillarId  : pillar.id
  , title     : pillar.title
  , pageId
  , diff      : { added: [], removed: [], modified: [], unchanged: 0 }
  , hasChanges: true
  , webui     : page._links?.webui
  };
}

/**
 * Aggiorna solo le pagine pilastro che contengono ticketKey (chiudi --confluence).
 * @param {string} ticketKey
 * @param {{ dryRun?: boolean, bundle?: Awaited<ReturnType<typeof generatePillarMatrixHtml>> }} [opts]
 */
async function publishTargetedUpdate(ticketKey, opts = {}) {
  const keyMatch = String(ticketKey).trim().toUpperCase().match(/JLO-\d+/);
  const key      = keyMatch?.[0];

  if (!key) {
    throw new Error(`Key ticket non valida per Confluence: ${ticketKey}`);
  }

  const bundle = opts.bundle ?? (opts.dryRun ? null : await generatePillarMatrixHtml());

  if (opts.dryRun && !bundle) {
    return {
      ok        : true
    , mode      : "targeted"
    , ticketKey : key
    , dryRun    : true
    , pillars   : []
    , skippedIndex: true
    , note      : "dry-run — nessuna chiamata Jira/Confluence"
    };
  }

  if (!bundle) {
    throw new Error("Bundle matrice mancante");
  }

  const updatedAt = bundle.fetchedAt ?? new Date().toISOString();
  const indexId   = EXISTING_PAGES.index;
  const matching  = findPillarsForKey(key, bundle.allPillars ?? [], bundle.issues ?? []);

  if (matching.length === 0) {
    return {
      ok        : false
    , mode      : "targeted"
    , ticketKey : key
    , error     : `Nessun pilastro mappa ${key}`
    , pillars   : []
    };
  }

  /** @type {Array<{ pillarId: string, title: string, pageId: string, diffSummary?: string, hasChanges?: boolean }>} */
  const pillars = [];

  for (const pillarDef of matching) {
    const pillar = bundle.pillars.find((row) => row.id === pillarDef.id);

    if (!pillar) {
      continue;
    }

    const row = await updateSinglePillarPage(pillar, bundle, {
      indexId
    , updatedAt
    , dryRun: opts.dryRun
    });

    pillars.push({
      pillarId    : row.pillarId
    , title       : row.title
    , pageId      : row.pageId
    , diffSummary : summarizeDiff(row.diff)
    , hasChanges  : row.hasChanges
    });
  }

  return {
    ok        : true
  , mode      : "targeted"
  , ticketKey : key
  , pillars
  , skippedIndex: true
  };
}

async function publishUpdate(bundle) {
  const indexId     = EXISTING_PAGES.index;
  const updatedAt   = bundle.fetchedAt ?? new Date().toISOString();
  /** @type {Array<{ label: string, diff: import("../lib/pillar-matrix-diff.mjs").MatrixDiff }>} */
  const diffSections = [];

  console.log(`Updating index page ${indexId}…`);

  /** @type {Array<{ title: string, id: string, webui?: string }>} */
  const children = [];

  for (const pillar of bundle.pillars) {
    const row = await updateSinglePillarPage(pillar, bundle, { indexId, updatedAt });

    diffSections.push({ label: pillar.title, diff: row.diff });

    children.push({
      title : pillar.title
    , id    : row.pageId
    , webui : row.webui
    });
  }

  const linksHtml = [
    `<ul>`
  , ...children.map((row) => `<li><a href="https://myfuturejobsearch.atlassian.net${row.webui ?? ""}">${row.title}</a></li>`)
  , `</ul>`
  ].join("\n");

  const aggregatePanel = buildAggregateChangelogPanel(diffSections, { updatedAt });
  const indexBody      = [
    aggregatePanel
  , buildIndexBody(bundle, linksHtml)
  ].filter(Boolean).join("\n\n");

  const { version: indexVersion } = await fetchPageStorage(indexId);
  /** @type {import("../lib/pillar-matrix-diff.mjs").MatrixDiff} */
  const totalDiff = diffSections.reduce((acc, row) => {
    acc.added.push(...row.diff.added);
    acc.removed.push(...row.diff.removed);
    acc.modified.push(...row.diff.modified);
    acc.unchanged += row.diff.unchanged;
    return acc;
  }, { added: [], removed: [], modified: [], unchanged: 0 });

  await updatePage({
    pageId         : indexId
  , title          : "JLO × Visione × Repo — Matrice pilastri"
  , parentId       : PARENT_DOC_ID
  , bodyHtml       : indexBody
  , version        : indexVersion
  , versionMessage : aggregatePanel
    ? `Indice — ${summarizeDiff(totalDiff)}`
    : "Indice pilastri — rigenerazione"
  });

  await ensurePageFullWidthLogged(indexId, "index (links)");

  /** @type {Record<string, string>} */
  const diffByPillar = {};

  for (const section of diffSections) {
    if (summarizeDiff(section.diff) !== "nessuna modifica issue") {
      diffByPillar[section.label] = summarizeDiff(section.diff);
    }
  }

  console.log(JSON.stringify({
    ok       : true
  , mode     : "update"
  , indexId
  , children : children.length
  , diff     : diffByPillar
  }, null, 2));

  return {
    ok       : true
  , mode     : "update"
  , indexId
  , children : children.length
  , diff     : diffByPillar
  };
}

export {
  publishUpdate as publishPillarMatrixUpdate
, publishTargetedUpdate as publishTargetedPillarMatrixUpdate
, applyConfluencePillarFullWidth
};

/**
 * Imposta larghezza max su tutte le pagine matrice già note (senza rigenerare HTML).
 */
async function applyConfluencePillarFullWidth() {
  /** @type {Array<{ id: string, label: string }>} */
  const pages = Object.entries(EXISTING_PAGES)
    .filter(([, pageId]) => Boolean(pageId))
    .map(([slug, pageId]) => ({ id: pageId, label: slug }));

  for (const row of pages) {
    await ensurePageFullWidthLogged(row.id, row.label);
  }

  return { ok: true, pages: pages.length, appearance: CONFLUENCE_PAGE_APPEARANCE };
}

async function publishCreate(bundle) {
  const indexBody = buildIndexBody(bundle);

  console.log("Creating index page…");

  /** @type {{ id?: string, _links?: { webui?: string } }} */
  const index = await createPage({
    title    : "JLO × Visione × Repo — Matrice pilastri"
  , parentId : PARENT_DOC_ID
  , bodyHtml : indexBody
  });

  const indexId = String(index.id ?? "");
  console.log(JSON.stringify({ indexId, webui: index._links?.webui }));

  await ensurePageFullWidthLogged(indexId, "index");

  /** @type {Array<{ title: string, id: string, webui?: string }>} */
  const children = [];

  for (const pillar of bundle.pillars) {
    console.log(`Creating pillar: ${pillar.title}…`);

    /** @type {{ id?: string, _links?: { webui?: string } }} */
    const page = await createPage({
      title    : `[Pilastro] ${pillar.title}`
    , parentId : indexId
    , bodyHtml : pillar.html
    });

    const pageId = String(page.id ?? "");

    await ensurePageFullWidthLogged(pageId, pillar.title);

    children.push({
      title : pillar.title
    , id    : pageId
    , webui : page._links?.webui
    });
  }

  const linksHtml = [
    `<ul>`
  , ...children.map((row) => `<li><a href="${row.webui ?? "#"}">${row.title}</a></li>`)
  , `</ul>`
  ].join("\n");

  await confluenceFetch(`/wiki/api/v2/pages/${indexId}`, {
    method: "PUT"
  , body  : JSON.stringify({
      id        : indexId
    , status    : "current"
    , title     : "JLO × Visione × Repo — Matrice pilastri"
    , spaceId   : SPACE_ID
    , parentId  : PARENT_DOC_ID
    , version   : { number: 2, message: "Link sotto-pagine pilastri" }
    , body      : {
        representation: "storage"
      , value         : buildIndexBody(bundle, linksHtml)
      }
    }),
  });

  console.log(JSON.stringify({ ok: true, mode: "create", indexId, children: children.length }, null, 2));
}

async function main() {
  const appearanceOnly = process.argv.includes("--appearance-only");

  if (appearanceOnly) {
    const result = await applyConfluencePillarFullWidth();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const bundle = await generatePillarMatrixHtml();

  if (UPDATE_MODE) {
    await publishUpdate(bundle);
    return;
  }

  try {
    await publishCreate(bundle);
  } catch (err) {
    const detail = String(/** @type {{ detail?: string, message?: string }} */ (err).detail ?? err.message ?? err);

    if (detail.includes("already exists") || detail.includes("same TITLE")) {
      console.warn(
        "Pagina matrice già presente su Confluence — passo ad aggiornamento (--update).\n"
        + "Comando consigliato: node scripts/publish-confluence-pillar-matrix.mjs --update"
      );
      await publishUpdate(bundle);
      return;
    }

    throw err;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    const cause = /** @type {{ code?: string, message?: string }} */ (/** @type {{ cause?: unknown }} */ (err).cause ?? {});

    console.error(err.message ?? err);

    if (cause?.code || cause?.message) {
      console.error(`Causa: ${[cause.code, cause.message].filter(Boolean).join(" — ")}`);
    }

    process.exit(1);
  });
}
