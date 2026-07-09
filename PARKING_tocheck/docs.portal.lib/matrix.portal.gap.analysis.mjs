#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-26 09:20
 * ------------------------------------------------------------------------------------------------------------------------
 * creato il: 2026-06-26 09:20 by: IbyEll
 * modificato il: 2026-06-26 09:20 by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Gap analysis PortalAdmin — pipeline completa JSON, MD, HTML matrice adv-card
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Serve un unico entrypoint che esegua la procedura step, serializzi artefatti strutturati e
 *     aggiorni la pagina matrice docs con merge incrementale (stelline sui delta).
 *
 *   A cosa serve:
 *   - runFullGapAnalysis orchestra matrix.portal.gap.analysis.procedure, scrive JSON/MD/HTML;
 *     generateGapMatrixHtml fa full render; merge via matrix.refresh se HTML già presente.
 *
 * Generalizzazione:
 *   No — output e metriche dedicati alla gap matrix PortalAdmin (finding da avanzamento).
 *
 * Input: —
 *
 * Uso:
 *   - node docs.portal.lib/matrix.portal.gap.analysis.mjs
 *   - node docs.portal.lib/matrix.portal.gap.analysis.mjs --stdout-html
 *   - node docs.portal.lib/matrix.portal.gap.analysis.mjs --full
 *
 * Flag CLI:
 *   --stdout-html  stampa HTML su stdout invece di scrivere file
 *   --full         rigenera HTML completo (no merge su pagina esistente)
 *
 * Consumatori:
 *   - docs.portal.lib/docs.portal.regenerate.mjs — RIGENERA pagina matrix.portal.gap.html
 *   - docs.portal.lib/matrix.portal.gap.analysis.procedure.mjs — step 3 e 4 della pipeline
 *
 * Export principali:
 *   - runFullGapAnalysis — pipeline end-to-end con merge opzionale
 *   - writeGapMatrixArtifacts, generateGapMatrixHtml — artefatti e render pagina
 *   - buildGapMatrixSections, matrixSectionsToMarkdown — re-export da matrix.gap.mjs
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import { buildGapMatrixSections, matrixSectionsToMarkdown } from "../docs.portal.lib/docs.portal.gap.matrix.mjs";
import { refreshMatrixPageHtml } from "../docs.portal.lib/docs.portal.matrix.refresh.mjs";
import {
  renderMatrixPage
, summarizeMatrixSections
} from "../docs.portal.lib/docs.portal.matrix.render.mjs";
import { isFreshEntry, parsePreviousAutoStates, stripFreshMarks } from "./docs.portal.refresh.mjs";
import { runAnalysisProcedure } from "./portal-gap-analysis.procedure.mjs";

const DOCS_DIR    = dirname(fileURLToPath(import.meta.url));
const PORTAL_ROOT = join(DOCS_DIR, "..");
const OUT_JSON    = join(DOCS_DIR, "portal-gap-matrix.json");
const OUT_MD      = join(DOCS_DIR, "portal-gap-matrix.md");
const OUT_HTML    = join(DOCS_DIR, "portal-gap-matrix.html");

export { buildGapMatrixSections, matrixSectionsToMarkdown };

/**
 * Scrive payload JSON e markdown della matrice gap sotto docs.portal.lib.
 *
 * @param {import("./matrix.render.mjs").MatrixSection[]} sections
 * @param {Awaited<ReturnType<import("../docs.portal/matrix.avanzamento.gap.feature.mjs").analyzePortalAdvancement>>} report
 * @returns {{ json: string, md: string }}
 */
