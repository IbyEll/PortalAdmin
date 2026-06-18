#!/usr/bin/env node
/**
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-17
 *
 * Genera pagine portal Admin (cruscotto :3999) — matrice pilastri JLO × visione × repo.
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - le pagine pillar-matrix statiche devono essere rigenerate on-demand da backlog Jira e scan repo
 *   - separa la fase lenta (generatePillarMatrixHtml) dalla scrittura HTML portal
 *
 *   A cosa serve:
 *   - CLI e export writePillarMatrixPortalFromBundle — scrive cruscotto.frontend/pillar-matrix/
 *   - writePillarMatrixPortalTargeted — rigenerazione subset pilastri (PARKING_tocheck)
 *
 * Generalizzazione:
 *   Si — bundle da scripts/confluence.pillar.matrix.generate.mjs; layout portal da pillar.matrix.portal.mjs.
 *
 * Input:
 *   - argv[1] — path script quando invocato come entrypoint Node
 *   - bundle — output generatePillarMatrixHtml (backlog, pillars, coverage, fetchedAt)
 *   - pillarIds — lista pilastri per writePillarMatrixPortalTargeted
 *
 * Uso:
 *   - node cruscotto.frontend/cruscotto.jira.pillar.matrix.portal.generate.mjs
 *
 * Consumatori:
 *   - runner/cruscotto.server.mjs — comando rigenerazione da API admin
 *   - PARKING_tocheck/pillar-matrix-regenerate.mjs, pillar-matrix-targeted.mjs — wrapper CLI
 *
 * Export principali:
 *   - generatePillarMatrixPortal — alias main CLI
 *   - writePillarMatrixPortalFromBundle, writePillarMatrixPortalTargeted — scrittura HTML
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { generatePillarMatrixHtml } from "../admin.script.standalone/confluence.pillar.matrix.generate.mjs";
import {
  buildNavItems
, confluenceHtmlToPortal
, pillarPageFilename
, pillarPageUrl
, renderIndexPillarTable
, renderPortalPage
} from "./cruscotto.jira.pillar.matrix.portal.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Directory di output servita dal dashboard-server su :3999 */
const OUT_DIR   = join(__dirname, "pillar-matrix");

const LOG_PREFIX = "[pillar-matrix-portal]";

/** Intervallo heartbeat mentre `generatePillarMatrixHtml` è in esecuzione (ms). */
const GENERATE_HEARTBEAT_MS = 30_000;

/**
 * @param {string} message
 */
function log(message) {
  console.log(`${LOG_PREFIX} ${message}`);
}

/**
 * @param {number} ms
 * @returns {string}
 */
function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min      = Math.floor(totalSec / 60);
  const sec      = totalSec % 60;

  if (min > 0) {
    return `${min}m ${sec}s`;
  }

  return `${sec}s`;
}

/**
 * Costruisce nav e metadati condivisi tra indice e pagine pilastro.
 *
 * @param {Awaited<ReturnType<typeof generatePillarMatrixHtml>>} bundle
 */
function buildPortalWriteContext(bundle) {
  const allPillars   = bundle.allPillars ?? [];
  const navItems     = buildNavItems(allPillars.map((pillar) => ({ id: pillar.id, pillar: pillar.pillar })));
  const pillarBlocks = bundle.pillars;
  const navPillars   = allPillars.map((pillar) => ({ id: pillar.id, pillar: pillar.pillar }));

  return {
    allPillars
  , navItems
  , pillarBlocks
  , navPillars
  , fetchedAt: bundle.fetchedAt
  };
}

/**
 * Scrive `index.html` con tabella riepilogo pilastri.
 *
 * @param {Awaited<ReturnType<typeof generatePillarMatrixHtml>>} bundle
 * @param {ReturnType<typeof buildPortalWriteContext>} ctx
 */
function writePortalIndexPage(bundle, ctx) {
  const indexBody = [
    confluenceHtmlToPortal(bundle.intro)
  , renderIndexPillarTable(ctx.navPillars, ctx.pillarBlocks)
  , confluenceHtmlToPortal(bundle.footer)
  ].join("\n\n");

  const outPath = join(OUT_DIR, pillarPageFilename("index"));

  writeFileSync(
    outPath
  , renderPortalPage({
      title     : "Indice"
    , activeId  : "index"
    , bodyHtml  : indexBody
    , navItems  : ctx.navItems
    , fetchedAt : ctx.fetchedAt
    })
  , "utf8"
  );

  log(`scritto indice → ${outPath}`);

  return "index";
}

/**
 * Scrive una pagina pilastro (`{id}.html`).
 *
 * @param {{ id: string, title: string, html: string }} block
 * @param {ReturnType<typeof buildPortalWriteContext>} ctx
 */
