#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-26 19:00
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-26 19:00   by: IbyEll
 * modificato il: 2026-06-26 22:30   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *          Matrice unificata PortalAdmin — avanzamento operativo + audit migrazione/storico.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Avanzamento, bug, deprecation, feature, audit PARKING, ridondanze, R1–R7 e storico obsoleto
 *     devono essere consultabili in un unico artefatto rigenerabile.
 *
 *   A cosa serve:
 *   - Scan repo, merge JSON storico audit, render HTML unificato e mirror legacy repo-audit.
 *
 * Generalizzazione:
 *   No — entrypoint dedicato a PortalAdmin; root repo da path script in docs.portal.
 *
 * Input:
 *   - —
 *
 * Uso:
 *   - node docs.portal/matrix.portal.gap.analysis.mjs
 *   - node docs.portal/matrix.portal.gap.analysis.mjs --stdout-html
 *   - node docs.portal/matrix.portal.gap.analysis.mjs --full
 *
 * Flag CLI:
 *   --stdout-html   emette l'HTML su stdout invece del riepilogo file (exit 0)
 *   --full          render completo senza merge sull'HTML esistente
 *
 * Artefatti output:
 *   - matrix.portal.gap.html — pagina canonica unificata
 *   - matrix.portal.gap.json · matrix.portal.gap.md
 *   - repo-audit-ridondanze-gap.json — sottoinsieme audit per storico (non più HTML dedicato)
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import { buildPortalGapMatrixMetrics } from "../docs.portal.lib/matrix.gap.mjs";
import { refreshMatrixPageHtml } from "../docs.portal.lib/matrix.refresh.mjs";
import { isFreshEntry, parsePreviousAutoStates, stripFreshMarks } from "../docs.portal.lib/docs.portal.refresh.mjs";
import {
  buildUnifiedJsonPayload
, buildUnifiedMatrixMetrics
, buildUnifiedMatrixSections
, generateUnifiedMatrixHtml
, matrixSectionsToMarkdown
, resolveUnifiedHistoryPaths
, summarizeUnifiedSections
} from "../docs.portal.lib/matrix.unified.mjs";
import { runAnalysisProcedure } from "./matrix.portal.gap.analysis.procedure.mjs";

const DOCS_DIR    = dirname(fileURLToPath(import.meta.url));
const PORTAL_ROOT = join(DOCS_DIR, "..");
const OUT_JSON    = join(DOCS_DIR, "matrix.portal.gap.json");
const OUT_MD      = join(DOCS_DIR, "matrix.portal.gap.md");
const OUT_HTML    = join(DOCS_DIR, "matrix.portal.gap.html");
const OUT_AUDIT_JSON = join(DOCS_DIR, "repo-audit-ridondanze-gap.json");

export { matrixSectionsToMarkdown };

/**
 * @param {import("../docs.portal.lib/matrix.render.mjs").MatrixSection[]} sections
 * @returns {import("../docs.portal.lib/matrix.render.mjs").MatrixSection[]}
 */
function stripAuditSectionPrefix(sections) {
  return sections.map((sec) => ({
    ...sec
  , id: sec.id.replace(/^audit-/, "")
  }));
}

/**
 * @param {import("../docs.portal.lib/matrix.render.mjs").MatrixSection[]} sections
 * @param {Awaited<ReturnType<import("../docs.portal.lib/matrix.gap.scan.mjs").analyzePortalAdvancement>>} report
 * @param {import("../docs.portal.lib/matrix.render.mjs").MatrixSection[]} operational
 * @param {import("../docs.portal.lib/matrix.render.mjs").MatrixSection[]} audit
 */
