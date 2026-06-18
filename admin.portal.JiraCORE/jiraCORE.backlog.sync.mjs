#!/usr/bin/env node
/**
 * ------------------------------------------------------------------------------------------------------------------------
 * ** SCRIPT ENTRYPOINT ** -- commentato il: 2026-06-18 09:24
 * ------------------------------------------------------------------------------------------------------------------------
 * creato     il: 2026-06-18 09:24   by: IbyEll
 * modificato il: 2026-06-18 09:24   by: IbyEll
 * ------------------------------------------------------------------------------------------------------------------------
 *
 * ************************************************************************************************************************
 *              Sync backlog Jira → SQLite cruscotto.database — migrate schema e fetch API live
 * ************************************************************************************************************************
 *
 * Descrizione funzionale:
 *
 *   Perché esiste:
 *   - Il cruscotto e loadJiraBacklog devono leggere cache locale, non l'API Jira a ogni pagina.
 *   - Centralizza migrate schema + fetch live in un unico comando operativo (CI, dev, seed).
 *
 *   A cosa serve:
 *   - Applica migrate Prisma su cruscotto.db, scarica backlog da Jira, persiste issue/sprint/plan.
 *   - Stampa layout DB, path, conteggio issue e id sync run a fine esecuzione.
 *
 * Generalizzazione:
 *   Si — fetch e devOrder da cruscotto.jira.backlog.mjs (overlay PRJ_NAME); path DB da CRUSCOTTO_DB_PATH.
 *
 * Input:
 *   - JIRA_EMAIL, JIRA_API_TOKEN — credenziali API Atlassian (obbligatorie per fetch)
 *   - JIRA_CLOUD_ID — cloud id workspace (default in fetch backlog se non impostato)
 *   - CRUSCOTTO_DB_PATH — path SQLite; default sotto cruscotto.database/
 *   - PRJ_NAME — overlay product per config Jira e ordine dev (working plan)
 *
 * Uso:
 *   - node admin.portal.JiraCORE/jiraCORE.backlog.sync.mjs
 *
 * Flag CLI:
 *   nessuno — esecuzione diretta migrate + sync
 *
 * Variabili d'ambiente:
 *   JIRA_EMAIL, JIRA_API_TOKEN — credenziali API Atlassian
 *   JIRA_CLOUD_ID              — cloud id Atlassian
 *   CRUSCOTTO_DB_PATH          — override path SQLite cruscotto.db
 *   PRJ_NAME                   — overlay product (es. JustLastOne, AdminDashBoard)
 *
 * npm:
 *   npm run db:sync
 *
 * Prerequisiti:
 *   - .env con credenziali Jira (stesse del cruscotto)
 *   - Node eseguibile; cruscotto.database/migrate.mjs presente
 *
 * Consumatori:
 *   - package.json — script npm db:sync
 *   - PROJECT_AdminDashBoard/config.project.AdminDashBoard.mjs — PRJ_SEED_FUNC
 *   - cruscotto.database/sync-backlog.mjs — syncJiraBacklogFromApi (persist snapshot)
 *
 * ------------------------------------------------------------------------------------------------------------------------
 */

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describeCruscottoDbLayout, resolveCruscottoDbPath } from "../cruscotto.database/index.mjs";
import { syncJiraBacklogFromApi } from "../cruscotto.database/sync-backlog.mjs";

const ROOT    = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATE = join(ROOT, "cruscotto.database", "migrate.mjs");

// 1. Migrate schema — allinea cruscotto.db prima del write
execFileSync(process.execPath, [MIGRATE], { stdio: "inherit", cwd: ROOT });

// 2. Fetch Jira + persist — snapshot in SQLite (sync-backlog.mjs)
const result = await syncJiraBacklogFromApi();

// 3. Report esito — layout, path, conteggi per smoke e operatore
console.log("OK sync-jira-backlog");
console.log(`  layout : ${describeCruscottoDbLayout()}`);
console.log(`  db     : ${resolveCruscottoDbPath()}`);
console.log(`  issues : ${result.issueCount}`);
console.log(`  syncRun: ${result.syncRunId}`);
console.log(`  fetched: ${result.fetchedAt}`);
