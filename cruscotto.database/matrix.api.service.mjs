/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-07-09 05:00
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-07-09 05:00   by: IbyEll
 * modificato il: 2026-07-09 05:00   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * Servizio API matrice cruscotto — portal-gap, runs, events, regenerate, finding-issue.
 * Story ADMIN-173 · consumer cruscotto.server.mjs route /api/matrix/*
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

import {
  cruscottoDbFileExists
, openCruscottoDb
} from "./cruscotto.db.config.mjs";
import {
  MATRIX_KIND_PORTAL_GAP
, MATRIX_KIND_TEST_COVERAGE
, loadMatrixRowEvents
} from "./matrix.db.mjs";
import {
  matrixSectionsFromDbRows
} from "../docs.portal.lib/matrix.db.adapter.mjs";
import {
  loadFindingIssueLinksObject
, persistFindingIssueLink
, pruneStaleMatrixFindingIssueLinks
} from "../docs.portal.lib/matrix.finding-issues.store.mjs";
import { createMatrixFindingIssue } from "../docs.portal.lib/matrix.finding.create.mjs";
import {
  renderMatrixPage
, summarizeMatrixSections
} from "../docs.portal.lib/matrix.render.mjs";
import {
  buildUnifiedMatrixMetrics
, renderMermaidArchitectureAppend
} from "../docs.portal.lib/matrix.unified.mjs";
import {
  getMatrixRegistryEntry
, MATRIX_REGISTRY_LIST
, regenerateMatrixByKind
, resolveMatrixKind
} from "../docs.portal.lib/matrix.registry.mjs";
import { buildTestCoveragePageConfig } from "../docs.portal/matrix.test.coverage.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS_DIR    = join(PORTAL_ROOT, "docs.portal");

/** @typedef {import("../docs.portal.lib/matrix.render.mjs").MatrixSection} MatrixSection */

export { matrixSectionsFromDbRows, matrixSectionTitleFromId } from "../docs.portal.lib/matrix.db.adapter.mjs";

/**
 * @param {{ matrixKind?: string }} [opts]
 */
export async function loadMatrixFromDb(opts = {}) {
  const matrixKind = resolveMatrixKind(opts.matrixKind ?? MATRIX_KIND_PORTAL_GAP);

  if (!cruscottoDbFileExists()) {
    throw new Error("Database cruscotto assente — eseguire npm run db:migrate");
  }

  if (!opts.skipPrune) {
    await pruneStaleMatrixFindingIssueLinks({ matrixKinds: [matrixKind] });
  }

  const db = await openCruscottoDb();

  const rows = await db.matrixRow.findMany({
    where  : { matrixKind }
  , include: { findingIssue: true }
  , orderBy: [{ sectionId: "asc" }, { findingId: "asc" }]
  });

  const latestRun = await db.matrixRun.findFirst({
    where  : { matrixKind }
  , orderBy: { generatedAt: "desc" }
  });

  const sections = matrixSectionsFromDbRows(rows);
  const summary  = summarizeMatrixSections(sections);

  return {
    ok          : true
  , matrixKind
  , generatedAt : latestRun?.generatedAt?.toISOString() ?? null
  , runId       : latestRun?.id ?? null
  , runSource   : latestRun?.source ?? null
  , sections
  , metrics     : summary
  , rowCount    : rows.length
  };
}

/**
 * @param {{ matrixKind?: string, limit?: number }} [opts]
 */
export async function loadMatrixRuns(opts = {}) {
  const matrixKind = String(opts.matrixKind ?? MATRIX_KIND_PORTAL_GAP).trim();
  const limit      = Math.min(Math.max(Number(opts.limit ?? 20) || 20, 1), 100);

  if (!cruscottoDbFileExists()) {
    throw new Error("Database cruscotto assente — eseguire npm run db:migrate");
  }

  const db  = await openCruscottoDb();
  const runs = await db.matrixRun.findMany({
    where  : { matrixKind }
  , orderBy: { generatedAt: "desc" }
  , take   : limit
  });

  return {
    ok         : true
  , matrixKind
  , runs: runs.map((run) => ({
      id          : run.id
    , matrixKind  : run.matrixKind
    , generatedAt : run.generatedAt.toISOString()
    , source      : run.source
    , syncRunId   : run.syncRunId
    , metrics     : run.metricsJson ? JSON.parse(run.metricsJson) : null
    }))
  };
}

