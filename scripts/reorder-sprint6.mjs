#!/usr/bin/env node
/**
 * Riordina le story root sul board Sprint 6 — Chat & Gamebook.
 * Ordine: Fase 0 → 1 → 2 → 3 → 4, poi obsoleti + epic rumore.
 *
 * Uso: node scripts/reorder-sprint6.mjs
 * Dry-run: node scripts/reorder-sprint6.mjs --dry-run
 */

import "../lib/load-env.mjs";
import {
  sprint6BoardStoryRankKeys
, sprint6BoardTailKeys
} from "../lib/jira/jira.working.order.mjs";

const BOARD_ID = Number(process.env.JIRA_BOARD_ID ?? 68);
const CLOUD_ID = process.env.JIRA_CLOUD_ID ?? "3caddd74-469e-4ca3-adf8-926f79c98e7c";
const API_BASE = `https://api.atlassian.com/ex/jira/${CLOUD_ID}`;
const SPRINT_NAME = "Sprint 6 — Chat & Gamebook";
const DRY_RUN = process.argv.includes("--dry-run");

function authHeader() {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!email || !token) {
    console.error("Mancano JIRA_EMAIL e/o JIRA_API_TOKEN in .env");
    process.exit(1);
  }

  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

/**
 * @param {string} path
 * @param {RequestInit} init
 */
async function jiraFetch(path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept        : "application/json"
    , "Content-Type": "application/json"
    , Authorization : authHeader()
    , ...(init.headers ?? {})
    },
  });

  const text = await res.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${text}`);
  }

  return body;
}

/**
 * @returns {Promise<{ id: number, name: string } | null>}
 */
async function findSprint() {
  const data = await jiraFetch(
    `/rest/agile/1.0/board/${BOARD_ID}/sprint?state=active,future,closed&maxResults=100`
  );

  return (data.values ?? []).find((row) => row.name === SPRINT_NAME) ?? null;
}

/**
 * @param {string[]} issues
 * @param {{ rankAfterIssue?: string, rankBeforeIssue?: string }} rank
 */
async function rankIssues(issues, rank) {
  if (DRY_RUN) {
    console.log(`[dry-run] rank ${issues.join(", ")}`, rank);
    return;
  }

  await jiraFetch("/rest/agile/1.0/issue/rank", {
    method : "PUT"
  , body   : JSON.stringify({
      issues
    , ...rank
    })
  });
}

async function main() {
  const sprint = await findSprint();

  if (!sprint) {
    throw new Error(`Sprint non trovato: ${SPRINT_NAME}`);
  }

  const order = [
    ...sprint6BoardStoryRankKeys()
  , ...sprint6BoardTailKeys()
  ];

  console.log(`Sprint ${sprint.name} (id ${sprint.id})`);
  console.log(`Ordine target (${order.length} story/epic):\n  ${order.join(" → ")}\n`);

  for (let i = 1; i < order.length; i += 1) {
    await rankIssues([order[i]], { rankAfterIssue: order[i - 1] });
    console.log(`✓ ${order[i - 1]} ← ${order[i]}`);
  }

  console.log("\nFatto.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
