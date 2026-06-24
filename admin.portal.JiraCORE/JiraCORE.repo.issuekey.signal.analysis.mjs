/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** LIBRARY MODULE ** -- commentato il: 2026-06-18 21:32
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 03:36   by: IbyEll
 * modificato il: 2026-06-18 21:32   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                      Analisi repo centralizzata — confronto Jira key vs codice e catalogo segnali.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Veve, procedi Step 0, chiudi gap test e CLI richiedono uno Stato repo ripetibile
 *     (✅/⚠️/❌) senza duplicare scan git e inspect backlog in ogni script.
 *   - Unifica aree ispezionate, ordine subtask e formattazione markdown per agente e umano.
 *
 *   A cosa serve:
 *   - Per ogni key: scan citazioni repo, segnale catalogo, allineamento Jira Fatto vs codice.
 *   - analyzeIssueKeys + formatRepoAnalysisMarkdown per output CLI; suggestSubtaskOrder per piano parent.
 *
 * Generalizzazione:
 *   Si — key JLO/ADMIN arbitrarie; scan repo da PRODUCT_REPO_PATH; segnali da overlay PRJ_NAME.
 *
 * Input:
 *   - keys — elenco IssueKEY passato da consumer (CLI --parent/--keys, veve)
 *   - opts.repoRefs — Map scan opzionale; default scanRepoJiraReferences su PRODUCT_REPO_PATH
 *   - opts.jiraStatusByKey — stati Jira per allineamento Fatto vs codice
 *
 * Consumatori:
 *   - admin.portal.JiraCORE/jiraCORE.repo.issuekey.gap.analysis.mjs — CLI --parent / --keys
 *   - jira.function.repo.refs.mjs — scanRepoJiraReferences (re-export)
 *   - Regole/skills jlo-analizza-repo, ADMIN-AnalizzaRepo, veve step 2
 *
 * Export principali:
 *   - REPO_ANALYSIS_AREAS — aree path per agente (schema, api, web, …)
 *   - TECHNICAL_LAYER_ORDER — ordine layer consigliato subtask
 *   - analyzeIssueKeys / analyzeIssueRepo — esito per key
 *   - suggestSubtaskOrder — ordinamento da summary subtask
 *   - formatRepoAnalysisMarkdown — report md per chat/CI
 *   - esitoSymbol, inspectToEsito — mapping inspect → ✅/⚠️/❌
 *   - Re-export: assessIssueRepoInspect, inspectRepoSignal, scanRepoJiraReferences, …
 */

import { isJiraStatusDone } from "../cruscotto.frontend/cruscotto.jira.backlog.mjs";
import {
  assessIssueRepoInspect
, buildRepoAlignMap
, inspectRepoSignal
, REPO_IMPLEMENTATION_SIGNALS
} from "../cruscotto.frontend/cruscotto.jira.backlog.insights.mjs";
import { scanRepoJiraReferences } from "./jira.function.repo.refs.mjs";

/** @typedef {"ok" | "partial" | "absent"} RepoEsito */

/**
 * Aree ispezionate — riferimento agente e documentazione gap analysis.
 *
 * @type {Array<{ id: string, label: string, paths: string[] }>}
 */
export const REPO_ANALYSIS_AREAS = [
  {
    id    : "schema"
  , label : "Schema"
  , paths : ["packages/database/prisma/schema.prisma"]
  }
, {
    id    : "api"
  , label : "API"
  , paths : ["apps/api/src/"]
  }
, {
    id    : "web"
  , label : "Web"
  , paths : ["apps/web/src/"]
  }
, {
    id    : "shared"
  , label : "Shared / i18n"
  , paths : ["packages/shared/", "packages/i18n/"]
  }
, {
    id    : "admin"
  , label : "Admin / cruscotto"
  , paths : ["lib/", "cruscotto.frontend/", "scripts/"]
  }
, {
    id    : "test"
  , label : "Test"
  , paths : ["testScript/"]
  }
, {
    id    : "catalog"
  , label : "Catalogo segnali"
  , paths : ["portal.config.mjs", "lib/repo.implementation.signals.catalog.mjs"]
  }
, {
    id    : "backlog-doc"
  , label : "Backlog ordine"
  , paths : ["docs/backlog-ordine-sviluppo.html"]
  }
];

/** Ordine tecnico consigliato per subtask (schema → … → manuale). */
export const TECHNICAL_LAYER_ORDER = [
  "schema"
, "shared"
, "api"
, "web"
, "i18n"
, "admin"
, "test"
, "manual"
];

/**
 * Simbolo markdown da esito repo.
 *
 * @param {RepoEsito} esito
 * @returns {string}
 */
export function esitoSymbol(esito) {
  if (esito === "ok") {
    return "✅";
  }

  if (esito === "partial") {
    return "⚠️";
  }

  return "❌";
}

/**
 * Mappa risultato inspect backlog → ok | partial | absent.
 *
 * @param {ReturnType<typeof assessIssueRepoInspect>} inspect
 * @returns {RepoEsito}
 */
export function inspectToEsito(inspect) {
  if (!inspect) {
    return "absent";
  }

  if (inspect.metaOnly) {
    return "partial";
  }

  if (inspect.complete && inspect.found > 0) {
    return "ok";
  }

  if (inspect.found > 0) {
    return "partial";
  }

  return "absent";
}

/**
 * Analisi singola key — inspect + segnale catalogo + gap testuale.
 *
 * @param {string} key
 * @param {Map<string, string[]>} repoRefs
 * @param {{ jiraDone?: boolean }} [opts]
 */