export function writeGapMatrixArtifacts(sections, report) {
  const payload = {
    generatedAt: report.generatedAt
  , metrics    : report.metrics
  , sections
  };

  writeFileSync(OUT_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  writeFileSync(OUT_MD, `${matrixSectionsToMarkdown(sections)}\n`, "utf8");

  return { json: OUT_JSON, md: OUT_MD };
}

/**
 * Render HTML completo gap matrix — adv-card, metriche, Issue refinement, link correlati.
 *
 * @param {Awaited<ReturnType<import("../docs.portal/matrix.avanzamento.gap.feature.mjs").analyzePortalAdvancement>>} report
 * @returns {string}
 */
export function generateGapMatrixHtml(report) {
  const sections  = buildGapMatrixSections(report);
  const summary   = summarizeMatrixSections(sections);
  const date = report.generatedAt.slice(0, 19).replace("T", " ");

  const html = renderMatrixPage({
    title      : "Gap analysis completo — PortalAdmin"
  , pageTitle  : "PortalAdmin — Gap analysis completo"
  , generatedAt: report.generatedAt
  , metaHtml   : [
      `Gap analysis repo · ${date} ·`
    , `correlati:`
    , `<a href="Avanzamento_Gap_Feature.html">avanzamento</a>,`
    , `<a href="test-coverage-matrix.html">copertura test</a>,`
    , `<a href="repo-audit-ridondanze-gap.html">audit ridondanze</a>,`
    , `<a href="portal-gap-matrix.md">matrice MD</a>`
    ].join(" ")
  , leadHtml   : [
      "Analisi dedotta da filesystem, import, package.json e CI."
    , "Layout matrice con <strong>Issue refirement</strong> e pulsante <strong>Crea</strong> (come test-coverage)."
    , "Rigenera: <code>node docs.portal/portal-gap-analysis.mjs</code> ·"
    , "procedura: <code>node docs.portal/portal-gap-analysis.procedure.mjs --describe</code>."
    ].join(" ")
  , metrics    : [
      { label: "arch", value: `${report.metrics.archScore}/${report.metrics.archTotal}`, meta: "Target arch. OK" }
    , { label: "gaps", value: report.metrics.openGaps, meta: "Gap aperti (finding)" }
    , { label: "bugs", value: report.metrics.openBugs, meta: "Bug aperti" }
    , { label: "rows", value: summary.total, meta: "Righe matrice" }
    , { label: "parking", value: report.metrics.parkingImports, meta: "Import live PARKING" }
    ]
  , metricsBadge: `${report.metrics.openGaps} gap · ${report.metrics.openBugs} bug`
  , sections
  , footerHtml : [
      "Artefatti:"
    , `<code>portal-gap-matrix.json</code> ·`
    , `<code>portal-gap-matrix.md</code> ·`
    , `Template renderer: <code>docs.portal.lib/docs.portal.matrix.render.mjs</code>`
    ].join(" ")
  });

  return html;
}

/**
 * Pipeline gap analysis — procedura, artefatti, merge HTML o full render.
 *
 * @param {{ fullRender?: boolean }} [opts]
 * @returns {Promise<{ html: string, sections: import("./matrix.render.mjs").MatrixSection[], report: object, merge: boolean }>}
 */
export async function runFullGapAnalysis({ fullRender = false } = {}) {
  // 1. Procedura step — ctx.report da matrix.portal.gap.analysis.procedure
  const ctx = await runAnalysisProcedure({ portalRoot: PORTAL_ROOT });

  if (!ctx.report) {
    throw new Error("Analisi incompleta");
  }

  const sections = buildGapMatrixSections(ctx.report);
  const summary    = summarizeMatrixSections(sections);
  const metrics     = [
    { label: "arch", value: `${ctx.report.metrics.archScore}/${ctx.report.metrics.archTotal}`, meta: "Target arch. OK" }
  , { label: "gaps", value: ctx.report.metrics.openGaps, meta: "Gap aperti (finding)" }
  , { label: "bugs", value: ctx.report.metrics.openBugs, meta: "Bug aperti" }
  , { label: "rows", value: summary.total, meta: "Righe matrice" }
  , { label: "parking", value: ctx.report.metrics.parkingImports, meta: "Import live PARKING" }
  ];
  const metricsBadge = `${ctx.report.metrics.openGaps} gap · ${ctx.report.metrics.openBugs} bug`;

  // 2. Artefatti JSON e MD — sempre riscritti
  writeGapMatrixArtifacts(sections, ctx.report);

  // 3. HTML — merge se OUT_HTML esiste e non --full; altrimenti generateGapMatrixHtml
  const mergeMode = !fullRender && existsSync(OUT_HTML);
  let html;

  if (mergeMode) {
    const existing = readFileSync(OUT_HTML, "utf8");
    const prev     = parsePreviousAutoStates(existing);
    let out        = stripFreshMarks(existing);

    out = refreshMatrixPageHtml(
      out
    , sections
    , prev
    , ctx.report.generatedAt
    , isFreshEntry
    , { metrics, metricsBadge }
    );
    html = out;
  } else {
    html = generateGapMatrixHtml(ctx.report);
  }

  // 4. Scrittura HTML su disco
  writeFileSync(OUT_HTML, html, "utf8");

  return { html, sections, report: ctx.report, merge: mergeMode };
}

const isCliMain = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCliMain) {
  // 1. Flag CLI — --stdout-html su stdout; --full disabilita merge HTML
  const stdoutHtml  = process.argv.includes("--stdout-html");
  const fullRender  = process.argv.includes("--full");

  // 2. Pipeline — exitCode 1 su errore; log path artefatti se non stdout
  runFullGapAnalysis({ fullRender })
    .then(({ html, sections, report, merge }) => {
      if (stdoutHtml) {
        process.stdout.write(html);
        return;
      }

      console.log(`Scritto ${OUT_HTML}${fullRender ? " (full)" : merge ? " (merge)" : ""}`);
      console.log(`Scritto ${OUT_JSON}`);
      console.log(`Scritto ${OUT_MD}`);
      console.log(
        `Arch ${report.metrics.archProgressPct}% · `
        + `${sections.length} sezioni · `
        + `gap ${report.metrics.openGaps} · bug ${report.metrics.openBugs}`
      );
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    });
}