export function writeUnifiedMatrixArtifacts(sections, report, operational, audit) {
  const payload      = buildUnifiedJsonPayload(sections, report, operational, audit);
  const auditSummary = summarizeUnifiedSections(audit);
  const auditPayload = {
    generatedAt: report.generatedAt
  , source     : "hybrid-scan"
  , metrics    : {
      gap     : auditSummary.gap
    , partial : auditSummary.partial
    , obsolete: auditSummary.obsolete
    , done    : auditSummary.done
    , total   : auditSummary.total
    }
  , sections: stripAuditSectionPrefix(audit)
  };

  writeFileSync(OUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(OUT_MD, `${matrixSectionsToMarkdown(sections)}\n`, "utf8");
  writeFileSync(OUT_AUDIT_JSON, `${JSON.stringify(auditPayload, null, 2)}\n`, "utf8");

  return { json: OUT_JSON, md: OUT_MD, auditJson: OUT_AUDIT_JSON };
}

/** @deprecated Usare generateUnifiedMatrixHtml via runFullGapAnalysis */
export async function generateGapMatrixHtml(report) {
  const history = resolveUnifiedHistoryPaths(DOCS_DIR);
  const { sections } = await buildUnifiedMatrixSections(PORTAL_ROOT, {
    auditJsonPath   : history.auditJsonPath
  , legacyJsonPaths : history.legacyJsonPaths
  , previousJsonPath: OUT_JSON
  , report
  });

  return generateUnifiedMatrixHtml(report, sections);
}

/**
 * @param {{ fullRender?: boolean }} [opts]
 * @returns {Promise<{ html: string, sections: import("../docs.portal.lib/matrix.render.mjs").MatrixSection[], report: object, merge: boolean }>}
 */
export async function runFullGapAnalysis({ fullRender = false } = {}) {
  const history = resolveUnifiedHistoryPaths(DOCS_DIR);

  const { sections, report, operational, audit } = await buildUnifiedMatrixSections(PORTAL_ROOT, {
    auditJsonPath  : history.auditJsonPath
  , legacyJsonPaths: history.legacyJsonPaths
  , previousJsonPath: OUT_JSON
  });

  const { metrics, metricsBadge } = buildUnifiedMatrixMetrics(report, sections);

  writeUnifiedMatrixArtifacts(sections, report, operational, audit);

  let mergeMode = !fullRender && existsSync(OUT_HTML);

  if (mergeMode) {
    const existing = readFileSync(OUT_HTML, "utf8");

    if (existing.includes('data-adv-section="arch"') && sections.some((s) => s.id.startsWith("op-"))) {
      mergeMode = false;
    }
  }

  let html;

  if (mergeMode) {
    const existing = readFileSync(OUT_HTML, "utf8");
    const prev     = parsePreviousAutoStates(existing);
    let out        = stripFreshMarks(existing);

    out = refreshMatrixPageHtml(
      out
    , sections
    , prev
    , report.generatedAt
    , isFreshEntry
    , { metrics, metricsBadge, metricsCardTitle: "Sintesi PortalAdmin — operativo + audit" }
    );

    const mermaidIdx = out.indexOf('data-adv-section="diagram"');

    if (mermaidIdx === -1) {
      const appendBlock = (await import("../docs.portal.lib/matrix.unified.mjs")).renderMermaidArchitectureAppend();

      out = out.replace("</main>", `${appendBlock}\n</main>`);
    }

    html = out;
  } else {
    html = generateUnifiedMatrixHtml(report, sections);
  }

  writeFileSync(OUT_HTML, html, "utf8");

  return { html, sections, report, merge: mergeMode };
}

/** @deprecated alias storico procedura step 3 */
export function writeGapMatrixArtifacts(sections, report) {
  const operational = sections.filter((s) => !s.id.startsWith("audit-"));
  const audit       = sections.filter((s) => s.id.startsWith("audit-"));

  return writeUnifiedMatrixArtifacts(sections, report, operational, audit);
}

const isCliMain = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCliMain) {
  const stdoutHtml = process.argv.includes("--stdout-html");
  const fullRender = process.argv.includes("--full");

  runFullGapAnalysis({ fullRender })
    .then(({ html, sections, report, merge }) => {
      if (stdoutHtml) {
        process.stdout.write(html);
        return;
      }

      const summary = summarizeUnifiedSections(sections);

      console.log(`Scritto ${OUT_HTML}${fullRender ? " (full)" : merge ? " (merge)" : ""}`);
      console.log(`Scritto ${OUT_JSON}`);
      console.log(`Scritto ${OUT_AUDIT_JSON}`);
      console.log(`Scritto ${OUT_MD}`);
      console.log(
        `Arch ${report.metrics.archProgressPct}% · `
        + `${sections.length} sezioni · `
        + `gap ${report.metrics.openGaps} · bug ${report.metrics.openBugs} · `
        + `${summary.obsolete} obsolete`
      );
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    });
}