export function analyzeIssueRepo(key, repoRefs, opts = {}) {
  // 1. Inspect backlog + segnale catalogo — esito ok/partial/absent e path trovati
  const inspect = assessIssueRepoInspect(key, repoRefs);
  const signal  = inspectRepoSignal(key, repoRefs);
  const esito   = inspectToEsito(inspect);
  const paths   = signal?.scan.found ?? signal?.signal.paths ?? [];

  /** @type {"aligned" | "gap" | null} */
  let align = null;

  if (opts.jiraDone !== undefined) {
    const alignMap = buildRepoAlignMap(
      [{
        key    : key
      , type   : "Task"
      , status : opts.jiraDone ? "Fatto" : "Da fare"
      }]
    , repoRefs
    );

    align = alignMap[key] ?? null;
  }

  return {
    key
  , esito
  , symbol     : esitoSymbol(esito)
  , paths      : paths.slice(0, 8)
  , metaOnly   : Boolean(inspect?.metaOnly)
  , align
  , gap        : esito === "absent"
      ? "Nessun path prodotto citato nel repo"
      : inspect?.metaOnly
        ? "Solo meta/cruscotto — nessun path prodotto"
        : null
  , signalLabel: signal?.signal.label ?? null
  };
}

/**
 * Batch analisi — scan repo opzionale, stati Jira per allineamento Fatto/codice.
 *
 * @param {string[]} keys
 * @param {{
 *   repoRefs?       : Map<string, string[]>
 *   jiraStatusByKey?: Record<string, string>
 * }} [opts]
 */
export function analyzeIssueKeys(keys, opts = {}) {
  // 1. Scan repo (o cache) — batch analyzeIssueRepo per ogni key unica
  const repoRefs = opts.repoRefs ?? scanRepoJiraReferences();
  const unique   = [...new Set(keys.filter(Boolean))];

  /** @type {ReturnType<typeof analyzeIssueRepo>[]} */
  const issues = unique.map((key) => {
    const status   = opts.jiraStatusByKey?.[key];
    const jiraDone = status !== undefined ? isJiraStatusDone(status) : undefined;

    return analyzeIssueRepo(key, repoRefs, { jiraDone });
  });

  return {
    analyzedAt : new Date().toISOString()
  , areas      : REPO_ANALYSIS_AREAS
  , issues
  , repoRefsScanned: repoRefs.size
  };
}

/**
 * Ordine subtask da summary — heuristica layer tecnico (schema → api → web → test).
 *
 * @param {Array<{ key: string, summary?: string }>} subtasks
 * @returns {string[]}
 */
export function suggestSubtaskOrder(subtasks) {
  /**
   * @param {string} summary
   * @returns {number}
   */
  function layerRank(summary) {
    const s = (summary ?? "").toLowerCase();

    if (/schema|prisma|migrat|sqlite|database/.test(s)) {
      return 0;
    }

    if (/shared|package/.test(s)) {
      return 1;
    }

    if (/api|backend|endpoint|nestjs/.test(s)) {
      return 2;
    }

    if (/web|ui|component|page|frontend|react/.test(s)) {
      return 3;
    }

    if (/i18n|locale|traduz/.test(s)) {
      return 4;
    }

    if (/admin|cruscotto|dashboard/.test(s)) {
      return 5;
    }

    if (/testscript|test-/.test(s)) {
      return 6;
    }

    if (/verifica manuale|manual/.test(s)) {
      return 7;
    }

    return 50;
  }

  return [...subtasks]
    .sort((a, b) => {
      const ra = layerRank(a.summary);
      const rb = layerRank(b.summary);

      if (ra !== rb) {
        return ra - rb;
      }

      return a.key.localeCompare(b.key, undefined, { numeric: true });
    })
    .map((row) => row.key);
}

/**
 * Report markdown — tabella issue vs repo + ordine subtask opzionale.
 *
 * @param {ReturnType<typeof analyzeIssueKeys>} report
 * @param {{ parentKey?: string, subtaskOrder?: string[] }} [opts]
 * @returns {string}
 */
export function formatRepoAnalysisMarkdown(report, opts = {}) {
  const lines = [
    `# Analisi repo${opts.parentKey ? ` — ${opts.parentKey}` : ""}`
  , ""
  , `Analizzato: ${report.analyzedAt} · ${report.issues.length} key · scan ${report.repoRefsScanned} key nel repo`
  , ""
  , "## Issue vs repo"
  , ""
  , "| Key | Esito | Path | Gap |"
  , "| --- | --- | --- | --- |"
  ];

  for (const row of report.issues) {
    const pathCell = row.paths.length > 0
      ? row.paths.slice(0, 3).map((p) => `\`${p}\``).join(", ")
      : "—";

    lines.push(
      `| ${row.key} | ${row.symbol} | ${pathCell} | ${row.gap ?? "—"} |`
    );
  }

  if (opts.subtaskOrder?.length) {
    lines.push(
      ""
    , "## Ordine subtask consigliato"
    , ""
    , opts.subtaskOrder.map((key, i) => `${i + 1}. ${key}`).join("\n")
    );
  }

  lines.push(
    ""
  , "## Aree repo (riferimento agente)"
  , ""
  , "| Area | Path |"
  , "| --- | --- |"
  );

  for (const area of REPO_ANALYSIS_AREAS) {
    lines.push(`| ${area.label} | ${area.paths.map((p) => `\`${p}\``).join(", ")} |`);
  }

  return lines.join("\n");
}

export {
  REPO_IMPLEMENTATION_SIGNALS
, assessIssueRepoInspect
, buildRepoAlignMap
, inspectRepoSignal
, scanRepoJiraReferences
};
