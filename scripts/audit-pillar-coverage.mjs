#!/usr/bin/env node
/**
 * Audit copertura pilastri matrice — epic/story/bug/todo non mappati.
 */

import { fetchJiraBacklog, isEpicType, isStoryLikeType } from "../lib/jira/jira.backlog.mjs";
import {
  PRODUCT_PILLARS
, buildOrphansPillar
, computePillarCoveredKeys
} from "./generate-confluence-pillar-matrix.mjs";

const backlog = await fetchJiraBacklog();
const issues  = backlog.issues;

const coveredStatic = computePillarCoveredKeys(PRODUCT_PILLARS, issues);
const orphansPillar = buildOrphansPillar(issues, coveredStatic);
const allPillars    = orphansPillar
  ? [...PRODUCT_PILLARS, orphansPillar]
  : PRODUCT_PILLARS;
const coveredAll    = computePillarCoveredKeys(allPillars, issues);

const topLevel = issues.filter((row) => isEpicType(row.type) || isStoryLikeType(row.type));
const missing  = topLevel.filter((row) => !coveredAll.has(row.key));

/** @type {Record<string, number>} */
const byType = {};

for (const row of missing) {
  byType[row.type] = (byType[row.type] ?? 0) + 1;
}

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

process.exit(missing.length > 0 ? 1 : 0);
