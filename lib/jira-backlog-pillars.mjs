/**
 * Vista backlog per pilastro prodotto — stesso mapping di generate-confluence-pillar-matrix.mjs.
 */

import { isEpicType } from "./jira-backlog.mjs";
import {
  PRODUCT_PILLARS
, buildOrphansPillar
, computePillarCoveredKeys
, keysForPillar
, keysForPillarTreeOrder
} from "../scripts/generate-confluence-pillar-matrix.mjs";

export const PILLAR_HEADER_PREFIX = "__pillar__";
const PORTAL_BASE = "/pillar-matrix";

/**
 * @param {string} pillarId
 * @param {string} key
 */
export function pillarTreeKey(pillarId, key) {
  return `${key}@pillar:${pillarId}`;
}

/**
 * @param {Array<{ key: string, parentKey?: string | null, jiraParentKey?: string | null, type?: string, tier?: string, isStoryLike?: boolean, summary?: string, status?: string, devOrder?: string | null, devSprint?: number | null, devSprintName?: string | null, devSort?: number | null, jiraSprints?: Array<{ id: number, name: string, state: string }>, relatedKeys?: string[], isSprint6Obsolete?: boolean }>} flatIssues
 * @returns {Array<{ key: string, parentKey?: string | null, type?: string }>}
 */
function pillarIssueIndex(flatIssues) {
  return flatIssues.map((row) => ({
    key       : row.key
  , parentKey : row.jiraParentKey ?? row.parentKey ?? null
  , type      : row.type
  }));
}

/**
 * @param {Array<{ key: string, parentKey?: string | null }>} issues
 * @param {string} key
 * @returns {{ key: string, summary: string } | null}
 */
function findEpicInfo(flatIssues, key) {
  const byKey = new Map(flatIssues.map((row) => [row.key, row]));
  let current = byKey.get(key);

  while (current) {
    if (isEpicType(current.type ?? "")) {
      return { key: current.key, summary: current.summary ?? "" };
    }

    const parentKey = current.jiraParentKey ?? current.parentKey ?? null;
    current = parentKey ? byKey.get(parentKey) ?? null : null;
  }

  return null;
}

/**
 * @param {string} key
 * @param {Set<string>} keysSet
 * @param {Map<string, { parentKey?: string | null }>} byKey
 */
function parentKeyInPillar(key, keysSet, byKey) {
  let current = byKey.get(key);

  while (current?.parentKey) {
    if (keysSet.has(current.parentKey)) {
      return current.parentKey;
    }

    current = byKey.get(current.parentKey) ?? null;
  }

  return null;
}

/**
 * @param {string} key
 * @param {Set<string>} keysSet
 * @param {Map<string, { parentKey?: string | null }>} byKey
 */
function depthInPillar(key, keysSet, byKey) {
  let depth   = 0;
  let current = byKey.get(key);

  while (current?.parentKey && keysSet.has(current.parentKey)) {
    depth += 1;
    current = byKey.get(current.parentKey) ?? null;
  }

  return depth;
}

/**
 * @param {string} key
 * @param {Set<string>} keysSet
 * @param {Array<{ key: string, parentKey?: string | null }>} issues
 */
function hasChildrenInPillar(key, keysSet, issues) {
  return issues.some((row) => row.parentKey === key && keysSet.has(row.key));
}

/**
 * @param {typeof flatIssues} flatIssues
 */
export function buildBacklogPillarTree(flatIssues) {
  const indexIssues = pillarIssueIndex(flatIssues);
  const byKey       = new Map(flatIssues.map((row) => [row.key, row]));
  const byIndex     = new Map(indexIssues.map((row) => [row.key, row]));
  const coveredStatic = computePillarCoveredKeys(PRODUCT_PILLARS, indexIssues);
  const orphansPillar = buildOrphansPillar(indexIssues, coveredStatic);
  const allPillars    = orphansPillar
    ? [...PRODUCT_PILLARS, orphansPillar]
    : PRODUCT_PILLARS;

  /** @type {typeof flatIssues} */
  const flat = [];

  for (let pillarOrder = 0; pillarOrder < allPillars.length; pillarOrder += 1) {
    const pillar    = allPillars[pillarOrder];
    const keysSet   = new Set(keysForPillar(pillar, indexIssues));
    const ordered   = keysForPillarTreeOrder(pillar, indexIssues);

    if (ordered.length === 0) {
      continue;
    }

    const headerKey = `${PILLAR_HEADER_PREFIX}${pillar.id}`;

    flat.push({
      key             : headerKey
    , treeKey         : headerKey
    , type            : "Pilastro"
    , tier            : "pillar"
    , summary         : pillar.pillar
    , status          : "—"
    , parentKey       : null
    , jiraParentKey   : null
    , depth           : 0
    , hasChildren     : true
    , devOrder        : String(pillarOrder + 1)
    , devSprint       : null
    , devSprintName   : null
    , devSort         : pillarOrder
    , isSynthetic     : true
    , pillarId        : pillar.id
    , pillarPortalUrl : `${PORTAL_BASE}/${pillar.id}.html`
    , pillarIssueCount: ordered.length
    });

    for (const key of ordered) {
      const src = byKey.get(key);

      if (!src) {
        continue;
      }

      const epicInfo    = findEpicInfo(flatIssues, key);
      const epicRow     = epicInfo ? byKey.get(epicInfo.key) : null;
      const parentInPillar = parentKeyInPillar(key, keysSet, byIndex) ?? headerKey;
      const treeDepth      = depthInPillar(key, keysSet, byIndex);
      const issueTreeKey   = pillarTreeKey(pillar.id, key);
      const parentTreeKey  = parentInPillar === headerKey
        ? headerKey
        : pillarTreeKey(pillar.id, parentInPillar);

      flat.push({
        key             : src.key
      , treeKey         : issueTreeKey
      , type            : src.type
      , tier            : src.tier ?? "task"
      , isStoryLike     : src.isStoryLike
      , summary         : src.summary
      , status          : src.status
      , parentKey       : parentTreeKey
      , jiraParentKey   : src.jiraParentKey ?? src.parentKey ?? null
      , depth           : treeDepth + 1
      , hasChildren     : hasChildrenInPillar(key, keysSet, indexIssues)
      , devOrder        : src.devOrder ?? null
      , devSprint       : src.devSprint ?? null
      , devSprintName   : src.devSprintName ?? null
      , devSort         : src.devSort ?? null
      , jiraSprints     : src.jiraSprints ?? []
      , relatedKeys     : src.relatedKeys ?? []
      , isSprint6Obsolete: src.isSprint6Obsolete ?? false
      , epicKey         : epicInfo?.key ?? null
      , epicSummary     : epicRow?.summary ?? null
      , pillarId        : pillar.id
      });
    }
  }

  return flat;
}

export { PRODUCT_PILLARS };
