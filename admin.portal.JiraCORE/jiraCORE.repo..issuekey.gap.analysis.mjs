#!/usr/bin/env node
/**
 * ** SCRIPT ENTRYPOINT **
 * CLI gap analysis — confronta Jira key (parent/subtask) con il repo locale.
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Il workflow veve, procedi Step 0 e chiudi gap test richiedono uno Stato repo
 *     ripetibile senza aprire Jira a mano per ogni subtask.
 *   - Centralizza l'invocazione di jira/JiraCORE/JiraCORE.repo.issuekey.signal.analysis.mjs da terminale e da CI.
 *
 *   A cosa serve:
 *   - Espande un parent in figli (backlog Jira), ordina le subtask, ispeziona segnali
 *     nel product repo e in PortalAdmin, restituisce JSON o markdown per agente/umano.
 *
 * Uso:
 *   - node JiraCORE/jira.repo.analysis..analyze.keys.mjs --parent JLO-507
 *   - node JiraCORE/jira.repo.analysis..analyze.keys.mjs --keys JLO-524,JLO-525
 *   - node JiraCORE/jira.repo.analysis..analyze.keys.mjs --key JLO-507 --format md
 *
 * Flag CLI:
 *   --parent KEY   parent Story/Bug/Todo — espande figli dal backlog Jira
 *   --keys K1,K2   elenco key esplicito (JLO-xxx o ADMIN-xxx)
 *   --key KEY      singola key (combinabile con --keys)
 *   --format F     json (default) | md — markdown per veve e chat agente
 *
 * Variabili d'ambiente (solo con --parent, fetch backlog):
 *   JIRA_EMAIL, JIRA_API_TOKEN, JIRA_CLOUD_ID — credenziali API Atlassian
 *
 * Prerequisiti:
 *   - PRODUCT_REPO_PATH (o default ../JustLastOne) per scan codice JLO
 *   - Con --parent: backlog Jira raggiungibile (stesse env del cruscotto)
 *
 * Consumatori:
 *   - .cursor/skills/jlo-analizza-repo/SKILL.md — gap analysis veve / procedi / chiudi
 *   - .cursor/rules/ADMIN-AnalizzaRepo.mdc — regola canonica analizza repo
 *   - .github/workflows/portal-smoke.yml — smoke --parent ADMIN-88 --format md
 */

import { fetchJiraBacklog, isStoryLikeType } from "../cruscotto.frontend/cruscotto.jira.backlog.mjs";
import {
  analyzeIssueKeys
, formatRepoAnalysisMarkdown
, suggestSubtaskOrder
} from "./JiraCORE.repo.issuekey.signal.analysis.mjs";

/**
 * Normalizza una key JLO-xxx o ADMIN-xxx.
 *
 * @param {string} raw
 * @returns {string}
 */
function normalizeIssueKey(raw) {
  const m = String(raw).trim().toUpperCase().match(/^(JLO|ADMIN)-\d+$/);

  if (!m) {
    throw new Error(`Key non valida: ${raw} — attese JLO-xxx o ADMIN-xxx`);
  }

  return m[0];
}

/**
 * Parsa argv CLI in parent, keys, format.
 *
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ parent?: string, keys: string[], key?: string, format: "json" | "md" }} */
  const out = { keys: [], format: "json" };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "--parent" && argv[i + 1]) {
      out.parent = normalizeIssueKey(argv[++i]);
      continue;
    }

    if (arg === "--keys" && argv[i + 1]) {
      out.keys = argv[++i].split(",").map((k) => normalizeIssueKey(k.trim())).filter(Boolean);
      continue;
    }

    if (arg === "--key" && argv[i + 1]) {
      out.key = normalizeIssueKey(argv[++i]);
      continue;
    }

    if (arg === "--format" && argv[i + 1]) {
      const f = argv[++i];

      if (f === "md" || f === "json") {
        out.format = f;
      }
    }
  }

  return out;
}

/**
 * Risolve parent + subtask dal backlog Jira e suggerisce ordine tecnico.
 *
 * @param {string} parentKey
 */
async function keysForParent(parentKey) {
  const backlog = await fetchJiraBacklog();
  const issues  = backlog.issues ?? [];
  const parent  = issues.find((row) => row.key === parentKey);

  if (!parent) {
    throw new Error(`Key non trovata nel backlog: ${parentKey}`);
  }

  const children = issues.filter((row) => row.parentKey === parentKey);
  const keys     = [parentKey, ...children.map((row) => row.key)];

  /** @type {Record<string, string>} */
  const jiraStatusByKey = {};

  for (const row of [parent, ...children]) {
    jiraStatusByKey[row.key] = row.status;
  }

  const subtaskOrder = suggestSubtaskOrder(
    children.map((row) => ({ key: row.key, summary: row.summary }))
  );

  return {
    keys
  , jiraStatusByKey
  , subtaskOrder
  , subtasks: children.map((row) => ({
      key     : row.key
    , summary : row.summary
    , status  : row.status
    , type    : row.type
    , storyLike: isStoryLikeType(row.type)
    }))
  };
}

async function main() {
  // 1. Parse argv — parent, keys esplicite, formato output
  const args = parseArgs(process.argv.slice(2));

  // 2. Validazione — almeno una sorgente key obbligatoria
  if (!args.parent && args.keys.length === 0 && !args.key) {
    console.error(
      "Uso: JiraCORE/jira.repo.analysis..analyze.keys.mjs --parent JLO-xxx|ADMIN-xxx | --keys K1,K2 | --key K [--format json|md]"
    );
    process.exit(1);
  }

  /** @type {string[]} */
  let keys = args.keys;

  if (args.key) {
    keys = [args.key, ...keys];
  }

  /** @type {Record<string, string>} */
  let jiraStatusByKey = {};
  /** @type {string[] | undefined} */
  let subtaskOrder;
  /** @type {string | undefined} */
  let parentKey = args.parent;

  // 3. Espansione parent — backlog Jira, stati, ordine subtask
  if (args.parent) {
    const parentCtx = await keysForParent(args.parent);
    keys              = parentCtx.keys;
    jiraStatusByKey   = parentCtx.jiraStatusByKey;
    subtaskOrder      = parentCtx.subtaskOrder;
  }

  // 4. Analisi repo — segnali implementazione vs codice locale
  const report = analyzeIssueKeys(keys, { jiraStatusByKey });

  // 5. Output — markdown per agente/veve oppure JSON strutturato
  if (args.format === "md") {
    process.stdout.write(
      formatRepoAnalysisMarkdown(report, { parentKey, subtaskOrder })
    );

    return;
  }

  console.log(JSON.stringify({
    ok           : true
  , parentKey
  , subtaskOrder
  , ...report
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