/**
 * @param {{ findingId: string, matrixKind?: string }} opts
 */
export async function loadMatrixRowEventsApi(opts) {
  const findingId  = String(opts.findingId ?? "").trim();
  const matrixKind = String(opts.matrixKind ?? MATRIX_KIND_PORTAL_GAP).trim();

  if (!findingId) {
    throw new Error("findingId obbligatorio");
  }

  if (!cruscottoDbFileExists()) {
    throw new Error("Database cruscotto assente — eseguire npm run db:migrate");
  }

  await openCruscottoDb();
  const events = await loadMatrixRowEvents(findingId, matrixKind);

  return {
    ok         : true
  , findingId
  , matrixKind
  , events: events.map((ev) => ({
      id          : ev.id
    , at          : ev.at.toISOString()
    , eventType   : ev.eventType
    , matrixRunId : ev.matrixRunId
    , oldStatus   : ev.oldStatus
    , newStatus   : ev.newStatus
    , note        : ev.note
    }))
  };
}

/**
 * @param {{
 *   findingId: string
 *   key: string
 *   issueType?: string
 *   matrixKind?: string
 *   linkedSource?: string
 * }} body
 */
export async function persistMatrixFindingIssueApi(body) {
  const findingId = String(body.findingId ?? "").trim();
  const key       = String(body.key ?? "").trim().toUpperCase();
  const issueType = String(body.issueType ?? "Bug").trim() || "Bug";

  if (!findingId || !key) {
    throw new Error("findingId e key obbligatori");
  }

  if (!/^(ADMIN|JLO)-\d+$/.test(key)) {
    throw new Error("key Jira non valida (ADMIN-xxx o JLO-xxx)");
  }

  const entry = await persistFindingIssueLink(findingId, {
    key
  , issueType
  }, String(body.matrixKind ?? MATRIX_KIND_PORTAL_GAP).trim());

  return {
    ok        : true
  , findingId
  , link      : entry
  , matrixKind: String(body.matrixKind ?? MATRIX_KIND_PORTAL_GAP).trim()
  };
}

/**
 * @param {{
 *   matrixKind?: string
 *   saveHtml?: boolean
 *   fullRender?: boolean
 *   source?: string
 * }} [opts]
 */
export async function regenerateMatrix(opts = {}) {
  const matrixKind = resolveMatrixKind(opts.matrixKind ?? MATRIX_KIND_PORTAL_GAP);
  const pruned     = await pruneStaleMatrixFindingIssueLinks({ matrixKinds: [matrixKind] });
  const result     = await regenerateMatrixByKind(matrixKind, {
    saveHtml   : opts.saveHtml
  , fullRender : opts.fullRender
  , source     : opts.source
  });

  return { ...result, prunedStaleLinks: pruned.count };
}

/** @deprecated alias — usare regenerateMatrix */
export const regenerateMatrixPortalGap = regenerateMatrix;

/** @deprecated alias — usare loadMatrixFromDb */
export const loadMatrixPortalGap = loadMatrixFromDb;

/**
 * Richiesta da localhost — gate dev-only per regenerate.
 *
 * @param {import("node:http").IncomingMessage} req
 * @returns {boolean}
 */
export function isLocalDevMatrixRequest(req) {
  const addr = String(req.socket?.remoteAddress ?? "");

  return (
    addr === "127.0.0.1"
    || addr === "::1"
    || addr === "::ffff:127.0.0.1"
    || addr.endsWith("127.0.0.1")
  );
}

const MERMAID_SCRIPTS_HTML = [
  `<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>`
, `<script>mermaid.initialize({ startOnLoad: true, theme: "dark", securityLevel: "loose" });</script>`
].join("\n");

/**
 * @param {{ generatedAt?: string | null, runId?: string | null, runSource?: string | null, matrixKind?: string, shortLabel?: string, tabId?: string }} meta
 * @returns {string}
 */
