/**
 * Matrice unificata PortalAdmin — avanzamento operativo + audit migrazione/storico.
 *
 * Consumatori:
 *   - docs.portal/matrix.portal.gap.analysis.mjs
 *   - docs.portal/matrix.repo.audit.ridondanze.gap.mjs
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  buildGapMatrixSections
, buildPortalGapMatrixMetrics
, matrixSectionsToMarkdown
} from "./matrix.gap.mjs";
import { analyzePortalAdvancement } from "./matrix.gap.scan.mjs";
import {
  buildRepoAuditSectionsFromReport
, SCAN_FINDING_TO_AUDIT_ID
, summarizeRepoAuditSections
} from "./matrix.repo.audit.mjs";
import { renderMatrixPage, summarizeMatrixSections } from "./matrix.render.mjs";
import { MATRIX_KIND_PORTAL_GAP } from "../cruscotto.database/matrix.db.mjs";

/** @typedef {import("./matrix.render.mjs").MatrixSection} MatrixSection */

/** Sezioni audit incluse nella pagina unificata (esclusa arch duplicata). */
const AUDIT_PART_IDS = new Set(["parking", "redundancy", "gap", "improv", "priority"]);

/**
 * @param {MatrixSection[]} operational
 * @returns {Set<string>}
 */
function operationalRowIds(operational) {
  const ids = new Set();

  for (const sec of operational) {
    for (const row of sec.rows) {
      ids.add(row.id);
    }
  }

  return ids;
}

/**
 * @param {import("./matrix.render.mjs").MatrixRow} row
 * @param {Set<string>} opIds
 * @returns {boolean}
 */
function isDuplicateAuditRow(row, opIds) {
  if (row.status === "obsoleto") {
    return false;
  }

  if (opIds.has(row.id)) {
    return true;
  }

  for (const [scanId, auditId] of Object.entries(SCAN_FINDING_TO_AUDIT_ID)) {
    if (auditId === row.id && opIds.has(scanId)) {
      return true;
    }

    if (row.id === scanId && opIds.has(auditId)) {
      return true;
    }
  }

  return false;
}

/**
 * @param {MatrixSection} section
 * @param {Set<string>} opIds
 * @returns {MatrixSection | null}
 */
function filterAuditSection(section, opIds) {
  const rows = section.rows.filter((r) => !isDuplicateAuditRow(r, opIds));

  if (rows.length === 0) {
    return null;
  }

  const open     = rows.filter((r) => r.status === "gap" || r.status === "parziale").length;
  const obsolete = rows.filter((r) => r.status === "obsoleto").length;
  const badge    = obsolete > 0
    ? `${open} aperti · ${obsolete} obsolete · ${rows.length} voci`
    : open > 0
      ? `${open} aperti · ${rows.length} voci`
      : `${rows.length} voci`;

  return {
    ...section
  , badge
  , open : section.open ?? open > 0
  , rows
  };
}

/**
 * @returns {string}
 */
export function renderMermaidArchitectureAppend() {
  return [
    `<details class="adv-card" data-adv-section="diagram">`
  , `<summary class="adv-card__summary">`
  , `<span class="adv-card__title">Diagramma architettura</span>`
  , `<span class="adv-card__badge">mermaid</span>`
  , `</summary>`
  , `<div class="adv-card__body">`
  , `<div class="mermaid">`
  , `flowchart TB`
  , `  subgraph host [PortalAdmin host]`
  , `    HOME[admin.portal HOME :3990]`
  , `    CRU[cruscotto.server :3999]`
  , `    JCORE[admin.portal.JiraCORE]`
  , `    LIB[lib + admin.portal.lib/overlay]`
  , `    PROJ[PROJECT_Base + overlay]`
  , `  end`
  , `  subgraph legacy [Legacy / parziale]`
  , `    RUN[runner/]`
  , `    SRV[server/ residui]`
  , `    PARK[PARKING_tocheck]`
  , `  end`
  , `  HOME --> LIB`
  , `  CRU --> LIB`
  , `  CRU --> JCORE`
  , `  CRU --> PROJ`
  , `  CRU -.-> PARK`
  , `  JCORE -.-> PARK`
  , `</div>`
  , `</div>`
  , `</details>`
  , `<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>`
  , `<script>mermaid.initialize({ startOnLoad: true, theme: "dark", securityLevel: "loose" });</script>`
  ].join("\n");
}

/**
 * @param {Awaited<ReturnType<typeof analyzePortalAdvancement>>} report
 * @param {MatrixSection[]} sections
 * @returns {{ metrics: object[], metricsBadge: string, metricsCardTitle: string }}
 */
export function buildUnifiedMatrixMetrics(report, sections) {
  const summary = summarizeMatrixSections(sections);
  const opOnly  = sections.filter((s) => s.id.startsWith("op-"));
  const { metrics: opMetrics, metricsBadge: opBadge } = buildPortalGapMatrixMetrics(report, opOnly);

  return {
    metrics: [
      ...opMetrics
    , { value: summary.obsolete, meta: "Obsolete (storico)" }
    , { value: 7, meta: "Priorità R1–R7" }
    , { value: summary.total, meta: "Voci totali" }
    ]
  , metricsBadge    : `${opBadge} · ${summary.obsolete} obsolete · ${summary.total} voci`
  , metricsCardTitle: "Sintesi PortalAdmin — operativo + audit"
  };
}

/**
 * @param {string} portalRoot
 * @param {{ legacyJsonPaths?: string[], report?: Awaited<ReturnType<typeof analyzePortalAdvancement>>, previousJsonPath?: string }} [opts]
 * @returns {Promise<{ sections: MatrixSection[], report: Awaited<ReturnType<typeof analyzePortalAdvancement>>, operational: MatrixSection[], audit: MatrixSection[] }>}
 */
