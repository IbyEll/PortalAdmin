#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-26 09:15
 * ------------------------------------------------------------------------------------------------------------------------
 * creato il: 2026-06-26 09:15 by: IbyEll
 * modificato il: 2026-06-26 09:15 by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *         Procedura gap analysis PortalAdmin — orchestratore step ANALYSIS_STEPS (CLI)
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - La gap analysis completa è una pipeline in più fasi (scan, sezioni, artefatti, HTML); serve un
 *     entrypoint che documenti e esegua gli step in ordine fisso.
 *
 *   A cosa serve:
 *   - Espone ANALYSIS_STEPS e runAnalysisProcedure; la CLI esegue tutti gli step o uno solo con
 *     --step=N; --describe stampa obiettivo, comando e artefatto per ogni fase.
 *
 * Generalizzazione:
 *   Si — portalRoot nel contesto AnalysisContext; onlySteps filtra quali step eseguire.
 *
 * Input (obbligatorio se Si; se No scrivere «Input: —»):
 *   - argv --describe — stampa procedura su stdout ed exit 0
 *   - argv --step=N — esegue solo lo step N (es. --step=3)
 *   - ctx.portalRoot — root checkout PortalAdmin per analyzePortalAdvancement
 *
 * Uso:
 *   - node docs.portal.lib/matrix.portal.gap.analysis.procedure.mjs
 *   - node docs.portal.lib/matrix.portal.gap.analysis.procedure.mjs --describe
 *   - node docs.portal.lib/matrix.portal.gap.analysis.procedure.mjs --step=3
 *
 * Flag CLI:
 *   --describe     elenco step, obiettivi e artefatti — exit 0
 *   --step=N       esegue solo lo step N (1–4)
 *
 * Consumatori:
 *   - docs.portal.lib/matrix.portal.gap.analysis.mjs — runFullGapAnalysis chiama runAnalysisProcedure
 *
 * Export principali:
 *   - ANALYSIS_STEPS — definizione step con run async
 *   - runAnalysisProcedure — loop step su AnalysisContext condiviso
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import { analyzePortalAdvancement } from "../docs.portal.lib/matrix.avanzamento.gap.feature.mjs";

const PORTAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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

/**
 * Step procedura gap analysis — ordine fisso 1→4; ogni run aggiorna AnalysisContext.
 *
 * @type {AnalysisStep[]}
 */
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

      const { buildGapMatrixSections } = await import("../docs.portal.lib/docs.portal.gap.matrix.mjs");

      return buildGapMatrixSections(ctx.report);
    }
  }
, {
    id       : 3
  , name     : "Export matrice JSON + Markdown"
  , goal     : "Serializzare dati strutturati per diff e review offline."
  , command  : "writeGapMatrixArtifacts(sections, report)"
  , artifact : "portal-gap-matrix.json · portal-gap-matrix.md"
  , run      : async (ctx) => {
      const { writeGapMatrixArtifacts } = await import("./portal-gap-analysis.mjs");

      if (!ctx.report) {
        throw new Error("Step 3 richiede step 1 completato");
      }

      const { buildGapMatrixSections } = await import("../docs.portal.lib/docs.portal.gap.matrix.mjs");
      const sections                   = buildGapMatrixSections(ctx.report);

      return writeGapMatrixArtifacts(sections, ctx.report);
    }
  }
, {
    id       : 4
  , name     : "Generazione pagina HTML documenti"
  , goal     : "Render adv-card + Issue refirement con  matrix.render (layout test-coverage)."
  , command  : "renderMatrixPage(config) →  matrix.portal.gap.html"
  , artifact : "docs.portal/matrix.portal.gap..html"
  , run      : async (ctx) => {
      const { generateGapMatrixHtml } = await import("../docs.portal.lib/matrix.portal.gap.analysis.mjs");

      if (!ctx.report) {
        throw new Error("Step 4 richiede step 1 completato");
      }

      return generateGapMatrixHtml(ctx.report);
    }
  }
];

/**
 * Formatta un singolo step per output --describe (markdown su stdout).
 *
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
 * Esegue la procedura gap analysis — ogni step aggiorna ctx (report da step 1).
 *
 * @param {AnalysisContext} ctx
 * @param {number[]} [onlySteps]
 * @returns {Promise<AnalysisContext>}
 */
export async function runAnalysisProcedure(ctx, onlySteps) {
  // 1. Filtra step — onlySteps opzionale restringe il sottoinsieme
  const steps = onlySteps?.length
    ? ANALYSIS_STEPS.filter((s) => onlySteps.includes(s.id))
    : ANALYSIS_STEPS;

  // 2. Esecuzione sequenziale — log artefatto; step.run muta ctx condiviso
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
  // 1. Flag CLI — --describe stampa guida procedura ed exit 0
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
    console.log("node docs.portal.lib/matrix.portal.gap.analysis.mjs");
    console.log("```\n");
    process.exit(0);
  }

  // 2. Esecuzione — tutti gli step o solo --step=N; exitCode 1 su errore
  const onlySteps = stepNum ? [stepNum] : undefined;

  runAnalysisProcedure({ portalRoot: PORTAL_ROOT }, onlySteps).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
