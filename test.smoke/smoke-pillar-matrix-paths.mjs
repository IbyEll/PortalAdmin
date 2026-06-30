#!/usr/bin/env node
/**
 * Smoke — import canonici matrice pilastri post-split PortalAdmin (ADMIN-98).
 */

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { findPillarsForKey } from "../admin.script.standalone/confluence.pillar.matrix.generate.mjs";
import { updatePillarPortalForTicket } from "../admin.script.standalone/pillar-matrix-targeted.mjs";
import { writePillarMatrixPortalFromBundle } from "../cruscotto.frontend/cruscotto.jira.pillar.matrix.portal.generate.mjs";
import { BASE_REPO_SIGNALS_CATALOG_POLICY } from "../admin.portal.JiraCORE/jira.project.config.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const adminPrefixes = BASE_REPO_SIGNALS_CATALOG_POLICY.pathPriority.map((row) => row.prefix);

if (adminPrefixes.some((prefix) => prefix.startsWith("Admin/"))) {
  console.error("FAIL: pathPriority still contains legacy Admin/ prefix", adminPrefixes);
  process.exit(1);
}

for (const rel of [
  "admin.script.standalone/confluence.pillar.matrix.generate.mjs"
, "admin.script.standalone/confluence.pillar.matrix.publish.mjs"
, "admin.script.standalone/pillar-matrix-targeted.mjs"
, "admin.script.standalone/pillar-matrix-diff.mjs"
, "cruscotto.frontend/cruscotto.jira.pillar.matrix.portal.mjs"
, "cruscotto.frontend/cruscotto.jira.pillar.matrix.portal.generate.mjs"
, "cruscotto.frontend/pillar-matrix.js"
]) {
  if (!existsSync(join(ROOT, rel))) {
    console.error(`FAIL: missing canonical pillar file ${rel}`);
    process.exit(1);
  }
}

const adminPillars = findPillarsForKey("ADMIN-98", [{ id: "admin-dev", anchorKeys: ["ADMIN-88"], includeKeys: [] }], [
  { key: "ADMIN-98", parentKey: "ADMIN-73" }
, { key: "ADMIN-73", parentKey: null }
, { key: "ADMIN-88", parentKey: null }
]);

if (adminPillars.length !== 1 || adminPillars[0].id !== "admin-dev") {
  console.error("FAIL: findPillarsForKey should map ADMIN-98 to admin-dev", adminPillars);
  process.exit(1);
}

const dry = await updatePillarPortalForTicket("ADMIN-98", { dryRun: true });

if (!dry.ok || dry.ticketKey !== "ADMIN-98") {
  console.error("FAIL: pillar-matrix-targeted dry-run", dry);
  process.exit(1);
}

if (typeof writePillarMatrixPortalFromBundle !== "function") {
  console.error("FAIL: writePillarMatrixPortalFromBundle not exported");
  process.exit(1);
}

console.log("OK smoke-pillar-matrix-paths");