function renderCruscottoMatrixChrome(meta) {
  const stamp = meta.generatedAt?.slice(0, 19).replace("T", " ") ?? "—";
  const kind  = meta.matrixKind ?? MATRIX_KIND_PORTAL_GAP;
  const tabId = meta.tabId ?? "matrix";

  return [
    `<nav class="docs-chrome" aria-label="Toolbar matrice cruscotto">`
  , `<div class="docs-chrome-inner">`
  , `<a class="docs-chrome-brand" href="/app.html#${tabId}">Cruscotto</a>`
  , `<span class="docs-chrome-link muted">${meta.shortLabel ?? "Matrice DB"}</span>`
  , `<button type="button" id="matrix-chrome-reload" class="docs-chrome-btn">Ricarica</button>`
  , `<button type="button" id="matrix-chrome-regenerate" class="docs-chrome-btn docs-chrome-btn-regenerate" data-matrix-kind="${kind}">Rigenera</button>`
  , `<span id="matrix-chrome-status" class="docs-chrome-status muted" aria-live="polite">${stamp}</span>`
  , `</div>`
  , `</nav>`
  ].join("\n");
}

/**
 * Metriche card — preferisce matrix.portal.gap.json se presente, altrimenti sintesi da sezioni DB.
 *
 * @param {import("../docs.portal.lib/matrix.render.mjs").MatrixSection[]} sections
 * @param {string | null | undefined} generatedAt
 */
function buildMatrixPageMetrics(sections, generatedAt) {
  /** @type {{ generatedAt?: string, metrics?: Record<string, unknown> }} */
  let report = {
    generatedAt: generatedAt ?? new Date().toISOString()
  , metrics    : {}
  };

  const jsonPath = join(DOCS_DIR, "matrix.portal.gap.json");

  if (existsSync(jsonPath)) {
    try {
      const json = JSON.parse(readFileSync(jsonPath, "utf8"));

      if (json?.metrics && typeof json.metrics === "object") {
        report.metrics = json.metrics;
      }

      if (typeof json?.generatedAt === "string") {
        report.generatedAt = json.generatedAt;
      }
    } catch {
      // JSON assente o corrotto — metriche da sezioni
    }
  }

  if (!report.metrics || Object.keys(report.metrics).length === 0) {
    const summary = summarizeMatrixSections(sections);

    report.metrics = {
      archProgressPct: "—"
    , archScore      : "—"
    , archTotal      : "—"
    , openGaps       : summary.gap
    , openBugs       : 0
    , parkingImports : "—"
    , gap            : summary.gap
    , partial        : summary.partial
    , obsolete       : summary.obsolete
    , done           : summary.done
    , total          : summary.total
    };
  }

  return buildUnifiedMatrixMetrics(report, sections);
}

/**
 * @param {{ matrixKind?: string, embed?: boolean }} [opts]
 * @returns {Promise<string>}
 */
export async function renderMatrixPageHtml(opts = {}) {
  const embed      = Boolean(opts.embed);
  const matrixKind = resolveMatrixKind(opts.matrixKind ?? MATRIX_KIND_PORTAL_GAP);
  const registry   = getMatrixRegistryEntry(matrixKind);
  const data       = await loadMatrixFromDb({ matrixKind });
  const shell      = buildMatrixCruscottoShellConfig(matrixKind, data, registry, embed);

  return renderMatrixPage(shell);
}

/** @deprecated alias — usare renderMatrixPageHtml({ matrixKind: portal_gap }) */
export const renderMatrixPortalGapPageHtml = (opts = {}) => renderMatrixPageHtml({
  ...opts
, matrixKind: opts.matrixKind ?? MATRIX_KIND_PORTAL_GAP
});

function renderEmbedMatrixToolbar(meta) {
  const kind = meta.matrixKind ?? "portal_gap";

  return [
    `<nav class="docs-chrome matrix-embed-toolbar" aria-label="Toolbar matrice embed">`
  , `<div class="docs-chrome-inner">`
  , `<span class="docs-chrome-link muted">${meta.shortLabel ?? "Matrice"}</span>`
  , `<button type="button" id="matrix-chrome-reload" class="docs-chrome-btn">Ricarica</button>`
  , `<button type="button" id="matrix-chrome-regenerate" class="docs-chrome-btn docs-chrome-btn-regenerate" data-matrix-kind="${kind}">Rigenera</button>`
  , `<span id="matrix-chrome-status" class="docs-chrome-status muted" aria-live="polite"></span>`
  , `</div>`
  , `</nav>`
  ].join("\n");
}

