/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-26 08:40
 * ------------------------------------------------------------------------------------------------------------------------
 * creato il: 2026-06-26 08:40 by: IbyEll
 * modificato il: 2026-06-26 08:40 by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *       Costruzione sezioni matrice gap — finding avanzamento → righe MatrixSection
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - portal-gap-analysis e audit condividono layout matrice adv-card; le sezioni per categoria
 *     devono essere costruite una sola volta dal report avanzamento.
 *
 *   A cosa serve:
 *   - findingToMatrixRow normalizza status e pulsante Crea; buildGapMatrixSections raggruppa per
 *     category; matrixSectionsToMarkdown esporta anteprima testuale.
 *
 * Generalizzazione:
 *   No — categorie e titoli allineati alla pagina Avanzamento PortalAdmin.
 *
 * Input: —
 *
 * Consumatori:
 *   - docs.portal/matrix.portal.gap.analysis.mjs — buildGapMatrixSections, matrixSectionsToMarkdown
 *
 * Export principali:
 *   - findingToMatrixRow — Finding → MatrixRow
 *   - buildGapMatrixSections — report → MatrixSection[]
 *   - matrixSectionsToMarkdown — export markdown tabellare
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { sectionTitleForCategory } from "./matrix.finding.sections.mjs";
import { summarizeMatrixSections } from "./matrix.render.mjs";

/** @typedef {import("./matrix.render.mjs").MatrixRow} MatrixRow */
/** @typedef {import("./matrix.render.mjs").MatrixSection} MatrixSection */

/**
 * @param {{ status: string, severity: string, title: string, detail: string, paths?: string[], id: string, project?: string | null, issueKey?: string | null, issueType?: string | null, issueSummary?: string | null, category?: string, resolvedNote?: string }} f
 * @returns {MatrixRow}
 */
export function findingToMatrixRow(f) {
  /** @type {Record<string, string>} */
  const statusMap = {
    open    : "gap"
  , partial : "parziale"
  , done    : "fatto"
  , fatto   : "fatto"
  };

  let status = statusMap[f.status] ?? f.status;

  if (f.status === "done") {
    const infoAsFatto = ["avanzamento", "architettura", "feature"].includes(f.category ?? "");

    status = f.severity === "info" && !infoAsFatto ? "coperto" : "fatto";
  }

  if (status === "fatto" && f.severity === "info") {
    status = "fatto";
  }

  const isOpen = status === "gap" || status === "parziale";

  return {
    id           : f.id
  , sev          : f.severity
  , status
  , project      : f.project ?? "PortalAdmin"
  , voce         : f.title
  , dettaglio    : f.detail
  , paths        : f.paths ?? []
  , issueKey     : f.issueKey ?? null
  , issueType    : f.issueType ?? null
  , issueSummary : f.issueSummary ?? null
  , category     : f.category ?? null
  , resolvedNote : f.resolvedNote ?? ""
  , create       : isOpen && !f.issueKey
      ? {
          section : sectionTitleForCategory(f.category ?? "gap")
        , summary : f.title
        , detail  : f.detail
        }
      : undefined
  };
}

/**
 * @param {MatrixRow[]} rows
 * @returns {string}
 */
function sectionBadge(rows) {
  const open = rows.filter((r) => r.status === "gap" || r.status === "parziale").length;

  return open > 0 ? `${open} aperti · ${rows.length} voci` : `${rows.length} voci`;
}

/**
 * @param {Awaited<ReturnType<import("../docs.portal/matrix.avanzamento.gap.feature.mjs").analyzePortalAdvancement>>} report
 * @returns {MatrixSection[]}
 */
export function buildGapMatrixSections(report) {
  const byCat = (cat) => report.findings.filter((f) => f.category === cat);

  /** @type {MatrixSection[]} */
  const sections = [
    {
      id    : "arch"
    , title : "Architettura e avanzamento"
    , badge : sectionBadge([...byCat("avanzamento"), ...byCat("architettura")].map(findingToMatrixRow))
    , open  : false
    , rows  : [...byCat("avanzamento"), ...byCat("architettura")].map(findingToMatrixRow)
    }
  , {
      id    : "gap"
    , title : "Gap analysis"
    , badge : sectionBadge(byCat("gap").map(findingToMatrixRow))
    , open  : byCat("gap").some((f) => f.status === "open" || f.status === "partial")
    , rows  : byCat("gap").map(findingToMatrixRow)
    }
  , {
      id    : "bug"
    , title : "Bug"
    , badge : sectionBadge(byCat("bug").map(findingToMatrixRow))
    , open  : byCat("bug").some((f) => f.status === "open")
    , rows  : byCat("bug").map(findingToMatrixRow)
    }
  , {
      id    : "deprecation"
    , title : "Deprecation / drift"
    , badge : sectionBadge(byCat("deprecation").map(findingToMatrixRow))
    , open  : byCat("deprecation").some((f) => f.status === "open")
    , rows  : byCat("deprecation").map(findingToMatrixRow)
    }
  , {
      id    : "feature"
    , title : "Feature completate"
    , badge : sectionBadge(byCat("feature").map(findingToMatrixRow))
    , open  : false
    , rows  : byCat("feature").map(findingToMatrixRow)
    }
  , {
      id    : "miglioramento"
    , title : "Miglioramenti suggeriti"
    , badge : sectionBadge(byCat("miglioramento").map(findingToMatrixRow))
    , open  : byCat("miglioramento").some((f) => f.status === "open")
    , rows  : byCat("miglioramento").map(findingToMatrixRow)
    }
  ];

  return sections.filter((s) => s.rows.length > 0);
}

/**
 * @param {MatrixSection[]} sections
 * @returns {string}
 */
export function matrixSectionsToMarkdown(sections) {
  const lines = ["# Matrice gap PortalAdmin", ""];

  for (const section of sections) {
    lines.push(`## ${section.title}`, "");
    lines.push("| Sev | Voce | Dettaglio | Path | Stato |");
    lines.push("| --- | --- | --- | --- | --- |");

    for (const r of section.rows) {
      const paths = r.paths.join(", ") || "—";

      lines.push(`| ${r.sev} | ${r.voce} | ${r.dettaglio} | ${paths} | ${r.status} |`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Metriche card matrice gap — full render, merge e Aggiorna docs.
 *
 * @param {Awaited<ReturnType<import("./matrix.gap.scan.mjs").analyzePortalAdvancement>>} report
 * @param {MatrixSection[]} sections
 * @returns {{ metrics: { value: string | number, meta: string }[], metricsBadge: string, metricsCardTitle: string }}
 */
export function buildPortalGapMatrixMetrics(report, sections) {
  const m       = report.metrics;
  const summary = summarizeMatrixSections(sections);

  return {
    metrics: [
      { value: `${m.archProgressPct}%`, meta: "Migrazioni architetturali" }
    , { value: `${m.archScore}/${m.archTotal}`, meta: "Target arch. OK" }
    , { value: m.openGaps, meta: "Gap aperti" }
    , { value: m.openBugs, meta: "Bug aperti" }
    , { value: summary.total, meta: "Righe matrice" }
    , { value: m.parkingImports, meta: "Import live PARKING" }
    ]
  , metricsBadge    : `${m.openGaps} gap · ${m.openBugs} bug`
  , metricsCardTitle: "Sintesi avanzamento"
  };
}