function writePortalPillarPage(block, ctx) {
  const outPath = join(OUT_DIR, pillarPageFilename(block.id));

  writeFileSync(
    outPath
  , renderPortalPage({
      title     : block.title
    , activeId  : block.id
    , bodyHtml  : confluenceHtmlToPortal(block.html)
    , navItems  : ctx.navItems
    , fetchedAt : ctx.fetchedAt
    })
  , "utf8"
  );

  return block.id;
}

/**
 * Scrive indice + tutte le pagine pilastro dal bundle già generato.
 *
 * @param {Awaited<ReturnType<typeof generatePillarMatrixHtml>>} bundle
 */
export function writePillarMatrixPortalFromBundle(bundle) {
  mkdirSync(OUT_DIR, { recursive: true });

  const ctx         = buildPortalWriteContext(bundle);
  const pillarCount = ctx.pillarBlocks.length;

  log(`scrittura HTML in ${OUT_DIR} (${pillarCount + 1} pagine)…`);

  writePortalIndexPage(bundle, ctx);

  for (let i = 0; i < pillarCount; i += 1) {
    const block = ctx.pillarBlocks[i];
    const id    = writePortalPillarPage(block, ctx);

    log(`  [${i + 1}/${pillarCount}] ${id}.html — ${block.title}`);
  }

  return {
    outDir  : OUT_DIR
  , pages   : 1 + pillarCount
  , written : ["index", ...ctx.pillarBlocks.map((block) => block.id)]
  };
}

/**
 * Aggiorna solo pagine pilastro selezionate (+ indice metriche opzionale).
 *
 * @param {Awaited<ReturnType<typeof generatePillarMatrixHtml>>} bundle
 * @param {string[]} pillarIds
 * @param {{ includeIndex?: boolean }} [opts]
 */
export function writePillarMatrixPortalTargeted(bundle, pillarIds, opts = {}) {
  mkdirSync(OUT_DIR, { recursive: true });

  const ctx     = buildPortalWriteContext(bundle);
  const idSet   = new Set(pillarIds);
  /** @type {string[]} */
  const written = [];

  log(`scrittura mirata: ${pillarIds.join(", ")}${opts.includeIndex === false ? "" : " + indice"}`);

  if (opts.includeIndex !== false) {
    written.push(writePortalIndexPage(bundle, ctx));
  }

  for (const block of ctx.pillarBlocks) {
    if (idSet.has(block.id)) {
      written.push(writePortalPillarPage(block, ctx));

      log(`  aggiornato ${block.id}.html — ${block.title}`);
    }
  }

  return {
    outDir
  , pages   : written.length
  , written
  };
}

/**
 * Entry point CLI: genera matrice + scrive portal HTML.
 */
async function main() {
  const startedAt = Date.now();

  log("avvio generazione matrice pilastri (portal cruscotto)");

  // Fase lenta: backlog Jira, scan repo, git log per ogni key — nessun output intermedio dal modulo sottostante.
  log("fase 1/2 — build matrice (Jira + repo + GitHub)…");

  const generateStartedAt = Date.now();
  const heartbeat         = setInterval(() => {
    log(`  … build matrice ancora in corso (${formatElapsed(Date.now() - generateStartedAt)})`);
  }, GENERATE_HEARTBEAT_MS);

  let bundle;

  try {
    bundle = await generatePillarMatrixHtml();
  } finally {
    clearInterval(heartbeat);
  }

  const { coverage, fetchedAt, backlog } = bundle;

  log(
    `fase 1/2 completata in ${formatElapsed(Date.now() - generateStartedAt)}`
    + ` — backlog ${backlog} issue`
    + ` · coverage ${coverage.covered}/${coverage.topLevel}`
    + (coverage.orphans ? ` · ${coverage.orphans} orfani` : "")
    + ` · fetchedAt ${fetchedAt?.slice(0, 19) ?? "—"}`
  );

  log("fase 2/2 — scrittura pagine HTML portal…");

  const writeStartedAt = Date.now();
  const result         = writePillarMatrixPortalFromBundle(bundle);

  log(`fase 2/2 completata in ${formatElapsed(Date.now() - writeStartedAt)}`);
  log(`totale ${formatElapsed(Date.now() - startedAt)} — ${result.pages} pagine`);

  console.log(JSON.stringify({
    ...result
  , coverage
  , url: `http://localhost:3999${pillarPageUrl("index")}`
  }));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(`${LOG_PREFIX} errore:`, err.message ?? err);

    if (err.stack) {
      console.error(err.stack);
    }

    process.exit(1);
  });
}

export { main as generatePillarMatrixPortal };