/**
 * @param {string} matrixKind
 * @param {Awaited<ReturnType<typeof loadMatrixFromDb>>} data
 * @param {import("../docs.portal.lib/matrix.registry.mjs").MatrixRegistryEntry} registry
 * @param {boolean} embed
 */
function buildMatrixCruscottoShellConfig(matrixKind, data, registry, embed) {
  const chromeMeta = {
    ...data
  , matrixKind
  , shortLabel: registry.shortLabel
  , tabId     : registry.tabId
  };

  const baseShell = {
    stylesheetHref: "/matrix/docs.style.css"
  , scriptSrc     : "/matrix/matrix.toolbar.mjs"
  , bodyClass     : embed ? "is-embed" : ""
  , bodyAttrs     : { "data-matrix-kind": matrixKind }
  , chromeHtml    : embed ? renderEmbedMatrixToolbar(chromeMeta) : renderCruscottoMatrixChrome(chromeMeta)
  , headExtraHtml: embed
      ? `<style>body.is-embed{overflow:auto}body.is-embed header{display:none}body.is-embed .page{min-height:auto;padding:.35rem .5rem .75rem}.matrix-embed-toolbar{margin-bottom:.5rem}</style>`
      : ""
  };

  if (matrixKind === MATRIX_KIND_TEST_COVERAGE) {
    return {
      ...buildTestCoveragePageConfig(data.sections, {
        generatedAt: data.generatedAt ?? undefined
      , runId      : data.runId
      , runSource  : data.runSource
      , embed
      })
    , ...baseShell
    };
  }

  const date = (data.generatedAt ?? new Date().toISOString()).slice(0, 19).replace("T", " ");
  const { metrics, metricsBadge, metricsCardTitle } = buildMatrixPageMetrics(data.sections, data.generatedAt);

  return {
    title           : "PortalAdmin — Matrice avanzamento, gap, audit e storico"
  , pageTitle       : "[ MATRIX ] - PortalAdmin — Avanzamento · Gap · Audit"
  , generatedAt     : data.generatedAt ?? undefined
  , metaHtml        : [
      `Matrice DB · ${date}`
    , data.runId ? `· run <code>${data.runId}</code>` : ""
    , data.runSource ? `· fonte <code>${data.runSource}</code>` : ""
    , `· <a href="http://localhost:3990/docs/${registry.docsHtmlFile}" target="_blank" rel="noopener noreferrer">docs HOME</a>`
    ].join(" ")
  , leadHtml        : embed
      ? ""
      : [
          "Unico punto per <strong>avanzamento</strong> (% migrazioni, bug, deprecation, feature),"
        , "<strong>audit migrazione</strong> (PARKING, ridondanze, R1–R7) e"
        , "<strong>storico obsoleto</strong> (voci catalogo non più rilevate dallo scan)."
        , "Dati da tabelle <code>matrix_*</code> · rigenera con il pulsante toolbar."
        ].join(" ")
  , metrics
  , metricsBadge
  , metricsCardTitle
  , sections        : data.sections
  , appendHtml      : `${renderMermaidArchitectureAppend()}\n${MERMAID_SCRIPTS_HTML}`
  , footerHtml      : [
      "Persistenza:"
    , `<code>matrix_kind=${matrixKind}</code> ·`
    , `<code>matrix_run</code> ·`
    , `${data.rowCount} righe`
    ].join(" ")
  , ...baseShell
  };
}

/**
 * @param {string} [matrixKind]
 * @returns {Promise<Record<string, { key: string, issueType: string, createdAt?: string }>>}
 */
export async function loadMatrixFindingIssuesApi(matrixKind) {
  const kind = matrixKind ? resolveMatrixKind(matrixKind) : undefined;

  await pruneStaleMatrixFindingIssueLinks({ matrixKinds: kind ? [kind] : undefined });

  return loadFindingIssueLinksObject(kind);
}

