#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-18 03:36
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 03:36   by: IbyEll
 * modificato il: 2026-06-18 03:36   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *                     Audit copertura pilastri — epic/story/bug/todo top-level non mappati in matrice.
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - La matrice pilastri (Confluence / cruscotto pillar-matrix) mappa anchorKeys e includeKeys;
 *     serve un controllo automatico che nessun ticket radice resti fuori dai pilastri noti.
 *   - Il pilastro «orfani» sintetico non basta se mancano ancora root non coperte — exit code per CI.
 *
 *   A cosa serve:
 *   - Scarica backlog Jira, calcola copertura statica + orfani, elenca key mancanti in JSON.
 *   - Exit 0 se tutto coperto, exit 1 se restano top-level issue fuori mappa (per grooming matrice).
 *
 * Generalizzazione:
 *   No — script dedicato all'audit pillar matrix JustLastOne (PRODUCT_PILLARS statici in generate).
 *
 * Input:
 *   - JIRA_EMAIL, JIRA_API_TOKEN, JIRA_CLOUD_ID — credenziali fetch backlog Jira Cloud
 *
 * Uso:
 *   - node cruscotto.frontend/jira/cruscotto.jira.pillar.matrix.audit.coverage.mjs
 *
 * Flag CLI:
 *   nessuno — nessun argomento
 *
 * Variabili d'ambiente:
 *   JIRA_EMAIL, JIRA_API_TOKEN, JIRA_CLOUD_ID — fetch backlog (come cruscotto)
 *
 * Prerequisiti:
 *   - scripts/confluence.pillar.matrix.generate.mjs — PRODUCT_PILLARS, buildOrphansPillar
 *   - Backlog Jira raggiungibile
 *
 * Consumatori:
 *   - Grooming matrice pilastri prima di publish Confluence / rigenera pillar-matrix HTML
 *   - CI opzionale — fallisce se compare nuova epic/story senza anchor in generate script
 */

import { fetchJiraBacklog, isEpicType, isStoryLikeType } from "../cruscotto.frontend/cruscotto.jira.backlog.mjs";
import {
  PRODUCT_PILLARS
, buildOrphansPillar
, computePillarCoveredKeys
} from "./confluence.pillar.matrix.generate.mjs";

// 1. Fetch backlog — issue complete per calcolo copertura
const backlog = await fetchJiraBacklog();
const issues  = backlog.issues;

// 2. Pilastri statici + sintetico orfani — stessa logica di generate pillar matrix
const coveredStatic = computePillarCoveredKeys(PRODUCT_PILLARS, issues);
const orphansPillar = buildOrphansPillar(issues, coveredStatic);
const allPillars    = orphansPillar
  ? [...PRODUCT_PILLARS, orphansPillar]
  : PRODUCT_PILLARS;
const coveredAll    = computePillarCoveredKeys(allPillars, issues);

// 3. Gap top-level — epic e story-like non in nessun pilastro
const topLevel = issues.filter((row) => isEpicType(row.type) || isStoryLikeType(row.type));
const missing  = topLevel.filter((row) => !coveredAll.has(row.key));

/** @type {Record<string, number>} */
const byType = {};

for (const row of missing) {
  byType[row.type] = (byType[row.type] ?? 0) + 1;
}

// 4. Report JSON — conteggi e elenco key da aggiungere ad anchorKeys/includeKeys
console.log(JSON.stringify({
  backlogTotal : backlog.total
, topLevel     : topLevel.length
, staticPillars: PRODUCT_PILLARS.length
, orphanRoots  : orphansPillar?.anchorKeys.length ?? 0
, covered      : coveredAll.size
, missing      : missing.length
, byType
, missingKeys  : missing
    .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
    .map((row) => ({
      key       : row.key
    , type      : row.type
    , summary   : row.summary
    , parentKey : row.parentKey
    , status    : row.status
    }))
}, null, 2));

// 5. Exit code — 1 se restano gap (CI / pre-publish)
process.exit(missing.length > 0 ? 1 : 0);