export async function buildUnifiedMatrixSections(portalRoot, opts = {}) {
  const report = opts.report ?? await analyzePortalAdvancement(portalRoot);

  const operationalRaw = buildGapMatrixSections(report);
  const opIds          = operationalRowIds(operationalRaw);

  const historyPaths = [
    ...(opts.legacyJsonPaths ?? [])
  , ...(opts.previousJsonPath ? [opts.previousJsonPath] : [])
  ].filter(Boolean);

  const auditJsonPath = opts.auditJsonPath ?? opts.previousJsonPath;

  const { sections: auditRaw } = await buildRepoAuditSectionsFromReport(portalRoot, auditJsonPath, {
    legacyJsonPaths: historyPaths
  , report
  });

  /** @type {MatrixSection[]} */
  const operational = operationalRaw.map((sec, idx) => ({
    ...sec
  , id          : `op-${sec.id}`
  , partHeading : idx === 0 ? "Avanzamento operativo" : undefined
  , open        : sec.open ?? ["op-bug", "op-deprecation", "op-miglioramento", "op-gap"].includes(`op-${sec.id}`)
  }));

  /** @type {MatrixSection[]} */
  const audit = [];
  let auditPartStarted = false;

  for (const sec of auditRaw) {
    if (!AUDIT_PART_IDS.has(sec.id)) {
      continue;
    }

    const filtered = filterAuditSection(
      { ...sec, id: `audit-${sec.id}` }
    , opIds
    );

    if (!filtered) {
      continue;
    }

    if (!auditPartStarted) {
      filtered.partHeading = "Audit migrazione, ridondanze e storico";
      auditPartStarted     = true;
    }

    audit.push(filtered);
  }

  const sections = [...operational, ...audit];

  return { sections, report, operational, audit };
}

/**
 * @param {Awaited<ReturnType<typeof analyzePortalAdvancement>>} report
 * @param {MatrixSection[]} sections
 * @returns {string}
 */
export function generateUnifiedMatrixHtml(report, sections) {
  const date = report.generatedAt.slice(0, 19).replace("T", " ");
  const { metrics, metricsBadge, metricsCardTitle } = buildUnifiedMatrixMetrics(report, sections);

  return renderMatrixPage({
    title      : "PortalAdmin — Matrice avanzamento, gap, audit e storico"
  , pageTitle  : "[ MATRIX ] - PortalAdmin — Avanzamento · Gap · Audit"
  , generatedAt: report.generatedAt
  , metaHtml   : [
      `Matrice unificata · ${date} · correlati:`
    , `<a href="matrix.test.coverage.html">copertura test</a>,`
    , `<a href="matrix.portal.gap.definition.html">definizione script</a>,`
    , `<a href="#audit-parking">audit migrazione</a>,`
    , `<a href="matrix.portal.gap.md">matrice MD</a>`
    ].join(" ")
  , leadHtml   : [
      "Unico punto per <strong>avanzamento</strong> (% migrazioni, bug, deprecation, feature),"
    , "<strong>audit migrazione</strong> (PARKING, ridondanze, R1–R7) e"
    , "<strong>storico obsoleto</strong> (voci catalogo non più rilevate dallo scan)."
    , "Rigenera: <code>node docs.portal/matrix.portal.gap.analysis.mjs</code> ·"
    , "procedura: <code>node docs.portal/matrix.portal.gap.analysis.procedure.mjs --describe</code>."
    ].join(" ")
  , metrics
  , metricsBadge
  , metricsCardTitle
  , matrixKind   : MATRIX_KIND_PORTAL_GAP
  , bodyAttrs    : { "data-matrix-kind": MATRIX_KIND_PORTAL_GAP }
  , sections
  , appendHtml : renderMermaidArchitectureAppend()
  , footerHtml : [
      "Artefatti:"
    , `<code>matrix.portal.gap.json</code> ·`
    , `<code>matrix.portal.gap.md</code> ·`
    , `<code>repo-audit-ridondanze-gap.json</code> (storico audit) ·`
    , `Deprecati: <code>repo-audit-ridondanze-gap.html</code>,`
    , `<code>matrix.repo.audit.ridondanze.gap.html</code> → redirect matrice unificata`
    ].join(" ")
  });
}

/**
 * @param {MatrixSection[]} sections
 * @param {Awaited<ReturnType<typeof analyzePortalAdvancement>>} report
 * @param {MatrixSection[]} operational
 * @param {MatrixSection[]} audit
 * @returns {object}
 */
export function buildUnifiedJsonPayload(sections, report, operational, audit) {
  const summary = summarizeRepoAuditSections(sections);

  return {
    generatedAt: report.generatedAt
  , source       : "unified"
  , metrics      : {
      ...report.metrics
    , gap     : summary.gap
    , partial : summary.partial
    , obsolete: summary.obsolete
    , done    : summary.done
    , total   : summary.total
    }
  , operational
  , audit
  , sections
  };
}

/**
 * @param {string} docsDir
 * @returns {{ legacyJsonPaths: string[], auditJsonPath: string }}
 */
export function resolveUnifiedHistoryPaths(docsDir) {
  /** @type {string[]} */
  const legacy = [];

  const candidates = [
    join(docsDir, "matrix.repo.audit.ridondanze.gap.json")
  , join(docsDir, "repo-audit-ridondanze-gap.json")
  ];

  for (const p of candidates) {
    if (existsSync(p)) {
      legacy.push(p);
    }
  }

  return {
    legacyJsonPaths: legacy
  , auditJsonPath  : join(docsDir, "repo-audit-ridondanze-gap.json")
  };
}

export { matrixSectionsToMarkdown, summarizeRepoAuditSections as summarizeUnifiedSections };