/**
 * @returns {Promise<{ matrices: typeof MATRIX_REGISTRY_LIST }>}
 */
export async function loadMatrixRegistryApi() {
  return {
    ok       : true
  , matrices : MATRIX_REGISTRY_LIST.map((entry) => ({
      kind             : entry.kind
    , label            : entry.label
    , shortLabel       : entry.shortLabel
    , tabId            : entry.tabId
    , docsHtmlFile     : entry.docsHtmlFile
    , regenerateScript : entry.regenerateScript
    , cruscottoPath    : `/matrix.html?kind=${encodeURIComponent(entry.kind)}`
    }))
  };
}

/**
 * Veve DB post CREA matrice — dopo sync backlog così subtask e cache sono allineati.
 *
 * @param {{ key: string }} created
 * @param {Record<string, unknown>} body
 */
export async function runMatrixFindingIssueVeveDb(created, body) {
  const findingId = typeof body.findingId === "string" ? body.findingId.trim() : "";
  const paths     = Array.isArray(body.paths) ? body.paths.map((p) => String(p)) : [];
  const detail    = typeof body.detail === "string" ? body.detail.trim() : "";

  /** @type {{ ok: boolean, key?: string, error?: string, [k: string]: unknown }} */
  let veve = { ok: false, error: "veve DB non eseguito" };

  try {
    const { runVeveDbForIssueKey } = await import("../admin.portal.JiraCORE/jiraCORE.veve.db.mjs");
    veve = await runVeveDbForIssueKey(created.key, {
      writeTarget    : "both"
    , matrixPaths    : paths
    , matrixDetail   : detail
    , matrixFindingId: findingId
    , matrixKind     : typeof body.matrixKind === "string" ? body.matrixKind : undefined
    , dryRun         : Boolean(body.dryRun)
    });
  } catch (err) {
    veve = {
      ok   : false
    , key  : created.key
    , error: err instanceof Error ? err.message : String(err)
    };
  }

  return veve;
}

/**
 * @param {Record<string, unknown>} body
 */
export async function createMatrixFindingIssueApi(body) {
  const created = await createMatrixFindingIssueOnly(body);
  const veve    = await runMatrixFindingIssueVeveDb(created, body);

  return {
    ...created
  , veve
  };
}

/**
 * Crea issue Jira da finding matrice (senza veve DB).
 *
 * @param {Record<string, unknown>} body
 */
export async function createMatrixFindingIssueOnly(body) {
  const findingId = typeof body.findingId === "string" ? body.findingId.trim() : "";

  if (!findingId) {
    throw new Error("findingId obbligatorio");
  }

  const projectLabel = typeof body.project === "string" && body.project.trim()
    ? body.project.trim()
    : "PortalAdmin";
  const title = typeof body.summary === "string" ? body.summary.trim() : "";
  const detail = typeof body.detail === "string" ? body.detail.trim() : "";

  if (!title) {
    throw new Error("summary obbligatorio");
  }

  const paths = Array.isArray(body.paths)
    ? body.paths.map((p) => String(p))
    : [];

  const sectionLabel = typeof body.sectionLabel === "string" && body.sectionLabel.trim()
    ? body.sectionLabel.trim()
    : undefined;
  const sectionTitle = typeof body.sectionTitle === "string" && body.sectionTitle.trim()
    ? body.sectionTitle.trim()
    : undefined;
  const category = typeof body.category === "string" && body.category.trim()
    ? body.category.trim()
    : undefined;

  const created = await createMatrixFindingIssue({
    projectLabel
  , findingId
  , title
  , detail
  , paths
  , issueTypeKey: typeof body.issueType === "string" ? body.issueType : undefined
  , sectionLabel
  , sectionTitle
  , category
  , parentKey    : typeof body.parentKey === "string" ? body.parentKey : null
  , matrixKind   : typeof body.matrixKind === "string" ? body.matrixKind : undefined
  });

  return {
    ...created
  , findingId
  , paths
  , detail
  , matrixKind: typeof body.matrixKind === "string" ? body.matrixKind : undefined
  , dryRun     : Boolean(body.dryRun)
  };
}
