#!/usr/bin/env node
/**
 * Procedura gap analysis PortalAdmin — step orchestrator (CLI).
 * Uso: node docs.portal/matrix.portal.gap.analysis.procedure.mjs [--describe] [--step=N]
 */

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import { analyzePortalAdvancement } from "../docs.portal.lib/matrix.gap.scan.mjs";

const DOCS_DIR    = dirname(fileURLToPath(import.meta.url));
const PORTAL_ROOT = join(DOCS_DIR, "..");

/**
 * @typedef {{
 *   id: number
 *   name: string
 *   goal: string
 *   command: string
 *   artifact: string
 *   run: (ctx: AnalysisContext) => Promise<unknown>
 * }} AnalysisStep
 */

/** @typedef {{ portalRoot: string, report?: Awaited<ReturnType<typeof analyzePortalAdvancement>> }} AnalysisContext */

/** @type {AnalysisStep[]} */
export const ANALYSIS_STEPS = [
  {
    id       : 1
  , name     : "Scansione avanzamento e finding"
  , goal     : "Architettura, gap P0–P2, bug runtime, deprecation, feature, miglioramenti da filesystem/import."
  , command  : "analyzePortalAdvancement(portalRoot)"
  , artifact : "report.findings[] + report.metrics"
  , run      : async (ctx) => {
      ctx.report = await analyzePortalAdvancement(ctx.portalRoot);
      return ctx.report;
    }
  }
, {
    id       : 2
  , name     : "Classificazione finding per sezione"
  , goal     : "Raggruppare finding per categoria (arch, gap, bug, deprecation, feature, miglioramento)."
  , command  : "buildGapMatrixSections(report)"
  , artifact : "MatrixSection[] per renderer HTML"
  , run      : async (ctx) => {
      if (!ctx.report) {
        throw new Error("Step 2 richiede step 1 completato");
      }

      const { buildGapMatrixSections } = await import("../docs.portal.lib/matrix.gap.mjs");

      return buildGapMatrixSections(ctx.report);
    }
  }
, {
    id       : 3
  , name     : "Export matrice JSON + Markdown"
  , goal     : "Serializzare dati strutturati per diff e review offline."
  , command  : "writeGapMatrixArtifacts(sections, report)"
  , artifact : "matrix.portal.gap.json · matrix.portal.gap.md"
  , run      : async (ctx) => {
      const { writeUnifiedMatrixArtifacts } = await import("./matrix.portal.gap.analysis.mjs");
      const { buildUnifiedMatrixSections, resolveUnifiedHistoryPaths } = await import(
        "../docs.portal.lib/matrix.unified.mjs"
      );

      if (!ctx.report) {
        throw new Error("Step 3 richiede step 1 completato");
      }

      const history = resolveUnifiedHistoryPaths(DOCS_DIR);
      const built   = await buildUnifiedMatrixSections(ctx.portalRoot, {
        report          : ctx.report
      , auditJsonPath   : history.auditJsonPath
      , legacyJsonPaths : history.legacyJsonPaths
      });

      return writeUnifiedMatrixArtifacts(
        built.sections
      , ctx.report
      , built.operational
      , built.audit
      );
    }
  }
, {
    id       : 4
  , name     : "Generazione pagina HTML documenti"
  , goal     : "Render pagina unificata avanzamento + audit via matrix.unified."
  , command  : "generateUnifiedMatrixHtml → matrix.portal.gap.html"
  , artifact : "docs.portal/matrix.portal.gap.html"
  , run      : async (ctx) => {
      const { generateGapMatrixHtml } = await import("./matrix.portal.gap.analysis.mjs");

      if (!ctx.report) {
        throw new Error("Step 4 richiede step 1 completato");
      }

      return generateGapMatrixHtml(ctx.report);
    }
  }
];

/**
 * @param {AnalysisStep} step
 * @returns {string}
 */
function formatStepDescribe(step) {
  return [
    `### Step ${step.id} — ${step.name}`
  , `- **Obiettivo:** ${step.goal}`
  , `- **Comando:** \`${step.command}\``
  , `- **Artefatto:** ${step.artifact}`
  , ""
  ].join("\n");
}

/**
 * @param {AnalysisContext} ctx
 * @param {number[]} [onlySteps]
 * @returns {Promise<AnalysisContext>}
 */
export async function runAnalysisProcedure(ctx, onlySteps) {
  const steps = onlySteps?.length
    ? ANALYSIS_STEPS.filter((s) => onlySteps.includes(s.id))
    : ANALYSIS_STEPS;

  for (const step of steps) {
    console.log(`[step ${step.id}] ${step.name}…`);
    await step.run(ctx);
    console.log(`[step ${step.id}] OK → ${step.artifact}`);
  }

  return ctx;
}

const isCliMain = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCliMain) {
  const describe = process.argv.includes("--describe");
  const stepArg  = process.argv.find((a) => a.startsWith("--step="));
  const stepNum  = stepArg ? Number(stepArg.split("=")[1]) : null;

  if (describe) {
    console.log("# Procedura gap analysis PortalAdmin\n");
    console.log("Ordine fisso — ogni step produce input per il successivo.\n");

    for (const step of ANALYSIS_STEPS) {
      console.log(formatStepDescribe(step));
    }

    console.log("## Rigenerazione completa\n");
    console.log("```bash");
    console.log("node docs.portal/matrix.portal.gap.analysis.mjs");
    console.log("```\n");
    process.exit(0);
  }

  const onlySteps = stepNum ? [stepNum] : undefined;

  runAnalysisProcedure({ portalRoot: PORTAL_ROOT }, onlySteps).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
